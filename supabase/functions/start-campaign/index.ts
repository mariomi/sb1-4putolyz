// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE ASINCRONA CON RISPOSTA IMMEDIATA E PROCESSAMENTO IN BACKGROUND

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

interface EmailQueueEntry {
  campaign_id: string;
  contact_id: string;
  sender_id: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  scheduled_for: string;
  retry_count: number;
  email_data: {
    to: string;
    from: string;
    subject: string;
    html: string;
  };
}

interface CampaignData {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  start_date: string;
  end_date: string;
}

interface ContactData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface SenderData {
  id: string;
  email_from: string;
  display_name?: string;
}

/**
 * Funzione per inviare email tramite Resend
 */
async function sendEmailViaResend(emailData: any): Promise<boolean> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY non configurata');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Errore Resend:', errorData);
      return false;
    }

    const result = await response.json();
    console.log('✅ Email inviata con successo:', result.id);
    return true;
  } catch (error) {
    console.error('❌ Errore nell\'invio email:', error);
    return false;
  }
}

/**
 * Processa le email in background
 */
async function processEmailsInBackground(
  supabase: SupabaseClient,
  campaignId: string,
  queueEntries: EmailQueueEntry[]
): Promise<void> {
  console.log(`🔄 Avvio processamento background per ${queueEntries.length} email`);
  
  // Processa le email in batch di 10 per volta
  const batchSize = 10;
  for (let i = 0; i < queueEntries.length; i += batchSize) {
    const batch = queueEntries.slice(i, i + batchSize);
    
    // Processa il batch in parallelo
    const promises = batch.map(async (entry) => {
      try {
        // Aggiorna lo status a 'sending'
        await supabase
          .from('campaign_queues')
          .update({ status: 'sending' })
          .eq('campaign_id', entry.campaign_id)
          .eq('contact_id', entry.contact_id);

        // Invia l'email
        const success = await sendEmailViaResend(entry.email_data);
        
        // Aggiorna lo status finale
        const finalStatus = success ? 'sent' : 'failed';
        await supabase
          .from('campaign_queues')
          .update({ 
            status: finalStatus,
            sent_at: success ? new Date().toISOString() : null,
            error_message: success ? null : 'Failed to send email'
          })
          .eq('campaign_id', entry.campaign_id)
          .eq('contact_id', entry.contact_id);

        return { success, contactId: entry.contact_id };
      } catch (error) {
        console.error(`❌ Errore processando email per ${entry.contact_id}:`, error);
        
        // Aggiorna lo status a 'failed'
        await supabase
          .from('campaign_queues')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('campaign_id', entry.campaign_id)
          .eq('contact_id', entry.contact_id);

        return { success: false, contactId: entry.contact_id };
      }
    });

    // Attendi il completamento del batch
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Batch completato: ${successCount}/${batch.length} email inviate`);

    // Pausa breve tra i batch per evitare rate limiting
    if (i + batchSize < queueEntries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Processamento background completato per campagna ${campaignId}`);
}

/**
 * Prepara i dati per l'invio immediato
 */
async function prepareImmediateEmailData(
  supabase: SupabaseClient,
  campaignId: string
): Promise<EmailQueueEntry[]> {
  console.log(`📋 Preparazione dati email per campagna ${campaignId}`);

  // 1. Recupera i dati della campagna
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignError?.message}`);
  }

  // 2. Recupera i mittenti associati
  const { data: sendersRes, error: sendersError } = await supabase
    .from('campaign_senders')
    .select('sender_id')
    .eq('campaign_id', campaignId);

  if (sendersError || !sendersRes?.length) {
    throw new Error('No senders associated with this campaign');
  }

  // 3. Recupera i mittenti attivi
  const senderIds = sendersRes.map(s => s.sender_id);
  const { data: senders, error: sendersDataError } = await supabase
    .from('senders')
    .select('*')
    .in('id', senderIds)
    .eq('is_active', true);

  if (sendersDataError || !senders?.length) {
    throw new Error('No active senders found');
  }

  // 4. Recupera i gruppi della campagna
  const { data: campaignGroups, error: groupsError } = await supabase
    .from('campaign_groups')
    .select('group_id, percentage_start, percentage_end')
    .eq('campaign_id', campaignId);

  if (groupsError || !campaignGroups?.length) {
    throw new Error('No recipient groups selected');
  }

  // 5. Recupera tutti i contatti dai gruppi
  const allContacts: ContactData[] = [];
  
  for (const group of campaignGroups) {
    // Determina se le percentuali sono abilitate
    const percentageEnabled = group.percentage_start !== null && group.percentage_end !== null;
    
    // Recupera i contact_id del gruppo
    const { data: contactGroups, error: groupError } = await supabase
      .from('contact_groups')
      .select('contact_id')
      .eq('group_id', group.group_id)
      .order('contact_id');

    if (groupError || !contactGroups?.length) {
      console.warn(`No contacts found in group ${group.group_id}`);
      continue;
    }

    // Recupera i contatti attivi
    const contactIds = contactGroups.map(cg => cg.contact_id);
    const { data: activeContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds)
      .eq('is_active', true);

    if (contactsError || !activeContacts?.length) {
      console.warn(`No active contacts found in group ${group.group_id}`);
      continue;
    }

    let validContacts = activeContacts;

    // Applica filtro percentuale se abilitato
    if (percentageEnabled) {
      const startIndex = Math.floor(((group.percentage_start ?? 0) / 100) * activeContacts.length);
      const endIndex = Math.ceil(((group.percentage_end ?? 100) / 100) * activeContacts.length);
      validContacts = activeContacts.slice(startIndex, endIndex);
    }

    allContacts.push(...validContacts);
  }

  if (allContacts.length === 0) {
    throw new Error('No active contacts found for the selected groups');
  }

  console.log(`📧 Trovati ${allContacts.length} contatti per l'invio`);

  // 6. Prepara le entry per la coda
  const queueEntries: EmailQueueEntry[] = [];
  const now = new Date();

  for (let i = 0; i < allContacts.length; i++) {
    const contact = allContacts[i];
    const sender = senders[i % senders.length]; // Cicla tra i mittenti

    queueEntries.push({
      campaign_id: campaignId,
      contact_id: contact.id,
      sender_id: sender.id,
      status: 'pending',
      scheduled_for: now.toISOString(),
      retry_count: 0,
      email_data: {
        to: contact.email,
        from: sender.email_from,
        subject: campaign.subject,
        html: campaign.html_content || '',
      },
    });
  }

  return queueEntries;
}

