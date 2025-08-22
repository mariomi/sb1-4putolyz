-- Extend user_role enum with additional roles from the "Matrice Operativa Utenti"
-- Add new enum values in transaction-safe way
do $$ begin
  begin
    alter type public.user_role add value 'project_manager';
  exception when duplicate_object then null; end;
  begin
    alter type public.user_role add value 'reply_operator';
  exception when duplicate_object then null; end;
  begin
    alter type public.user_role add value 'data_operator';
  exception when duplicate_object then null; end;
  begin
    alter type public.user_role add value 'sales';
  exception when duplicate_object then null; end;
  begin
    alter type public.user_role add value 'client';
  exception when duplicate_object then null; end;
end $$;

-- Note: Data migration and default change are applied in a separate migration
