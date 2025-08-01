/*
  # Fix Campaign Processor Cron Job
  
  1. Remove old incorrect cron job
  2. Create new cron job for campaign-processor
  3. Fix the trigger function
  4. Update the monitoring view
*/

-- Remove the old cron job
SELECT cron.unschedule('send-campaign-slot');

-- Create the correct cron job to run every 5 minutes for better responsiveness
SELECT cron.schedule(
  'campaign-processor',              -- job name
  '*/5 * * * *',                    -- every 5 minutes
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

-- Update the manual trigger function
CREATE OR REPLACE FUNCTION trigger_campaign_processor()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT 
    net.http_post(
      url := 'https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/campaign-processor',
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

-- Drop the old view and function
DROP VIEW IF EXISTS campaign_slot_stats;
DROP FUNCTION IF EXISTS trigger_campaign_slot();

-- Create a better monitoring view for campaign queue status
CREATE OR REPLACE VIEW campaign_queue_stats AS
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.status as campaign_status,
  COUNT(cq.id) as total_emails,
  COUNT(CASE WHEN cq.status = 'pending' THEN 1 END) as pending_emails,
  COUNT(CASE WHEN cq.status = 'sent' THEN 1 END) as sent_emails,
  COUNT(CASE WHEN cq.status = 'failed' THEN 1 END) as failed_emails,
  COUNT(CASE WHEN cq.status = 'processing' THEN 1 END) as processing_emails,
  ROUND(
    (COUNT(CASE WHEN cq.status = 'sent' THEN 1 END)::numeric / 
     NULLIF(COUNT(cq.id), 0)::numeric) * 100, 2
  ) as completion_percentage,
  MIN(cq.scheduled_for) as first_scheduled_for,
  MAX(cq.scheduled_for) as last_scheduled_for,
  c.created_at,
  c.updated_at
FROM campaigns c
LEFT JOIN campaign_queues cq ON c.id = cq.campaign_id
WHERE c.status IN ('sending', 'completed')
GROUP BY c.id, c.name, c.status, c.created_at, c.updated_at
ORDER BY c.updated_at DESC;

-- Grant permissions
GRANT SELECT ON campaign_queue_stats TO authenticated, service_role;

-- Create a function to check cron job status
CREATE OR REPLACE FUNCTION get_campaign_processor_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean,
  last_run timestamptz,
  next_run timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.last_run,
    j.next_run
  FROM cron.job j 
  WHERE j.jobname = 'campaign-processor';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_campaign_processor_status() TO authenticated, service_role;