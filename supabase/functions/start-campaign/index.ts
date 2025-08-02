// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE FINALE CON LOGICA start_date e end_date

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Funzione di esecuzione principale che orchestra l'avvio di una campagna.
 * Calcola la pianificazione degli invii in modo dinamico basandosi
 * su una data di inizio e una data di fine.
 */
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string, startImmediately: boolean = false) {
  console.log(`[EXEC] Starting campaign execution for ID: ${campaignId}`);

  try {
    // 1. Ottieni i dettagli della campagna dal database
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*') // Seleziona tutte le colonne per avere start_date, end_date, etc.
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    // Controlla che la campagna sia in uno stato valido per essere avviata
    if (campaign.status !== 'draft' && campaign.status !== 'sending') { // 'sending' per riavviare
      throw new Error(`Campaign is not in a startable status. Current status: ${campaign.status}`);
    }

    // Controlla che le date necessarie siano presenti
    if (!campaign.start_date || !campaign.end_date) {
        throw new Error('Start date or End date is missing for this campaign.');
    }

    // 2. Ottieni i gruppi e i mittenti associati alla campagna (logica invariata)
    const [groupsRes, sendersRes] = await Promise.all([
      supabaseAdmin.from('campaign_groups').select('group_id').eq('campaign_id', campaignId),
      supabaseAdmin.from('campaign_senders').select('sender_id').eq('campaign_id', campaignId)
    ]);

    if (groupsRes.error || sendersRes.error) throw new Error('Failed to fetch campaign groups or senders.');
    const groupIds = groupsRes.data.map(g => g.group_id);
    const senderIds = sendersRes.data.map(s => s.sender_id);
    if (groupIds.length === 0) throw new Error('No groups associated with this campaign.');
    if (senderIds.length === 0) throw new Error('No senders associated with this campaign.');

    // 3. Ottieni tutti i contatti attivi dai gruppi (logica invariata)
    const { data: contactGroupsData, error: contactGroupsError } = await supabaseAdmin.from('contact_groups').select('contact_id').in('group_id', groupIds);
    if (contactGroupsError) throw new Error('Failed to fetch contacts from groups.');
    const contactIds = contactGroupsData?.map(cg => cg.contact_id) || [];
    if (contactIds.length === 0) throw new Error('No contacts found in the associated groups.');

    const { data: contacts, error: contactsError } = await supabaseAdmin.from('contacts').select('id, email, first_name, last_name, is_active').in('id', contactIds).eq('is_active', true);
    if (contactsError) throw new Error('Failed to fetch active contacts.');
    if (!contacts || contacts.length === 0) throw new Error('No active contacts found for this campaign.');

    // 4. Ottieni i dettagli dei mittenti attivi (logica invariata)
    const { data: senders, error: sendersDataError } = await supabaseAdmin.from('senders').select('*').in('id', senderIds).eq('is_active', true);
    if (sendersDataError || !senders || senders.length === 0) throw new Error('No active senders found for this campaign.');

    console.log(`[EXEC] Found ${contacts.length} contacts and ${senders.length} senders.`);

    // 5. Aggiorna lo status della campagna a 'sending'
    await supabaseAdmin.from('campaigns').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', campaignId);
    console.log(`[EXEC] Campaign status updated to 'sending'.`);
    
    // 6. Se la campagna era già in 'sending', pulisce la coda precedente per riprogrammarla
    if (campaign.status === 'sending') {
      console.log(`[EXEC] Campaign was already in 'sending' status. Deleting existing queue entries for re-scheduling...`);
      await supabaseAdmin.from('campaign_queues').delete().eq('campaign_id', campaignId);
    }

    // 7. --- NUOVA LOGICA DI CALCOLO DELLA PIANIFICAZIONE ---
    const [startHour, startMinute] = campaign.start_time_of_day.split(':').map(Number);
    
    const campaignStartDate = new Date(campaign.start_date);
    campaignStartDate.setUTCHours(startHour, startMinute, 0, 0);

    const campaignEndDate = new Date(campaign.end_date);
    campaignEndDate.setUTCHours(23, 59, 59, 999); // Imposta l'orario alla fine del giorno di fine

    // Determina l'orario di partenza del primo batch
    const now = new Date();
    const firstBatchTime = startImmediately ? now : (campaignStartDate > now ? campaignStartDate : now);

    if (firstBatchTime > campaignEndDate) {
      throw new Error('Calculated start time is after the campaign end date.');
    }
    
    const totalDurationMs = campaignEndDate.getTime() - firstBatchTime.getTime();
    if (totalDurationMs <= 0) {
      throw new Error('The campaign duration must be positive. Check your start/end dates.');
    }

    const totalEmails = contacts.length;
    const batchSize = campaign.emails_per_batch;
    const totalBatches = Math.ceil(totalEmails / batchSize);

    // Calcola l'intervallo tra i batch per distribuirli uniformemente nella durata totale.
    // Se c'è un solo batch, l'intervallo è 0.
    const batchIntervalMs = totalBatches > 1 ? Math.floor(totalDurationMs / (totalBatches - 1)) : 0;
    
    // --- FINE NUOVA LOGICA ---

    // 8. Crea le voci nella tabella `campaign_queues`
    const queueEntries = [];
    let senderIndex = 0;
    
    for (let i = 0; i < totalBatches; i++) {
        // Calcola l'orario di invio per questo specifico batch
        const batchTime = new Date(firstBatchTime.getTime() + (i * batchIntervalMs));
        const batchContacts = contacts.slice(i * batchSize, (i + 1) * batchSize);

        for (const contact of batchContacts) {
            const sender = senders[senderIndex % senders.length];
            queueEntries.push({
                campaign_id: campaignId,
                contact_id: contact.id,
                sender_id: sender.id,
                status: 'pending',
                scheduled_for: batchTime.toISOString(), // Salva l'orario calcolato
                retry_count: 0
            });
            senderIndex++;
        }
    }

    // 9. Inserisci tutte le voci in coda con un'unica operazione
    const { error: queueError } = await supabaseAdmin.from('campaign_queues').insert(queueEntries);
    if (queueError) {
      // Se l'inserimento fallisce, riporta la campagna allo stato 'draft'
      await supabaseAdmin.from('campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaignId);
      throw new Error(`Failed to create queue entries: ${queueError.message}`);
    }

    const lastBatchTime = totalBatches > 0 ? new Date(firstBatchTime.getTime() + ((totalBatches - 1) * batchIntervalMs)) : firstBatchTime;

    console.log(`[EXEC] Created ${queueEntries.length} queue entries for campaign ${campaignId}.`);
    console.log(`[EXEC] Campaign Details:`, {
        total_contacts: contacts.length,
        total_senders: senders.length,
        total_batches: totalBatches,
        batch_interval_minutes: Math.round(batchIntervalMs / 60000),
        first_batch_time: firstBatchTime.toISOString(),
        last_batch_time: lastBatchTime.toISOString()
    });

  } catch (error) {
    console.error(`[EXEC] Error during campaign execution for ${campaignId}:`, error);
    // Tenta di ripristinare lo stato a 'draft' in caso di qualsiasi errore
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .catch(restoreError => console.error('[EXEC] Critical: Failed to restore campaign status after error:', restoreError));
    throw error;
  }
}

// Funzione principale Deno che riceve la richiesta HTTP (logica invariata)
Deno.serve(async (req) => {
  // Gestione della richiesta pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { campaignId, startImmediately } = await req.json();
    if (!campaignId) {
      throw new Error('Missing campaignId in request body');
    }

    // Crea un client Supabase con privilegi di amministratore
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Esegui la logica principale
    await startCampaignExecution(supabaseAdmin, campaignId, startImmediately);

    // Rispondi con successo
    return new Response(JSON.stringify({ 
      success: true,
      message: `Campaign ${campaignId} scheduled successfully` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in start-campaign function:', error);
    // Rispondi con un errore
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Usa 400 per errori di input, 500 per errori interni
    });
  }
});