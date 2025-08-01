/*
  # Update Campaign Processor to V2
  
  1. Remove old cron job
  2. Create new cron job pointing to campaign-processor-v2
  3. Add debug functions
*/

-- Remove the old cron job
SELECT cron.unschedule('campaign-processor');

-- Create the new cron job pointing to V2
SELECT cron.schedule(
  'campaign-processor-v2',           -- job name
  '* * * * *',                      -- every minute for precise timing
  $$
  SELECT
    net.http_post(
      url := 'https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/campaign-processor-v2',
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

-- Create function to debug campaign status
CREATE OR REPLACE FUNCTION debug_campaign_status(campaign_id_param uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT 
    net.http_post(
      url := 'https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/debug-campaign-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'campaignId', campaign_id_param
      )
    ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_campaign_status(uuid) TO authenticated, service_role;

-- Create a manual trigger for the new processor
CREATE OR REPLACE FUNCTION trigger_campaign_processor_v2()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT 
    net.http_post(
      url := 'https://xqsjyvqikrvibyluynwv.supabase.co/functions/v1/campaign-processor-v2',
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

GRANT EXECUTE ON FUNCTION trigger_campaign_processor_v2() TO authenticated, service_role;