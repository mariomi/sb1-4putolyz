-- Create a test user for Playwright testing
do $$
declare
  v_user_id uuid;
  v_email text := 'test@example.com';
  v_password text := 'testpassword123';
begin
  -- Create auth user
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
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    now()
  )
  returning id into v_user_id;

  -- Create profile
  insert into public.profiles (id, email, full_name, role, operator_id, created_at, updated_at)
  values (
    v_user_id,
    v_email,
    'Test User',
    'admin',
    'OP-TEST-USER',
    now(),
    now()
  );
end $$;