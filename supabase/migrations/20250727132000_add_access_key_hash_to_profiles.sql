-- Add access_key_hash to profiles and ensure pgcrypto is available for bcrypt hashing
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists access_key_hash text;

comment on column public.profiles.access_key_hash is 'Bcrypt hash of the access key used for operator login';
