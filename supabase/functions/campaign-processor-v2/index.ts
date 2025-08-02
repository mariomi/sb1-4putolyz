import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Campaign Processor V2 - Versione Semplificata e Robusta
 * 
 * Logica chiara:
 * 1. Trova email pronte per l'invio (scheduled_for <= now AND status = pending)
 * 2. Le invia in batch
 * 3. Controlla se le campagne sono completate (NESSUNA email pending in QUALSIASI momento)
 */

interface QueueEmail {
  id: string
  campaign_id: string
  contact_id: string
  sender_id: string
  scheduled_for: string
  status: string
  retry_count: number
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
    daily_limit: number
    emails_sent_today: number
    is_active: boolean
  }
  campaign: {
    name: string
    subject: string
    html_content: string
  }
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

    console.log('🚀 Campaign Processor V2 started')
    console.log(`⏰ Current time: ${new Date().toISOString()}`)

    // STEP 1: Trova email pronte per l'invio
    const now = new Date().toISOString()
    const { data: readyEmails, error: emailsError } = await supabase
      .from('campaign_queues')
      .select(`
        *,
        contact:contacts!inner(email, first_name, last_name, is_active),
        sender:senders!inner(id, email_from, display_name, daily_limit, emails_sent_today, is_active),
        campaign:campaigns!inner(name, subject, html_content)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .eq('contact.is_active', true)
      .eq('sender.is_active', true)
      .limit(50)
      .order('scheduled_for', { ascending: true })

    if (emailsError) {
      throw new Error(`Failed to fetch ready emails: ${emailsError.message}`)
    }

    console.log(`📧 Found ${readyEmails?.length || 0} emails ready to send`)

    if (!readyEmails || readyEmails.length === 0) {
      console.log('✅ No emails to send right now')
      
      // Controlla se ci sono campagne che dovrebbero essere completate
      await checkAndCompleteCampaigns(supabase)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails ready to send',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Log dettagliato delle email da inviare
    console.log('📋 EMAILS TO SEND:')
    readyEmails.forEach((email, index) => {
      console.log(`  ${index + 1}. Campaign: ${email.campaign.name}`)
      console.log(`     To: ${email.contact.email}`)
      console.log(`     Scheduled: ${new Date(email.scheduled_for).toLocaleString('it-IT')}`)
      console.log(`     Sender: ${email.sender.email_from}`)
    })

    // STEP 3: Raggruppa per campagna per evitare problemi
    const emailsByCampaign = readyEmails.reduce((acc, email) => {
      if (!acc[email.campaign_id]) acc[email.campaign_id] = []
      acc[email.campaign_id].push(email)
      return acc
    }, {} as Record<string, QueueEmail[]>)

    let totalSent = 0
    let totalFailed = 0

    // STEP 4: Processa ogni campagna
    for (const [campaignId, emails] of Object.entries(emailsByCampaign)) {
      console.log(`\n📤 Processing ${emails.length} emails for campaign ${emails[0].campaign.name}`)
      
      // Marca come processing
      await markEmailsAsProcessing(supabase, emails.map(e => e.id))

      try {
        // Invia le email
        for (const email of emails) {
          const result = await sendSingleEmail(resend, email)
          
          if (result.success) {
            await markEmailAsSent(supabase, email.id, result.resendId)
            totalSent++
            console.log(`  ✅ Sent: ${email.contact.email}`)
          } else {
            await markEmailAsFailed(supabase, email.id, result.error)
            totalFailed++
            console.log(`  ❌ Failed: ${email.contact.email} - ${result.error}`)
          }
        }

        // Aggiorna statistiche mittenti
        await updateSenderStats(supabase, emails)
        
      } catch (error) {
        console.error(`💥 Error processing campaign ${campaignId}:`, error)
        
        // Marca tutte come failed
        for (const email of emails) {
          await markEmailAsFailed(supabase, email.id, error.message)
          totalFailed++
        }
      }
    }

    console.log(`\n📊 PROCESSING COMPLETE: ${totalSent} sent, ${totalFailed} failed`)

    // STEP 5: Controlla campagne completate
    await checkAndCompleteCampaigns(supabase)

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalSent + totalFailed,
        sent: totalSent,
        failed: totalFailed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Campaign processor V2 error:', error)
    
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

async function markEmailsAsProcessing(supabase: any, emailIds: string[]) {
  if (emailIds.length === 0) return

  const { error } = await supabase
    .from('campaign_queues')
    .update({ 
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .in('id', emailIds)

  if (error) {
    console.error('Error marking emails as processing:', error)
  }
}

async function sendSingleEmail(resend: any, email: QueueEmail) {
  try {
    const result = await resend.emails.send({
      from: `${email.sender.display_name} <${email.sender.email_from}>`,
      to: [email.contact.email],
      subject: email.campaign.subject,
      html: email.campaign.html_content
        .replace(/{{first_name}}/g, email.contact.first_name || '')
        .replace(/{{last_name}}/g, email.contact.last_name || '')
        .replace(/{{email}}/g, email.contact.email)
    })

    return { success: true, resendId: result.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function markEmailAsSent(supabase: any, emailId: string, resendId: string) {
  const now = new Date().toISOString()
  
  await supabase
    .from('campaign_queues')
    .update({ 
      status: 'sent',
      sent_at: now,
      resend_email_id: resendId,
      updated_at: now
    })
    .eq('id', emailId)
}

async function markEmailAsFailed(supabase: any, emailId: string, errorMessage: string) {
  const now = new Date().toISOString()
  
  await supabase
    .from('campaign_queues')
    .update({ 
      status: 'failed',
      error_message: errorMessage,
      updated_at: now
    })
    .eq('id', emailId)
}

async function updateSenderStats(supabase: any, emails: QueueEmail[]) {
  const senderCounts = emails.reduce((acc, email) => {
    if (email.status === 'sent') {
      acc[email.sender_id] = (acc[email.sender_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  for (const [senderId, count] of Object.entries(senderCounts)) {
    if (count > 0) {
      const { error } = await supabase.rpc('increment_sender_emails_sent', {
        sender_id_in: senderId,
        increment_by: count,
      });
      if (error) {
        console.error(`Error updating stats for sender ${senderId}:`, error);
      }
    }
  }
}

async function checkAndCompleteCampaigns(supabase: any) {
  console.log('\n🔍 Checking for completed campaigns...');

  const { data: activeCampaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, start_date, end_date')
    .eq('status', 'sending');

  if (campaignsError) {
    if (campaignsError.code === '404') {
      console.warn('No active campaigns found.');
      return;
    }
    console.error('Error fetching active campaigns:', campaignsError);
    return;
  }

  if (!activeCampaigns || activeCampaigns.length === 0) {
    console.log('No active campaigns to process.');
    return;
  }

  console.log(`Found ${activeCampaigns.length} active campaigns`)

  for (const campaign of activeCampaigns) {
    const now = new Date();
    const endDate = new Date(campaign.end_date);

    if (now > endDate) {
      console.log(`🏁 Completing campaign "${campaign.name}" as it has passed its end date.`);

      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      await supabase
        .from('logs')
        .insert({
          campaign_id: campaign.id,
          event_type: 'completed',
          event_data: {
            completed_at: new Date().toISOString(),
            reason: 'End date reached'
          }
        });
    } else {
      console.log(`⏳ Campaign "${campaign.name}" is still within its active period.`)
    }
  }
}

async function processEmails(supabase: any, resend: any) {
  const now = new Date().toISOString();
  const { data: emails, error: emailsError } = await supabase
    .from('campaign_queues')
    .select(`
      id, campaign_id, contact_id, sender_id, scheduled_for, status,
      contact:contacts(email, first_name, last_name),
      sender:senders(email_from, display_name),
      campaign:campaigns(subject, html_content)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(50);

  if (emailsError) throw emailsError;

  for (const email of emails) {
    try {
      await resend.emails.send({
        from: `${email.sender.display_name} <${email.sender.email_from}>`,
        to: [email.contact.email],
        subject: email.campaign.subject,
        html: email.campaign.html_content
          .replace(/{{first_name}}/g, email.contact.first_name)
          .replace(/{{last_name}}/g, email.contact.last_name)
          .replace(/{{email}}/g, email.contact.email),
      });

      await supabase.from('campaign_queues').update({ status: 'sent' }).eq('id', email.id);
    } catch (error) {
      await supabase.from('campaign_queues').update({ status: 'failed', error_message: error.message }).eq('id', email.id);
    }
  }
}