-- Verifica completa della struttura del database
-- Esegui queste query per verificare che tutto sia configurato correttamente

-- 1. Verifica che tutti i campi necessari esistano nella tabella campaigns
SELECT 
  'campaigns' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name IN ('id', 'name', 'subject', 'html_content', 'status', 'start_date', 'end_date', 'selected_groups', 'profile_id', 'created_at', 'updated_at')
ORDER BY column_name;

-- 2. Verifica che il campo stato sia stato rimosso
SELECT 
  'stato field check' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Campo stato rimosso correttamente'
    ELSE '❌ Campo stato ancora presente'
  END as result
FROM information_schema.columns 
WHERE table_name = 'campaigns' AND column_name = 'stato';

-- 3. Verifica che i campi percentage esistano in campaign_groups
SELECT 
  'campaign_groups percentage fields' as check_type,
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ Campi percentage_start e percentage_end presenti'
    ELSE '❌ Campi percentage mancanti'
  END as result
FROM information_schema.columns 
WHERE table_name = 'campaign_groups' 
AND column_name IN ('percentage_start', 'percentage_end');

-- 4. Verifica che tutti i campi necessari esistano in senders
SELECT 
  'senders' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'senders' 
AND column_name IN ('id', 'domain', 'email_from', 'display_name', 'is_active', 'daily_limit', 'profile_id', 'created_at', 'updated_at')
ORDER BY column_name;

-- 5. Verifica che tutti i campi necessari esistano in contacts
SELECT 
  'contacts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('id', 'email', 'first_name', 'last_name', 'is_active', 'profile_id', 'created_at', 'updated_at')
ORDER BY column_name;

-- 6. Verifica che tutti i campi necessari esistano in groups
SELECT 
  'groups' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'groups' 
AND column_name IN ('id', 'name', 'description', 'contact_count', 'profile_id', 'created_at', 'updated_at')
ORDER BY column_name;

-- 7. Verifica che i campi corretti esistano in campaign_queues
SELECT 
  'campaign_queues' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'campaign_queues' 
AND column_name IN ('id', 'campaign_id', 'contact_id', 'sender_id', 'status', 'scheduled_for', 'sent_at', 'retry_count', 'created_at', 'updated_at')
ORDER BY column_name;

-- 8. Verifica che le tabelle esistano
SELECT 
  'table existence' as check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ Tabella presente'
    ELSE '❌ Tabella mancante'
  END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('campaigns', 'groups', 'contacts', 'senders', 'campaign_groups', 'campaign_queues', 'profiles');

-- 9. Verifica che gli indici esistano
SELECT 
  'indexes' as check_type,
  indexname,
  CASE 
    WHEN indexname IS NOT NULL THEN '✅ Indice presente'
    ELSE '❌ Indice mancante'
  END as result
FROM pg_indexes 
WHERE tablename IN ('campaigns', 'campaign_groups', 'campaign_queues')
AND indexname LIKE 'idx_%';

-- 10. Verifica che RLS sia abilitato
SELECT 
  'RLS status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('campaigns', 'groups', 'contacts', 'senders', 'campaign_groups', 'campaign_queues'); 