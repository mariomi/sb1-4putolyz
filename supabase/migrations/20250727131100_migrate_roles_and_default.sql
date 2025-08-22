-- Migrate existing values to the new enum variants using text casting
update public.profiles set role = 'project_manager'::public.user_role where role::text = 'pm';
update public.profiles set role = 'reply_operator'::public.user_role where role::text = 'operator';

-- Set default to reply_operator
alter table public.profiles alter column role set default 'reply_operator';
