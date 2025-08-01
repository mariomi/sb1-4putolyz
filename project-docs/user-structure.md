# Flusso Utente e Struttura del Progetto

## Flusso Utente Principale

### 1. Configurazione Iniziale
```
Utente → Accede al sistema
      ↓
   Gestisce Gruppi di contatti
      ↓
   Importa/Aggiunge contatti ai gruppi
      ↓
   Configura mittenti email (domini)
      ↓
   PRONTO per creare campagne
```

### 2. Creazione e Avvio Campagna
```
Utente → Crea nuova campagna
      ↓
   Compila: nome, oggetto, contenuto HTML
      ↓
   Seleziona: gruppi di contatti
      ↓
   Seleziona: mittenti email
      ↓
   Configura: batch size, intervalli, durata
      ↓
   Avvia campagna
      ↓
   🚀 INVIO AUTOMATICO: primo batch immediatamente
      ↓
   📅 CRON JOB: batch successivi ogni X minuti
      ↓
   ⏰ AUTO-COMPLETAMENTO: dopo durata limite
```

### 3. Monitoraggio Campagna
```
Utente → Visualizza dashboard campagne
      ↓
   Stato in tempo reale: inviate/fallite/in coda
      ↓
   Progressione: % completamento
      ↓
   Log dettagliato eventi
      ↓
   Statistiche mittenti: limite/inviato oggi
```

## Sistema di Invio Email Automatico

### Algoritmo Dettagliato
1. **Trigger Avvio**: Utente clicca "Avvia Campagna"
2. **Validazione**: Controlla campagna, contatti, mittenti
3. **Creazione Coda**: Calcola e pianifica tutti i batch
4. **Invio Immediato**: Primo batch inviato subito con Resend
5. **Scheduling**: Batch successivi programmati in database
6. **Cron Processing**: Ogni 2 minuti controlla e invia email pronte
7. **Gestione Limiti**: Rispetta limiti giornalieri e orari di invio
8. **Auto-Completion**: Completa campagna al raggiungimento tempo limite

### Parametri Configurabili
- **Dimensione Batch**: 1-1000 email per batch
- **Intervallo Batch**: 1-1440 minuti tra batch
- **Durata Campagna**: 1-720 ore (30 giorni max)
- **Orario Invio**: Finestra oraria giornaliera
- **Limiti Mittente**: Email giornaliere per dominio

## Struttura del Progetto

### Frontend (src/)
```
src/
├── components/          # Componenti riutilizzabili
│   ├── Header.tsx      # Navigazione principale
│   ├── Layout.tsx      # Layout applicazione
│   ├── LoadingSpinner.tsx
│   ├── ProtectedRoute.tsx  # Protezione autenticazione
│   └── Sidebar.tsx     # Menu laterale
├── hooks/
│   └── useAuth.ts      # Hook autenticazione
├── lib/
│   ├── supabase.ts     # Client Supabase
│   └── utils.ts        # Utility functions
├── pages/              # Pagine principali
│   ├── AuthPage.tsx    # Login/Registrazione
│   ├── CampaignsPage.tsx  # 🎯 GESTIONE CAMPAGNE
│   ├── ContactsPage.tsx   # Gestione contatti
│   ├── Dashboard.tsx      # Dashboard principale
│   ├── DomainsPage.tsx    # Gestione domini
│   ├── GroupsPage.tsx     # Gestione gruppi
│   ├── ReportsPage.tsx    # Report e statistiche
│   └── SendersPage.tsx    # Gestione mittenti
└── types/
    └── database.ts     # Type definitions
```

### Backend (supabase/)
```
supabase/
├── functions/          # Edge Functions
│   ├── _shared/
│   │   └── cors.ts     # Gestione CORS
│   ├── campaign-processor/  # 🤖 CRON JOB PRINCIPALE
│   │   └── index.ts         # Processamento automatico email
│   ├── start-campaign/      # 🚀 AVVIO CAMPAGNE
│   │   └── index.ts         # Invio primo batch + scheduling
│   └── sync-resend-domains/
│       └── index.ts         # Sincronizzazione domini
└── migrations/         # Schema database
    ├── 20250719133549_patient_mouse.sql    # Setup iniziale
    ├── 20250719135811_jade_marsh.sql       # Tabelle principali
    ├── 20250720132643_peaceful_spark.sql   # Relazioni
    ├── 20250723095141_crimson_hat.sql      # Indici
    ├── 20250723095227_morning_meadow.sql   # Permessi RLS
    ├── 20250726190900_withered_field.sql   # Ottimizzazioni
    ├── 20250727113639_cold_wind.sql        # Schema completo
    ├── 20250127000000_fix_campaign_processor_cron.sql  # Cron job
    └── 20250127000001_add_sender_increment_function.sql # Funzioni
```

## Documenti di Progetto
```
project-docs/
├── overview.md         # Panoramica e obiettivi
├── requirements.md     # Requisiti funzionali e non
├── tech-specs.md      # Specifiche tecniche dettagliate
├── user-structure.md  # 📍 QUESTO FILE
└── timeline.md        # Timeline e progresso
```

## Data Flow Principale

### 1. Autenticazione
```
Browser → Supabase Auth → User Session → Protected Routes
```

### 2. Gestione Dati
```
React Components → Supabase Client → PostgreSQL → Real-time Updates
```

### 3. Invio Email
```
User Action → start-campaign Function → Queue Creation → 
Email Send (Resend API) → Status Update → UI Refresh
```

### 4. Processamento Automatico  
```
Cron (ogni 2 min) → campaign-processor Function → 
Query Queue → Send Batch → Update Counters → Repeat
```

## Stati del Sistema

### Stati Campagna
- **draft**: Bozza, modificabile
- **scheduled**: Programmata per avvio futuro
- **sending**: In corso di invio
- **completed**: Completata (successo o timeout)
- **failed**: Fallita per errori critici

### Stati Email Queue
- **pending**: In attesa di invio
- **processing**: In corso di elaborazione
- **sent**: Inviata con successo
- **failed**: Fallita (con retry)
- **cancelled**: Cancellata (campagna completata)

### Indicatori Performance
- **Completion Rate**: % email inviate vs totali
- **Delivery Rate**: % email consegnate vs inviate  
- **Batch Efficiency**: Velocità elaborazione batch
- **Sender Utilization**: Utilizzo limiti giornalieri