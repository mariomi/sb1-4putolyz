import { createClient } from 'npm:@supabase/supabase-js@2'

// CORS headers semplici
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
  // Gestione CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let body = {}
    try {
      body = await req.json()
    } catch (e) {
      // Se non c'è body JSON, usa oggetto vuoto
    }

    const campaignId = (body as any).campaignId

    console.log('🔍 DEBUGGING CAMPAIGN STATUS')
    
    if (campaignId) {
      console.log(`🎯 Debugging campaign: ${campaignId}`)
      
      // 1. Stato della campagna
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError) {
        throw new Error(`Campaign not found: ${campaignError.message}`)
      }

      // 2. Tutte le email nella coda
      const { data: allEmails, error: emailsError } = await supabase
        .from('campaign_queues')
        .select('id, status, scheduled_for, contact_id, sender_id, sent_at, error_message')
        .eq('campaign_id', campaignId)
        .order('scheduled_for')

      if (emailsError) {
        throw new Error(`Failed to fetch emails: ${emailsError.message}`)
      }

      // 3. Statistiche
      const emails = allEmails || []
      const stats = {
        pending: emails.filter(e => e.status === 'pending').length,
        processing: emails.filter(e => e.status === 'processing').length,
        sent: emails.filter(e => e.status === 'sent').length,
        failed: emails.filter(e => e.status === 'failed').length,
        total: emails.length
      }

      // 4. Email future vs ready
      const now = new Date()
      const futureEmails = emails.filter(e => 
        e.status === 'pending' && new Date(e.scheduled_for) > now
      )
      const readyEmails = emails.filter(e => 
        e.status === 'pending' && new Date(e.scheduled_for) <= now
      )

      // 5. Raggruppa per orario
      const emailsByTime: Record<string, any[]> = {}
      emails.forEach(email => {
        const time = new Date(email.scheduled_for).toLocaleString('it-IT')
        if (!emailsByTime[time]) emailsByTime[time] = []
        emailsByTime[time].push(email)
      })

      const timeGroups = Object.entries(emailsByTime).map(([time, emails]) => {
        const statuses: Record<string, number> = {}
        emails.forEach(e => {
          statuses[e.status] = (statuses[e.status] || 0) + 1
        })
        return { time, count: emails.length, statuses }
      })

      // 6. Diagnosi
      const issues = []
      if (campaign.status === 'sending' && stats.total === 0) {
        issues.push('🚨 PROBLEMA: Campagna in sending ma nessuna email in coda!')
      }
      if (campaign.status === 'sending' && stats.pending === 0 && stats.processing === 0) {
        if (stats.sent === stats.total) {
          issues.push('✅ DOVREBBE ESSERE COMPLETATA: Tutte le email sono state inviate')
        } else {
          issues.push('🚨 PROBLEMA: Nessuna email pending ma non tutte sono state inviate')
        }
      }
      if (futureEmails.length > 0) {
        issues.push(`⏳ OK: ${futureEmails.length} email programmate per il futuro`)
      }
      if (readyEmails.length > 0) {
        issues.push(`🔥 ATTENZIONE: ${readyEmails.length} email pronte ma non inviate`)
      }
      if (issues.length === 0) {
        issues.push('✅ Tutto sembra normale')
      }

      const result = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          emails_per_batch: campaign.emails_per_batch,
          batch_interval_minutes: campaign.batch_interval_minutes,
          start_date: campaign.start_date,
          start_time_of_day: campaign.start_time_of_day
        },
        statistics: stats,
        queue_analysis: {
          ready_now: readyEmails.length,
          scheduled_future: futureEmails.length,
          next_batch_time: futureEmails.length > 0 ? 
            new Date(Math.min(...futureEmails.map(e => new Date(e.scheduled_for).getTime()))).toLocaleString('it-IT') 
            : null
        },
        emails_by_time: timeGroups,
        should_be_completed: stats.pending === 0 && stats.processing === 0,
        problem_diagnosis: issues
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else {
      // Debug generale
      console.log('📊 Debugging all active campaigns')
      
      const { data: activeCampaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('status', 'sending')

      if (campaignsError) {
        throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
      }

      const campaignStats = []
      for (const campaign of (activeCampaigns || [])) {
        const { count: totalCount } = await supabase
          .from('campaign_queues')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)

        const { count: pendingCount } = await supabase
          .from('campaign_queues')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')

        const { count: sentCount } = await supabase
          .from('campaign_queues')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'sent')

        campaignStats.push({
          ...campaign,
          total_emails: totalCount || 0,
          pending_emails: pendingCount || 0,
          sent_emails: sentCount || 0,
          should_be_completed: (pendingCount || 0) === 0
        })
      }

      const result = {
        active_campaigns: campaignStats,
        summary: {
          total_active: activeCampaigns?.length || 0,
          campaigns_that_should_be_completed: campaignStats.filter(c => c.should_be_completed).length
        }
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('💥 Debug error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})