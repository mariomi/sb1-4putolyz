# Logica di Scheduling delle Campagne Email

## Panoramica

La nuova logica di scheduling è stata completamente riscritta per essere più robusta, chiara e funzionante. Il sistema ora calcola automaticamente quante email inviare, in quanti batch e a quali orari, basandosi sulla durata della campagna, sul numero totale di email e sul numero di invii giornalieri.

## Input Richiesti

- **totalEmails**: numero totale di email da inviare (basato sui contatti filtrati e attivi)
- **start_date**: data di inizio della campagna
- **end_date**: data di fine della campagna  
- **dailySendCount**: numero di invii giornalieri (batch)

## Calcoli Principali

### 1. Numero di Giorni della Campagna
```typescript
const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
```

### 2. Email al Giorno
```typescript
const emailsPerDay = Math.floor(totalEmails / totalDays);
```

### 3. Email Rimanenti
```typescript
const remainingEmails = totalEmails % totalDays;
```
Le email rimanenti vengono distribuite negli ultimi giorni della campagna.

### 4. Dimensione del Batch
```typescript
const batchSize = Math.floor(emailsPerDay / dailySendCount);
```

### 5. Intervallo tra i Batch
```typescript
const totalMinutesPerDay = 24 * 60;
const intervalMinutes = Math.floor(totalMinutesPerDay / dailySendCount);
const intervalHours = Math.floor(intervalMinutes / 60);
const remainingMinutes = intervalMinutes % 60;
```

## Esempio Pratico

**Parametri:**
- Totale email: 3000
- Giorni: 30 (dal 1° al 30 gennaio)
- Invii giornalieri: 10

**Calcoli:**
- Email al giorno: 100 (3000 ÷ 30)
- Email rimanenti: 0 (3000 % 30 = 0)
- Batch size: 10 (100 ÷ 10)
- Intervallo: 2h 24m (1440 minuti ÷ 10 = 144 minuti = 2h 24m)

**Risultato:**
Ogni giorno vengono inviati 10 batch da 10 email l'uno, ogni 2h 24m.

## Distribuzione degli Orari

### Orari dei Batch
Gli orari vengono calcolati partendo dalle 9:00 del mattino:

```
Giorno 1:
1. 09:00
2. 11:24  
3. 13:48
4. 16:12
5. 18:36
6. 21:00
7. 23:24
8. 01:48 (giorno successivo)
9. 04:12
10. 06:36
```

### Distribuzione delle Email
Le email vengono distribuite ciclicamente tra i mittenti disponibili e assegnate ai batch in ordine cronologico.

## Funzioni Principali

### `calculateSchedulingPlan()`
Calcola il piano di scheduling completo con tutti i parametri necessari.

### `generateBatchTimes()`
Genera gli orari dei batch per un giorno specifico.

### `distributeEmailsForDay()`
Distribuisce le email per un giorno specifico tra i batch disponibili.

### `scheduleCampaign()`
Funzione principale che orchestra tutto il processo di scheduling.

## Output della Funzione

La funzione restituisce un oggetto `SchedulingPlan` con:

```typescript
interface SchedulingPlan {
  totalDays: number;           // Giorni totali della campagna
  emailsPerDay: number;        // Email per giorno (valore intero)
  remainingEmails: number;     // Email rimanenti
  batchSize: number;           // Dimensione dei batch (email per invio)
  intervalHours: number;       // Intervallo tra invii (ore)
  intervalMinutes: number;     // Intervallo tra invii (minuti)
  totalScheduled: number;      // Totale email pianificate
}
```

## Logging Dettagliato

La funzione fornisce logging dettagliato per il debug:

```
📅 SCHEDULING CAMPAIGN abc123
📊 Total emails: 3000
📅 Start date: 2025-01-01T00:00:00.000Z
📅 End date: 2025-01-30T00:00:00.000Z
🕐 Daily send count: 10

📋 SCHEDULING PLAN:
   • Total days: 30
   • Emails per day: 100
   • Remaining emails: 0
   • Batch size: 10
   • Interval: 2h 24m

📅 DAY 1: 100 emails
   🕐 Batch times:
      1. 09:00
      2. 11:24
      3. 13:48
      ...

📦 TOTAL QUEUE ENTRIES: 3000
✅ Successfully inserted 3000 queue entries
```

## Gestione degli Errori

La funzione include gestione robusta degli errori:

- Validazione dei parametri di input
- Controllo dello stato della campagna
- Verifica della presenza di mittenti e contatti attivi
- Gestione degli errori di database
- Logging dettagliato per il debug

## Vantaggi della Nuova Logica

1. **Robustezza**: Gestione completa degli errori e validazioni
2. **Chiarezza**: Codice modulare e ben documentato
3. **Flessibilità**: Supporta diversi parametri di configurazione
4. **Scalabilità**: Gestisce campagne di qualsiasi dimensione
5. **Debugging**: Logging dettagliato per il troubleshooting
6. **Distribuzione Equilibrata**: Le email vengono distribuite uniformemente nel tempo

## Migrazione Database

È stata creata una migrazione per aggiungere il campo `end_date` alla tabella `campaigns`:

```sql
-- Add end_date column to campaigns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN end_date date;
  END IF;
END $$;

-- Add index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
``` 