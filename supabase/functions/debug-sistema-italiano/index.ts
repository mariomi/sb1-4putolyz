import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
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

    const campagnaId = (body as any).campagnaId

    console.log('🔍 DEBUGGING IL TUO SISTEMA ITALIANO')
    
    if (campagnaId) {
      console.log(`🎯 Debugging campagna: ${campagnaId}`)
      
      // 1. Stato della campagna (tabelle italiane)
      const { data: campagna, error: campagnaError } = await supabase
        .from('campagne')
        .select('*')
        .eq('id', campagnaId)
        .single()

      if (campagnaError) {
        throw new Error(`Campagna non trovata: ${campagnaError.message}`)
      }

      // 2. Campaign targets (dove vanno le email dopo send-campaign)
      const { data: targets, error: targetsError } = await supabase
        .from('campaign_targets')
        .select('id, status, email, created_at, sent_at, error_message, priority')
        .eq('campaign_id', campagnaId)
        .order('created_at')

      // 3. Scheduled emails (creati da generate_email_batches)
      const { data: scheduled, error: scheduledError } = await supabase
        .from('scheduled_emails')
        .select('id, stato_batch, ora_invio, emails_sent, emails_total, batch_id, email_list')
        .eq('campagna_id', campagnaId)
        .order('ora_invio')

      const targetStats = {
        ready: targets?.filter(t => t.status === 'ready').length || 0,
        processing: targets?.filter(t => t.status === 'processing').length || 0,
        sent: targets?.filter(t => t.status === 'sent').length || 0,
        failed: targets?.filter(t => t.status === 'failed').length || 0,
        total: targets?.length || 0
      }

      const scheduledStats = {
        pending: scheduled?.filter(s => s.stato_batch === 'pending').length || 0,
        processing: scheduled?.filter(s => s.stato_batch === 'processing').length || 0,
        sent: scheduled?.filter(s => s.stato_batch === 'sent').length || 0,
        failed: scheduled?.filter(s => s.stato_batch === 'failed').length || 0,
        total: scheduled?.length || 0
      }

      // 4. Prossimi invii programmati
      const now = new Date()
      const nextScheduled = scheduled?.filter(s => 
        s.stato_batch === 'pending' && new Date(s.ora_invio) > now
      ).slice(0, 5)

      // 5. Batch scaduti (dovevano essere inviati ma sono ancora pending)
      const overdueScheduled = scheduled?.filter(s => 
        s.stato_batch === 'pending' && new Date(s.ora_invio) <= now
      )

      const result = {
        campagna: {
          id: campagna.id,
          titolo: campagna.titolo,
          stato: campagna.stato,
          tipo_destinatari: campagna.tipo_destinatari,
          durata_invio_ore: campagna.durata_invio_ore,
          orario_inizio: campagna.orario_inizio,
          data_invio: campagna.data_invio
        },
        campaign_targets: {
          statistiche: targetStats,
          primi_5: targets?.slice(0, 5).map(t => ({
            email: t.email,
            status: t.status,
            created_at: new Date(t.created_at).toLocaleString('it-IT'),
            sent_at: t.sent_at ? new Date(t.sent_at).toLocaleString('it-IT') : null
          })) || []
        },
        scheduled_emails: {
          statistiche: scheduledStats,
          prossimi_invii: nextScheduled?.map(s => ({
            batch_id: s.batch_id,
            ora_invio: new Date(s.ora_invio).toLocaleString('it-IT'),
            emails_total: s.emails_total,
            stato: s.stato_batch
          })) || [],
          batch_scaduti: overdueScheduled?.map(s => ({
            batch_id: s.batch_id,
            ora_invio: new Date(s.ora_invio).toLocaleString('it-IT'),
            emails_total: s.emails_total,
            ritardo_minuti: Math.round((now.getTime() - new Date(s.ora_invio).getTime()) / 60000)
          })) || []
        },
        diagnosi: [],
        sistema_attivo: {
          targets_pronti: targetStats.ready,
          batch_programmati: scheduledStats.pending,
          batch_scaduti: overdueScheduled?.length || 0
        }
      }

      // Diagnosi problemi
      if (campagna.stato === 'programmata' && targetStats.total === 0 && scheduledStats.total === 0) {
        result.diagnosi.push('🚨 PROBLEMA GRAVE: Campagna programmata ma nessuna email creata!')
      }
      if (targetStats.total === 0 && scheduledStats.total === 0) {
        result.diagnosi.push('🚨 PROBLEMA: Nessuna email nella coda!')
      }
      if (targetStats.ready > 0) {
        result.diagnosi.push(`🔥 TARGETS PRONTI: ${targetStats.ready} email pronte per queue-processor`)
      }
      if (scheduledStats.pending > 0) {
        result.diagnosi.push(`⏳ BATCH PROGRAMMATI: ${scheduledStats.pending} batch per email-scheduler`)
      }
      if (overdueScheduled && overdueScheduled.length > 0) {
        result.diagnosi.push(`⚠️ BATCH SCADUTI: ${overdueScheduled.length} batch dovevano essere inviati ma sono ancora pending!`)
      }
      if (campagna.stato === 'programmata' && targetStats.sent > 0) {
        result.diagnosi.push(`🤔 STRANO: Campagna ancora "programmata" ma ${targetStats.sent} email già inviate`)
      }
      if (result.diagnosi.length === 0) {
        result.diagnosi.push('✅ Sistema sembra normale')
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else {
      // Debug generale - tutte le campagne attive
      console.log('📊 Debug generale di tutte le campagne')
      
      const { data: campagne, error: campagneError } = await supabase
        .from('campagne')
        .select('id, titolo, stato, created_at')
        .in('stato', ['programmata', 'sending', 'inviata'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (campagneError) {
        throw new Error(`Errore fetch campagne: ${campagneError.message}`)
      }

      const campaignStats = []
      for (const campagna of (campagne || [])) {
        const { count: targetsCount } = await supabase
          .from('campaign_targets')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campagna.id)

        const { count: scheduledCount } = await supabase
          .from('scheduled_emails')
          .select('*', { count: 'exact', head: true })
          .eq('campagna_id', campagna.id)

        campaignStats.push({
          ...campagna,
          targets_count: targetsCount || 0,
          scheduled_count: scheduledCount || 0
        })
      }

      const result = {
        campagne_recenti: campaignStats,
        summary: {
          totale_campagne: campagne?.length || 0,
          campagne_con_targets: campaignStats.filter(c => c.targets_count > 0).length,
          campagne_con_scheduled: campaignStats.filter(c => c.scheduled_count > 0).length
        },
        istruzioni: [
          "Per debug specifico, invia: {\"campagnaId\": \"ID_CAMPAGNA\"}",
          "Controlla se le campagne hanno targets E scheduled emails",
          "targets = email immediate, scheduled = email programmate"
        ]
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('💥 Debug error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})