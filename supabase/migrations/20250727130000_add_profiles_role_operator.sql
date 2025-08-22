-- Add user role enum and operator_id to profiles
do $$ begin
  create type public.user_role as enum ('admin', 'pm', 'operator');
exception
  when duplicate_object then null;
end $$;

alter table if exists public.profiles
  add column if not exists role public.user_role not null default 'operator',
  add column if not exists operator_id text;

-- Ensure operator_id exists and is unique for mapping login
create unique index if not exists profiles_operator_id_unique on public.profiles (operator_id) where operator_id is not null;

comment on column public.profiles.role is 'User role used for post-login redirects (admin, pm, operator)';
comment on column public.profiles.operator_id is 'External Operator identifier used for login UI';

-- Backfill: if some users lack operator_id, generate a simple one
update public.profiles
set operator_id = coalesce(operator_id, 'OP-' || substr(md5(id::text), 1, 8))
where operator_id is null;
