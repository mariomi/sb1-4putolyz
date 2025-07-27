/*
  # Create Campaign Slot System Tables

  1. New Tables
    - `verified_domains`
      - `id` (uuid, primary key)
      - `domain` (text, domain name)
      - `resend_id` (text, Resend domain ID)
      - `status` (text, domain status)
      - `current_day` (int, current warm-up day)
      - `emails_sent_today` (int, emails sent today)
      - `max_today` (int, max emails for today)
      - `last_sent_at` (timestamptz, last send time)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `campaign_targets`
      - `id` (uuid, primary key)
      - `email` (text, target email)
      - `campaign_id` (uuid, campaign reference)
      - `status` (text, target status)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for service role access
*/

-- Create verified_domains table
CREATE TABLE IF NOT EXISTS verified_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  resend_id text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'warming')),
  current_day int DEFAULT 1 CHECK (current_day >= 1),
  emails_sent_today int DEFAULT 0 CHECK (emails_sent_today >= 0),
  max_today int DEFAULT 150 CHECK (max_today > 0),
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campaign_targets table
CREATE TABLE IF NOT EXISTS campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  campaign_id uuid,
  status text DEFAULT 'ready' CHECK (status IN ('ready', 'sent', 'failed', 'bounced')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE verified_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (needed for Edge Functions)
CREATE POLICY "Service role can manage verified_domains"
  ON verified_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage campaign_targets"
  ON campaign_targets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verified_domains_status ON verified_domains(status);
CREATE INDEX IF NOT EXISTS idx_verified_domains_last_sent ON verified_domains(last_sent_at);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_status ON campaign_targets(status);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id ON campaign_targets(campaign_id);

-- Create updated_at trigger function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS '
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    ' LANGUAGE plpgsql;
  END IF;
END $$;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_verified_domains_updated_at ON verified_domains;
CREATE TRIGGER update_verified_domains_updated_at
  BEFORE UPDATE ON verified_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_targets_updated_at ON campaign_targets;
CREATE TRIGGER update_campaign_targets_updated_at
  BEFORE UPDATE ON campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO verified_domains (domain, resend_id, status, max_today) VALUES
('example.com', 'resend_domain_1', 'active', 150),
('test-domain.com', 'resend_domain_2', 'active', 200)
ON CONFLICT (domain) DO NOTHING;

INSERT INTO campaign_targets (email, campaign_id, status) VALUES
('test1@example.com', gen_random_uuid(), 'ready'),
('test2@example.com', gen_random_uuid(), 'ready'),
('test3@example.com', gen_random_uuid(), 'ready')
ON CONFLICT DO NOTHING;