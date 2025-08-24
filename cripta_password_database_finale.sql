-- =====================================================
-- SCRIPT FINALE PER CRIPTARE PASSWORD CON ENCRYPT/DECRYPT
-- =====================================================
-- Esegui questo script nel Supabase Dashboard > SQL Editor
-- Usa encrypt/decrypt per cifratura simmetrica sicura

-- 1. Abilita l'estensione pgcrypto (se non già abilitata)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crea la funzione per criptare password con encrypt
CREATE OR REPLACE FUNCTION encrypt_password(_password text, _master_key text DEFAULT 'SenduraMasterKey2025!')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encrypted text;
  v_key bytea;
BEGIN
  -- Deriva una chiave 256-bit dalla master key usando SHA-256
  v_key := digest(_master_key::bytea, 'sha256');
  
  -- Cripta la password usando encrypt con AES-256
  v_encrypted := encode(
    encrypt(
      _password::bytea,
      v_key,
      'aes'
    ),
    'hex'
  );
  
  RETURN v_encrypted;
END;
$$;

-- 3. Crea la funzione per decriptare password con decrypt
CREATE OR REPLACE FUNCTION decrypt_password(_encrypted_data text, _master_key text DEFAULT 'SenduraMasterKey2025!')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted bytea;
  v_key bytea;
BEGIN
  -- Deriva la stessa chiave 256-bit dalla master key
  v_key := digest(_master_key::bytea, 'sha256');
  
  -- Decripta la password usando decrypt con AES-256
  v_decrypted := decrypt(
    decode(_encrypted_data, 'hex'),
    v_key,
    'aes'
  );
  
  RETURN convert_from(v_decrypted, 'utf8');
END;
$$;

-- 4. Crea la funzione per verificare password (per autenticazione)
CREATE OR REPLACE FUNCTION verify_password(_input_password text, _stored_encrypted text, _master_key text DEFAULT 'SenduraMasterKey2025!')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted text;
BEGIN
  -- Decripta la password salvata
  v_decrypted := decrypt_password(_stored_encrypted, _master_key);
  
  -- Confronta con la password di input
  RETURN v_decrypted = _input_password;
END;
$$;

-- 5. Aggiorna la funzione di autenticazione per usare encrypt/decrypt
CREATE OR REPLACE FUNCTION public.authenticate_operator(_operator_id text, _access_key text)
RETURNS TABLE(user_id uuid, email text, role text, full_name text, success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_role text;
  v_full_name text;
  v_stored_key text;
BEGIN
  -- Ottieni i dati utente e la chiave di accesso
  SELECT 
    p.id, 
    au.email, 
    p.role::text, 
    p.full_name,
    p.access_key
  INTO v_user_id, v_email, v_role, v_full_name, v_stored_key
  FROM public.profiles p
  INNER JOIN auth.users au ON p.id = au.id
  WHERE p.operator_id = _operator_id;
  
  -- Verifica la password salvata
  IF v_user_id IS NOT NULL AND v_stored_key IS NOT NULL THEN
    -- Se la password è criptata (non è testo semplice)
    IF v_stored_key != _access_key AND length(v_stored_key) > 20 THEN
      -- Verifica usando la funzione di verifica
      IF verify_password(_access_key, v_stored_key) THEN
        RETURN QUERY SELECT v_user_id, v_email, v_role, v_full_name, true;
        RETURN;
      END IF;
    ELSE
      -- Se la password non è criptata (per compatibilità), confronta direttamente
      IF v_stored_key = _access_key THEN
        RETURN QUERY SELECT v_user_id, v_email, v_role, v_full_name, true;
        RETURN;
      END IF;
    END IF;
  END IF;
  
  -- Autenticazione fallita
  RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, false;
END;
$$;

-- 6. Test delle funzioni
SELECT 'Test criptazione:' as test;
SELECT encrypt_password('test123') as password_criptata;

SELECT 'Test decriptazione:' as test;
SELECT decrypt_password(encrypt_password('test123')) as password_decriptata;

SELECT 'Test verifica password:' as test;
SELECT verify_password('test123', encrypt_password('test123')) as password_valida;

SELECT 'Test verifica password sbagliata:' as test;
SELECT verify_password('password_sbagliata', encrypt_password('test123')) as password_valida;

-- 7. Verifica password esistenti
SELECT 
  operator_id,
  CASE 
    WHEN access_key LIKE '%:%' THEN 'Criptata (vecchio formato)' 
    WHEN length(access_key) > 20 THEN 'Criptata (encrypt/decrypt)'
    ELSE 'In chiaro' 
  END as stato_password
FROM profiles;

-- 8. Cripta tutte le password esistenti (OPZIONALE - decommenta se vuoi)
-- UPDATE profiles 
-- SET access_key = encrypt_password(access_key)
-- WHERE access_key IS NOT NULL 
--   AND access_key NOT LIKE '%:%'
--   AND length(access_key) <= 20;

-- =====================================================
-- RIEPILOGO DELLE MODIFICHE APPLICATE:
-- =====================================================
-- ✅ Estensione pgcrypto abilitata per encrypt/decrypt
-- ✅ Funzione encrypt_password() creata (encrypt con AES-256)
-- ✅ Funzione decrypt_password() creata (decrypt)
-- ✅ Funzione verify_password() creata (verifica sicura)
-- ✅ Funzione authenticate_operator() aggiornata
-- ✅ Sistema di autenticazione sicuro implementato
-- ✅ Algoritmo bidirezionale sicuro (encrypt/decrypt)
-- =====================================================
