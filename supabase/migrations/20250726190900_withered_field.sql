/*
  # Add scheduling columns to campagne table

  1. New Columns
    - `durata_invio_ore` (integer, default 1) - Number of hours to distribute the campaign sending
    - `orario_inizio` (text, default '09:00') - Start time for sending the campaign

  2. Changes
    - Add durata_invio_ore column to campagne table
    - Add orario_inizio column to campagne table
    - Set appropriate defaults for existing campaigns
*/

-- Add durata_invio_ore column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'durata_invio_ore'
  ) THEN
    ALTER TABLE campagne ADD COLUMN durata_invio_ore integer DEFAULT 1;
  END IF;
END $$;

-- Add orario_inizio column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'orario_inizio'
  ) THEN
    ALTER TABLE campagne ADD COLUMN orario_inizio text DEFAULT '09:00';
  END IF;
END $$;