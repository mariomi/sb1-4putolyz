// percorso: supabase/functions/start-campaign/index.ts
// VERSIONE COMPLETAMENTE RISCITTA CON LOGICA DI SCHEDULING ROBUSTA

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Header CORS per permettere le chiamate dal frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupSelection {
  group_id: string;
  percentage_enabled?: boolean; // Opzionale: se true, usa percentuali
  percentage_start?: number;    // Opzionale: percentuale iniziale
  percentage_end?: number;      // Opzionale: percentuale finale
}

interface SchedulingPlan {
  totalDays: number;
  emailsPerDay: number;
  remainingEmails: number;
  batchSize: number;
  intervalHours: number;
  intervalMinutes: number;
  totalScheduled: number;
}

/**
 * Calcola il piano di scheduling per la campagna
 */
function calculateSchedulingPlan(
  totalEmails: number,
  startDate: Date,
  endDate: Date,
  dailySendCount: number
): SchedulingPlan {
  // Calcola il numero di giorni della campagna (inclusivo)
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  // Email al giorno (divisione intera)
  const emailsPerDay = Math.floor(totalEmails / totalDays);
  
  // Email rimanenti da distribuire negli ultimi giorni
  const remainingEmails = totalEmails % totalDays;
  
  // Dimensione del batch (email per invio)
  const batchSize = Math.floor(emailsPerDay / dailySendCount);
  
  // Intervallo tra i batch (in ore e minuti)
  const totalMinutesPerDay = 24 * 60;
  const intervalMinutes = Math.floor(totalMinutesPerDay / dailySendCount);
  const intervalHours = Math.floor(intervalMinutes / 60);
  const remainingMinutes = intervalMinutes % 60;
  
  return {
    totalDays,
    emailsPerDay,
    remainingEmails,
    batchSize,
    intervalHours,
    intervalMinutes: remainingMinutes,
    totalScheduled: 0
  };
}

/**
 * Genera gli orari dei batch per un giorno specifico
 */
function generateBatchTimes(
  dayStartTime: Date,
  dailySendCount: number,
  intervalHours: number,
  intervalMinutes: number
): Date[] {
  const batchTimes: Date[] = [];
  
  for (let batch = 0; batch < dailySendCount; batch++) {
    const batchTime = new Date(dayStartTime);
    batchTime.setHours(
      dayStartTime.getHours() + (batch * intervalHours) + Math.floor((batch * intervalMinutes) / 60)
    );
    batchTime.setMinutes(
      dayStartTime.getMinutes() + ((batch * intervalMinutes) % 60)
    );
    batchTimes.push(batchTime);
  }
  
  return batchTimes;
}

/**
 * Distribuisce le email per un giorno specifico
 */
function distributeEmailsForDay(
  dayIndex: number,
  emailsForDay: number,
  batchSize: number,
  batchTimes: Date[],
  contacts: any[],
  senders: any[],
  campaignId: string,
  startContactIndex: number
): any[] {
  const queueEntries: any[] = [];
  let contactIndex = startContactIndex;
  let senderIndex = 0;
  
  // Distribuisci le email tra i batch
  for (let batchIndex = 0; batchIndex < batchTimes.length && contactIndex < contacts.length; batchIndex++) {
    const batchTime = batchTimes[batchIndex];
    const emailsInThisBatch = Math.min(
      batchSize + (batchIndex === batchTimes.length - 1 ? emailsForDay % batchSize : 0),
      contacts.length - contactIndex
    );
    
    for (let i = 0; i < emailsInThisBatch; i++) {
      const contact = contacts[contactIndex];
      const sender = senders[senderIndex % senders.length];
      
      queueEntries.push({
        campaign_id: campaignId,
        contact_id: contact.id,
        sender_id: sender.id,
        status: 'pending',
        scheduled_for: batchTime.toISOString(),
        retry_count: 0,
      });
      
      contactIndex++;
      senderIndex++;
    }
  }
  
  return queueEntries;
}

/**
 * Funzione principale per la pianificazione della campagna
 */
async function scheduleCampaign(
  supabaseAdmin: SupabaseClient,
  campaignId: string,
  totalEmails: number,
  startDate: Date,
  endDate: Date,
  dailySendCount: number,
  contacts: any[],
  senders: any[]
): Promise<SchedulingPlan> {
  console.log(`📅 SCHEDULING CAMPAIGN ${campaignId}`);
  console.log(`📊 Total emails: ${totalEmails}`);
  console.log(`📅 Start date: ${startDate.toISOString()}`);
  console.log(`📅 End date: ${endDate.toISOString()}`);
  console.log(`🕐 Daily send count: ${dailySendCount}`);
  
  // Calcola il piano di scheduling
  const plan = calculateSchedulingPlan(totalEmails, startDate, endDate, dailySendCount);
  
  console.log(`\n📋 SCHEDULING PLAN:`);
  console.log(`   • Total days: ${plan.totalDays}`);
  console.log(`   • Emails per day: ${plan.emailsPerDay}`);
  console.log(`   • Remaining emails: ${plan.remainingEmails}`);
  console.log(`   • Batch size: ${plan.batchSize}`);
  console.log(`   • Interval: ${plan.intervalHours}h ${plan.intervalMinutes}m`);
  
  // Genera tutti gli orari dei batch per ogni giorno
  const allQueueEntries: any[] = [];
  let contactIndex = 0;
  
  for (let day = 0; day < plan.totalDays; day++) {
    const dayStartTime = new Date(startDate);
    dayStartTime.setDate(startDate.getDate() + day);
    dayStartTime.setHours(9, 0, 0, 0); // Inizia alle 9:00
    
    // Calcola quante email per questo giorno
    const emailsForDay = plan.emailsPerDay + (day < plan.remainingEmails ? 1 : 0);
    
    if (emailsForDay > 0) {
      console.log(`\n📅 DAY ${day + 1}: ${emailsForDay} emails`);
      
      // Genera gli orari dei batch per questo giorno
      const batchTimes = generateBatchTimes(dayStartTime, dailySendCount, plan.intervalHours, plan.intervalMinutes);
      
      console.log(`   🕐 Batch times:`);
      batchTimes.forEach((time, index) => {
        console.log(`      ${index + 1}. ${time.toLocaleTimeString('it-IT')}`);
      });
      
      // Distribuisci le email per questo giorno
      const dayEntries = distributeEmailsForDay(
        day,
        emailsForDay,
        plan.batchSize,
        batchTimes,
        contacts,
        senders,
        campaignId,
        contactIndex
      );
      
      allQueueEntries.push(...dayEntries);
      contactIndex += emailsForDay;
      plan.totalScheduled += dayEntries.length;
    }
  }
  
  console.log(`\n📦 TOTAL QUEUE ENTRIES: ${allQueueEntries.length}`);
  
  // Inserisci tutte le entry nella coda
  if (allQueueEntries.length > 0) {
    const { error: queueError } = await supabaseAdmin
      .from('campaign_queues')
      .insert(allQueueEntries);
      
    if (queueError) {
      throw new Error(`Error inserting queue entries: ${queueError.message}`);
    }
    
    console.log(`✅ Successfully inserted ${allQueueEntries.length} queue entries`);
  }
  
  return plan;
}

