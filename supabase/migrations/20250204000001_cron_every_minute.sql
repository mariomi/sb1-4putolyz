/*
  # Update Campaign Processor Cron Job to run every minute
  
  1. Unschedule existing cron job
  2. Create new cron job to run every minute
*/

-- Remove the current 5-minute cron job
SELECT cron.unschedule('campaign-processor');

-- Create new cron job to run every minute for maximum responsiveness
SELECT cron.schedule(
  'campaign-processor',              -- job name
  '* * * * *',                      -- every minute
  $$
  SELECT
    net.http_post(
      url := 'https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/campaign-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'scheduled', true,
        'timestamp', now()
      )
    );
  $$
);