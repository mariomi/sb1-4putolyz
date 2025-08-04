# Fix per la Pianificazione Immediata delle Campagne

## Problema Risolto

**Bug Critico**: La funzione "Avvia Ora" inviava tutte le email di una campagna istantaneamente, ignorando completamente la logica di pianificazione dei batch e degli intervalli.

## Soluzione Implementata

### Approccio Ibrido Frontend-Backend

La soluzione implementa un approccio ibrido che rispetta i requisiti dell'utente:

1. **Frontend (React)**: Calcola la pianificazione e genera l'array `queueEntries`
2. **Backend (Edge Function)**: Riceve l'array pre-calcolato e lo inserisce nel database

### Modifiche al Frontend (`CampaignsPage.tsx`)

#### Nuove Funzioni Aggiunte:

1. **`calculateImmediateScheduling()`**: Calcola i parametri di scheduling per una campagna immediata
2. **`generateImmediateSchedule()`**: Genera gli orari di invio distribuiti nel tempo
3. **`getCampaignContacts()`**: Recupera i contatti con logica percentuale
4. **`generateQueueEntries()`**: Genera l'array completo di entry per la coda

#### Modifiche alla Funzione `handleStartCampaignNow()`:

- Recupera tutti i dati necessari (campagna, mittenti, contatti)
- Calcola la pianificazione usando `new Date()` come data di inizio
- Mantiene la `end_date` originale della campagna
- Genera l'array `queueEntries` con timestamp distribuiti
- Invia l'array al backend tramite Edge Function

### Modifiche al Backend (`start-campaign/index.ts`)

#### Gestione di Due Scenari:

1. **Scenario "Avvia Ora"**: 
   - Riceve l'array `queueEntries` pre-calcolato dal frontend
   - Inserisce direttamente nel database senza ricalcoli
   - Aggiorna `start_date` e `scheduled_at` a `new Date()`

2. **Scenario "Programma" (Fallback)**:
   - Se `queueEntries` non è presente, usa la logica server-side esistente
   - Mantiene compatibilità con le campagne programmate

#### Modifiche Principali:

- `startCampaignExecution()`: Aggiunto parametro `queueEntries?`
- Logica condizionale per gestire i due scenari
- Logging migliorato per distinguere i due percorsi

## Comportamento Corretto Implementato

### Per "Avvia Ora":

1. **Data di Inizio**: `new Date()` (istante attuale)
2. **Data di Fine**: Mantiene `campaign.end_date` originale
3. **Ricalcolo Pianificazione**: 
   - `numDays` = differenza tra fine e ora
   - `emailPerDay` = totale email / numDays
   - `dailySendCount` = calcolato automaticamente (1-10)
   - `batchSize` = emailPerDay / dailySendCount
   - `interval` = 24h / dailySendCount

4. **Distribuzione Email**:
   - Prima email: `new Date()`
   - Email successive: distribuite secondo gli intervalli calcolati
   - Rispetta batch e intervalli come per le campagne programmate

### Esempio Pratico:

```
Campagna: 100 email, end_date = domani
Avvio: Oggi alle 14:00
Risultato:
- numDays = 2
- emailPerDay = 50
- dailySendCount = 5
- batchSize = 10
- interval = 4h 48m

Email 1-10: 14:00
Email 11-20: 18:48
Email 21-30: 23:36
Email 31-40: 04:24 (giorno successivo)
Email 41-50: 09:12
...
```

## Vantaggi della Soluzione

1. **Sicurezza**: Il calcolo avviene nel frontend ma l'inserimento nel DB è controllato dal backend
2. **Performance**: Inserimento in blocco invece di calcoli lato server
3. **Flessibilità**: Mantiene compatibilità con campagne programmate
4. **Trasparenza**: Logging dettagliato per debugging
5. **Robustezza**: Gestione errori migliorata con messaggi specifici

## File Modificati

- `src/pages/CampaignsPage.tsx`: Logica di calcolo frontend
- `supabase/functions/start-campaign/index.ts`: Gestione scenari backend

## Test Consigliati

1. **Campagna con pochi contatti**: Verifica distribuzione corretta
2. **Campagna con molti contatti**: Verifica performance
3. **Campagna con percentuali**: Verifica logica percentuale
4. **Campagna programmata**: Verifica che non sia influenzata
5. **Errori di rete**: Verifica gestione errori

## Note Tecniche

- I linter errors per `Deno` sono attesi in ambiente Deno
- La soluzione mantiene la compatibilità con l'API esistente
- Il logging dettagliato facilita il debugging
- La gestione degli errori è specifica per ogni scenario 