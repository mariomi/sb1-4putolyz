import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = 'https://xqsjyvqikrvibyluynwv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p5dnFpa3J2aWJ5bHV5bnd2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI5NzE5OSwiZXhwIjoyMDUwODczMTk5fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugCampaignStatus() {
  console.log('🔍 Debugging campaign status...')
  
  try {
    // 1. Check if there are any campaigns
    console.log('\n1. Checking campaigns...')
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(5)
    
    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError)
    } else {
      console.log(`✅ Found ${campaigns?.length || 0} campaigns`)
      campaigns?.forEach(campaign => {
        console.log(`   - ${campaign.name} (ID: ${campaign.id}, Status: ${campaign.status})`)
      })
    }

    // 2. Check if there are any groups
    console.log('\n2. Checking groups...')
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .limit(5)
    
    if (groupsError) {
      console.error('❌ Error fetching groups:', groupsError)
    } else {
      console.log(`✅ Found ${groups?.length || 0} groups`)
      groups?.forEach(group => {
        console.log(`   - ${group.name} (ID: ${group.id})`)
      })
    }

    // 3. Check if there are any contacts
    console.log('\n3. Checking contacts...')
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(5)
    
    if (contactsError) {
      console.error('❌ Error fetching contacts:', contactsError)
    } else {
      console.log(`✅ Found ${contacts?.length || 0} contacts`)
      contacts?.forEach(contact => {
        console.log(`   - ${contact.first_name} ${contact.last_name} (${contact.email})`)
      })
    }

    // 4. Check if there are any contact_groups relationships
    console.log('\n4. Checking contact_groups relationships...')
    const { data: contactGroups, error: contactGroupsError } = await supabase
      .from('contact_groups')
      .select('*')
      .limit(10)
    
    if (contactGroupsError) {
      console.error('❌ Error fetching contact_groups:', contactGroupsError)
    } else {
      console.log(`✅ Found ${contactGroups?.length || 0} contact-group relationships`)
      contactGroups?.forEach(cg => {
        console.log(`   - Contact ${cg.contact_id} -> Group ${cg.group_id}`)
      })
    }

    // 5. Check if there are any campaign_groups relationships
    console.log('\n5. Checking campaign_groups relationships...')
    const { data: campaignGroups, error: campaignGroupsError } = await supabase
      .from('campaign_groups')
      .select('*')
      .limit(10)
    
    if (campaignGroupsError) {
      console.error('❌ Error fetching campaign_groups:', campaignGroupsError)
    } else {
      console.log(`✅ Found ${campaignGroups?.length || 0} campaign-group relationships`)
      campaignGroups?.forEach(cg => {
        console.log(`   - Campaign ${cg.campaign_id} -> Group ${cg.group_id}`)
      })
    }

    // 6. Check if there are any senders
    console.log('\n6. Checking senders...')
    const { data: senders, error: sendersError } = await supabase
      .from('senders')
      .select('*')
      .limit(5)
    
    if (sendersError) {
      console.error('❌ Error fetching senders:', sendersError)
    } else {
      console.log(`✅ Found ${senders?.length || 0} senders`)
      senders?.forEach(sender => {
        console.log(`   - ${sender.email_from} (${sender.domain}) - Active: ${sender.is_active}`)
      })
    }

    // 7. Check if there are any campaign_senders relationships
    console.log('\n7. Checking campaign_senders relationships...')
    const { data: campaignSenders, error: campaignSendersError } = await supabase
      .from('campaign_senders')
      .select('*')
      .limit(10)
    
    if (campaignSendersError) {
      console.error('❌ Error fetching campaign_senders:', campaignSendersError)
    } else {
      console.log(`✅ Found ${campaignSenders?.length || 0} campaign-sender relationships`)
      campaignSenders?.forEach(cs => {
        console.log(`   - Campaign ${cs.campaign_id} -> Sender ${cs.sender_id}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the debug function
debugCampaignStatus()