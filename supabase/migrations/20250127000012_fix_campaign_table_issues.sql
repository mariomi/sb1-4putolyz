-- Fix remaining issues in campaigns table
-- This migration corrects the problems that weren't resolved by previous migrations

DO $$
BEGIN
  -- Add end_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN end_date date;
  END IF;
  
  -- Add selected_groups column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'selected_groups'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN selected_groups jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  -- Remove the old stato column and ensure status column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'stato'
  ) THEN
    -- First, ensure status column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'status'
    ) THEN
      ALTER TABLE campaigns ADD COLUMN status text DEFAULT 'draft';
    END IF;
    
    -- Copy data from stato to status
    UPDATE campaigns SET status = 
      CASE 
        WHEN stato = 'bozza' THEN 'draft'
        WHEN stato = 'in_progress' THEN 'sending'
        WHEN stato = 'completed' THEN 'completed'
        ELSE 'draft'
      END
    WHERE status IS NULL OR status = 'draft';
    
    -- Drop the old stato column
    ALTER TABLE campaigns DROP COLUMN IF EXISTS stato;
  END IF;
  
  -- Ensure status column has proper default and constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'status'
  ) THEN
    -- Update any NULL status values to 'draft'
    UPDATE campaigns SET status = 'draft' WHERE status IS NULL;
    
    -- Add constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'campaigns_status_check'
    ) THEN
      ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check 
        CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'paused'));
    END IF;
  END IF;
END $$;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id ON campaigns(profile_id);

-- Create trigger to update updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at'
  ) THEN
    CREATE TRIGGER update_campaigns_updated_at
      BEFORE UPDATE ON campaigns
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 