// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE FINALE CON LOGICA start_date e end_date

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupSelection {
  group_id: string;
  percentage_start: number;
  percentage_end: number;
}

/**
 * Funzione di esecuzione principale che orchestra l'avvio di una campagna.
 * Calcola la pianificazione degli invii in modo dinamico basandosi
 * su una data di inizio e una data di fine.
 */
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string) {
  console.log(`[EXEC] Starting campaign execution for ID: ${campaignId}`);

  // 1. Ottieni i dettagli della campagna dal database
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError) throw new Error(`Error fetching campaign: ${campaignError.message}`);
  if (!campaign) throw new Error(`Campaign with ID ${campaignId} not found.`);
  if (campaign.status !== 'draft') throw new Error(`Campaign is not in 'draft' status.`);
  if (!campaign.start_date || !campaign.end_date) throw new Error('Missing start_date or end_date.');

  // 2. Ottieni i mittenti associati alla campagna
  const { data: sendersRes, error: sendersError } = await supabaseAdmin
    .from('campaign_senders')
    .select('sender_id')
    .eq('campaign_id', campaignId);
  if (sendersError) throw new Error(`Error fetching senders: ${sendersError.message}`);
  const senderIds = sendersRes.map((s) => s.sender_id);
  if (!senderIds.length) throw new Error('No senders associated with this campaign.');

  // 3. Ottieni i contatti basati sulle percentuali dei gruppi
  const finalContactIds = new Set<string>();
  const selectedGroups: GroupSelection[] = campaign.selected_groups || [];
  if (!selectedGroups.length) throw new Error('No recipient groups selected.');

  for (const group of selectedGroups) {
    const { data: contactsInGroup, error: groupError } = await supabaseAdmin
      .from('contact_groups')
      .select('contact_id')
      .eq('group_id', group.group_id);

    if (groupError) throw new Error(`Error fetching contacts for group ${group.group_id}: ${groupError.message}`);
    if (!contactsInGroup?.length) continue;

    const totalContactsInGroup = contactsInGroup.length;

    // Controlla se percentage_start e percentage_end sono definiti
    const startIndex = group.percentage_start !== undefined
      ? Math.floor((group.percentage_start / 100) * totalContactsInGroup)
      : 0; // Imposta a 0 per impostazione predefinita se non è definito
    const endIndex = group.percentage_end !== undefined
      ? Math.ceil((group.percentage_end / 100) * totalContactsInGroup)
      : totalContactsInGroup; // Imposta al 100% per impostazione predefinita se non è definito

    // Assicurati che gli indici siano entro i limiti
    const validContacts = contactsInGroup.slice(
      Math.max(0, startIndex),
      Math.min(totalContactsInGroup, endIndex)
    );

    validContacts.forEach((c) => finalContactIds.add(c.contact_id));
  }

  const contactIds = Array.from(finalContactIds);
  if (!contactIds.length) throw new Error('No contacts found for the selected groups and percentages.');

  // 4. Filtra i contatti e mittenti attivi
  const { data: activeContacts, error: contactsError } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .in('id', contactIds)
    .eq('is_active', true);
  if (contactsError || !activeContacts?.length) throw new Error('No active contacts found.');

  const { data: activeSenders, error: activeSendersError } = await supabaseAdmin
    .from('senders')
    .select('id')
    .in('id', senderIds)
    .eq('is_active', true);
  if (activeSendersError || !activeSenders?.length) throw new Error('No active senders found.');

  console.log(`[EXEC] Processing ${activeContacts.length} active contacts and ${activeSenders.length} active senders.`);

  // 5. Pulisci la coda precedente della campagna
  await supabaseAdmin.from('campaign_queues').delete().eq('campaign_id', campaignId);
  console.log(`[EXEC] Cleared previous queue for campaign ${campaignId}.`);

  // 6. Calcola la pianificazione
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  const totalDurationMs = endDate.getTime() - startDate.getTime();
  if (totalDurationMs <= 0) throw new Error('End date must be after start date.');
  const intervalPerEmailMs = totalDurationMs / activeContacts.length;

  const queueEntries = [];
  let senderIndex = 0;

  activeContacts.forEach((contact, i) => {
    const scheduledTime = new Date(startDate.getTime() + i * intervalPerEmailMs);
    const sender = activeSenders[senderIndex % activeSenders.length];
    senderIndex++;

    queueEntries.push({
      campaign_id: campaignId,
      contact_id: contact.id,
      sender_id: sender.id,
      status: 'pending',
      scheduled_for: scheduledTime.toISOString(),
      retry_count: 0,
    });
  });

  // 7. Inserisci tutte le voci in coda con un'unica operazione
  if (queueEntries.length) {
    const { error: queueError } = await supabaseAdmin.from('campaign_queues').insert(queueEntries);
    if (queueError) throw new Error(`Error creating queue: ${queueError.message}`);
  }

  await supabaseAdmin.from('campaigns').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', campaignId);
  console.log(`[EXEC] Campaign ${campaignId} scheduled successfully with ${queueEntries.length} emails.`);
}

// Funzione principale Deno che riceve la richiesta HTTP (logica invariata)
Deno.serve(async (req) => {
  // Gestione della richiesta pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { campaignId } = await req.json();
    if (!campaignId) throw new Error('campaignId is required.');

    // Crea un client Supabase con privilegi di amministratore
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Esegui la logica principale
    await startCampaignExecution(supabaseAdmin, campaignId);

    // Rispondi con successo
    return new Response(JSON.stringify({ success: true, message: `Campaign ${campaignId} started successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in start-campaign function:', error);
    // Rispondi con un errore
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});