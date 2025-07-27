/*
  # Add campaign-specific domain assignment

  1. New Columns
    - `campagne.domini_assegnati` (jsonb array) - domains assigned to each campaign
    - `campaign_targets.assigned_domains` (jsonb array) - domains available for this target
    
  2. Purpose
    - Each campaign gets its own domain pool
    - Separate processing queues per campaign
    - Better domain rotation and management
*/

-- Add domini_assegnati column to campagne table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'domini_assegnati'
  ) THEN
    ALTER TABLE campagne ADD COLUMN domini_assegnati jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add assigned_domains column to campaign_targets table  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_targets' AND column_name = 'assigned_domains'
  ) THEN
    ALTER TABLE campaign_targets ADD COLUMN assigned_domains jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_targets_assigned_domains 
ON campaign_targets USING gin (assigned_domains);

CREATE INDEX IF NOT EXISTS idx_campagne_domini_assegnati 
ON campagne USING gin (domini_assegnati);