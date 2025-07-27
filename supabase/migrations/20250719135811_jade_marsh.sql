/*
  # Add Resend Integration Tables

  1. New Tables
    - `domini`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `nome_dominio` (text, domain name)
      - `stato_verifica` (text, verification status)
      - `resend_domain_id` (text, Resend domain ID)
      - `dns_records` (jsonb, DNS configuration)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `mittenti`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `dominio_id` (uuid, foreign key to domini)
      - `nome_mittente` (text, sender name)
      - `email_mittente` (text, sender email)
      - `is_default` (boolean, default sender)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data

  3. Updates
    - Add `mittente_id` to campagne table
    - Update log_invio with more detailed tracking
*/

-- Create domini table
CREATE TABLE IF NOT EXISTS domini (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome_dominio text NOT NULL,
  stato_verifica text DEFAULT 'pending' NOT NULL,
  resend_domain_id text,
  dns_records jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE domini ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own domini"
  ON domini
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Create mittenti table
CREATE TABLE IF NOT EXISTS mittenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dominio_id uuid NOT NULL REFERENCES domini(id) ON DELETE CASCADE,
  nome_mittente text DEFAULT '' NOT NULL,
  email_mittente text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mittenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mittenti"
  ON mittenti
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Add mittente_id to campagne table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'mittente_id'
  ) THEN
    ALTER TABLE campagne ADD COLUMN mittente_id uuid REFERENCES mittenti(id);
  END IF;
END $$;

-- Add more fields to log_invio for better tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'log_invio' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE log_invio ADD COLUMN resend_email_id text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'log_invio' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE log_invio ADD COLUMN error_message text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'log_invio' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE log_invio ADD COLUMN retry_count integer DEFAULT 0;
  END IF;
END $$;

-- Create triggers for updated_at
CREATE TRIGGER update_domini_updated_at
  BEFORE UPDATE ON domini
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mittenti_updated_at
  BEFORE UPDATE ON mittenti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_domini_profile_id ON domini(profile_id);
CREATE INDEX IF NOT EXISTS idx_mittenti_profile_id ON mittenti(profile_id);
CREATE INDEX IF NOT EXISTS idx_mittenti_dominio_id ON mittenti(dominio_id);
CREATE INDEX IF NOT EXISTS idx_campagne_mittente_id ON campagne(mittente_id);