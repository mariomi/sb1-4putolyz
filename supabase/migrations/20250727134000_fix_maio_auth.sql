-- Fix maio admin user authentication by recreating with proper settings
do $$
declare
  v_user_id uuid;
  v_email text := 'maio@example.com';
  v_access_key text := 'Maio-Admin-Access-2025!';
begin
  -- Get existing user id first
  select id into v_user_id from public.profiles where operator_id = 'OP-MAIO-ADMIN';
  
  if v_user_id is not null then
    -- Delete and recreate auth user with correct fields
    delete from auth.users where id = v_user_id;
    
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
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_access_key, gen_salt('bf')),
      now(),
      now(),
      now()
    );
  end if;
end $$;