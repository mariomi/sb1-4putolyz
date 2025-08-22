-- Recreate RPC functions for the new profiles table structure

-- Function to get email and role by operator ID
create or replace function public.get_email_and_role_by_operator(_operator_id text)
returns table(email text, role text)
language plpgsql
security definer
as $$
begin
  return query
  select 
    au.email::text,
    p.role::text
  from public.profiles p
  inner join auth.users au on p.id = au.id
  where p.operator_id = _operator_id;
end;
$$;

-- Function to get all available roles for an operator (simplified - since we store access_key directly)
create or replace function public.get_roles_by_operator(_operator_id text)
returns table(role text)
language plpgsql
security definer
as $$
begin
  return query
  select distinct p.role::text
  from public.profiles p
  where p.operator_id = _operator_id;
end;
$$;

-- Function to validate access key (for authentication)
create or replace function public.validate_access_key(_operator_id text, _access_key text)
returns boolean
language plpgsql
security definer
as $$
declare
  stored_key text;
begin
  select access_key into stored_key
  from public.profiles
  where operator_id = _operator_id;
  
  return stored_key = _access_key;
end;
$$;