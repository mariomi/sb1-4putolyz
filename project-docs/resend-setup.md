# Configurazione Resend per Edge Function

## 🎯 Obiettivo
Configurare l'API key di Resend per permettere l'invio di email tramite l'Edge Function `start-campaign`.

## 📋 Passi per la Configurazione

### 1. Ottenere API Key di Resend
1. Vai su [Resend Dashboard](https://resend.com/dashboard)
2. Accedi al tuo account
3. Vai su "API Keys" nel menu laterale
4. Crea una nuova API key o usa quella esistente

### 2. Configurare la Variabile d'Ambiente in Supabase

#### Opzione A: Tramite Dashboard Supabase
1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il progetto `xqsjyvqikrvibyluynwv`
3. Vai su "Settings" → "Edge Functions"
4. Aggiungi la variabile d'ambiente:
   - **Nome**: `RESEND_API_KEY`
   - **Valore**: La tua API key di Resend

#### Opzione B: Tramite CLI Supabase
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx --project-ref xqsjyvqikrvibyluynwv
```

### 3. Verificare la Configurazione
L'Edge Function ora:
- ✅ Risponde immediatamente con `{ status: "started" }`
- ✅ Processa le email in background
- ✅ Usa Resend per l'invio effettivo
- ✅ Gestisce errori e retry
- ✅ Aggiorna lo status nel database

## 🔧 Funzionalità Implementate

### Risposta Immediata
```typescript
// La funzione risponde in 1-2 secondi
return new Response(
  JSON.stringify({ 
    success: true, 
    status: 'started',
    message: 'Campaign started successfully. Emails are being sent in background.' 
  }),
  { status: 200, headers: corsHeaders }
);
```

### Processamento Background
```typescript
// Le email vengono processate in background
processEmailsInBackground(supabase, campaignId, queueEntries).catch(error => {
  console.error(`❌ Errore nel processamento background:`, error);
});
```

### Invio Tramite Resend
```typescript
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  }),
});
```

## 📊 Monitoraggio

### Log dell'Edge Function
- Controlla i log in tempo reale nel Dashboard Supabase
- Vai su "Edge Functions" → "start-campaign" → "Logs"

### Status delle Email
- `pending`: Email in coda
- `sending`: Email in fase di invio
- `sent`: Email inviata con successo
- `failed`: Email fallita

## 🚀 Test

### Test Rapido
```bash
curl -X POST https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/start-campaign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"campaignId": "your-campaign-id"}'
```

### Risposta Attesa
```json
{
  "success": true,
  "status": "started",
  "message": "Campaign started successfully. Emails are being sent in background."
}
```

## ⚠️ Note Importanti

1. **API Key Sicura**: L'API key di Resend è gestita come variabile d'ambiente
2. **Rate Limiting**: Le email vengono inviate in batch di 10 con pause di 1 secondo
3. **Error Handling**: Errori di invio vengono registrati nel database
4. **Background Processing**: L'Edge Function non aspetta il completamento dell'invio

## 🔍 Troubleshooting

### Errore: "RESEND_API_KEY non configurata"
- Verifica che la variabile d'ambiente sia impostata correttamente
- Controlla i log dell'Edge Function

### Email non inviate
- Verifica che i mittenti siano configurati correttamente
- Controlla che i domini siano verificati in Resend
- Controlla i log per errori specifici

### Timeout dell'Edge Function
- La funzione ora risponde immediatamente
- Il processamento avviene in background
- Non dovrebbero più verificarsi timeout 