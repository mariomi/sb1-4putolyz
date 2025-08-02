# Risoluzione Problemi Database

## Problema Identificato

L'errore 400 quando si tenta di salvare una campagna è causato da **discrepanze tra il frontend e la struttura del database**. Il frontend usa campi in inglese e strutture moderne, mentre il database ha ancora campi in italiano e strutture incomplete.

## Migrazioni Create

Ho creato 11 migrazioni per risolvere tutti i problemi:

### 1. `20250127000003_add_end_date_to_campaigns.sql`
- Aggiunge il campo `end_date` alla tabella `campaigns`
- Necessario per la nuova logica di scheduling

### 2. `20250127000004_add_missing_campaign_fields.sql`
- Aggiunge tutti i campi mancanti alla tabella `campaigns`:
  - `selected_groups` (JSONB)
  - `profile_id`
  - `updated_at`
  - `start_date`
  - `start_time_of_day`
  - `warm_up_days`
  - `emails_per_batch`
  - `batch_interval_minutes`
  - `send_duration_hours`

### 3. `20250127000005_rename_campaign_fields_to_english.sql`
- Rinomina i campi da italiano a inglese:
  - `nome` → `name`
  - `oggetto` → `subject`
  - `contenuto_html` → `html_content`
  - `stato` → `status`
- Aggiorna i valori di status da italiano a inglese

### 4. `20250127000006_create_campaign_groups_table.sql`
- Crea la tabella `campaign_groups` mancante
- Necessaria per le relazioni tra campagne e gruppi
- Include campi per le percentuali di selezione

### 5. `20250127000007_rename_groups_fields_to_english.sql`
- Rinomina i campi della tabella `groups`:
  - `nome` → `name`

### 6. `20250127000008_rename_campaign_queues_fields.sql`
- Rinomina i campi della tabella `campaign_queues`:
  - `scheduled_time` → `scheduled_for`
  - `sent_time` → `sent_at`
- Aggiunge campi mancanti:
  - `resend_email_id`
  - `error_message`
  - `created_at`
  - `updated_at`

### 7. `20250127000009_add_missing_sender_fields.sql`
- Aggiunge campi mancanti alla tabella `senders`:
  - `display_name`
  - `is_active`
  - `emails_sent_today`
  - `current_day`
  - `last_sent_at`
  - `profile_id`
  - `created_at`
  - `updated_at`

### 8. `20250127000010_add_missing_contact_fields.sql`
- Aggiunge campi mancanti alla tabella `contacts`:
  - `first_name`
  - `last_name`
  - `is_active`
  - `profile_id`
  - `created_at`
  - `updated_at`

### 9. `20250127000011_add_missing_group_fields.sql`
- Aggiunge campi mancanti alla tabella `groups`:
  - `description`
  - `contact_count`
  - `profile_id`
  - `created_at`
  - `updated_at`

### 10. `20250127000012_fix_campaign_table_issues.sql` ⚠️ **NUOVO**
- **Corregge i problemi rimanenti** nella tabella `campaigns`:
  - Aggiunge il campo `end_date` se mancante
  - Aggiunge il campo `selected_groups` se mancante
  - **Rimuove il campo `stato`** (italiano) e assicura che `status` (inglese) funzioni
  - Copia i dati da `stato` a `status` con la conversione corretta
  - Aggiunge indici e trigger mancanti

### 11. `20250127000013_fix_campaign_groups_percentage_fields.sql` ⚠️ **NUOVO**
- **Corregge i problemi nella tabella `campaign_groups`**:
  - Aggiunge i campi `percentage_start` e `percentage_end` se mancanti
  - Aggiunge i campi `created_at` e `updated_at` se mancanti
  - Crea indici e policy RLS se mancanti
  - Risolve l'errore "Could not find the 'percentage_end' column"

## Problemi Risolti dal Frontend

Ho anche corretto i problemi nel frontend:

### ✅ **Correzione `updateCampaignRelations`**
- Ora gestisce correttamente gli oggetti `GroupSelection` con percentuali
- Invece di mappare solo `group_id`, ora include `percentage_start` e `percentage_end`

