import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

interface QueueItem {
  id: string
  campaign_id: string
  contact_id: string
  sender_id: string
  scheduled_for: string
  status: string
  retry_count: number
  sent_at: string | null
  resend_email_id: string | null
  error_message: string | null
  contact: {
    email: string
    first_name: string
    last_name: string
    is_active: boolean
  }
  sender: {
    id: string
    email_from: string
    display_name: string
    domain: string
    daily_limit: number
    emails_sent_today: number
    current_day: number
    last_sent_at: string | null
    is_active: boolean
  }
  campaign: {
    name: string
    subject: string
    html_content: string
    start_time_of_day: string
    send_duration_hours: number
    warm_up_days: number
    emails_per_batch: number
    batch_interval_minutes: number
  }
}

interface BatchEmail {
  from: string
  to: string[]
  subject: string
  html: string
}

interface ProcessingSummary {
  totalProcessed: number
  totalSent: number
  totalFailed: number
  batchesSent: number
  details: {
    senderId: string
    senderEmail: string
    sent: number
    failed: number
    batchSize: number
  }[]
}

Deno.serve(async (req: Request) => {
  // Gestione CORS per preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
    
    // Check if we're in test mode for additional logging
    const allowFakeEmails = Deno.env.get('ALLOW_FAKE_EMAILS') === 'true'
    const isTestMode = Deno.env.get('ENVIRONMENT') !== 'production'
    
    if (allowFakeEmails || isTestMode) {
      console.log('🧪 Test mode enabled - fake emails will be processed')
      if (Deno.env.get('TEST_EMAIL_OVERRIDE')) {
        console.log(`📧 Test email override: ${Deno.env.get('TEST_EMAIL_OVERRIDE')}`)
      }
    }

    console.log('🚀 Campaign processor started with batch sending')

    // Check for scheduled campaigns that should start now
    await checkScheduledCampaigns(supabase)

    // Get pending queue items that are ready to be sent
    const now = new Date().toISOString()
    const { data: queueItems, error: queueError } = await supabase
      .from('campaign_queues')
      .select(`
        *,
        contact:contacts!inner(email, first_name, last_name, is_active),
        sender:senders!inner(id, email_from, display_name, domain, daily_limit, emails_sent_today, current_day, last_sent_at, is_active),
        campaign:campaigns!inner(name, subject, html_content, status, start_time_of_day, send_duration_hours, warm_up_days, emails_per_batch, batch_interval_minutes)
      `)
      .eq('status', 'pending')
      .eq('sender.is_active', true)
      .eq('campaign.status', 'sending')
      .limit(50) // Ridotto il limite per rispettare i batch
      .order('scheduled_for', { ascending: true })

    if (queueError) {
      console.error('❌ Error fetching queue items:', queueError)
      throw queueError
    }

    console.log(`📧 Found ${queueItems?.length || 0} emails ready to send`)

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails ready to send',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processingSummary: ProcessingSummary = {
      totalProcessed: 0,
      totalSent: 0,
      totalFailed: 0,
      batchesSent: 0,
      details: []
    }

    // Reset daily counters for senders if new day
    await resetDailyCountersIfNeeded(supabase, queueItems as QueueItem[])

    // Filter items within sending window and under daily limits
    const validItems = await filterValidItems(supabase, queueItems as QueueItem[])
    
    console.log(`✅ ${validItems.length} emails are valid for sending`)

    if (validItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails within sending window or all senders reached daily limit',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group emails by sender for batch processing
    const emailsBySender = groupEmailsBySender(validItems)
    
    console.log(`📦 Grouped emails into ${Object.keys(emailsBySender).length} sender groups`)

    // Process each sender's batch
    for (const [senderId, items] of Object.entries(emailsBySender)) {
      const senderSummary = await processSenderBatch(supabase, resend, senderId, items)
      processingSummary.details.push(senderSummary)
      processingSummary.totalProcessed += senderSummary.sent + senderSummary.failed
      processingSummary.totalSent += senderSummary.sent
      processingSummary.totalFailed += senderSummary.failed
      processingSummary.batchesSent += senderSummary.batchSize > 0 ? 1 : 0
    }

    // Check if any campaigns are completed
    await checkCompletedCampaigns(supabase)

    console.log(`📊 Processing complete: ${processingSummary.totalSent} sent, ${processingSummary.totalFailed} failed, ${processingSummary.batchesSent} batches`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processingSummary.totalProcessed,
        sent: processingSummary.totalSent,
        failed: processingSummary.totalFailed,
        batches_sent: processingSummary.batchesSent,
        details: processingSummary.details
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Campaign processor error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Calculate dynamic daily limit based on warm-up progression
 */
function calculateWarmUpLimit(sender: { daily_limit: number; current_day: number }, campaign: { warm_up_days: number }): number {
  const { current_day, daily_limit } = sender
  const { warm_up_days } = campaign
  
  // If no warm-up or we're past the warm-up period, use full limit
  if (warm_up_days === 0 || current_day > warm_up_days) {
    return daily_limit
  }
  
  // During warm-up: gradual increase from 10% to 100%
  // Day 1: 10%, Day 2: 20%, etc., Final day: 100%
  const minPercent = 0.10  // Start with 10% of limit
  const progressPercent = current_day / warm_up_days
  const currentPercent = minPercent + (1 - minPercent) * progressPercent
  
  const warmUpLimit = Math.floor(daily_limit * currentPercent)
  
  // Ensure minimum of 1 email per day and maximum of full limit
  return Math.max(1, Math.min(warmUpLimit, daily_limit))
}

async function resetDailyCountersIfNeeded(supabase: any, queueItems: QueueItem[]) {
  const nowDate = new Date()
  const startOfToday = new Date(nowDate)
  startOfToday.setUTCHours(0, 0, 0, 0)

  const sendersToReset = new Set<string>()

  for (const item of queueItems) {
    if (!item.sender.last_sent_at || new Date(item.sender.last_sent_at) < startOfToday) {
      sendersToReset.add(item.sender_id)
    }
  }

  if (sendersToReset.size > 0) {
    console.log(`🔄 Resetting daily counters for ${sendersToReset.size} senders`)
    
    for (const senderId of sendersToReset) {
      const item = queueItems.find(item => item.sender_id === senderId)
      if (item) {
        await supabase
          .from('senders')
          .update({
            emails_sent_today: 0,
            current_day: item.sender.current_day + 1,
            updated_at: nowDate.toISOString(),
          })
          .eq('id', senderId)

        // Update local data
        item.sender.emails_sent_today = 0
        item.sender.current_day = item.sender.current_day + 1
      }
    }
  }
}

async function filterValidItems(supabase: any, queueItems: QueueItem[]): Promise<QueueItem[]> {
  const validItems: QueueItem[] = []
  const nowDate = new Date()

  for (const item of queueItems) {
    // Calculate dynamic daily limit based on warm-up progression
    const effectiveLimit = calculateWarmUpLimit(item.sender, item.campaign)
    
    // Check if sender has reached their warm-up adjusted daily limit
    if (item.sender.emails_sent_today >= effectiveLimit) {
      console.log(`⏸️ Sender ${item.sender.email_from} has reached warm-up limit (${item.sender.emails_sent_today}/${effectiveLimit}) [Day ${item.sender.current_day}/${item.campaign.warm_up_days}]`)
      continue
    }

    // Check sending window - BUT bypass if email was scheduled in the past (indicates "Start Now")
    const emailScheduledTime = new Date(item.scheduled_for)
    const isImmediateStart = emailScheduledTime <= nowDate // Email scheduled for now/past = immediate start
    
    if (!isImmediateStart) {
      // Only check sending window for scheduled (non-immediate) campaigns
      const [h, m] = item.campaign.start_time_of_day.split(':').map(Number)
      const campaignStart = new Date(nowDate)
      campaignStart.setUTCHours(h, m, 0, 0)
      const campaignEnd = new Date(campaignStart.getTime() + item.campaign.send_duration_hours * 60 * 60 * 1000)

      if (nowDate < campaignStart || nowDate > campaignEnd) {
        console.log(`⏰ Outside sending window for campaign ${item.campaign_id}`)
        continue
      }
    } else {
      console.log(`🚀 IMMEDIATE START: Bypassing sending window for campaign ${item.campaign_id}`)
    }

    validItems.push(item)
  }

  return validItems
}

function groupEmailsBySender(items: QueueItem[]): Record<string, QueueItem[]> {
  const groups: Record<string, QueueItem[]> = {}
  
  for (const item of items) {
    if (!groups[item.sender_id]) {
      groups[item.sender_id] = []
    }
    groups[item.sender_id].push(item)
  }
  
  return groups
}

async function processSenderBatch(
  supabase: any, 
  resend: any, 
  senderId: string, 
  items: QueueItem[]
): Promise<{ senderId: string; senderEmail: string; sent: number; failed: number; batchSize: number }> {
  
  const senderEmail = items[0].sender.email_from
  const senderName = items[0].sender.display_name
  const firstItem = items[0]
  
  // Calculate current warm-up status
  const effectiveLimit = calculateWarmUpLimit(firstItem.sender, firstItem.campaign)
  const isWarmingUp = firstItem.sender.current_day <= firstItem.campaign.warm_up_days
  const warmUpProgress = isWarmingUp 
    ? `Day ${firstItem.sender.current_day}/${firstItem.campaign.warm_up_days} (${Math.round((effectiveLimit/firstItem.sender.daily_limit)*100)}% limit)`
    : 'Warm-up completed'
  
  console.log(`📤 Processing batch for sender ${senderEmail}: ${items.length} emails`)
  console.log(`🔥 Warm-up status: ${warmUpProgress} - Effective limit: ${effectiveLimit}/${firstItem.sender.daily_limit}`)

  // Raggruppa le email per campagna per rispettare i limiti di batch
  const emailsByCampaign: Record<string, QueueItem[]> = {}
  for (const item of items) {
    if (!emailsByCampaign[item.campaign_id]) {
      emailsByCampaign[item.campaign_id] = []
    }
    emailsByCampaign[item.campaign_id].push(item)
  }

  let totalSent = 0
  let totalFailed = 0

  // Processa ogni campagna separatamente rispettando i limiti di batch
  for (const [campaignId, campaignItems] of Object.entries(emailsByCampaign)) {
    const campaign = campaignItems[0].campaign
    const emailsPerBatch = campaign.emails_per_batch || 10
    
    console.log(`📦 Campagna ${campaignId}: ${campaignItems.length} email totali, ${emailsPerBatch} per batch`)
    
    // Processa solo il primo batch per questa esecuzione
    const currentBatch = campaignItems.slice(0, emailsPerBatch)
    console.log(`📤 Invio batch corrente: ${currentBatch.length} email`)
    
    // Mark current batch items as processing
    await markItemsAsProcessing(supabase, currentBatch.map(item => item.id))

    // Create batch emails for Resend
    const batchEmails: BatchEmail[] = currentBatch.map(item => {
      // Convert fake emails to valid test emails for development/testing
      let emailToSend = item.contact.email
      
      // Check environment flag to allow fake emails
      const allowFakeEmails = Deno.env.get('ALLOW_FAKE_EMAILS') === 'true'
      const isTestMode = Deno.env.get('ENVIRONMENT') !== 'production'
      
      // Check if it's a fake/example domain
      const isFakeEmail = emailToSend.includes('@example.com') || 
                         emailToSend.includes('@test.com') || 
                         emailToSend.includes('@fake.com') ||
                         emailToSend.includes('@localhost') ||
                         emailToSend.includes('@invalid')
      
      if (isFakeEmail && (allowFakeEmails || isTestMode)) {
        // In test mode or when explicitly allowed, use a service that accepts any email
        // Use Resend's test mode or a mailbox service like Mailtrap
        const localPart = emailToSend.split('@')[0]
        
        // Check if we have a test email override
        const testEmailOverride = Deno.env.get('TEST_EMAIL_OVERRIDE')
        if (testEmailOverride) {
          emailToSend = testEmailOverride
          console.log(`🧪 Using test email override: ${emailToSend} (original: ${item.contact.email})`)
        } else {
          // Use original fake email - let Resend handle it
          console.log(`🔄 Allowing fake email in test mode: ${item.contact.email}`)
          // Keep original email
        }
      }
      
      return {
        from: `${senderName} <${senderEmail}>`,
        to: [emailToSend],
        subject: item.campaign.subject,
        html: item.campaign.html_content
          .replace(/{{first_name}}/g, item.contact.first_name || '')
          .replace(/{{last_name}}/g, item.contact.last_name || '')
          .replace(/{{email}}/g, emailToSend)
      }
    })

    try {
      console.log(`🚀 Sending batch of ${batchEmails.length} emails via Resend`)
      
      // Send batch via Resend
      const batchResult = await resend.batch.send(batchEmails)
      
      if (batchResult.error) {
        console.error(`❌ Batch send failed for sender ${senderEmail}:`, batchResult.error)
        await handleBatchFailure(supabase, currentBatch, batchResult.error.message)
        totalFailed += currentBatch.length
      } else {
        console.log(`✅ Batch sent successfully for sender ${senderEmail}:`, batchResult.data?.length, 'emails')
        
        // Process successful batch results
        await handleBatchSuccess(supabase, currentBatch, batchResult.data)
        
        // Update sender stats
        await updateSenderStats(supabase, senderId, currentBatch.length)
        
        totalSent += currentBatch.length
      }
      
    } catch (error) {
      console.error(`💥 Unexpected error processing batch for sender ${senderEmail}:`, error)
      await handleBatchFailure(supabase, currentBatch, error.message)
      totalFailed += currentBatch.length
    }
  }

  return { 
    senderId, 
    senderEmail, 
    sent: totalSent, 
    failed: totalFailed, 
    batchSize: totalSent + totalFailed 
  }
}

async function markItemsAsProcessing(supabase: any, itemIds: string[]) {
  const now = new Date().toISOString()
  
  for (const id of itemIds) {
    await supabase
      .from('campaign_queues')
      .update({ 
        status: 'processing',
        updated_at: now
      })
      .eq('id', id)
  }
}

async function handleBatchSuccess(supabase: any, items: QueueItem[], batchResults: any[]) {
  const now = new Date().toISOString()
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const result = batchResults?.[i]
    
    await Promise.all([
      // Update queue item
      supabase
        .from('campaign_queues')
        .update({ 
          status: 'sent',
          sent_at: now,
          resend_email_id: result?.id || null,
          updated_at: now
        })
        .eq('id', item.id),
      
      // Log the event
      supabase
        .from('logs')
        .insert({
          campaign_id: item.campaign_id,
          queue_entry_id: item.id,
          sender_id: item.sender_id,
          contact_id: item.contact_id,
          event_type: 'sent',
          event_data: {
            resend_email_id: result?.id || null,
            email: item.contact.email,
            sender: item.sender.email_from,
            batch_send: true
          }
        })
    ])
  }
}

async function handleBatchFailure(supabase: any, items: QueueItem[], errorMessage: string) {
  const now = new Date().toISOString()
  
  for (const item of items) {
    await Promise.all([
      // Update queue item
      supabase
        .from('campaign_queues')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: item.retry_count + 1,
          updated_at: now
        })
        .eq('id', item.id),
      
      // Log the event
      supabase
        .from('logs')
        .insert({
          campaign_id: item.campaign_id,
          queue_entry_id: item.id,
          sender_id: item.sender_id,
          contact_id: item.contact_id,
          event_type: 'failed',
          event_data: {
            error: errorMessage,
            email: item.contact.email,
            sender: item.sender.email_from,
            batch_send: true
          }
        })
    ])
  }
}

