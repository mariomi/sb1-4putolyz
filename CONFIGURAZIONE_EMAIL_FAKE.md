# Configurazione per Email Fake/Test

## Descrizione
Il sistema ora supporta l'invio di email anche a indirizzi fake/test come `@example.com`, `@test.com`, etc. Questo è utile per testing e sviluppo.

## Configurazione delle Variabili d'Ambiente

### 1. Permettere Email Fake (Consigliato per Test)
```bash
# In Supabase Dashboard -> Edge Functions -> Environment Variables
ALLOW_FAKE_EMAILS=true
```

### 2. Modalità Ambiente
```bash
# Imposta l'ambiente (se non è 'production', le fake emails sono permesse)
ENVIRONMENT=development
# oppure
ENVIRONMENT=testing
```

### 3. Override Email di Test (Opzionale)
```bash
# Tutte le email fake verranno inviate a questo indirizzo invece
TEST_EMAIL_OVERRIDE=tuaemail@gmail.com
```

## Come Configurare in Supabase

1. Vai su **Supabase Dashboard**
2. Seleziona il tuo progetto
3. Vai su **Edge Functions**
4. Clicca su **Environment Variables**
5. Aggiungi le variabili desiderate:

| Nome | Valore | Descrizione |
|------|--------|-------------|
| `ALLOW_FAKE_EMAILS` | `true` | Permette l'invio a email fake |
| `ENVIRONMENT` | `development` | Imposta modalità non-production |
| `TEST_EMAIL_OVERRIDE` | `your@email.com` | Reindirizza tutte le fake emails |

## Comportamento del Sistema

### ✅ Con le configurazioni attive:
- Email `luca.rossi@example.com` → Viene inviata
- Email `test@fake.com` → Viene inviata  
- Email `user@localhost` → Viene inviata

### ⚠️ Con TEST_EMAIL_OVERRIDE:
- Email `luca.rossi@example.com` → Viene inviata a `your@email.com`
- Email normali → Vengono inviate normalmente

### ❌ Senza configurazioni (Production):
- Email fake vengono bloccate da Resend
- Solo email reali vengono inviate

## Domini Fake Riconosciuti
Il sistema riconosce automaticamente questi domini come "fake":
- `@example.com`
- `@test.com` 
- `@fake.com`
- `@localhost`
- `@invalid`

## Testing
Per testare che funzioni:

1. Configura `ALLOW_FAKE_EMAILS=true`
2. Crea una campagna con contatti `@example.com`
3. Avvia la campagna
4. Controlla i log della Edge Function per vedere i messaggi di test

## Logs da Cercare
```
🧪 Test mode enabled - fake emails will be processed
🔄 Allowing fake email in test mode: luca.rossi@example.com
🧪 Using test email override: your@email.com (original: test@example.com)
```

## Sicurezza
⚠️ **IMPORTANTE**: Non abilitare mai `ALLOW_FAKE_EMAILS=true` in produzione per evitare invii accidentali a email non valide.