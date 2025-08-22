-- Clean existing test users and seed new ones with the new structure

-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_email text;
  v_password text;
begin
  
  -- Clean existing test users
  delete from auth.users where email in (
    'maio@example.com', 
    'marco@example.com', 
    'sofia@example.com', 
    'luca@example.com', 
    'anna@example.com',
    'testuser@example.com',
    'test@example.com'
  );
  
  -- Admin user: Maio
  v_user_id := gen_random_uuid();
  v_email := 'maio@example.com';
  v_password := 'AdminAccess2025!';
  
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf', 8)), now(), now(), now()
  );
  
  insert into public.profiles (id, role, full_name, operator_id, access_key, created_at, updated_at)
  values (v_user_id, 'admin', 'Maio Admin', 'OP-MAIO-ADMIN', 'AdminAccess2025!', now(), now());
  
  
  -- Project Manager user: Marco
  v_user_id := gen_random_uuid();
  v_email := 'marco@example.com';
  v_password := 'ProjectManager123!';
  
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf', 8)), now(), now(), now()
  );
  
  insert into public.profiles (id, role, full_name, operator_id, access_key, created_at, updated_at)
  values (v_user_id, 'project_manager', 'Marco Progetti', 'OP-MARCO-PM', 'ProjectManager123!', now(), now());
  
  
  -- Reply Operator user: Sofia  
  v_user_id := gen_random_uuid();
  v_email := 'sofia@example.com';
  v_password := 'ReplyOp456!';
  
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf', 8)), now(), now(), now()
  );
  
  insert into public.profiles (id, role, full_name, operator_id, access_key, created_at, updated_at)
  values (v_user_id, 'reply_operator', 'Sofia Risposte', 'OP-SOFIA-REPLY', 'ReplyOp456!', now(), now());
  
  
  -- Sales user: Luca
  v_user_id := gen_random_uuid();
  v_email := 'luca@example.com';
  v_password := 'Sales789!';
  
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf', 8)), now(), now(), now()
  );
  
  insert into public.profiles (id, role, full_name, operator_id, access_key, created_at, updated_at)
  values (v_user_id, 'sales', 'Luca Vendite', 'OP-LUCA-SALES', 'Sales789!', now(), now());
  
  
  -- Client user: Anna
  v_user_id := gen_random_uuid();
  v_email := 'anna@example.com';
  v_password := 'Client101!';
  
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf', 8)), now(), now(), now()
  );
  
  insert into public.profiles (id, role, full_name, operator_id, access_key, created_at, updated_at)
  values (v_user_id, 'client', 'Anna Cliente', 'OP-ANNA-CLIENT', 'Client101!', now(), now());
  
end $$;