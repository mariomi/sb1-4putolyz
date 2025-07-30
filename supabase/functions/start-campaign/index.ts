import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Questi header sono la chiave per risolvere il problema del CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // O, per maggiore sicurezza: 'https://sb1-4putolyz.vercel.app'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestione della richiesta preflight (pre-volo) del browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { campaignId } = await req.json()

    if (!campaignId) {
      throw new Error('ID della campagna mancante nel corpo della richiesta.')
    }

    // Qui inserisci la logica per avviare la campagna.
    // Esempio: aggiorna lo stato della campagna nel database.
    const { error: updateError } = await supabaseClient
      .from('campaigns')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', campaignId)

    if (updateError) {
      throw updateError
    }

    return new Response(JSON.stringify({ message: `Campagna ${campaignId} avviata con successo` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
