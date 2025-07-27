/*
  # Add queue_settings column to campagne table

  1. New Column
    - `queue_settings` (jsonb) - Settings for automatic queue processing
    
  2. Updates
    - Add column to campagne table with default empty object
    - Safe addition with IF NOT EXISTS check
*/

-- Add queue_settings column to campagne table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'queue_settings'
  ) THEN
    ALTER TABLE campagne ADD COLUMN queue_settings JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;