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
        campaign:campaigns!inner(name, subject, html_content, status, start_time_of_day, send_duration_hours, warm_up_days)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .eq('contact.is_active', true)
      .eq('sender.is_active', true)
      .eq('campaign.status', 'sending')
      .limit(100) // Increased limit for better batch processing
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

  // Mark all items as processing
  await markItemsAsProcessing(supabase, items.map(item => item.id))

  // Create batch emails for Resend
  const batchEmails: BatchEmail[] = items.map(item => ({
    from: `${senderName} <${senderEmail}>`,
    to: [item.contact.email],
    subject: item.campaign.subject,
    html: item.campaign.html_content
      .replace(/{{first_name}}/g, item.contact.first_name || '')
      .replace(/{{last_name}}/g, item.contact.last_name || '')
      .replace(/{{email}}/g, item.contact.email)
  }))

  try {
    console.log(`🚀 Sending batch of ${batchEmails.length} emails via Resend`)
    
    // Send batch via Resend
    const batchResult = await resend.batch.send(batchEmails)
    
    if (batchResult.error) {
      console.error(`❌ Batch send failed for sender ${senderEmail}:`, batchResult.error)
      await handleBatchFailure(supabase, items, batchResult.error.message)
      return { senderId, senderEmail, sent: 0, failed: items.length, batchSize: 0 }
    }

    console.log(`✅ Batch sent successfully for sender ${senderEmail}:`, batchResult.data?.length, 'emails')
    
    // Process successful batch results
    await handleBatchSuccess(supabase, items, batchResult.data)
    
    // Update sender stats
    await updateSenderStats(supabase, senderId, items.length)

    return { 
      senderId, 
      senderEmail, 
      sent: items.length, 
      failed: 0, 
      batchSize: items.length 
    }
    
  } catch (error) {
    console.error(`💥 Unexpected error processing batch for sender ${senderEmail}:`, error)
    await handleBatchFailure(supabase, items, error.message)
    return { senderId, senderEmail, sent: 0, failed: items.length, batchSize: 0 }
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
        // Call start-campaign function - exactly like "Avvia Ora" does
        const startCampaignUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/start-campaign`
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        
        const response = await fetch(startCampaignUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({ 
            campaignId: campaign.id,
            startImmediately: true // Same as "Avvia Ora"
          })
        })

        if (!response.ok) {
          const errorData = await response.text()
          throw new Error(`Start-campaign failed: ${response.status} ${errorData}`)
        }

        const result = await response.json()
        console.log(`✅ Campaign "${campaign.name}" started via start-campaign:`, result)

        // Log the automatic start
        await supabase
          .from('logs')
          .insert({
            campaign_id: campaign.id,
            event_type: 'started',
            event_data: {
              started_at: new Date().toISOString(),
              trigger: 'automatic_scheduler',
              result: result
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