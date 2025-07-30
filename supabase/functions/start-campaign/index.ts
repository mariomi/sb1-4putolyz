import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurazione CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://sb1-4putolyz.vercel.app', // Specifica il dominio del frontend
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Gestione della richiesta preflight (OPTIONS)
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

    // Logica per avviare la campagna
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