### ✅ **Correzione `toggleGroupSelection`**
- Ora crea oggetti `GroupSelection` completi con percentuali di default (0-100)

### ✅ **Correzione `startEditing`**
- Ora carica correttamente i gruppi con percentuali di default

### ✅ **Gestione Date**
- Le date ora vengono gestite correttamente con valori `null` per campi vuoti

## Come Applicare le Migrazioni

### Opzione 1: Supabase CLI (Raccomandato)
```bash
# Applica tutte le migrazioni
supabase db push

# Oppure applica solo le nuove migrazioni
supabase migration up
```

### Opzione 2: Dashboard Supabase
1. Vai su **Database** → **SQL Editor**
2. Esegui le migrazioni in ordine cronologico:
   ```sql
   -- Esegui il contenuto di ogni file .sql in ordine
   -- 20250127000003_add_end_date_to_campaigns.sql
   -- 20250127000004_add_missing_campaign_fields.sql
   -- 20250127000005_rename_campaign_fields_to_english.sql
   -- 20250127000006_create_campaign_groups_table.sql
   -- 20250127000007_rename_groups_fields_to_english.sql
   -- 20250127000008_rename_campaign_queues_fields.sql
   -- 20250127000009_add_missing_sender_fields.sql
   -- 20250127000010_add_missing_contact_fields.sql
   -- 20250127000011_add_missing_group_fields.sql
   -- 20250127000012_fix_campaign_table_issues.sql  ⚠️ IMPORTANTE
   -- 20250127000013_fix_campaign_groups_percentage_fields.sql  ⚠️ IMPORTANTE
   ```

### Opzione 3: Reset Completo (Solo per sviluppo)
```bash
supabase db reset
```

## Verifica delle Migrazioni

Dopo aver applicato le migrazioni, puoi verificare che tutto funzioni:

```sql
-- Verifica che tutti i campi esistano
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
ORDER BY column_name;

-- Verifica che il campo stato sia stato rimosso
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaigns' AND column_name = 'stato';

-- Verifica che end_date esista
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaigns' AND column_name = 'end_date';

-- Verifica che selected_groups esista
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaigns' AND column_name = 'selected_groups';

-- Verifica che i campi percentage esistano in campaign_groups
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaign_groups' AND column_name IN ('percentage_start', 'percentage_end');
```

## Problemi Risolti

✅ **Campo `end_date` mancante** - Ora disponibile per la nuova logica di scheduling

✅ **Campo `stato` rimosso** - Sostituito completamente con `status` in inglese

✅ **Campo `selected_groups` aggiunto** - Per salvare le selezioni dei gruppi con percentuali

✅ **Campi in italiano** - Rinominati in inglese per compatibilità con il frontend

✅ **Tabella `campaign_groups` mancante** - Creata con supporto per percentuali

✅ **Campi mancanti in `senders`** - Aggiunti `display_name`, `is_active`, ecc.

✅ **Campi mancanti in `contacts`** - Aggiunti `first_name`, `last_name`, `is_active`

✅ **Campi mancanti in `groups`** - Aggiunti `description`, `contact_count`

✅ **Campi mancanti in `campaign_queues`** - Rinominati e aggiunti campi necessari

✅ **Relazioni utente** - Aggiunto `profile_id` a tutte le tabelle per ownership

✅ **Frontend corretto** - Gestione corretta degli oggetti `GroupSelection`

## Risultato Atteso

Dopo aver applicato tutte le migrazioni:
- Il frontend dovrebbe funzionare senza errori 400
- Le campagne possono essere create e salvate correttamente
- La nuova logica di scheduling funzionerà con `start_date` e `end_date`
- Tutti i campi necessari saranno disponibili nel database
- Le date saranno gestite correttamente

## Note Importanti

- Le migrazioni sono **idempotenti** (possono essere eseguite più volte senza problemi)
- Tutte le migrazioni usano `IF NOT EXISTS` per evitare errori
- Gli indici sono creati per le performance
- I trigger per `updated_at` sono configurati automaticamente
- Le policy RLS sono configurate per la sicurezza
- **La migrazione `20250127000012_fix_campaign_table_issues.sql` è cruciale** per risolvere i problemi rimanenti 