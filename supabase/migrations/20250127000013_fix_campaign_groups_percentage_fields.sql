-- Fix campaign_groups table to ensure percentage fields exist
-- This migration adds the percentage fields if they're missing

DO $$
BEGIN
  -- Add percentage_start column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_groups' AND column_name = 'percentage_start'
  ) THEN
    ALTER TABLE campaign_groups ADD COLUMN percentage_start INTEGER DEFAULT 0;
  END IF;
  
  -- Add percentage_end column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_groups' AND column_name = 'percentage_end'
  ) THEN
    ALTER TABLE campaign_groups ADD COLUMN percentage_end INTEGER DEFAULT 100;
  END IF;
  
  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_groups' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE campaign_groups ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_groups' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE campaign_groups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_campaign_groups_campaign_id ON campaign_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_groups_group_id ON campaign_groups(group_id);

-- Enable Row Level Security if not already enabled
ALTER TABLE campaign_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'campaign_groups' AND policyname = 'Users can manage own campaign groups'
  ) THEN
    CREATE POLICY "Users can manage own campaign groups"
      ON campaign_groups
      FOR ALL
      TO authenticated
      USING (
        campaign_id IN (
          SELECT id FROM campaigns WHERE profile_id = auth.uid()
        )
      )
      WITH CHECK (
        campaign_id IN (
          SELECT id FROM campaigns WHERE profile_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create trigger to update updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_campaign_groups_updated_at
      BEFORE UPDATE ON campaign_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 