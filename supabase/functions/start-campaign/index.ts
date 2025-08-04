// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE CON LOGICA DI SCHEDULING UNIFICATA PER CAMPAIGNE IMMEDIATE

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Calcola i parametri di scheduling per una campagna
 */
function calculateSchedulingParameters(
  totalEmails: number,
  startDate: Date,
  endDate: Date
): {
  numDays: number;
  emailPerDay: number;
  emailRemainder: number;
  batchSize: number;
  intervalHours: number;
  intervalMinutes: number;
  dailySendCount: number;
} {
  // Calcola il numero di giorni
  const numDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  // Email al giorno
  const emailPerDay = Math.floor(totalEmails / numDays);
  const emailRemainder = totalEmails % numDays;

  // Calcolo automatico dei parametri di invio
  const dailySendCount = Math.max(1, Math.min(10, Math.ceil(emailPerDay / 10))); // Min 1, max 10 batch al giorno
  const batchSize = Math.max(1, Math.floor(emailPerDay / dailySendCount));
  const intervalBetweenSends = Math.floor((24 * 60) / dailySendCount); // Minuti totali divisi per numero di batch

  const intervalHours = Math.floor(intervalBetweenSends / 60);
  const intervalMinutes = intervalBetweenSends % 60;

  return {
    numDays,
    emailPerDay,
    emailRemainder,
    batchSize,
    intervalHours,
    intervalMinutes,
    dailySendCount,
  };
}

/**
 * Genera gli orari di invio per una campagna immediata
 */
