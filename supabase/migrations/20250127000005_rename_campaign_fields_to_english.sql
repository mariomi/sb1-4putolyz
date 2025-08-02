-- Rename campaign fields from Italian to English
-- This migration renames the fields to match the frontend expectations

DO $$
BEGIN
  -- Rename nome to name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'nome'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'name'
  ) THEN
    ALTER TABLE campaigns RENAME COLUMN nome TO name;
  END IF;
  
  -- Rename oggetto to subject
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'oggetto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'subject'
  ) THEN
    ALTER TABLE campaigns RENAME COLUMN oggetto TO subject;
  END IF;
  
  -- Rename contenuto_html to html_content
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'contenuto_html'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'html_content'
  ) THEN
    ALTER TABLE campaigns RENAME COLUMN contenuto_html TO html_content;
  END IF;
  
  -- Rename stato to status and update values
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'stato'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'status'
  ) THEN
    ALTER TABLE campaigns RENAME COLUMN stato TO status;
    
    -- Update status values from Italian to English
    UPDATE campaigns SET status = 'draft' WHERE status = 'bozza';
    UPDATE campaigns SET status = 'sending' WHERE status = 'in_progress';
    UPDATE campaigns SET status = 'completed' WHERE status = 'completed';
  END IF;
END $$;

-- Update the status check constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_stato_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check 
  CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'paused')); 