-- Rename groups fields from Italian to English
-- This migration renames the fields to match the frontend expectations

DO $$
BEGIN
  -- Rename nome to name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'nome'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'name'
  ) THEN
    ALTER TABLE groups RENAME COLUMN nome TO name;
  END IF;
END $$; 