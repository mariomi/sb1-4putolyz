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

    const { campagnaId } = await req.json()

    if (!campagnaId) {
      throw new Error('campagnaId richiesto')
    }

    console.log(`🧪 TEST: Simulando programmazione campagna ${campagnaId}`)

    // 1. Controlla se la campagna esiste
    const { data: campagna, error: campagnaError } = await supabase
      .from('campagne')
      .select('*')
      .eq('id', campagnaId)
      .single()

    if (campagnaError || !campagna) {
      throw new Error('Campagna non trovata')
    }

    console.log(`✅ Campagna trovata: ${campagna.titolo}`)
    console.log(`📊 Stato attuale: ${campagna.stato}`)
    console.log(`🎯 Tipo destinatari: ${campagna.tipo_destinatari}`)

    // 2. Conta i contatti che dovrebbero ricevere l'email
    let contatti = []
    if (campagna.tipo_destinatari === 'specific' && campagna.destinatari_config?.contacts) {
      const { data, error } = await supabase
        .from('contatti')
        .select('*')
        .in('id', campagna.destinatari_config.contacts)
        .eq('profile_id', campagna.profile_id)

      contatti = data || []
    } else if (campagna.tipo_destinatari === 'groups' && campagna.destinatari_config?.groups) {
      const { data, error } = await supabase
        .from('contatti_gruppi')
        .select('contatti (*)')
        .in('gruppo_id', campagna.destinatari_config.groups)

      if (data) {
        const uniqueContacts = new Map()
        data.forEach(item => {
          if (item.contatti && !uniqueContacts.has(item.contatti.id)) {
            uniqueContacts.set(item.contatti.id, item.contatti)
          }
        })
        contatti = Array.from(uniqueContacts.values())
      }
    } else {
      const { data, error } = await supabase
        .from('contatti')
        .select('*')
        .eq('profile_id', campagna.profile_id)

      contatti = data || []
    }

    console.log(`📧 Contatti trovati: ${contatti.length}`)

    // 3. Verifica mittente
    const { data: mittente, error: mittenteError } = await supabase
      .from('mittenti')
      .select('*')
      .eq('id', campagna.mittente_id)
      .single()

    if (mittenteError || !mittente) {
      throw new Error('Mittente non trovato')
    }

    console.log(`👤 Mittente: ${mittente.nome_mittente} <${mittente.email_mittente}>`)

    // 4. Controlla se esistono già targets
    const { count: existingTargets } = await supabase
      .from('campaign_targets')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campagnaId)

    // 5. Controlla se esistono già scheduled emails  
    const { count: existingScheduled } = await supabase
      .from('scheduled_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campagna_id', campagnaId)

    const result = {
      campagna: {
        id: campagna.id,
        titolo: campagna.titolo,
        stato: campagna.stato,
        tipo_destinatari: campagna.tipo_destinatari,
        durata_invio_ore: campagna.durata_invio_ore,
        orario_inizio: campagna.orario_inizio
      },
      contatti_trovati: contatti.length,
      mittente: {
        nome: mittente.nome_mittente,
        email: mittente.email_mittente
      },
      stato_attuale: {
        campaign_targets_esistenti: existingTargets || 0,
        scheduled_emails_esistenti: existingScheduled || 0
      },
      test_risultato: {
        pronto_per_programmazione: contatti.length > 0 && mittente,
        step_successivo: contatti.length > 0 ? 
          "Chiama send-campaign per creare targets e scheduled_emails" : 
          "Configura prima i destinatari"
      }
    }

    console.log(`🎯 Test completato. Contatti: ${contatti.length}, Targets esistenti: ${existingTargets}, Scheduled esistenti: ${existingScheduled}`)

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Test error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})