// Percorso del file: supabase/functions/_shared/cors.ts

// Definiamo le intestazioni CORS che permettono al tuo frontend Vercel di comunicare con questa funzione.
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://sb1-4putolyz.vercel.app', // URL esatto del tuo sito
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};