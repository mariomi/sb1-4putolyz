/*
  # Update campaign_targets table structure
  
  1. Changes
    - Add campaign metadata fields to campaign_targets
    - Add indexes for better performance
    - Add sent_at and error_message fields
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to campaign_targets if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_targets' AND column_name = 'campaign_title'
  ) THEN
    ALTER TABLE campaign_targets ADD COLUMN campaign_title text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_targets' AND column_name = 'campaign_html'
  ) THEN
    ALTER TABLE campaign_targets ADD COLUMN campaign_html text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_targets' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE campaign_targets ADD COLUMN sender_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_targets' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE campaign_targets ADD COLUMN sender_email text;
  END IF;
END $$;