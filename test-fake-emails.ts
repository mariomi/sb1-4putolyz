/**
 * Script di test per verificare l'invio di email fake
 * 
 * Usage:
 * npx tsx test-fake-emails.ts
 * 
 * Prerequisiti:
 * - Configurare le variabili d'ambiente in .env.local
 * - Avere contatti con email @example.com nel database
 */

import { createClient } from '@supabase/supabase-js'

// Configurazione
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testFakeEmails() {
  console.log('🧪 Testing fake email configuration...\n')

  try {
    // 1. Verifica se ci sono contatti con email fake
    console.log('1. Checking for fake email contacts...')
    const { data: fakeContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .or('email.ilike.%@example.com,email.ilike.%@test.com,email.ilike.%@fake.com')
      .limit(5)

    if (contactsError) {
      console.error('❌ Error fetching contacts:', contactsError)
      return
    }

    if (!fakeContacts || fakeContacts.length === 0) {
      console.log('⚠️ No fake email contacts found. Creating test contacts...')
      
      // Crea contatti di test
      const testContacts = [
        { email: 'test1@example.com', first_name: 'Test', last_name: 'User1' },
        { email: 'test2@example.com', first_name: 'Test', last_name: 'User2' },
        { email: 'demo@fake.com', first_name: 'Demo', last_name: 'User' }
      ]

      for (const contact of testContacts) {
        const { error } = await supabase
          .from('contacts')
          .insert([contact])
          .select()

        if (error) {
          console.error(`❌ Error creating contact ${contact.email}:`, error)
        } else {
          console.log(`✅ Created test contact: ${contact.email}`)
        }
      }
    } else {
      console.log(`✅ Found ${fakeContacts.length} fake email contacts:`)
      fakeContacts.forEach(contact => {
        console.log(`   - ${contact.email} (${contact.first_name} ${contact.last_name})`)
      })
    }

    // 2. Verifica se ci sono campanine in bozza
    console.log('\n2. Checking for draft campaigns...')
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('status', 'bozza')
      .limit(3)

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError)
      return
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ No draft campaigns found. You can create one manually.')
    } else {
      console.log(`✅ Found ${campaigns.length} draft campaigns:`)
      campaigns.forEach(campaign => {
        console.log(`   - ${campaign.name} (ID: ${campaign.id})`)
      })
    }

    // 3. Verifica le queue con email fake
    console.log('\n3. Checking campaign queue for fake emails...')
    const { data: queueItems, error: queueError } = await supabase
      .from('campaign_queues')
      .select(`
        id, status,
        contact:contacts!inner(email, first_name, last_name),
        campaign:campaigns!inner(name)
      `)
      .eq('status', 'pending')
      .limit(10)

    if (queueError) {
      console.error('❌ Error fetching queue:', queueError)
      return
    }

    const fakeEmailQueue = queueItems?.filter(item => 
      item.contact.email.includes('@example.com') ||
      item.contact.email.includes('@test.com') ||
      item.contact.email.includes('@fake.com')
    ) || []

    if (fakeEmailQueue.length > 0) {
      console.log(`✅ Found ${fakeEmailQueue.length} fake emails in queue:`)
      fakeEmailQueue.forEach(item => {
        console.log(`   - ${item.contact.email} for campaign "${item.campaign.name}"`)
      })
    } else {
      console.log('ℹ️ No fake emails in queue currently')
    }

    // 4. Suggerimenti per il test
    console.log('\n🎯 Next Steps to Test:')
    console.log('1. Configure environment variables in Supabase:')
    console.log('   - ALLOW_FAKE_EMAILS=true')
    console.log('   - ENVIRONMENT=development')
    console.log('   - TEST_EMAIL_OVERRIDE=your@email.com (optional)')
    console.log('\n2. Create a campaign with fake email contacts')
    console.log('3. Start the campaign and monitor the Edge Function logs')
    console.log('4. Look for messages like:')
    console.log('   "🧪 Test mode enabled - fake emails will be processed"')
    console.log('   "🔄 Allowing fake email in test mode: user@example.com"')

  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

// Esegui il test
testFakeEmails()