function generateImmediateSchedule(
  totalEmails: number,
  startTime: Date,
  schedulingParams: ReturnType<typeof calculateSchedulingParameters>
): Date[] {
  const { dailySendCount, batchSize, intervalHours, intervalMinutes } = schedulingParams;
  const schedule: Date[] = [];
  
  let currentTime = new Date(startTime);
  let emailsScheduled = 0;

  // Per ogni batch del giorno
  for (let batchIndex = 0; batchIndex < dailySendCount; batchIndex++) {
    const emailsInThisBatch = Math.min(batchSize, totalEmails - emailsScheduled);
    
    if (emailsInThisBatch <= 0) break;

    // Aggiungi le email di questo batch
    for (let i = 0; i < emailsInThisBatch; i++) {
      schedule.push(new Date(currentTime));
      emailsScheduled++;
    }

    // Calcola il prossimo orario di batch
    if (batchIndex < dailySendCount - 1 && emailsScheduled < totalEmails) {
      currentTime = new Date(currentTime.getTime() + 
        (intervalHours * 60 * 60 * 1000) + 
        (intervalMinutes * 60 * 1000));
    }
  }

  return schedule;
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
 * Processa le email in background con scheduling
 */
async function processEmailsInBackground(
  supabase: SupabaseClient,
  campaignId: string,
  queueEntries: any[]
): Promise<void> {
  console.log(`🔄 Avvio processamento background per ${queueEntries.length} email`);
  
  // Ordina le entry per scheduled_for
  queueEntries.sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  
  // Processa le email in batch di 5 per volta
  const batchSize = 5;
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

    // Pausa tra i batch per evitare rate limiting
    if (i + batchSize < queueEntries.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`✅ Processamento background completato per campagna ${campaignId}`);
}

/**
 * Prepara i dati per l'invio con scheduling
 */
async function prepareScheduledEmailData(
  supabase: SupabaseClient,
  campaignId: string,
  startImmediately: boolean = false
): Promise<any[]> {
  console.log(`📋 Preparazione dati email per campagna ${campaignId} (immediata: ${startImmediately})`);

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
  const allContacts: any[] = [];
  
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

  // 6. Calcola i parametri di scheduling
  const now = new Date();
  const startDate = startImmediately ? now : new Date(campaign.start_date || now);
  const endDate = new Date(campaign.end_date || new Date(now.getTime() + 24 * 60 * 60 * 1000)); // Default 1 giorno se non specificato

  const schedulingParams = calculateSchedulingParameters(allContacts.length, startDate, endDate);
  
  console.log(`📅 Parametri di scheduling:`, {
    totalEmails: allContacts.length,
    numDays: schedulingParams.numDays,
    emailPerDay: schedulingParams.emailPerDay,
    dailySendCount: schedulingParams.dailySendCount,
    batchSize: schedulingParams.batchSize,
    intervalHours: schedulingParams.intervalHours,
    intervalMinutes: schedulingParams.intervalMinutes
  });

  // 7. Genera gli orari di invio
  const schedule = generateImmediateSchedule(allContacts.length, startDate, schedulingParams);

  // 8. Prepara le entry per la coda
  const queueEntries: any[] = [];

  for (let i = 0; i < allContacts.length; i++) {
    const contact = allContacts[i];
    const sender = senders[i % senders.length]; // Cicla tra i mittenti
    const scheduledFor = schedule[i] || now; // Fallback all'orario corrente

    queueEntries.push({
      campaign_id: campaignId,
      contact_id: contact.id,
      sender_id: sender.id,
      status: 'pending',
      scheduled_for: scheduledFor.toISOString(),
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
 * Funzione principale per l'avvio della campagna
 */
async function startCampaignExecution(supabase: SupabaseClient, campaignId: string, startImmediately: boolean = false, queueEntries?: any[]): Promise<void> {
  console.log(`🚀 Avvio campagna per ID: ${campaignId} (immediata: ${startImmediately}, queueEntries forniti: ${!!queueEntries})`);

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

  let finalQueueEntries: any[];

  // 2. Gestisci i due scenari: Avvio immediato vs Programma
  if (startImmediately && queueEntries && queueEntries.length > 0) {
    // SCENARIO 1: Avvio immediato con queueEntries pre-calcolati dal frontend
    console.log(`📋 Utilizzo ${queueEntries.length} entry pre-calcolate dal frontend`);
    finalQueueEntries = queueEntries;
  } else {
    // SCENARIO 2: Avvio programmato o fallback - calcola la pianificazione lato server
    console.log(`📋 Calcolo pianificazione lato server`);
    finalQueueEntries = await prepareScheduledEmailData(supabase, campaignId, startImmediately);
  }

  // 3. Pulisci la coda precedente
  await supabase.from('campaign_queues').delete().eq('campaign_id', campaignId);

  // 4. Inserisci le nuove entry nella coda
  const { error: insertError } = await supabase
    .from('campaign_queues')
    .insert(finalQueueEntries.map(entry => ({
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

  // 5. Aggiorna lo status della campagna
  const updateData: any = { 
    status: 'sending',
    updated_at: new Date().toISOString()
  };

  // Se è un avvio immediato, aggiorna anche start_date e scheduled_at
  if (startImmediately) {
    updateData.start_date = new Date().toISOString().split('T')[0];
    updateData.scheduled_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Error updating campaign status: ${updateError.message}`);
  }

  console.log(`✅ Campagna ${campaignId} preparata per l'invio (${finalQueueEntries.length} email)`);

  // 6. Avvia il processamento in background (non attendere)
  processEmailsInBackground(supabase, campaignId, finalQueueEntries).catch(error => {
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
    const { campaignId, startImmediately = false } = body;

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

    console.log(`🎯 Starting campaign for ID: ${campaignId} (immediate: ${startImmediately})`);
    
    // Avvia la campagna in background (non attendere il completamento)
    startCampaignExecution(supabase, campaignId, startImmediately).catch(error => {
      console.error(`❌ Errore nell'avvio campagna:`, error);
    });

    // Rispondi immediatamente con successo
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: startImmediately 
          ? 'Campaign started immediately. Emails are being sent with proper scheduling.'
          : 'Campaign scheduled successfully. Emails will be sent according to the schedule.'
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