async function updateSenderStats(supabase: any, senderId: string, emailsSent: number) {
  const now = new Date().toISOString()
  
  await supabase
    .rpc('increment_emails_sent', {
      sender_id: senderId,
      increment_amount: emailsSent,
      last_sent_time: now
    })
  
  // Fallback if RPC doesn't exist
  const { data: sender } = await supabase
    .from('senders')
    .select('emails_sent_today')
    .eq('id', senderId)
    .single()
  
  if (sender) {
    await supabase
      .from('senders')
      .update({ 
        emails_sent_today: sender.emails_sent_today + emailsSent,
        last_sent_at: now,
        updated_at: now
      })
      .eq('id', senderId)
  }
}

async function checkScheduledCampaigns(supabase: any) {
  console.log('📅 Checking for scheduled campaigns that should start now...')
  
  const now = new Date().toISOString()
  
  // Find campaigns that are scheduled and should start now
  const { data: scheduledCampaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)

  if (error) {
    console.error('❌ Error fetching scheduled campaigns:', error)
    return
  }

  if (scheduledCampaigns && scheduledCampaigns.length > 0) {
    console.log(`🚀 Found ${scheduledCampaigns.length} scheduled campaigns ready to start`)
    
    for (const campaign of scheduledCampaigns) {
      console.log(`▶️  Starting campaign "${campaign.name}" (scheduled for ${campaign.scheduled_at})`)
      
      try {
        console.log(`🚀 Starting campaign "${campaign.name}" automatically (scheduled for ${campaign.scheduled_at})`)
        
        // Replica la logica del tasto "Avvia Ora" direttamente qui
        // 1. Recupera i dettagli della campagna
        const { data: campaignDetails, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaign.id)
          .single()

        if (campaignError || !campaignDetails) {
          throw new Error(`Campaign not found: ${campaignError?.message}`)
        }

        // 2. Recupera i mittenti associati
        const { data: sendersRes, error: sendersError } = await supabase
          .from('campaign_senders')
          .select('sender_id')
          .eq('campaign_id', campaign.id)

        if (sendersError || !sendersRes?.length) {
          throw new Error('No senders associated with this campaign')
        }

        // 3. Recupera i mittenti attivi
        const senderIds = sendersRes.map(s => s.sender_id)
        const { data: senders, error: sendersDataError } = await supabase
          .from('senders')
          .select('*')
          .in('id', senderIds)
          .eq('is_active', true)

        if (sendersDataError || !senders?.length) {
          throw new Error('No active senders found')
        }

        // 4. Recupera i gruppi della campagna
        let campaignGroups: any[] = []
        
        try {
          if (campaignDetails.selected_groups) {
            const groupsData = typeof campaignDetails.selected_groups === 'string' 
              ? JSON.parse(campaignDetails.selected_groups) 
              : campaignDetails.selected_groups
            
            if (groupsData && groupsData.groups && Array.isArray(groupsData.groups)) {
              campaignGroups = groupsData.groups.map((group: any) => ({
                group_id: group.groupId,
                percentage_start: group.percentageStart || 0,
                percentage_end: group.percentageEnd || 100
              }))
            }
          }
        } catch (parseError) {
          console.error('Error parsing selected_groups:', parseError)
        }
        
        // Fallback: prova a leggere dalla tabella campaign_groups se il JSON è vuoto
        if (!campaignGroups.length) {
          const { data: legacyGroups, error: groupsError } = await supabase
            .from('campaign_groups')
            .select('group_id, percentage_start, percentage_end')
            .eq('campaign_id', campaign.id)
          
          if (!groupsError && legacyGroups?.length) {
            campaignGroups = legacyGroups
          }
        }

        if (!campaignGroups?.length) {
          throw new Error('No recipient groups selected')
        }

        // 5. Recupera tutti i contatti dai gruppi
        const allContacts: any[] = []
        
        for (const group of campaignGroups) {
          // Determina se le percentuali sono abilitate
          const percentageEnabled = group.percentage_start !== null && group.percentage_end !== null
          
          // Recupera i contact_id del gruppo
          const { data: contactGroups, error: groupError } = await supabase
            .from('contact_groups')
            .select('contact_id')
            .eq('group_id', group.group_id)
            .order('contact_id')

          if (groupError || !contactGroups?.length) {
            console.warn(`No contacts found in group ${group.group_id}`)
            continue
          }

          // Recupera tutti i contatti (attivi e non attivi) usando paginazione per grandi gruppi
          const contactIds = contactGroups.map(cg => cg.contact_id)
          let allContactsInGroup: any[] = []
          
          // Se ci sono molti contatti, usa paginazione (ridotto per evitare 414 errors)
          if (contactIds.length > 100) {
            console.log(`📧 Processing large group with ${contactIds.length} contacts, using pagination...`)
            
            for (let i = 0; i < contactIds.length; i += 100) {
              const batchIds = contactIds.slice(i, i + 100)
              const { data: batchContacts, error: batchError } = await supabase
                .from('contacts')
                .select('*')
                .in('id', batchIds)
              
              if (batchError) {
                console.error(`Error fetching contacts batch ${i/100 + 1}:`, batchError)
                continue
              }
              
              if (batchContacts) {
                allContactsInGroup.push(...batchContacts)
              }
            }
          } else {
            // Per gruppi piccoli, usa query normale
            const { data: contacts, error: contactsError } = await supabase
              .from('contacts')
              .select('*')
              .in('id', contactIds)

            if (contactsError) {
              console.warn(`Error fetching contacts for group ${group.group_id}:`, contactsError)
              continue
            }
            
            if (contacts) {
              allContactsInGroup = contacts
            }
          }

          if (!allContactsInGroup.length) {
            console.warn(`No contacts found in group ${group.group_id}`)
            continue
          }

          let validContacts = allContactsInGroup

          // Applica filtro percentuale se abilitato
          if (percentageEnabled) {
            const startIndex = Math.floor(((group.percentage_start ?? 0) / 100) * allContactsInGroup.length)
            const endIndex = Math.ceil(((group.percentage_end ?? 100) / 100) * allContactsInGroup.length)
            validContacts = allContactsInGroup.slice(startIndex, endIndex)
          }

          allContacts.push(...validContacts)
        }

        if (allContacts.length === 0) {
          throw new Error('No contacts found for the selected groups')
        }

        console.log(`📧 Found ${allContacts.length} contacts for campaign "${campaign.name}"`)

        // 6. Prepara le entry per la coda con intervalli di batch
        const queueEntries: any[] = []
        const now = new Date()
        
        // Recupera le impostazioni di batch dalla campagna
        const emailsPerBatch = campaignDetails.emails_per_batch || 10
        const batchIntervalMinutes = campaignDetails.batch_interval_minutes || 5
        
        console.log(`📦 Batch config: ${emailsPerBatch} emails per batch, ${batchIntervalMinutes} minutes interval`)

        for (let i = 0; i < allContacts.length; i++) {
          const contact = allContacts[i]
          const sender = senders[i % senders.length] // Cicla tra i mittenti
          
          // Calcola l'orario di invio basato sul batch
          const batchNumber = Math.floor(i / emailsPerBatch)
          const scheduledTime = new Date(now.getTime() + (batchNumber * batchIntervalMinutes * 60 * 1000))
          
          queueEntries.push({
            campaign_id: campaign.id,
            contact_id: contact.id,
            sender_id: sender.id,
            status: 'pending',
            scheduled_for: scheduledTime.toISOString(),
            retry_count: 0,
          })
        }

        // 7. Pulisci la coda precedente
        await supabase.from('campaign_queues').delete().eq('campaign_id', campaign.id)

        // 8. Inserisci le nuove entry nella coda
        const { error: insertError } = await supabase
          .from('campaign_queues')
          .insert(queueEntries)

        if (insertError) {
          throw new Error(`Error inserting queue entries: ${insertError.message}`)
        }

        // 9. Aggiorna lo status della campagna a 'sending'
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ 
            status: 'sending',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id)

        if (updateError) {
          throw new Error(`Error updating campaign status: ${updateError.message}`)
        }

        console.log(`✅ Campaign "${campaign.name}" started successfully with ${queueEntries.length} emails queued`)

        // Log the automatic start
        await supabase
          .from('logs')
          .insert({
            campaign_id: campaign.id,
            event_type: 'started',
            event_data: {
              started_at: new Date().toISOString(),
              trigger: 'automatic_scheduler',
              scheduled_for: campaign.scheduled_at,
              emails_queued: queueEntries.length,
              contacts_found: allContacts.length
            }
          })

      } catch (error) {
        console.error(`❌ Error starting campaign ${campaign.name}:`, error)
        
        // Log the error
        await supabase
          .from('logs')
          .insert({
            campaign_id: campaign.id,
            event_type: 'error',
            event_data: {
              error_at: new Date().toISOString(),
              trigger: 'automatic_scheduler',
              error_message: String(error)
            }
          })
      }
    }
  } else {
    console.log('No scheduled campaigns ready to start')
  }
}

