import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Debug Campaign Status
 * 
 * Funzione per debuggare lo stato delle campagne e vedere esattamente
 * cosa c'è nella coda di invio.
 */

Deno.serve(async (req: Request) => {
  // Gestione CORS per preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { campaignId } = await req.json()

    console.log('🔍 DEBUGGING CAMPAIGN STATUS')
    
    if (campaignId) {
      // Debug specifica campagna
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

      // 3. Statistiche dettagliate
      const stats = {
        pending: allEmails?.filter(e => e.status === 'pending').length || 0,
        processing: allEmails?.filter(e => e.status === 'processing').length || 0,
        sent: allEmails?.filter(e => e.status === 'sent').length || 0,
        failed: allEmails?.filter(e => e.status === 'failed').length || 0,
        total: allEmails?.length || 0
      }

      // 4. Email future (scheduled_for > now)
      const now = new Date()
      const futureEmails = allEmails?.filter(e => 
        e.status === 'pending' && new Date(e.scheduled_for) > now
      ) || []

      const readyEmails = allEmails?.filter(e => 
        e.status === 'pending' && new Date(e.scheduled_for) <= now
      ) || []

      // 5. Raggruppa per orario
      const emailsByTime = allEmails?.reduce((acc, email) => {
        const time = new Date(email.scheduled_for).toLocaleString('it-IT')
        if (!acc[time]) acc[time] = []
        acc[time].push(email)
        return acc
      }, {} as Record<string, any[]>) || {}

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
        emails_by_time: Object.entries(emailsByTime).map(([time, emails]) => ({
          time,
          count: emails.length,
          statuses: emails.reduce((acc, e) => {
            acc[e.status] = (acc[e.status] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        })),
        should_be_completed: stats.pending === 0 && stats.processing === 0,
        problem_diagnosis: getDiagnosis(campaign, stats, futureEmails.length, readyEmails.length)
      }

      return new Response(
        JSON.stringify(result, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      // Debug generale - tutte le campagne attive
      console.log('📊 Debugging all active campaigns')
      
      const { data: activeCampaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('status', 'sending')

      if (campaignsError) {
        throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
      }

      const campaignStats = await Promise.all(
        (activeCampaigns || []).map(async (campaign) => {
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

          return {
            ...campaign,
            total_emails: totalCount || 0,
            pending_emails: pendingCount || 0,
            sent_emails: sentCount || 0,
            should_be_completed: (pendingCount || 0) === 0
          }
        })
      )

      return new Response(
        JSON.stringify({
          active_campaigns: campaignStats,
          summary: {
            total_active: activeCampaigns?.length || 0,
            campaigns_that_should_be_completed: campaignStats.filter(c => c.should_be_completed).length
          }
        }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('💥 Debug error:', error)
    
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

function getDiagnosis(campaign: any, stats: any, futureCount: number, readyCount: number): string[] {
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

  if (futureCount > 0) {
    issues.push(`⏳ OK: ${futureCount} email programmate per il futuro`)
  }

  if (readyCount > 0) {
    issues.push(`🔥 ATTENZIONE: ${readyCount} email pronte ma non inviate`)
  }

  if (issues.length === 0) {
    issues.push('✅ Tutto sembra normale')
  }

  return issues
}