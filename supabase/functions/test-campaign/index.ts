// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log('🚀 Test Campaign Function loaded!')

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId } = await req.json()
    
    console.log(`🔍 Testing campaign: ${campaignId}`)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Test 1: Check if campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Campaign not found: ${campaignError?.message}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Campaign found: ${campaign.name} (${campaign.status})`)

    // Test 2: Check groups and senders
    const [groupsRes, sendersRes] = await Promise.all([
      supabase.from('campaign_groups').select('group_id').eq('campaign_id', campaignId),
      supabase.from('campaign_senders').select('sender_id').eq('campaign_id', campaignId)
    ])

    const groupIds = groupsRes.data?.map(g => g.group_id) || []
    const senderIds = sendersRes.data?.map(s => s.sender_id) || []

    console.log(`📊 Groups: ${groupIds.length}, Senders: ${senderIds.length}`)

    // Test 3: Check contacts
    const { data: contactGroupsData } = await supabase
      .from('contact_groups')
      .select('contact_id')
      .in('group_id', groupIds)

    const contactIds = contactGroupsData?.map(cg => cg.contact_id) || []

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, is_active')
      .in('id', contactIds)
      .eq('is_active', true)

    console.log(`👥 Active contacts: ${contacts?.length || 0}`)

    // Test 4: Check senders
    const { data: senders } = await supabase
      .from('senders')
      .select('*')
      .in('id', senderIds)
      .eq('is_active', true)

    console.log(`📧 Active senders: ${senders?.length || 0}`)

    // Test 5: Check existing queue entries
    const { data: existingQueue } = await supabase
      .from('campaign_queues')
      .select('*')
      .eq('campaign_id', campaignId)

    console.log(`📋 Existing queue entries: ${existingQueue?.length || 0}`)

    // Return comprehensive test results
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test completed successfully',
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          emails_per_batch: campaign.emails_per_batch,
          batch_interval_minutes: campaign.batch_interval_minutes
        },
        resources: {
          groups: groupIds.length,
          senders: senderIds.length,
          active_contacts: contacts?.length || 0,
          active_senders: senders?.length || 0,
          existing_queue_entries: existingQueue?.length || 0
        },
        can_start: contacts && contacts.length > 0 && senders && senders.length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Test error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/test-campaign' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

