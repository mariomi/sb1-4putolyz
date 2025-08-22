-- Ensure pgcrypto is enabled and fix maio password
create extension if not exists pgcrypto;

-- Update maio admin password to match the access key
do $$
declare
  v_user_id uuid;
  v_access_key text := 'Maio-Admin-Access-2025!';
begin
  -- Get maio user id
  select id into v_user_id from auth.users where email = 'maio@example.com';
  
  if v_user_id is not null then
    -- Update password with correct hash
    update auth.users 
    set encrypted_password = crypt(v_access_key, gen_salt('bf', 8))
    where id = v_user_id;
  end if;
end $$;