/**
 * Funzione di esecuzione principale che orchestra l'avvio di una campagna
 */
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string) {
  console.log(`🚀 Starting campaign execution for ID: ${campaignId}`);

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

  console.log(`📋 Campaign: ${campaign.name}`);
  console.log(`📅 Start date: ${campaign.start_date}`);
  console.log(`📅 End date: ${campaign.end_date}`);

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
    console.log(`📋 Processing group ${group.group_id} with percentage_enabled: ${group.percentage_enabled}`);
    
    const { data: contactsInGroup, error: groupError } = await supabaseAdmin
      .from('contact_groups')
      .select('contact_id')
      .eq('group_id', group.group_id)
      .order('contact_id'); // Ordine stabile per percentuali

    if (groupError) {
      console.error(`Error fetching contacts for group ${group.group_id}:`, groupError.message);
      throw new Error(`Error fetching contacts for group ${group.group_id}: ${groupError.message}`);
    }

    if (!contactsInGroup?.length) {
      console.warn(`No contacts found for group ${group.group_id}`);
      continue;
    }

    const totalContactsInGroup = contactsInGroup.length;
    let validContacts: any[];

    // Se le percentuali non sono abilitate, usa tutti i contatti
    if (!group.percentage_enabled) {
      console.log(`  ✅ Using all ${totalContactsInGroup} contacts (no percentage filter)`);
      validContacts = contactsInGroup;
    } else {
      // Altrimenti applica il filtro percentuale
      const startIndex = Math.floor(((group.percentage_start ?? 0) / 100) * totalContactsInGroup);
      const endIndex = Math.ceil(((group.percentage_end ?? 100) / 100) * totalContactsInGroup);
      
      console.log(`  📊 Applying percentage filter: ${group.percentage_start ?? 0}% - ${group.percentage_end ?? 100}%`);
      console.log(`  📊 Contacts range: ${startIndex} to ${endIndex} (${endIndex - startIndex} contacts)`);
      
      validContacts = contactsInGroup.slice(
        Math.max(0, startIndex),
        Math.min(totalContactsInGroup, endIndex)
      );
    }

    validContacts.forEach((c) => finalContactIds.add(c.contact_id));
    console.log(`  📧 Added ${validContacts.length} contacts from group ${group.group_id}`);
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

  console.log(`👥 Processing ${activeContacts.length} active contacts and ${activeSenders.length} active senders.`);

  // 5. Clear previous campaign queue
  await supabaseAdmin.from('campaign_queues').delete().eq('campaign_id', campaignId);
  console.log(`🧹 Cleared previous queue for campaign ${campaignId}.`);

  // 6. Schedule the campaign with new logic
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  const dailySendCount = campaign.emails_per_batch || 10; // Default a 10 batch al giorno
  
  const schedulingPlan = await scheduleCampaign(
    supabaseAdmin,
    campaignId,
    activeContacts.length,
    startDate,
    endDate,
    dailySendCount,
    activeContacts,
    activeSenders
  );

  // 7. Update campaign status to 'sending'
  const { error: updateError } = await supabaseAdmin
    .from('campaigns')
    .update({ 
      status: 'sending',
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);
  if (updateError) throw new Error(`Error updating campaign status: ${updateError.message}`);

  console.log(`✅ Campaign ${campaignId} is now scheduled and running.`);
  console.log(`📊 Final summary:`);
  console.log(`   • Total days: ${schedulingPlan.totalDays}`);
  console.log(`   • Emails per day: ${schedulingPlan.emailsPerDay}`);
  console.log(`   • Remaining emails: ${schedulingPlan.remainingEmails}`);
  console.log(`   • Batch size: ${schedulingPlan.batchSize}`);
  console.log(`   • Interval: ${schedulingPlan.intervalHours}h ${schedulingPlan.intervalMinutes}m`);
  console.log(`   • Total scheduled: ${schedulingPlan.totalScheduled}`);
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
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  // Estrai l'ID della campagna dal corpo della richiesta
  const { campaignId } = await req.json();

  try {
    // Avvia l'esecuzione della campagna
    await startCampaignExecution(supabase, campaignId);

    // Restituisci una risposta di successo
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Campaign started successfully' 
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