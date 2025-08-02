-- Create campaign_groups table
-- This table links campaigns to groups with percentage selections

CREATE TABLE IF NOT EXISTS campaign_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    percentage_start INTEGER DEFAULT 0,
    percentage_end INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, group_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_groups_campaign_id ON campaign_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_groups_group_id ON campaign_groups(group_id);

-- Enable Row Level Security
ALTER TABLE campaign_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create trigger to update updated_at column
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