async function checkCompletedCampaigns(supabase: any) {
  console.log('🔍 Checking for completed campaigns...')
  
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('status', 'sending')

  if (activeCampaigns && activeCampaigns.length > 0) {
    console.log(`Found ${activeCampaigns.length} campaigns in sending status`)
    
    for (const campaign of activeCampaigns) {
      // Conta TUTTE le email pending e processing (INDIPENDENTEMENTE dal scheduled_for)
      const [pendingRes, processingRes, sentRes, totalRes] = await Promise.all([
        supabase.from('campaign_queues').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'pending'),
        supabase.from('campaign_queues').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'processing'),
        supabase.from('campaign_queues').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'sent'),
        supabase.from('campaign_queues').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id)
      ])

      const pendingCount = pendingRes.count || 0
      const processingCount = processingRes.count || 0  
      const sentCount = sentRes.count || 0
      const totalCount = totalRes.count || 0
      
      const totalPendingCount = pendingCount + processingCount

      console.log(`📊 Campaign "${campaign.name}" (${campaign.id}):`)
      console.log(`  Total emails: ${totalCount}`)
      console.log(`  Sent: ${sentCount}`) 
      console.log(`  Pending: ${pendingCount}`)
      console.log(`  Processing: ${processingCount}`)
      console.log(`  Total still to process: ${totalPendingCount}`)

      // Una campagna è completata SOLO se NON ci sono più email da processare
      if (totalPendingCount === 0) {
        console.log(`🏁 Campaign "${campaign.name}" COMPLETED! All ${totalCount} emails processed.`)
        
        await Promise.all([
          supabase
            .from('campaigns')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id),
          
          supabase
            .from('logs')
            .insert({
              campaign_id: campaign.id,
              event_type: 'completed',
              event_data: {
                completed_at: new Date().toISOString(),
                total_emails: totalCount,
                sent_emails: sentCount,
                success_rate: totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0
              }
            })
        ])
      } else {
        console.log(`⏳ Campaign "${campaign.name}" still in progress: ${totalPendingCount} emails remaining`)
      }
    }
  } else {
    console.log('No campaigns in sending status found')
  }
}