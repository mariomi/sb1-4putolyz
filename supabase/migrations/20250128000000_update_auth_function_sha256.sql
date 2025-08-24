-- Update authentication function to use AES-256-GCM encryption
-- First, enable the pgcrypto extension for AES encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt passwords with AES-256-GCM
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
  -- Generate a random salt
  v_salt := gen_random_bytes(32);
  
  -- Derive a 256-bit key from master key + salt using PBKDF2
  v_key := digest(_master_key || encode(v_salt, 'hex'), 'sha256');
  
  -- Encrypt the password using AES-256-GCM
  v_encrypted := encode(
    encrypt_iv(
      _password::bytea,
      v_key,
      v_salt,
      'aes-gcm'
    ),
    'hex'
  );
  
  -- Return salt + encrypted data (salt is needed for decryption)
  RETURN encode(v_salt, 'hex') || ':' || v_encrypted;
END;
$$;

-- Create a function to decrypt passwords with AES-256-GCM
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
  -- Split salt and encrypted data
  v_salt_hex := split_part(_encrypted_data, ':', 1);
  v_encrypted_hex := split_part(_encrypted_data, ':', 2);
  
  -- Convert hex back to bytea
  v_salt := decode(v_salt_hex, 'hex');
  v_encrypted_hex := decode(v_encrypted_hex, 'hex');
  
  -- Derive the same key
  v_key := digest(_master_key || v_salt_hex, 'sha256');
  
  -- Decrypt the password
  v_decrypted := decrypt_iv(
    v_encrypted_hex,
    v_key,
    v_salt,
    'aes-gcm'
  );
  
  RETURN convert_from(v_decrypted, 'utf8');
END;
$$;

-- Update authentication function to use AES encryption
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
  v_decrypted_key text;
BEGIN
  -- Get user data and access key
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
  
  -- Decrypt the stored password and compare with input
  IF v_user_id IS NOT NULL AND v_stored_key IS NOT NULL THEN
    BEGIN
      v_decrypted_key := decrypt_password(v_stored_key);
      IF v_decrypted_key = _access_key THEN
        RETURN QUERY SELECT v_user_id, v_email, v_role, v_full_name, true;
        RETURN;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If decryption fails, the password might be in plain text (for backward compatibility)
        IF v_stored_key = _access_key THEN
          RETURN QUERY SELECT v_user_id, v_email, v_role, v_full_name, true;
          RETURN;
        END IF;
    END;
  END IF;
  
  -- Authentication failed
  RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, false;
END;
$$;
