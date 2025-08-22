/*
  # Schedule Campaign Processor every minute using pg_cron + pg_net
  - Idempotent: scheduling with the same job name upserts the command
*/

-- Ensure extensions exist
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- Schedule/Upsert the cron job (every minute)
select cron.schedule(
  'campaign-processor',
  '* * * * *',
  $$
    select
      net.http_post(
        url:='https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/campaign-processor',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || current_setting('app.service_role_key')
        ),
        body:=jsonb_build_object('scheduled', true, 'timestamp', now()),
        timeout_milliseconds:=5000
      ) as request_id;
  $$
);