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

  // 1. Fetch campaign details
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError) throw new Error(`Error fetching campaign: ${campaignError.message}`);
  if (!campaign) throw new Error(`Campaign with ID ${campaignId} not found.`);
  if (campaign.status !== 'draft') throw new Error(`Campaign is not in 'draft' status.`);
  if (!campaign.start_date || !campaign.end_date) throw new Error('Missing start_date or end_date.');

  // 2. Fetch associated senders
  const { data: sendersRes, error: sendersError } = await supabaseAdmin
    .from('campaign_senders')
    .select('sender_id')
    .eq('campaign_id', campaignId);
  if (sendersError) throw new Error(`Error fetching senders: ${sendersError.message}`);
  const senderIds = sendersRes.map((s) => s.sender_id);
  if (!senderIds.length) throw new Error('No senders associated with this campaign.');

  // 3. Fetch contacts based on group percentages
  const finalContactIds = new Set<string>();
  const selectedGroups: GroupSelection[] = campaign.selected_groups || [];
  if (!selectedGroups.length) throw new Error('No recipient groups selected.');

  for (const group of selectedGroups) {
    const { data: contactsInGroup, error: groupError } = await supabaseAdmin
      .from('contact_groups')
      .select('contact_id')
      .eq('group_id', group.group_id);

    if (groupError) {
      console.error(`Error fetching contacts for group ${group.group_id}:`, groupError.message);
      throw new Error(`Error fetching contacts for group ${group.group_id}: ${groupError.message}`);
    }

    if (!contactsInGroup?.length) {
      console.warn(`No contacts found for group ${group.group_id}`);
      continue;
    }

    const totalContactsInGroup = contactsInGroup.length;

    const startIndex = group.percentage_start !== undefined
      ? Math.floor((group.percentage_start / 100) * totalContactsInGroup)
      : 0;
    const endIndex = group.percentage_end !== undefined
      ? Math.ceil((group.percentage_end / 100) * totalContactsInGroup)
      : totalContactsInGroup;

    const validContacts = contactsInGroup.slice(
      Math.max(0, startIndex),
      Math.min(totalContactsInGroup, endIndex)
    );

    validContacts.forEach((c) => finalContactIds.add(c.contact_id));
  }

  const contactIds = Array.from(finalContactIds);
  if (!contactIds.length) throw new Error('No contacts found for the selected groups.');

  // 4. Filter active contacts and senders
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

  // 5. Clear previous campaign queue
  await supabaseAdmin.from('campaign_queues').delete().eq('campaign_id', campaignId);
  console.log(`[EXEC] Cleared previous queue for campaign ${campaignId}.`);

  // 6. Batch-based scheduling
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  const numDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const totalEmails = activeContacts.length;
  const emailPerDay = Math.floor(totalEmails / numDays);
  const emailRemainder = totalEmails % numDays;

  const queueEntries = [];
  let senderIndex = 0;

  for (let day = 0; day < numDays; day++) {
    const emailsToday = emailPerDay + (day < emailRemainder ? 1 : 0);
    const numBatches = Math.ceil(emailsToday / campaign.emails_per_batch);
    const batchSize = Math.floor(emailsToday / numBatches);
    const intervalBetweenBatchesMs = campaign.batch_interval_minutes * 60 * 1000;

    for (let batch = 0; batch < numBatches; batch++) {
      const batchStartIndex = day * emailPerDay + batch * batchSize;
      const batchEndIndex = Math.min(batchStartIndex + batchSize, activeContacts.length);

      for (let i = batchStartIndex; i < batchEndIndex; i++) {
        const scheduledTime = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000 + batch * intervalBetweenBatchesMs);
        const sender = activeSenders[senderIndex % activeSenders.length];
        senderIndex++;

        queueEntries.push({
          campaign_id: campaignId,
          contact_id: activeContacts[i].id,
          sender_id: sender.id,
          status: 'pending',
          scheduled_for: scheduledTime.toISOString(),
          retry_count: 0,
        });
      }
    }
  }

  // 7. Insert queue entries and update campaign status
  if (queueEntries.length) {
    const { error: queueError } = await supabaseAdmin.from('campaign_queues').insert(queueEntries);
    if (queueError) throw new Error(`Error inserting queue entries: ${queueError.message}`);
    console.log(`[EXEC] Inserted ${queueEntries.length} queue entries for campaign ${campaignId}.`);
  }

  // 8. Update campaign status to 'running'
  const { error: updateError } = await supabaseAdmin
    .from('campaigns')
    .update({ status: 'running' })
    .eq('id', campaignId);
  if (updateError) throw new Error(`Error updating campaign status: ${updateError.message}`);

  console.log(`[EXEC] Campaign ${campaignId} is now running.`);
}

// Funzione principale per l'esecuzione della funzione serverless
export default async function handler(req: Request) {
  // Abilita CORS
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: corsHeaders,
    });
  }

  // Estrai il token dall'intestazione Authorization
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Crea il client Supabase con il token dell'utente
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Estrai l'ID della campagna dal corpo della richiesta
  const { campaignId } = await req.json();

  try {
    // Avvia l'esecuzione della campagna
    await startCampaignExecution(supabase, campaignId);

    // Restituisci una risposta di successo
    return new Response('Campaign started successfully', { status: 200 });
  } catch (error) {
    // Gestisci gli errori e restituisci una risposta appropriata
    console.error('Error in campaign execution:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}