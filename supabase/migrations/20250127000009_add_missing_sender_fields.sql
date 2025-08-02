-- Add missing fields to senders table
-- This migration adds fields needed by the frontend

DO $$
BEGIN
  -- Add display_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE senders ADD COLUMN display_name text;
  END IF;
  
  -- Add is_active column (alias for status)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE senders ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  -- Add emails_sent_today column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'emails_sent_today'
  ) THEN
    ALTER TABLE senders ADD COLUMN emails_sent_today integer DEFAULT 0;
  END IF;
  
  -- Add current_day column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'current_day'
  ) THEN
    ALTER TABLE senders ADD COLUMN current_day integer DEFAULT 1;
  END IF;
  
  -- Add last_sent_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE senders ADD COLUMN last_sent_at timestamptz;
  END IF;
  
  -- Add profile_id column for user ownership
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE senders ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  
  -- Add created_at and updated_at columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE senders ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE senders ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_senders_profile_id ON senders(profile_id);
CREATE INDEX IF NOT EXISTS idx_senders_is_active ON senders(is_active);

-- Create trigger to update updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_senders_updated_at'
  ) THEN
    CREATE TRIGGER update_senders_updated_at
      BEFORE UPDATE ON senders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 