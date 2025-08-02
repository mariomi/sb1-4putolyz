// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE FINALE CON LOGICA start_date e end_date

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string) {
  console.log(`[EXEC] Starting campaign execution for ID: ${campaignId}`);

  try {
    // 1. Ottieni i dettagli della campagna dal database
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('status', 'draft')
      .single();

    if (campaignError) throw campaignError;
    if (!campaign.start_date || !campaign.end_date) throw new Error('Missing start_date or end_date.');

    // 2. Ottieni i gruppi e i mittenti associati alla campagna (logica invariata)
    const [groupsRes, sendersRes] = await Promise.all([
      supabaseAdmin.from('campaign_groups').select('group_id').eq('campaign_id', campaignId),
      supabaseAdmin.from('campaign_senders').select('sender_id').eq('campaign_id', campaignId),
    ]);

    if (groupsRes.error || sendersRes.error) throw new Error('Failed to fetch groups or senders.');
    const groupIds = groupsRes.data.map((g) => g.group_id);
    const senderIds = sendersRes.data.map((s) => s.sender_id);

    if (!groupIds.length || !senderIds.length) throw new Error('No groups or senders associated with this campaign.');

    // 3. Ottieni tutti i contatti attivi dai gruppi (logica semplificata)
    const contactIds = [];
    for (const groupId of groupIds) {
      const { data: groupContacts, error: groupError } = await supabaseAdmin
        .from('contact_groups')
        .select('contact_id')
        .eq('group_id', groupId);

      if (groupError) throw groupError;
      contactIds.push(...groupContacts.map((gc) => gc.contact_id));
    }

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, email, first_name, last_name, is_active')
      .in('id', contactIds)
      .eq('is_active', true);

    if (contactsError || !contacts?.length) throw new Error('No active contacts found.');

    // 4. Ottieni i dettagli dei mittenti attivi (logica invariata)
    const { data: senders, error: sendersError } = await supabaseAdmin
      .from('senders')
      .select('*')
      .in('id', senderIds)
      .eq('is_active', true);

    if (sendersError || !senders?.length) throw new Error('No active senders found.');

    // 5. Pulisci la coda precedente della campagna
    await supabaseAdmin.from('campaign_queues').delete().eq('campaign_id', campaignId);

    // 6. Calcola la pianificazione
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const intervalMs = (endDate.getTime() - startDate.getTime()) / contacts.length;

    const queueEntries = [];
    let senderIndex = 0;

    contacts.forEach((contact, i) => {
      const scheduledFor = new Date(startDate.getTime() + i * intervalMs).toISOString();
      const sender = senders[senderIndex % senders.length];
      senderIndex++;

      queueEntries.push({
        campaign_id: campaignId,
        contact_id: contact.id,
        sender_id: sender.id,
        status: 'pending',
        scheduled_for: scheduledFor,
        retry_count: 0,
      });
    });

    // 7. Inserisci tutte le voci in coda con un'unica operazione
    const { error: queueError } = await supabaseAdmin.from('campaign_queues').insert(queueEntries);
    if (queueError) throw queueError;

    // 8. Aggiorna lo stato della campagna
    await supabaseAdmin.from('campaigns').update({ status: 'sending' }).eq('id', campaignId);

    console.log(`[EXEC] Campaign ${campaignId} scheduled successfully.`);
  } catch (error) {
    console.error(`[EXEC] Error during campaign execution:`, error);
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
    const { campaignId } = await req.json();
    if (!campaignId) {
      throw new Error('Missing campaignId in request body');
    }

    // Crea un client Supabase con privilegi di amministratore
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Esegui la logica principale
    await startCampaignExecution(supabaseAdmin, campaignId);

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