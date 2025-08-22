-- Create function to get all available roles for an operator
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