/*
  # Add domains management and import functionality

  1. New Tables
    - `domains` (domini)
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key)
      - `domain_name` (text)
      - `verification_status` (text)
      - `resend_domain_id` (text)
      - `dns_records` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Modifications
    - Update `senders` table to reference domains
    - Add import-related columns

  3. Security
    - Enable RLS on domains table  
    - Add policies for profile-based access
    - Add update triggers
*/

-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_name text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  resend_domain_id text,
  dns_records jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add domain_id to senders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'domain_id'
  ) THEN
    ALTER TABLE senders ADD COLUMN domain_id uuid REFERENCES domains(id);
  END IF;
END $$;

-- Add import-related columns to contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN import_batch_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN imported_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'source'
  ) THEN
    ALTER TABLE contacts ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Create import_batches table for tracking imports
CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename text,
  total_records integer DEFAULT 0,
  successful_imports integer DEFAULT 0,
  failed_imports integer DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_log jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own domains"
  ON domains
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can manage own import batches"
  ON import_batches
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_domains_profile_id ON domains(profile_id);
CREATE INDEX IF NOT EXISTS idx_domains_verification_status ON domains(verification_status);
CREATE INDEX IF NOT EXISTS idx_senders_domain_id ON senders(domain_id);
CREATE INDEX IF NOT EXISTS idx_contacts_import_batch_id ON contacts(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_profile_id ON import_batches(profile_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status);

-- Create update triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_domains_updated_at'
  ) THEN
    CREATE TRIGGER update_domains_updated_at
      BEFORE UPDATE ON domains
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Insert sample domain data (optional, for development)
-- This can be removed in production
INSERT INTO domains (profile_id, domain_name, verification_status) 
SELECT id, 'example.com', 'pending' 
FROM profiles 
WHERE NOT EXISTS (SELECT 1 FROM domains WHERE domain_name = 'example.com')
LIMIT 1;