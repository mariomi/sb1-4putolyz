import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xqsjyvqikrvibyluynwv.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p5dnFpa3J2aWJ5bHV5bnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzIzOTgsImV4cCI6MjA2ODUwODM5OH0.rfBsX1s-3dJcr7hvd9x3hHW7WZPJpT-SMYrMfiG8fgc'

const supabase = createClient(supabaseUrl, anonKey)

async function testNewCampaign() {
  console.log('🧪 Avvio Test Nuova Campagna\n')
  
  // 1. Login
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'mario@gmail.com',
    password: 'mario@gmail.com'
  })
  
  console.log(`✅ Autenticato: ${authData?.user?.email}\n`)
  
  // 2. Controlla tutte le campagne esistenti
  console.log('📋 STATO CAMPAGNE ESISTENTI:')
  console.log('=' .repeat(50))
  
  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, updated_at')
    .eq('profile_id', authData?.user?.id)
    .order('updated_at', { ascending: false })
    .limit(5)
  
  allCampaigns?.forEach((campaign, i) => {
    console.log(`${i + 1}. "${campaign.name}" (${campaign.id})`)
    console.log(`   Status: ${campaign.status}`)
    console.log(`   Updated: ${new Date(campaign.updated_at).toLocaleString()}\n`)
  })
  
  // 3. Prova ad avviare di nuovo la campagna esistente
  const campaignId = '91fc84b6-b5a6-4c1a-8acc-654ece557c3a' // ID campagna "cdsx"
  
  console.log('🚀 RIAVVIO CAMPAGNA "cdsx":')
  console.log('=' .repeat(50))
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/start-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData?.session?.access_token}`
      },
      body: JSON.stringify({ 
        campaignId,
        startImmediately: true
      })
    })
    
    console.log(`📡 Risposta: ${response.status} ${response.statusText}`)
    
    const responseText = await response.text()
    console.log(`📄 Body: ${responseText}`)
    
    if (response.ok) {
      const result = JSON.parse(responseText)
      console.log(`\n✅ CAMPAGNA RIAVVIATA!`)
      console.log(`   Email in coda: ${result.emailsQueued}`)
      
      // Verifica stato dopo avvio
      await new Promise(resolve => setTimeout(resolve, 2000)) // Aspetta 2 secondi
      
      console.log('\n📊 STATO DOPO AVVIO:')
      const { count: pendingCount } = await supabase
        .from('campaign_queues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      const { count: sendingCampaigns } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sending')
        .eq('profile_id', authData?.user?.id)
      
      console.log(`   📧 Email pending: ${pendingCount}`)
      console.log(`   🚀 Campagne sending: ${sendingCampaigns}`)
      
      if (pendingCount && pendingCount > 0) {
        console.log('\n✅ SUCCESSO! Email in coda pronte per processamento')
        console.log('⏰ Il cron job (ora ogni minuto) le processerà automaticamente')
        
        // Mostra prossime email da inviare
        const { data: nextEmails } = await supabase
          .from('campaign_queues')
          .select(`
            scheduled_for,
            contact:contacts!inner(email),
            sender:senders!inner(email_from)
          `)
          .eq('status', 'pending')
          .order('scheduled_for', { ascending: true })
          .limit(5)
        
        console.log('\n📬 Prossime 5 email da inviare:')
        nextEmails?.forEach((email, i) => {
          const scheduledTime = new Date(email.scheduled_for)
          const now = new Date()
          const isReady = scheduledTime <= now
          
          console.log(`${i + 1}. ${email.contact.email} via ${email.sender.email_from}`)
          console.log(`   Schedulata: ${scheduledTime.toLocaleString()}`)
          console.log(`   Status: ${isReady ? '✅ Pronta' : `⏰ Tra ${Math.round((scheduledTime.getTime() - now.getTime()) / 60000)} min`}`)
        })
      } else {
        console.log('\n⚠️  Nessuna email in coda dopo l\'avvio')
      }
      
    } else {
      console.log(`\n❌ ERRORE RIAVVIO CAMPAGNA`)
    }
    
  } catch (error) {
    console.error('\n❌ Errore:', error)
  }
  
  // 4. Test manuale immediato del processor
  console.log('\n🔧 TEST MANUALE CAMPAIGN PROCESSOR:')
  console.log('=' .repeat(50))
  
  try {
    const processorResponse = await fetch(`${supabaseUrl}/functions/v1/campaign-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData?.session?.access_token}`
      },
      body: JSON.stringify({ 
        manual_test: true,
        timestamp: new Date().toISOString()
      })
    })
    
    const processorText = await processorResponse.text()
    console.log(`📡 Processor response: ${processorResponse.status}`)
    console.log(`📄 Processor body: ${processorText}`)
    
    if (processorResponse.ok) {
      const processorResult = JSON.parse(processorText)
      console.log(`\n✅ PROCESSOR ESEGUITO:`)
      console.log(`   Processate: ${processorResult.processed || 0}`)
      console.log(`   Inviate: ${processorResult.sent || 0}`)
      console.log(`   Fallite: ${processorResult.failed || 0}`)
      
      if ((processorResult.sent || 0) > 0) {
        console.log('\n🎉 EMAIL INVIATE CON SUCCESSO!')
      } else if ((processorResult.processed || 0) > 0) {
        console.log('\n⚠️  Email processate ma nessuna inviata - controlla logs')
      } else {
        console.log('\n📭 Nessuna email pronta per l\'invio in questo momento')
      }
    }
    
  } catch (processorError) {
    console.error('\n❌ Errore processor:', processorError)
  }
}

testNewCampaign()