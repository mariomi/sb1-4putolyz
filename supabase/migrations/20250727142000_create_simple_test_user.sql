-- Create a simple test user for testing authentication
do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'testuser@example.com';
  v_password text := 'simplepassword123';
begin
  -- Delete if exists
  delete from auth.users where email = v_email;
  
  -- Create auth user with simple structure
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf', 8)),
    now(),
    now(),
    now()
  );

  -- Create profile
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    operator_id,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_email,
    'Test User Simple',
    'admin',
    'OP-SIMPLE-TEST',
    now(),
    now()
  );
end $$;