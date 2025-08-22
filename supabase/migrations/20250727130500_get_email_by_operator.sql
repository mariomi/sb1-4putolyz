-- Function to fetch email by operator_id and role for login purposes
-- Uses SECURITY DEFINER to bypass RLS safely
create or replace function public.get_email_by_operator(
  _operator_id text,
  _role public.user_role
) returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where operator_id = _operator_id
    and role = _role
  limit 1;
$$;

grant execute on function public.get_email_by_operator(text, public.user_role) to anon, authenticated;
