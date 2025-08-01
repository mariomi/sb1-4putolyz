// Percorso del file: supabase/functions/start-campaign/index.ts
// VERSIONE CORRETTA CHE USA IL SISTEMA DI CODE

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- FUNZIONE CORRETTA CHE USA IL SISTEMA DI CODE ---
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string, startImmediately: boolean = false) {
  console.log(`[EXEC] Starting campaign execution for ID: ${campaignId}`);

  try {
    // 1. Verifica che la campagna esista e sia in stato draft
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    // Accetta 'draft', 'scheduled' e 'sending' per permettere la riprogrammazione
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'sending') {
      throw new Error(`Campaign is not in draft, scheduled, or sending status. Current status: ${campaign.status}`);
    }

    // 2. Ottieni i gruppi e mittenti associati alla campagna
    const [groupsRes, sendersRes] = await Promise.all([
      supabaseAdmin.from('campaign_groups').select('group_id').eq('campaign_id', campaignId),
      supabaseAdmin.from('campaign_senders').select('sender_id').eq('campaign_id', campaignId)
    ]);

    if (groupsRes.error || sendersRes.error) {
      throw new Error('Failed to fetch campaign groups or senders.');
    }

    const groupIds = groupsRes.data.map(g => g.group_id);
    const senderIds = sendersRes.data.map(s => s.sender_id);

    if (groupIds.length === 0) {
      throw new Error('No groups associated with this campaign.');
    }

    if (senderIds.length === 0) {
      throw new Error('No senders associated with this campaign.');
    }

    // 3. Ottieni tutti i contatti dei gruppi associati
    // Prima ottieni i contact_id dai gruppi
    const { data: contactGroupsData, error: contactGroupsError } = await supabaseAdmin
      .from('contact_groups')
      .select('contact_id')
      .in('group_id', groupIds);

    if (contactGroupsError) {
      throw new Error('Failed to fetch contact groups.');
    }

    const contactIds = contactGroupsData?.map(cg => cg.contact_id) || [];

    if (contactIds.length === 0) {
      throw new Error('No contacts found in the associated groups.');
    }

    // Poi ottieni i dettagli dei contatti
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, email, first_name, last_name, is_active')
      .in('id', contactIds)
      .eq('is_active', true);

    if (contactsError) {
      throw new Error('Failed to fetch contacts.');
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('No active contacts found for this campaign.');
    }

    // 4. Ottieni i dettagli dei mittenti
    const { data: senders, error: sendersDataError } = await supabaseAdmin
      .from('senders')
      .select('*')
      .in('id', senderIds)
      .eq('is_active', true);

    if (sendersDataError || !senders || senders.length === 0) {
      throw new Error('No active senders found for this campaign.');
    }

    console.log(`[EXEC] Found ${contacts.length} contacts and ${senders.length} senders.`);

    // 5. Aggiorna lo status della campagna a 'sending'
    const { error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({ 
        status: 'sending', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', campaignId);

    if (updateError) {
      throw new Error('Failed to update campaign status.');
    }

    console.log(`[EXEC] Campaign status updated to 'sending'.`);

    // 6. Elimina le email esistenti se la campagna è già in sending
    if (campaign.status === 'sending') {
      console.log(`[EXEC] Campaign already in sending status, deleting existing queue entries...`);
      const { error: deleteError } = await supabaseAdmin
        .from('campaign_queues')
        .delete()
        .eq('campaign_id', campaignId);
      
      if (deleteError) {
        console.error('[EXEC] Error deleting existing queue entries:', deleteError);
      } else {
        console.log(`[EXEC] Deleted existing queue entries for campaign ${campaignId}`);
      }
    }

    // 7. Calcola i tempi di scheduling - INIZIA ORA se startImmediately=true, altrimenti usa la programmazione
    const now = new Date();
    let firstBatchTime;
    
    if (startImmediately) {
      // Avvio immediato: inizia subito
      firstBatchTime = now;
      console.log(`[EXEC] IMMEDIATE START: Scheduling first batch for NOW: ${firstBatchTime.toISOString()}`);
    } else {
      // Programmazione normale: usa start_date e start_time_of_day
      const startDate = new Date(campaign.start_date);
      const [startHour, startMinute] = campaign.start_time_of_day.split(':').map(Number);
      startDate.setHours(startHour, startMinute, 0, 0);
      firstBatchTime = startDate > now ? startDate : now;
      console.log(`[EXEC] SCHEDULED START: Scheduling first batch for: ${firstBatchTime.toISOString()}`);
    }
    
    console.log(`[EXEC] Campaign start_date: ${campaign.start_date}, start_time_of_day: ${campaign.start_time_of_day}`);

    // 8. Crea le entries nella coda per ogni contatto
    const queueEntries = [];
    let senderIndex = 0;
    let batchIndex = 0;
    const batchSize = campaign.emails_per_batch;
    const batchIntervalMs = campaign.batch_interval_minutes * 60 * 1000;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchTime = new Date(firstBatchTime.getTime() + (batchIndex * batchIntervalMs));

      for (const contact of batch) {
        const sender = senders[senderIndex % senders.length];
        
        queueEntries.push({
          campaign_id: campaignId,
          contact_id: contact.id,
          sender_id: sender.id,
          status: 'pending',
          scheduled_for: batchTime.toISOString(),
          retry_count: 0
        });

        senderIndex++;
      }
      
      batchIndex++;
    }

    // 9. Inserisci tutte le entries nella coda
    const { error: queueError } = await supabaseAdmin
      .from('campaign_queues')
      .insert(queueEntries);

    if (queueError) {
      console.error('[EXEC] Error inserting queue entries:', queueError);
      // Ripristina lo status a draft se fallisce
      await supabaseAdmin
        .from('campaigns')
        .update({ 
          status: 'draft', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', campaignId);
      throw new Error('Failed to create queue entries.');
    }

    console.log(`[EXEC] Created ${queueEntries.length} queue entries for campaign ${campaignId}.`);
    console.log(`[EXEC] Campaign ${campaignId} started successfully with queue system.`);
    
    // Log dettagliato per debugging
    console.log(`[EXEC] Campaign details:`, {
      id: campaignId,
      name: campaign.name,
      emails_per_batch: campaign.emails_per_batch,
      batch_interval_minutes: campaign.batch_interval_minutes,
      total_contacts: contacts.length,
      total_senders: senders.length,
      queue_entries_created: queueEntries.length,
      first_batch_time: firstBatchTime.toISOString()
    });

  } catch (error) {
    console.error(`[EXEC] Error during campaign execution for ${campaignId}:`, error);
    
    // Ripristina lo status a draft in caso di errore
    try {
      await supabaseAdmin
        .from('campaigns')
        .update({ 
          status: 'draft', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', campaignId);
    } catch (restoreError) {
      console.error('[EXEC] Failed to restore campaign status:', restoreError);
    }
    
    throw error;
  }
}

// --- LA FUNZIONE PRINCIPALE CON CORS CORRETTO ---
console.log(`🚀 Function "start-campaign" up and running!`);

Deno.serve(async (req) => {
  // Gestione CORS per preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId, startImmediately } = await req.json()

    if (!campaignId) {
      throw new Error('Missing campaignId in request body')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Chiama la funzione corretta che usa il sistema di code
    await startCampaignExecution(supabaseAdmin, campaignId, startImmediately)

    return new Response(JSON.stringify({ 
      success: true,
      message: `Campaign ${campaignId} started successfully` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in start-campaign function:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})