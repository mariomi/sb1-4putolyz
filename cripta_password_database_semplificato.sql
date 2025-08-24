-- =====================================================
-- SCRIPT SEMPLIFICATO PER CRIPTARE PASSWORD
-- =====================================================
-- Esegui questo script nel Supabase Dashboard > SQL Editor

-- 1. Abilita l'estensione pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crea la funzione per criptare password con AES-256
CREATE OR REPLACE FUNCTION encrypt_password(_password text, _master_key text DEFAULT 'SenduraMasterKey2025!')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encrypted text;
  v_salt bytea;
  v_key bytea;
BEGIN
  -- Genera un salt casuale per ogni password
  v_salt := gen_random_bytes(32);
  
  -- Deriva una chiave 256-bit dalla master key + salt
  v_key := digest((_master_key || encode(v_salt, 'hex'))::bytea, 'sha256');
  
  -- Cripta la password usando AES-256
  v_encrypted := encode(
    encrypt(
      _password::bytea,
      v_key,
      'aes'
    ),
    'hex'
  );
  
  -- Restituisce salt + dati criptati
  RETURN encode(v_salt, 'hex') || ':' || v_encrypted;
END;
$$;

-- 3. Crea la funzione per decriptare password con AES-256
CREATE OR REPLACE FUNCTION decrypt_password(_encrypted_data text, _master_key text DEFAULT 'SenduraMasterKey2025!')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_salt_hex text;
  v_encrypted_hex text;
  v_salt bytea;
  v_key bytea;
  v_decrypted bytea;
BEGIN
  -- Separa salt e dati criptati
  v_salt_hex := split_part(_encrypted_data, ':', 1);
  v_encrypted_hex := split_part(_encrypted_data, ':', 2);
  
  -- Converte hex in bytea
  v_salt := decode(v_salt_hex, 'hex');
  v_encrypted_hex := decode(v_encrypted_hex, 'hex');
  
  -- Deriva la stessa chiave
  v_key := digest((_master_key || v_salt_hex)::bytea, 'sha256');
  
  -- Decripta la password
  v_decrypted := decrypt(
    v_encrypted_hex,
    v_key,
    'aes'
  );
  
  RETURN convert_from(v_decrypted, 'utf8');
END;
$$;

-- 4. Test delle funzioni
SELECT 'Test criptazione:' as test;
SELECT encrypt_password('test123') as password_criptata;

SELECT 'Test decriptazione:' as test;
SELECT decrypt_password(encrypt_password('test123')) as password_decriptata;

-- 5. Verifica password esistenti
SELECT 
  operator_id,
  CASE 
    WHEN access_key LIKE '%:%' THEN 'Criptata' 
    ELSE 'In chiaro' 
  END as stato_password
FROM profiles;
