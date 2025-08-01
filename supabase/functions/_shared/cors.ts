// Percorso del file: supabase/functions/_shared/cors.ts
// Configurazione CORS condivisa per tutte le Edge Functions

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permette tutte le origini per sviluppo
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Funzione helper per gestire le preflight requests
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }
  return null;
}