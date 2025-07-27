/*
  # MailFlow DEM Manager Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `full_name` (text)
      - `email` (text, unique)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `contatti`
      - `id` (uuid, primary key) 
      - `profile_id` (uuid, foreign key)
      - `nome` (text)
      - `cognome` (text)
      - `email` (text)
      - `telefono` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `campagne`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key)
      - `titolo` (text)
      - `contenuto_html` (text)
      - `data_invio` (timestamp)
      - `stato` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `log_invio`
      - `id` (uuid, primary key)
      - `campagna_id` (uuid, foreign key)
      - `contatto_id` (uuid, foreign key)
      - `stato_invio` (text)
      - `data_invio` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data

  3. Functions & Triggers
    - Auto-update updated_at timestamp on all relevant tables
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contatti table
CREATE TABLE IF NOT EXISTS contatti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL DEFAULT '',
  cognome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campagne table
CREATE TABLE IF NOT EXISTS campagne (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  titolo text NOT NULL DEFAULT '',
  contenuto_html text DEFAULT '',
  data_invio timestamptz,
  stato text NOT NULL DEFAULT 'bozza',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create log_invio table
CREATE TABLE IF NOT EXISTS log_invio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagna_id uuid REFERENCES campagne(id) ON DELETE CASCADE NOT NULL,
  contatto_id uuid REFERENCES contatti(id) ON DELETE CASCADE NOT NULL,
  stato_invio text NOT NULL DEFAULT 'pending',
  data_invio timestamptz DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and create new ones
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contatti_updated_at ON contatti;
CREATE TRIGGER update_contatti_updated_at
  BEFORE UPDATE ON contatti
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campagne_updated_at ON campagne;
CREATE TRIGGER update_campagne_updated_at
  BEFORE UPDATE ON campagne
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatti ENABLE ROW LEVEL SECURITY;
ALTER TABLE campagne ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_invio ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policies for contatti
CREATE POLICY "Users can manage own contatti"
  ON contatti
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Policies for campagne
CREATE POLICY "Users can manage own campagne"
  ON campagne
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Policies for log_invio
CREATE POLICY "Users can view own log_invio"
  ON log_invio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campagne
      WHERE campagne.id = log_invio.campagna_id
      AND campagne.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert into log_invio"
  ON log_invio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campagne
      WHERE campagne.id = log_invio.campagna_id
      AND campagne.profile_id = auth.uid()
    )
  );