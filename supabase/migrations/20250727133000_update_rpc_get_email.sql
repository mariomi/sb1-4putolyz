-- Replace RPC to fetch email and role by operator_id using join to auth.users
drop function if exists public.get_email_by_operator(text, public.user_role);

create or replace function public.get_email_and_role_by_operator(
  _operator_id text
) returns table(email text, role public.user_role)
language sql
security definer
set search_path = public, auth
as $$
  select u.email, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.operator_id = _operator_id
  limit 1;
$$;

grant execute on function public.get_email_and_role_by_operator(text) to anon, authenticated;
