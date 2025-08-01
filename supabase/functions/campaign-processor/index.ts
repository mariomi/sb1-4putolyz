import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

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
    email_from: string
    display_name: string
    domain: string
    daily_limit: number
    emails_sent_today: number
    current_day: number
    last_sent_at: string | null
  }
  campaign: {
    name: string
    subject: string
    html_content: string
    start_time_of_day: string
    send_duration_hours: number
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

    console.log('🚀 Campaign processor started')

    // Get pending queue items that are ready to be sent
    const now = new Date().toISOString()
    const { data: queueItems, error: queueError } = await supabase
      .from('campaign_queues')
      .select(`
        *,
        contact:contacts!inner(email, first_name, last_name, is_active),
        sender:senders!inner(email_from, display_name, domain, daily_limit, emails_sent_today, current_day, last_sent_at, is_active),
        campaign:campaigns!inner(name, subject, html_content, status, start_time_of_day, send_duration_hours)
      `)
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .eq('contact.is_active', true)
      .eq('sender.is_active', true)
      .eq('campaign.status', 'sending')
      .limit(50)
      .order('scheduled_time', { ascending: true })

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

    let processedCount = 0
    let sentCount = 0
    let failedCount = 0

    // Process each queue item
    for (const item of queueItems as QueueItem[]) {
      try {
        const nowDate = new Date()

        // Reset daily counters if a new day started
        const startOfToday = new Date(nowDate)
        startOfToday.setUTCHours(0, 0, 0, 0)
        if (!item.sender.last_sent_at || new Date(item.sender.last_sent_at) < startOfToday) {
          await supabase
            .from('senders')
            .update({
              emails_sent_today: 0,
              current_day: item.sender.current_day + 1,
              updated_at: nowDate.toISOString(),
            })
            .eq('id', item.sender_id)

          item.sender.emails_sent_today = 0
          item.sender.current_day = item.sender.current_day + 1
        }

        // Check if sender has reached daily limit
        if (item.sender.emails_sent_today >= item.sender.daily_limit) {
          console.log(`⏸️ Sender ${item.sender.email_from} has reached daily limit`)
          continue
        }

        // Ensure we are within campaign sending window
        const [h, m] = item.campaign.start_time_of_day.split(':').map(Number)
        const campaignStart = new Date(nowDate)
        campaignStart.setUTCHours(h, m, 0, 0)
        const campaignEnd = new Date(campaignStart.getTime() + item.campaign.send_duration_hours * 60 * 60 * 1000)

        if (nowDate < campaignStart || nowDate > campaignEnd) {
          console.log(`⏰ Outside sending window for campaign ${item.campaign_id}`)
          continue
        }

        // Mark as processing
        await supabase
          .from('campaign_queues')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        // Send email via Resend
        const emailData = {
          from: `${item.sender.display_name} <${item.sender.email_from}>`,
          to: [item.contact.email],
          subject: item.campaign.subject,
          html: item.campaign.html_content.replace(/{{first_name}}/g, item.contact.first_name)
            .replace(/{{last_name}}/g, item.contact.last_name)
            .replace(/{{email}}/g, item.contact.email),
        }

        console.log(`📤 Sending email to ${item.contact.email} from ${item.sender.email_from}`)

        const { data: emailResult, error: emailError } = await resend.emails.send(emailData)

        if (emailError) {
          console.error(`❌ Failed to send email to ${item.contact.email}:`, emailError)

          // Mark as failed and log error
          await Promise.all([
            supabase
              .from('campaign_queues')
              .update({
                status: 'failed',
                error_message: emailError.message,
                retry_count: item.retry_count + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id),

            supabase
              .from('senders')
              .update({
                emails_sent_today: item.sender.emails_sent_today + 1,
                last_sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.sender_id),

            supabase
              .from('logs')
              .insert({
                campaign_id: item.campaign_id,
                queue_entry_id: item.id,
                sender_id: item.sender_id,
                contact_id: item.contact_id,
                event_type: 'failed',
                event_data: {
                  error: emailError.message,
                  email: item.contact.email,
                  sender: item.sender.email_from
                }
              })
          ])

          item.sender.emails_sent_today += 1
          item.sender.last_sent_at = new Date().toISOString()
          failedCount++
        } else {
          console.log(`✅ Email sent successfully to ${item.contact.email}, ID: ${emailResult.id}`)
          
          // Mark as sent and update sender stats
          await Promise.all([
            supabase
              .from('campaign_queues')
              .update({ 
                status: 'sent',
                sent_at: new Date().toISOString(),
                resend_email_id: emailResult.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id),
            
            supabase
              .from('senders')
              .update({ 
                emails_sent_today: item.sender.emails_sent_today + 1,
                last_sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.sender_id),
            
            supabase
              .from('logs')
              .insert({
                campaign_id: item.campaign_id,
                queue_entry_id: item.id,
                sender_id: item.sender_id,
                contact_id: item.contact_id,
                event_type: 'sent',
                event_data: {
                  resend_email_id: emailResult.id,
                  email: item.contact.email,
                  sender: item.sender.email_from
                }
              })
          ])
          
          sentCount++
        }
        
        processedCount++
        
        // Small delay between sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`💥 Unexpected error processing queue item ${item.id}:`, error)
        
        await supabase
          .from('campaign_queues')
          .update({ 
            status: 'failed',
            error_message: error.message,
            retry_count: item.retry_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
        
        failedCount++
      }
    }

    // Check if any campaigns are completed
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('status', 'sending')

    if (activeCampaigns) {
      for (const campaign of activeCampaigns) {
        const { data: pendingCount } = await supabase
          .from('campaign_queues')
          .select('id', { count: 'exact' })
          .eq('campaign_id', campaign.id)
          .in('status', ['pending', 'processing'])

        if (pendingCount && pendingCount.length === 0) {
          console.log(`🏁 Campaign ${campaign.id} completed`)
          
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
                  completed_at: new Date().toISOString()
                }
              })
          ])
        }
      }
    }

    console.log(`📊 Processing complete: ${sentCount} sent, ${failedCount} failed, ${processedCount} total`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        sent: sentCount,
        failed: failedCount
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