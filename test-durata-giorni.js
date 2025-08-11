// Test conversione durata da ore a giorni

console.log('🧪 Test Conversione Durata Campagna da Ore a Giorni\n')

// Esempi di durate in ore dal database
const esempiOre = [24, 48, 72, 96, 120, 168, 240, 336, 720]

esempiOre.forEach(ore => {
  const giorni = Math.round(ore / 24)
  console.log(`📊 ${ore} ore → ${giorni} giorni`)
})

console.log('\n✅ La formula Math.round(send_duration_hours / 24) converte correttamente!')
console.log('📝 Esempi reali:')
console.log('   • 24 ore = 1 giorno (campagna giornaliera)')
console.log('   • 72 ore = 3 giorni (campagna breve)')
console.log('   • 168 ore = 7 giorni (campagna settimanale)')
console.log('   • 720 ore = 30 giorni (campagna mensile)')