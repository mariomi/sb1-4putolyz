-- Add end_date column to campaigns table
-- This migration adds the end_date field needed for the new scheduling logic

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN end_date date;
  END IF;
END $$;

-- Add index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date); 