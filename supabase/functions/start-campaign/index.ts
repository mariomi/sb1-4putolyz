// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE CORRETTA CON LOGICA DI SCHEDULING DISTRIBUITO NEL TEMPO

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
 * Distribuisce le email nel tempo tra startDate e endDate
 */
function calculateSchedulingParameters(
  totalEmails: number,
  startDate: Date,
  endDate: Date
): {
  totalDays: number;
  emailsPerDay: number;
  dailySendCount: number;
  batchSize: number;
  intervalMinutes: number;
} {
  // Calcola il numero totale di giorni (minimo 1)
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  // Email al giorno (distribuite uniformemente)
  const emailsPerDay = Math.ceil(totalEmails / totalDays);
  
  // Numero di batch al giorno (tra 1 e 10)
  const dailySendCount = Math.max(1, Math.min(10, Math.ceil(emailsPerDay / 50)));
  
  // Dimensione di ogni batch
  const batchSize = Math.ceil(emailsPerDay / dailySendCount);
  
  // Intervallo in minuti tra i batch (distribuisce i batch nell'arco della giornata)
  const intervalMinutes = Math.max(15, Math.floor((24 * 60) / dailySendCount));

  return {
    totalDays,
    emailsPerDay,
    dailySendCount,
    batchSize,
    intervalMinutes,
  };
}

/**
 * Genera timestamp scaglionati per ogni email della campagna
 * Questa è la funzione chiave che risolve il problema dell'invio di massa
 */
function generateStaggeredTimestamps(
  totalEmails: number,
  startDate: Date,
  schedulingParams: ReturnType<typeof calculateSchedulingParameters>
): Date[] {
  const { totalDays, emailsPerDay, dailySendCount, batchSize, intervalMinutes } = schedulingParams;
  const timestamps: Date[] = [];
  
  let emailIndex = 0;
  
  // Itera per ogni giorno
  for (let dayOffset = 0; dayOffset < totalDays && emailIndex < totalEmails; dayOffset++) {
    const currentDay = new Date(startDate);
    currentDay.setDate(startDate.getDate() + dayOffset);
    
    // Imposta l'orario di inizio del giorno (9:00 AM)
    currentDay.setHours(9, 0, 0, 0);
    
    // Calcola quante email inviare in questo giorno
    const emailsForThisDay = Math.min(emailsPerDay, totalEmails - emailIndex);
    
    // Distribuisci le email nei batch del giorno
    for (let batchIndex = 0; batchIndex < dailySendCount && emailIndex < totalEmails; batchIndex++) {
      const emailsInThisBatch = Math.min(batchSize, emailsForThisDay - (batchIndex * batchSize));
      
      if (emailsInThisBatch <= 0) break;
      
      // Calcola l'orario di questo batch
      const batchTime = new Date(currentDay);
      batchTime.setMinutes(batchTime.getMinutes() + (batchIndex * intervalMinutes));
      
      // Aggiungi le email di questo batch
      for (let i = 0; i < emailsInThisBatch && emailIndex < totalEmails; i++) {
        timestamps.push(new Date(batchTime));
        emailIndex++;
      }
    }
  }
  
  return timestamps;
}

/**
 * Recupera tutti i dati necessari per la campagna
 */
