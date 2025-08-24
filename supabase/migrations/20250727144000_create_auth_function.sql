-- Create authentication function for operator login
create or replace function public.authenticate_operator(_operator_id text, _access_key text)
returns table(user_id uuid, email text, role text, full_name text, success boolean)
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_email text;
  v_role text;
  v_full_name text;
  v_stored_key text;
  v_hashed_input text;
begin
  -- Get user data and access key
  select 
    p.id, 
    au.email, 
    p.role::text, 
    p.full_name,
    p.access_key
  into v_user_id, v_email, v_role, v_full_name, v_stored_key
  from public.profiles p
  inner join auth.users au on p.id = au.id
  where p.operator_id = _operator_id;
  
  -- Hash the input access key with SHA-256
  v_hashed_input := encode(sha256(_access_key::bytea), 'hex');
  
  -- Check if user exists and hashed access key matches
  if v_user_id is not null and v_stored_key = v_hashed_input then
    return query select v_user_id, v_email, v_role, v_full_name, true;
  else
    return query select null::uuid, null::text, null::text, null::text, false;
  end if;
end;
$$;