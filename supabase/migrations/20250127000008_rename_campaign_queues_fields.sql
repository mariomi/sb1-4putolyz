-- Rename campaign_queues fields to match the code expectations
-- This migration renames the fields to match the frontend and function expectations

DO $$
BEGIN
  -- Rename scheduled_time to scheduled_for
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'scheduled_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE campaign_queues RENAME COLUMN scheduled_time TO scheduled_for;
  END IF;
  
  -- Rename sent_time to sent_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'sent_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE campaign_queues RENAME COLUMN sent_time TO sent_at;
  END IF;
  
  -- Add missing fields that are used in the code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN resend_email_id text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN error_message text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update indexes to use new column names
DROP INDEX IF EXISTS idx_campaign_queues_scheduled_time;
CREATE INDEX IF NOT EXISTS idx_campaign_queues_scheduled_for ON campaign_queues(scheduled_for);

-- Create trigger to update updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_queues_updated_at'
  ) THEN
    CREATE TRIGGER update_campaign_queues_updated_at
      BEFORE UPDATE ON campaign_queues
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 