import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface ResendDomain {
  id: string
  name: string
  status: string
  region: string
  created_at: string
  records: Array<{
    record: string
    name: string
    value: string
    type: string
    priority?: number
  }>
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

    console.log('🔍 Fetching domains from Resend...')

    // Get domains from Resend
    const { data: resendDomains, error: resendError } = await resend.domains.list()

    if (resendError) {
      console.error('❌ Error fetching Resend domains:', resendError)
      throw new Error(`Resend API error: ${resendError.message}`)
    }

    console.log(`📋 Found ${resendDomains?.data?.length || 0} domains on Resend`)

    // Get current domains from database
    const { data: localDomains, error: dbError } = await supabase
      .from('domains')
      .select('*')

    if (dbError) {
      console.error('❌ Error fetching local domains:', dbError)
      throw dbError
    }

    // Process and sync domains
    const syncResults = {
      resend_domains: resendDomains?.data || [],
      local_domains: localDomains || [],
      sync_actions: [] as Array<{
        action: string
        domain: string
        status: string
        message: string
      }>
    }

    // Check for domains that exist on Resend but not locally
    for (const resendDomain of (resendDomains?.data || [])) {
      const localDomain = localDomains?.find(d => d.domain_name === resendDomain.name)
      
      if (!localDomain) {
        syncResults.sync_actions.push({
          action: 'found_new',
          domain: resendDomain.name,
          status: resendDomain.status,
          message: `Domain found on Resend but not in local database`
        })
      } else {
        // Update local domain with Resend info
        const updateData = {
          resend_domain_id: resendDomain.id,
          verification_status: resendDomain.status === 'verified' ? 'verified' : 'pending',
          dns_records: resendDomain.records || {},
          updated_at: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('domains')
          .update(updateData)
          .eq('id', localDomain.id)

        if (updateError) {
          console.error(`❌ Error updating domain ${resendDomain.name}:`, updateError)
          syncResults.sync_actions.push({
            action: 'update_failed',
            domain: resendDomain.name,
            status: resendDomain.status,
            message: `Failed to update: ${updateError.message}`
          })
        } else {
          syncResults.sync_actions.push({
            action: 'updated',
            domain: resendDomain.name,
            status: resendDomain.status,
            message: `Successfully synced with Resend`
          })
        }
      }
    }

    // Check for local domains that don't exist on Resend
    for (const localDomain of (localDomains || [])) {
      const resendDomain = resendDomains?.data?.find(d => d.name === localDomain.domain_name)
      
      if (!resendDomain) {
        syncResults.sync_actions.push({
          action: 'local_only',
          domain: localDomain.domain_name,
          status: localDomain.verification_status,
          message: `Domain exists locally but not found on Resend`
        })
      }
    }

    console.log(`✅ Sync completed: ${syncResults.sync_actions.length} actions processed`)

    return new Response(
      JSON.stringify({
        success: true,
        data: syncResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Sync domains error:', error)
    
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