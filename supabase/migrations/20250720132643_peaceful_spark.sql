/*
  # Create contact groups and campaign targeting

  1. New Tables
    - `gruppi_contatti`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `nome_gruppo` (text)
      - `descrizione` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `contatti_gruppi` (junction table)
      - `id` (uuid, primary key)
      - `contatto_id` (uuid, foreign key to contatti)
      - `gruppo_id` (uuid, foreign key to gruppi_contatti)
      - `created_at` (timestamp)

  2. Campaign Updates
    - Add `tipo_destinatari` (all/groups/specific)
    - Add `destinatari_config` (jsonb for storing selection)

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create gruppi_contatti table
CREATE TABLE IF NOT EXISTS gruppi_contatti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome_gruppo text NOT NULL DEFAULT '',
  descrizione text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS contatti_gruppi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contatto_id uuid NOT NULL REFERENCES contatti(id) ON DELETE CASCADE,
  gruppo_id uuid NOT NULL REFERENCES gruppi_contatti(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contatto_id, gruppo_id)
);

-- Add campaign targeting columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'tipo_destinatari'
  ) THEN
    ALTER TABLE campagne ADD COLUMN tipo_destinatari text DEFAULT 'all';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campagne' AND column_name = 'destinatari_config'
  ) THEN
    ALTER TABLE campagne ADD COLUMN destinatari_config jsonb DEFAULT '{}';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE gruppi_contatti ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatti_gruppi ENABLE ROW LEVEL SECURITY;

-- Create policies for gruppi_contatti
CREATE POLICY "Users can manage own gruppi_contatti"
  ON gruppi_contatti
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Create policies for contatti_gruppi
CREATE POLICY "Users can manage own contatti_gruppi"
  ON contatti_gruppi
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contatti
      WHERE contatti.id = contatti_gruppi.contatto_id
      AND contatti.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contatti
      WHERE contatti.id = contatti_gruppi.contatto_id
      AND contatti.profile_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gruppi_contatti_profile_id ON gruppi_contatti(profile_id);
CREATE INDEX IF NOT EXISTS idx_contatti_gruppi_contatto_id ON contatti_gruppi(contatto_id);
CREATE INDEX IF NOT EXISTS idx_contatti_gruppi_gruppo_id ON contatti_gruppi(gruppo_id);

-- Create update triggers
CREATE TRIGGER update_gruppi_contatti_updated_at
  BEFORE UPDATE ON gruppi_contatti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();