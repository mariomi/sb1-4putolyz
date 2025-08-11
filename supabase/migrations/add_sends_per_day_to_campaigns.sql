/*
  # Add sends_per_day column to campaigns table
  
  Adds the sends_per_day field to support the new campaign configuration 
  where users specify the number of email sends per day instead of 
  batch interval minutes.
*/

-- Add sends_per_day column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sends_per_day integer DEFAULT 10;

-- Add comment to the column
COMMENT ON COLUMN campaigns.sends_per_day IS 'Number of email sends per day for the campaign';

-- Update existing campaigns to have a default value
UPDATE campaigns SET sends_per_day = 10 WHERE sends_per_day IS NULL;