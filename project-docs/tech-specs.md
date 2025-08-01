# Specifiche Tecniche del Sistema

## Stack Tecnologico

### Frontend
- **Framework**: React 18 con TypeScript
- **Build Tool**: Vite 7.0.6
- **Styling**: Tailwind CSS
- **State Management**: React Hooks + Supabase Realtime
- **Forms**: React Hook Form con Zod validation
- **Routing**: React Router DOM 7.7.0
- **Notifications**: React Hot Toast
- **Icons**: Lucide React

### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Edge Functions**: Deno TypeScript
- **Email Service**: Resend API
- **Cron Jobs**: pg_cron extension

### API e Integrazioni
- **Supabase Client**: @supabase/supabase-js@2
- **Email API**: Resend 4.7.0
- **HTTP Client**: Native fetch API

## Architettura del Sistema

### Database Schema
```sql
-- Campagne email
campaigns (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT,
  status TEXT CHECK (status IN ('draft','scheduled','sending','completed','failed')),
  emails_per_batch INTEGER DEFAULT 50,
  batch_interval_minutes INTEGER DEFAULT 30,
  send_duration_hours INTEGER DEFAULT 24,
  start_time_of_day TIME DEFAULT '09:00'
)

-- Coda di invio email
campaign_queues (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  contact_id UUID REFERENCES contacts(id),
  sender_id UUID REFERENCES senders(id),
  status TEXT CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0
)

-- Mittenti email
senders (
  id UUID PRIMARY KEY,
  email_from TEXT NOT NULL,
  display_name TEXT,
  daily_limit INTEGER DEFAULT 500,
  emails_sent_today INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
)
```

### Algoritmo di Invio Email

#### 1. Avvio Campagna
```typescript
// Quando l'utente avvia una campagna:
1. Verifica stato campagna (draft/scheduled)
2. Ottiene contatti e mittenti associati
3. Crea entries nella coda con scheduling
4. Invia IMMEDIATAMENTE il primo batch
5. Programa batch successivi secondo intervallo
```

#### 2. Sistema di Batch
```typescript
// Parametri configurabili per campagna:
- emails_per_batch: Numero email per batch (default: 50)
- batch_interval_minutes: Intervallo tra batch (default: 30 min)
- send_duration_hours: Durata massima campagna (default: 24h)
- start_time_of_day: Orario inizio invio giornaliero
```

#### 3. Cron Job Processing
```sql
-- Eseguito ogni 2 minuti:
*/2 * * * * - campaign-processor

Azioni:
1. Controlla campagne scadute → completa
2. Controlla campagne programmate → avvia
3. Processa email in coda → invia
4. Gestisce retry per email fallite
5. Aggiorna contatori mittenti
```

### Edge Functions

#### start-campaign
```typescript
// Input: { campaignId: string, immediate?: boolean }
// Output: { success: boolean, firstBatchSent: number, totalQueued: number }

Funzionalità:
- Valida campagna e permessi
- Crea coda con batch scheduling
- Invia primo batch immediatamente
- Aggiorna contatori mittenti
- Log delle attività
```

#### campaign-processor  
```typescript
// Cron job principale per processamento automatico

Funzionalità:
- Gestione time limits campagne
- Invio batch secondo scheduling
- Retry automatico email fallite
- Rispetto limiti giornalieri mittenti
- Warm-up domini nuovi
```

## Codifica e Standard

### TypeScript Configuration
- Strict mode abilitato
- Type safety completo
- Interface per database schema
- Zod per validation runtime

### Error Handling
- Try-catch per operazioni async
- Rollback automatico su errori
- Logging dettagliato per debugging
- User-friendly error messages

### Performance
- Connection pooling Supabase
- Batch processing per email
- Lazy loading componenti
- Ottimizzazione query database

### Security
- Row Level Security (RLS)
- Authentication required
- Authorization checks
- Sanitizzazione input

## Design Database

### Indici Ottimizzati
```sql
-- Performance query coda
CREATE INDEX idx_campaign_queues_status_scheduled 
ON campaign_queues(status, scheduled_for);

-- Performance mittenti
CREATE INDEX idx_senders_active_limit 
ON senders(is_active, emails_sent_today, daily_limit);

-- Performance campagne utente
CREATE INDEX idx_campaigns_profile_status 
ON campaigns(profile_id, status);
```

### Funzioni Stored
```sql
-- Incremento atomico contatori
CREATE FUNCTION increment_emails_sent(
  sender_id uuid, 
  increment_amount integer,
  last_sent_time timestamptz
) RETURNS TABLE(new_emails_sent_today integer);

-- Reset contatori giornalieri
CREATE FUNCTION reset_daily_counters() 
RETURNS void;
```