-- Recreate profiles table with simplified structure
-- Fields: role, full_name, operator_id, access_key

-- First, drop the existing table and recreate it
drop table if exists public.profiles cascade;

-- Recreate the user_role enum with all required roles
drop type if exists public.user_role cascade;
create type public.user_role as enum (
  'admin',
  'project_manager', 
  'reply_operator',
  'data_operator',
  'sales',
  'client'
);

-- Create the new profiles table with simplified structure
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role public.user_role not null default 'reply_operator',
  full_name text,
  operator_id text unique,
  access_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better performance
create index profiles_operator_id_idx on public.profiles(operator_id);
create index profiles_role_idx on public.profiles(role);

-- Enable RLS (Row Level Security)
alter table public.profiles enable row level security;

-- Create RLS policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Allow service role to insert profiles (for user creation)
create policy "Service role can insert profiles" on public.profiles
  for insert with check (true);

-- Create trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();