async function fetchCampaignData(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{
  campaign: any;
  senders: any[];
  contacts: any[];
}> {
  console.log(`📋 Recupero dati per campagna ${campaignId}`);

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

  return { campaign, senders, contacts: allContacts };
}

/**
 * Prepara le entry per la coda con timestamp scaglionati
 */
function prepareQueueEntries(
  campaign: any,
  senders: any[],
  contacts: any[],
  timestamps: Date[]
): any[] {
  console.log(`📅 Preparazione ${contacts.length} entry per la coda con timestamp scaglionati`);
  
  const queueEntries: any[] = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const sender = senders[i % senders.length]; // Cicla tra i mittenti
    const scheduledFor = timestamps[i] || new Date(); // Fallback all'orario corrente

    queueEntries.push({
      campaign_id: campaign.id,
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
 * Funzione principale per l'avvio della campagna con scheduling corretto
 */
async function startCampaignWithProperScheduling(
  supabase: SupabaseClient,
  campaignId: string
): Promise<void> {
  console.log(`🚀 Avvio campagna ${campaignId} con scheduling distribuito nel tempo`);

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

  // 2. Recupera tutti i dati necessari
  const { campaign: campaignData, senders, contacts } = await fetchCampaignData(supabase, campaignId);

  // 3. Calcola i parametri di scheduling
  const startDate = new Date(); // Ora corrente
  const endDate = new Date(campaignData.end_date || new Date(startDate.getTime() + 24 * 60 * 60 * 1000)); // Default 1 giorno

  const schedulingParams = calculateSchedulingParameters(contacts.length, startDate, endDate);
  
  console.log(`📅 Parametri di scheduling:`, {
    totalEmails: contacts.length,
    totalDays: schedulingParams.totalDays,
    emailsPerDay: schedulingParams.emailsPerDay,
    dailySendCount: schedulingParams.dailySendCount,
    batchSize: schedulingParams.batchSize,
    intervalMinutes: schedulingParams.intervalMinutes
  });

  // 4. Genera timestamp scaglionati per ogni email
  const timestamps = generateStaggeredTimestamps(contacts.length, startDate, schedulingParams);
  
  console.log(`⏰ Generati ${timestamps.length} timestamp scaglionati`);
  console.log(`📊 Primo timestamp: ${timestamps[0]?.toISOString()}`);
  console.log(`📊 Ultimo timestamp: ${timestamps[timestamps.length - 1]?.toISOString()}`);

  // 5. Prepara le entry per la coda
  const queueEntries = prepareQueueEntries(campaignData, senders, contacts, timestamps);

  // 6. Pulisci la coda precedente per questa campagna
  const { error: deleteError } = await supabase
    .from('campaign_queues')
    .delete()
    .eq('campaign_id', campaignId);

  if (deleteError) {
    throw new Error(`Error clearing previous queue: ${deleteError.message}`);
  }

  // 7. Inserisci le nuove entry nella coda con timestamp scaglionati
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

  // 8. Aggiorna lo status della campagna
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      status: 'sending',
      start_date: startDate.toISOString().split('T')[0],
      scheduled_at: startDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Error updating campaign status: ${updateError.message}`);
  }

  console.log(`✅ Campagna ${campaignId} avviata con successo`);
  console.log(`📊 ${queueEntries.length} email programmate per l'invio nel tempo`);
  console.log(`⏰ Prima email: ${timestamps[0]?.toISOString()}`);
  console.log(`⏰ Ultima email: ${timestamps[timestamps.length - 1]?.toISOString()}`);
}

// Funzione principale per l'esecuzione della funzione serverless
export default async function handler(req: Request) {
  console.log(`🚀 Edge Function start-campaign chiamata con metodo: ${req.method}`);
  console.log(`📡 Request URL: ${req.url}`);
  
  // Abilita CORS per tutte le richieste
  if (req.method === 'OPTIONS') {
    console.log(`✅ Gestione richiesta CORS preflight`);
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Estrai il token dall'intestazione Authorization
  const authHeader = req.headers.get('Authorization');
  console.log(`🔑 Auth header: ${authHeader ? 'Presente' : 'Mancante'}`);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  if (!token) {
    console.log(`❌ Nessun token fornito`);
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

    console.log(`🎯 Avvio campagna per ID: ${campaignId}`);
    
    // Avvia la campagna con scheduling corretto
    await startCampaignWithProperScheduling(supabase, campaignId);

    // Rispondi con successo
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: 'Campaign started successfully with proper time-distributed scheduling. Emails will be sent according to the calculated schedule.'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    // Gestisci gli errori e restituisci una risposta appropriata
    console.error('❌ Errore nell\'esecuzione della campagna:', error);
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