/**
 * Funzione principale per l'avvio immediato della campagna
 */
async function startImmediateCampaign(supabase: SupabaseClient, campaignId: string): Promise<void> {
  console.log(`🚀 Avvio campagna immediata per ID: ${campaignId}`);

  // 1. Verifica che la campagna sia in stato 'draft'
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignError?.message}`);
  }

  if (campaign.status !== 'draft') {
    throw new Error(`Campaign is not in 'draft' status. Current status: ${campaign.status}`);
  }

  // 2. Prepara i dati per l'invio
  const queueEntries = await prepareImmediateEmailData(supabase, campaignId);

  // 3. Pulisci la coda precedente
  await supabase.from('campaign_queues').delete().eq('campaign_id', campaignId);

  // 4. Inserisci le nuove entry nella coda
  const { error: insertError } = await supabase
    .from('campaign_queues')
    .insert(queueEntries.map(entry => ({
      campaign_id: entry.campaign_id,
      contact_id: entry.contact_id,
      sender_id: entry.sender_id,
      status: entry.status,
      scheduled_for: entry.scheduled_for,
      retry_count: entry.retry_count,
    })));

  if (insertError) {
    throw new Error(`Error inserting queue entries: ${insertError.message}`);
  }

  // 5. Aggiorna lo status della campagna a 'sending'
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ 
      status: 'sending',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Error updating campaign status: ${updateError.message}`);
  }

  console.log(`✅ Campagna ${campaignId} preparata per l'invio immediato`);

  // 6. Avvia il processamento in background (non attendere)
  processEmailsInBackground(supabase, campaignId, queueEntries).catch(error => {
    console.error(`❌ Errore nel processamento background:`, error);
  });
}

// Funzione principale per l'esecuzione della funzione serverless
export default async function handler(req: Request) {
  console.log(`🚀 Edge Function called with method: ${req.method}`);
  console.log(`📡 Request URL: ${req.url}`);
  
  // Abilita CORS per tutte le richieste
  if (req.method === 'OPTIONS') {
    console.log(`✅ Handling CORS preflight request`);
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Estrai il token dall'intestazione Authorization
  const authHeader = req.headers.get('Authorization');
  console.log(`🔑 Auth header: ${authHeader ? 'Present' : 'Missing'}`);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  if (!token) {
    console.log(`❌ No token provided`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Missing authorization header' 
      }),
      { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Crea il client Supabase con il token dell'utente
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Estrai l'ID della campagna dal corpo della richiesta
    const body = await req.json();
    console.log(`📦 Request body:`, body);
    const { campaignId } = body;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing campaignId in request body' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🎯 Starting immediate campaign for ID: ${campaignId}`);
    
    // Avvia la campagna in background (non attendere il completamento)
    startImmediateCampaign(supabase, campaignId).catch(error => {
      console.error(`❌ Errore nell'avvio campagna:`, error);
    });

    // Rispondi immediatamente con successo
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: 'Campaign started successfully. Emails are being sent in background.' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    // Gestisci gli errori e restituisci una risposta appropriata
    console.error('Error in campaign execution:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}