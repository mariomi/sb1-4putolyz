// Percorso del file: supabase/functions/start-campaign/index.ts
// VERSIONE AUTO-CONTENUTA CHE NON RICHIEDE ALTRI FILE

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Contenuto di _shared/cors.ts INCOLLATO QUI ---
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://sb1-4putolyz.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Contenuto di start-campaign-execution.ts INCOLLATO QUI ---
async function startCampaignExecution(supabaseAdmin: SupabaseClient, campaignId: string) {
  console.log(`[EXEC] Starting campaign execution for ID: ${campaignId}`);

  try {
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    console.log(`[EXEC] Campaign status updated to 'in_progress'.`);

    const [groupsRes, sendersRes] = await Promise.all([
      supabaseAdmin.from('campaign_groups').select('group_id').eq('campaign_id', campaignId),
      supabaseAdmin.from('campaign_senders').select('sender_id').eq('campaign_id', campaignId)
    ]);

    if (groupsRes.error || sendersRes.error) throw new Error('Failed to fetch groups or senders.');

    const groupIds = groupsRes.data.map(g => g.group_id);
    const senderIds = sendersRes.data.map(s => s.sender_id);

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, email, first_name, last_name')
      .in('group_id', groupIds);

    if (contactsError) throw new Error('Failed to fetch contacts.');
    if (!contacts || contacts.length === 0) throw new Error('No contacts found for this campaign.');

    const { data: senders, error: sendersDataError } = await supabaseAdmin
      .from('senders')
      .select('*')
      .in('id', senderIds);
    if (sendersDataError || !senders) throw new Error('Failed to fetch sender details.');

    console.log(`[EXEC] Found ${contacts.length} contacts and ${senders.length} senders.`);

    let senderIndex = 0;
    const totalEmailsToSend = contacts.length;
    const batchSize = campaign.emails_per_batch;
    const batchInterval = campaign.batch_interval_minutes * 60 * 1000;

    for (let i = 0; i < totalEmailsToSend; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      console.log(`[EXEC] Processing batch ${i / batchSize + 1} of ${Math.ceil(totalEmailsToSend / batchSize)}.`);

      for (const contact of batch) {
        const currentSender = senders[senderIndex];
        const emailHtml = campaign.html_content
          .replace(/{{first_name}}/g, contact.first_name || '')
          .replace(/{{last_name}}/g, contact.last_name || '')
          .replace(/{{email}}/g, contact.email);

        console.log(`[EXEC] Sending email to ${contact.email} from ${currentSender.email_from}`);
        // NOTA: La chiamata a Resend è commentata come nel tuo repo originale.
        // Se usi Resend, dovrai aggiungere la logica qui.
        // await resend.emails.send({ ... });

        await supabaseAdmin.from('campaign_logs').insert({
          campaign_id: campaignId,
          contact_id: contact.id,
          sender_id: currentSender.id,
          status: 'sent',
        });

        senderIndex = (senderIndex + 1) % senders.length;
      }

      if (i + batchSize < totalEmailsToSend) {
        console.log(`[EXEC] Waiting for ${batchInterval / 1000} seconds before next batch.`);
        await new Promise(resolve => setTimeout(resolve, batchInterval));
      }
    }

    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    console.log(`[EXEC] Campaign ${campaignId} completed successfully.`);

  } catch (error) {
    console.error(`[EXEC] Error during campaign execution for ${campaignId}:`, error);
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
  }
}


// --- LA TUA FUNZIONE PRINCIPALE (MODIFICATA LEGGERMENTE) ---
console.log(`🚀 Function "start-campaign" up and running!`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId } = await req.json()

    if (!campaignId) {
      throw new Error('Missing campaignId in request body')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Ora chiamiamo la funzione che abbiamo incollato sopra
    await startCampaignExecution(supabaseAdmin, campaignId)

    return new Response(JSON.stringify({ message: `Campaign ${campaignId} started successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in start-campaign function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})