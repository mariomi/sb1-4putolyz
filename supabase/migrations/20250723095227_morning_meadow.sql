/*
  # Setup Campaign Slot Cron Job

  1. Cron Configuration
    - Creates a cron job that runs every 15 minutes
    - Calls the send-campaign-slot Edge Function
    - Uses pg_cron extension

  2. Security
    - Uses service role for authentication
    - Handles errors gracefully
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to run every 15 minutes
-- This will call our Edge Function automatically
SELECT cron.schedule(
  'send-campaign-slot',              -- job name
  '*/15 * * * *',                   -- every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-campaign-slot',
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

-- Alternative: Create a database function that we can call manually for testing
CREATE OR REPLACE FUNCTION trigger_campaign_slot()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT 
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-campaign-slot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'manual_trigger', true,
        'timestamp', now()
      )
    ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a view to monitor campaign slot performance
CREATE OR REPLACE VIEW campaign_slot_stats AS
SELECT 
  d.domain,
  d.status,
  d.current_day,
  d.emails_sent_today,
  d.max_today,
  ROUND((d.emails_sent_today::numeric / d.max_today::numeric) * 100, 2) as usage_percentage,
  d.last_sent_at,
  COUNT(ct.id) as ready_targets
FROM verified_domains d
LEFT JOIN campaign_targets ct ON ct.status = 'ready'
GROUP BY d.id, d.domain, d.status, d.current_day, d.emails_sent_today, d.max_today, d.last_sent_at
ORDER BY d.domain;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT SELECT ON campaign_slot_stats TO authenticated, service_role;