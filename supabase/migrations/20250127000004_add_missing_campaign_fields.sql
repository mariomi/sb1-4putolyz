-- Add missing fields to campaigns table
-- This migration adds all the fields needed by the frontend

DO $$
BEGIN
  -- Add end_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN end_date date;
  END IF;
  
  -- Add selected_groups column (JSONB for storing group selections with percentages)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'selected_groups'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN selected_groups jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  -- Add profile_id column for user ownership
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  
  -- Add updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  
  -- Add start_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN start_date date;
  END IF;
  
  -- Add start_time_of_day column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'start_time_of_day'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN start_time_of_day text DEFAULT '09:00';
  END IF;
  
  -- Add warm_up_days column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'warm_up_days'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN warm_up_days integer DEFAULT 0;
  END IF;
  
  -- Add emails_per_batch column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'emails_per_batch'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN emails_per_batch integer DEFAULT 50;
  END IF;
  
  -- Add batch_interval_minutes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'batch_interval_minutes'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN batch_interval_minutes integer DEFAULT 15;
  END IF;
  
  -- Add send_duration_hours column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'send_duration_hours'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN send_duration_hours integer DEFAULT 8;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id ON campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Create trigger to update updated_at column
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