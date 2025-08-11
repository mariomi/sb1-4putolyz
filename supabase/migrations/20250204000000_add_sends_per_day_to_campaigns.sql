-- Aggiunge la colonna sends_per_day alla tabella campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS sends_per_day INTEGER DEFAULT 10;

-- Aggiorna i record esistenti che non hanno questo valore
UPDATE campaigns 
SET sends_per_day = 10 
WHERE sends_per_day IS NULL;