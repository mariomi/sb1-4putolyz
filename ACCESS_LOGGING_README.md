# Sistema di Logging Accessi Utenti

## Panoramica

Il sistema di logging accessi utenti è stato implementato per tenere traccia di:
- Chi ha fatto l'accesso all'applicazione
- A che ora è entrato e uscito
- Quanto tempo è stato online
- Informazioni aggiuntive come IP, User Agent e Session ID

## Funzionalità

### 1. Tracciamento Automatico
- **Login**: Registrato automaticamente quando un utente effettua l'accesso
- **Logout**: Registrato automaticamente quando un utente esce o la sessione scade
- **Durata Online**: Calcolata automaticamente in minuti

### 2. Sezione Admin
- **Dashboard Statistiche**: Accessi oggi, settimana, utenti online, totale log
- **Filtri Avanzati**: Per data, ruolo utente, ricerca testuale
- **Utenti Online**: Visualizzazione in tempo reale degli utenti attualmente connessi
- **Cronologia Accessi**: Tabella completa con tutti i log di accesso
- **Esportazione CSV**: Download dei dati per analisi esterne

### 3. Sicurezza
- **RLS (Row Level Security)**: Gli utenti possono vedere solo i propri log
- **Admin Access**: Gli amministratori possono vedere tutti i log
- **Audit Trail**: Tracciamento completo delle sessioni

## Struttura Database

### Tabella `user_access_logs`
```sql
CREATE TABLE user_access_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  profile_id UUID REFERENCES profiles(id),
  login_time TIMESTAMPTZ NOT NULL,
  logout_time TIMESTAMPTZ,
  online_duration_minutes INTEGER,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### Trigger Automatici
- **Calcolo Durata**: Calcola automaticamente la durata online quando viene impostato il logout_time
- **Aggiornamento Timestamp**: Mantiene aggiornato il campo updated_at

## Utilizzo

### 1. Accesso alla Sezione Log
1. Accedi come amministratore
2. Vai alla sezione "Log Accessi" nel menu laterale
3. Visualizza le statistiche e i log

### 2. Filtri Disponibili
- **Intervallo Date**: Ultime 24 ore, 7 giorni, 30 giorni, tutti
- **Ruolo Utente**: Filtra per ruolo specifico
- **Ricerca**: Cerca per nome utente o ID operatore

### 3. Esportazione Dati
- Clicca su "Esporta CSV" per scaricare i dati filtrati
- Il file include: Utente, Ruolo, ID Operatore, Login, Logout, Durata Online, IP, User Agent

## Implementazione Tecnica

### File Principali
- `src/lib/accessLogger.ts`: Funzioni per logging e recupero dati
- `src/components/AccessLogsSection.tsx`: Componente React per la visualizzazione
- `src/hooks/useAuth.ts`: Hook aggiornato per logging automatico

### Funzioni Principali
```typescript
// Log accesso utente
await logUserLogin({
  user_id: 'user-id',
  profile_id: 'profile-id',
  user_agent: navigator.userAgent,
  session_id: 'session-id'
})

// Log logout utente
await logUserLogout('user-id', 'session-id')

// Recupera tutti i log (admin)
const logs = await getUserAccessLogs()

// Recupera statistiche
const stats = await getAccessStatistics()
```

### Eventi Automatici
- **Login**: Quando `signIn()` o `signInWithOperator()` ha successo
- **Logout**: Quando `signOut()` viene chiamato
- **Sessione Scaduta**: Quando la sessione Supabase scade
- **Chiusura Tab**: Quando l'utente chiude la tab o naviga via
- **Cambio Visibilità**: Quando la tab perde il focus

## Configurazione

### 1. Migrazione Database
Esegui la migrazione per creare la tabella:
```bash
# La migrazione è già creata in:
supabase/migrations/20250128000001_create_user_access_logs_table.sql
```

### 2. Variabili Ambiente
Nessuna variabile aggiuntiva richiesta, utilizza la configurazione Supabase esistente.

### 3. Permessi
- **RLS**: Abilitato automaticamente
- **Policies**: Configurate per sicurezza
- **Admin Access**: Solo utenti con ruolo 'admin' possono vedere tutti i log

## Monitoraggio e Manutenzione

### 1. Performance
- **Indici**: Creati automaticamente per ottimizzare le query
- **Pulizia**: Considera la pulizia periodica dei log vecchi per mantenere le performance

### 2. Storage
- **Dimensioni**: Monitora la crescita della tabella
- **Backup**: Include nei backup del database

### 3. Sicurezza
- **Audit**: Verifica regolarmente i log per attività sospette
- **Privacy**: I log contengono solo informazioni necessarie per il monitoraggio

## Troubleshooting

### Problemi Comuni

#### 1. Log non vengono creati
- Verifica che la migrazione sia stata eseguita
- Controlla i permessi RLS
- Verifica la connessione al database

#### 2. Durata online non calcolata
- Verifica che il trigger sia stato creato correttamente
- Controlla che logout_time sia impostato

#### 3. Performance lente
- Verifica che gli indici siano stati creati
- Considera la pulizia dei log vecchi

### Debug
```typescript
// Abilita logging dettagliato
console.log('Access logging debug enabled')

// Verifica connessione
const logs = await getUserAccessLogs()
console.log('Retrieved logs:', logs)
```

## Estensioni Future

### Possibili Miglioramenti
1. **Notifiche**: Alert per accessi sospetti
2. **Analytics**: Grafici e trend temporali
3. **Geolocalizzazione**: Mappatura degli accessi per IP
4. **Integrazione**: Con sistemi di sicurezza esterni
5. **Report**: Generazione automatica di report periodici

## Supporto

Per problemi o domande:
1. Controlla i log della console del browser
2. Verifica la configurazione del database
3. Controlla i permessi RLS
4. Consulta la documentazione Supabase per RLS e policies




