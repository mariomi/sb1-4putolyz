-- Create or update user "maio" as administrator with an access key
-- Fixed to properly set password for auth user
do $$
declare
  v_user_id uuid;
  v_email text := 'maio@example.com';
  v_access_key text := 'Maio-Admin-Access-2025!';
begin
  -- Delete existing user if exists to recreate fresh
  delete from auth.users where email = v_email;
  
  -- Create fresh auth user
  insert into auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    phone_confirmed_at,
    confirmation_sent_at,
    confirmed_at,
    instance_id, 
    role,
    aud,
    created_at,
    updated_at,
    last_sign_in_at
  )
  values (
    gen_random_uuid(),
    v_email,
    crypt(v_access_key, gen_salt('bf')),
    now(),
    now(),
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    now(),
    now(),
    now()
  )
  returning id into v_user_id;

  -- Upsert profile with admin role and operator id
  insert into public.profiles (id, email, full_name, role, operator_id, access_key_hash, created_at, updated_at)
  values (
    v_user_id,
    v_email,
    'Maio Admin',
    'admin',
    'OP-MAIO-ADMIN',
    crypt(v_access_key, gen_salt('bf')),
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = 'admin',
    operator_id = excluded.operator_id,
    access_key_hash = excluded.access_key_hash,
    updated_at = now();
end $$;
