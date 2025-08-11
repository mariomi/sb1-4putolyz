import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xqsjyvqikrvibyluynwv.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p5dnFpa3J2aWJ5bHV5bnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzIzOTgsImV4cCI6MjA2ODUwODM5OH0.rfBsX1s-3dJcr7hvd9x3hHW7WZPJpT-SMYrMfiG8fgc'

const supabase = createClient(supabaseUrl, anonKey)

async function debugCampaignStatus() {
  console.log('🔍 Debug Stato Campagna - Perché le Email Non Vengono Inviate\n')
  
  // 1. Login
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'mario@gmail.com',
    password: 'mario@gmail.com'
  })
  
  console.log(`✅ Autenticato: ${authData?.user?.email}\n`)
  
  // 2. Trova tutte le campagne attive
  console.log('📋 CAMPAGNE ATTIVE:')
  console.log('=' .repeat(60))
  
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, updated_at, created_at')
    .eq('profile_id', authData?.user?.id)
    .in('status', ['sending', 'scheduled'])
    .order('updated_at', { ascending: false })
  
  if (!activeCampaigns?.length) {
    console.log('❌ Nessuna campagna attiva (sending/scheduled) trovata!')
    
    // Mostra le ultime campagne
    const { data: recentCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, updated_at')
      .eq('profile_id', authData?.user?.id)
      .order('updated_at', { ascending: false })
      .limit(5)
    
    console.log('\n📋 Ultime 5 campagne:')
    recentCampaigns?.forEach((c, i) => {
      console.log(`${i + 1}. "${c.name}" - Status: ${c.status} - ${new Date(c.updated_at).toLocaleString()}`)
    })
    return
  }
  
  console.log(`🚀 ${activeCampaigns.length} campagne attive trovate:`)
  activeCampaigns.forEach((c, i) => {
    console.log(`${i + 1}. "${c.name}" (${c.id})`)
    console.log(`   Status: ${c.status}`)
    console.log(`   Creata: ${new Date(c.created_at).toLocaleString()}`)
    console.log(`   Aggiornata: ${new Date(c.updated_at).toLocaleString()}`)
  })
  
  // 3. Analizza ogni campagna attiva in dettaglio
  for (const campaign of activeCampaigns) {
    console.log(`\n📊 ANALISI DETTAGLIATA: "${campaign.name}"`)
    console.log('=' .repeat(60))
    console.log(`🆔 ID: ${campaign.id}`)
    console.log(`📈 Status: ${campaign.status}`)
    
    // Email statistics
    const statuses = ['pending', 'processing', 'sent', 'failed']
    const stats: any = {}
    let totalEmails = 0
    
    for (const status of statuses) {
      const { count } = await supabase
        .from('campaign_queues')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', status)
      
      stats[status] = count || 0
      totalEmails += count || 0
    }
    
    console.log(`\n📊 STATISTICHE EMAIL:`)
    console.log(`   📧 Totale: ${totalEmails}`)
    console.log(`   ⏳ Pending: ${stats.pending}`)
    console.log(`   🔄 Processing: ${stats.processing}`)
    console.log(`   ✅ Sent: ${stats.sent}`)
    console.log(`   ❌ Failed: ${stats.failed}`)
    
    if (totalEmails === 0) {
      console.log(`\n❌ PROBLEMA: Nessuna email in coda per questa campagna!`)
      console.log(`💡 La campagna potrebbe non essere stata avviata correttamente`)
      continue
    }
    
    // 4. Analisi email pending - sono pronte per invio?
    if (stats.pending > 0) {
      console.log(`\n⏰ ANALISI EMAIL PENDING (${stats.pending}):`)
      
      const now = new Date()
      const { data: pendingEmails } = await supabase
        .from('campaign_queues')
        .select(`
          id,
          scheduled_for,
          contact:contacts!inner(email, first_name, is_active),
          sender:senders!inner(email_from, is_active, emails_sent_today, daily_limit)
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(10)
      
      let readyCount = 0
      let notReadyCount = 0
      let inactiveContacts = 0
      let inactiveSenders = 0
      let senderLimitReached = 0
      
      console.log(`   📬 Prime ${Math.min(10, stats.pending)} email pending:`)
      
      pendingEmails?.forEach((email, i) => {
        const scheduledTime = new Date(email.scheduled_for)
        const isReady = scheduledTime <= now
        const minutesDiff = Math.round((scheduledTime.getTime() - now.getTime()) / 60000)
        
        console.log(`      ${i + 1}. ${email.contact.email}`)
        console.log(`         Scheduled: ${scheduledTime.toLocaleTimeString()}`)
        console.log(`         Timing: ${isReady ? '✅ PRONTA' : `⏰ Tra ${minutesDiff} min`}`)
        console.log(`         Contact attivo: ${email.contact.is_active ? '✅' : '❌'}`)
        console.log(`         Sender attivo: ${email.sender.is_active ? '✅' : '❌'}`)
        console.log(`         Sender limit: ${email.sender.emails_sent_today}/${email.sender.daily_limit}`)
        
        if (isReady) readyCount++
        else notReadyCount++
        
        if (!email.contact.is_active) inactiveContacts++
        if (!email.sender.is_active) inactiveSenders++
        if (email.sender.emails_sent_today >= email.sender.daily_limit) senderLimitReached++
      })
      
      console.log(`\n   📋 SUMMARY PENDING:`)
      console.log(`      ✅ Pronte ora: ${readyCount}`)
      console.log(`      ⏰ Non ancora pronte: ${notReadyCount}`)
      console.log(`      ❌ Contatti inattivi: ${inactiveContacts}`)
      console.log(`      ❌ Senders inattivi: ${inactiveSenders}`)
      console.log(`      🚫 Senders limite raggiunto: ${senderLimitReached}`)
      
      if (readyCount === 0) {
        console.log(`\n❌ PROBLEMA: Nessuna email pronta per invio immediato!`)
        if (notReadyCount > 0) {
          console.log(`💡 Le email sono schedulare per il futuro`)
        }
        if (inactiveContacts > 0) {
          console.log(`💡 Alcuni contatti sono disattivati`)
        }
        if (inactiveSenders > 0) {
          console.log(`💡 Alcuni senders sono disattivati`)
        }
        if (senderLimitReached > 0) {
          console.log(`💡 Alcuni senders hanno raggiunto il limite giornaliero`)
        }
      }
    }
    
    // 5. Email fallite - perché sono fallite?
    if (stats.failed > 0) {
      console.log(`\n💥 ANALISI EMAIL FALLITE (${stats.failed}):`)
      
      const { data: failedEmails } = await supabase
        .from('campaign_queues')
        .select(`
          error_message,
          retry_count,
          updated_at,
          contact:contacts!inner(email)
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(5)
      
      console.log(`   💥 Ultimi ${Math.min(5, stats.failed)} errori:`)
      failedEmails?.forEach((email, i) => {
        console.log(`      ${i + 1}. ${email.contact.email}`)
        console.log(`         Errore: ${email.error_message}`)
        console.log(`         Tentativi: ${email.retry_count}`)
        console.log(`         Quando: ${new Date(email.updated_at).toLocaleString()}`)
      })
    }
    
    // 6. Email inviate di recente
    if (stats.sent > 0) {
      console.log(`\n📤 EMAIL INVIATE (${stats.sent}):`)
      
      const { data: sentEmails } = await supabase
        .from('campaign_queues')
        .select(`
          sent_at,
          contact:contacts!inner(email)
        `)
        .eq('campaign_id', campaign.id)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(5)
      
      console.log(`   📤 Ultime ${Math.min(5, stats.sent)} inviate:`)
      sentEmails?.forEach((email, i) => {
        console.log(`      ${i + 1}. ${email.contact.email}`)
        console.log(`         Inviata: ${new Date(email.sent_at).toLocaleString()}`)
      })
    }
  }
  
  // 7. Test manuale del campaign processor
  console.log(`\n🔧 TEST MANUALE CAMPAIGN PROCESSOR:`)
  console.log('=' .repeat(60))
  
  try {
    console.log('📡 Chiamando campaign-processor manualmente...')
    
    const response = await fetch(`${supabaseUrl}/functions/v1/campaign-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData?.session?.access_token}`
      },
      body: JSON.stringify({ 
        manual_debug: true,
        timestamp: new Date().toISOString()
      })
    })
    
    const responseText = await response.text()
    console.log(`📡 Status: ${response.status} ${response.statusText}`)
    console.log(`📄 Response: ${responseText}`)
    
    if (response.ok) {
      const result = JSON.parse(responseText)
      console.log(`\n✅ PROCESSOR RESULT:`)
      console.log(`   Processate: ${result.processed || 0}`)
      console.log(`   Inviate: ${result.sent || 0}`)
      console.log(`   Fallite: ${result.failed || 0}`)
      console.log(`   Message: ${result.message || 'N/A'}`)
      
      if (result.details?.length) {
        console.log(`\n   📋 Dettagli per sender:`)
        result.details.forEach((detail: any, i: number) => {
          console.log(`      ${i + 1}. ${detail.senderEmail}:`)
          console.log(`         Sent: ${detail.sent}`)
          console.log(`         Failed: ${detail.failed}`)
          console.log(`         Batch size: ${detail.batchSize}`)
        })
      }
      
      if ((result.sent || 0) > 0) {
        console.log(`\n🎉 ${result.sent} EMAIL INVIATE ORA!`)
      } else if ((result.processed || 0) > 0) {
        console.log(`\n⚠️  Email processate ma nessuna inviata`)
      } else {
        console.log(`\n📭 Nessuna email pronta per invio`)
      }
    } else {
      console.log(`\n❌ ERRORE PROCESSOR`)
    }
    
  } catch (error) {
    console.error('\n❌ Errore chiamata processor:', error)
  }
  
  // 8. Raccomandazioni
  console.log(`\n💡 RACCOMANDAZIONI:`)
  console.log('=' .repeat(60))
  console.log('1. ⏰ Verifica che il cron job sia attivo ogni minuto')
  console.log('2. 📧 Controlla che ci siano email pending pronte (scheduled_for <= NOW)')
  console.log('3. 👤 Verifica che contatti e senders siano attivi')
  console.log('4. 🚫 Controlla limiti giornalieri dei senders')
  console.log('5. 🔧 Aggiorna cron job se necessario:')
  console.log('   https://supabase.com/dashboard/project/xqsjyvqikrvibyluynwv/sql')
}

debugCampaignStatus()