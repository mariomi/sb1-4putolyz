/*
  # Add campaign_targets table for queue system

  1. New Tables
    - `campaign_targets`
      - `id` (uuid, primary key)
      - `email` (text, recipient email)
      - `campaign_id` (uuid, reference to campaign)
      - `status` (text, ready/sent/failed/bounced)
      - `sent_at` (timestamp, when sent)
      - `error_message` (text, error details if failed)
      - `campaign_title` (text, cached campaign title)
      - `campaign_html` (text, cached campaign content)
      - `sender_name` (text, cached sender name)
      - `sender_email` (text, cached sender email)
      - `assigned_domains` (jsonb, assigned domains array)
      - `priority` (integer, sending priority)
      - `retry_count` (integer, number of retries)
      - `scheduled_for` (timestamp, when to retry)
      - `domain_used` (text, which domain was used for sending)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `campaign_targets` table
    - Add policy for service role to manage all records

  3. Indexes
    - Index on status for quick filtering
    - Index on campaign_id for campaign-specific queries
    - Index on assigned_domains for domain-based queries
*/

-- Create campaign_targets table if it doesn't exist
CREATE TABLE IF NOT EXISTS campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  campaign_id uuid,
  status text DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'sent', 'failed', 'bounced')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  campaign_title text,
  campaign_html text,
  sender_name text,
  sender_email text,
  assigned_domains jsonb DEFAULT '[]'::jsonb,
  priority integer DEFAULT 1,
  retry_count integer DEFAULT 0,
  scheduled_for timestamptz,
  domain_used text
);

-- Add indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaign_targets_status') THEN
    CREATE INDEX idx_campaign_targets_status ON campaign_targets (status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaign_targets_campaign_id') THEN
    CREATE INDEX idx_campaign_targets_campaign_id ON campaign_targets (campaign_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaign_targets_assigned_domains') THEN
    CREATE INDEX idx_campaign_targets_assigned_domains ON campaign_targets USING gin (assigned_domains);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE campaign_targets ENABLE ROW LEVEL SECURITY;

-- Add policy for service role (used by Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'campaign_targets' 
    AND policyname = 'Service role can manage campaign_targets'
  ) THEN
    CREATE POLICY "Service role can manage campaign_targets"
      ON campaign_targets
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_campaign_targets_updated_at'
  ) THEN
    CREATE TRIGGER update_campaign_targets_updated_at
      BEFORE UPDATE ON campaign_targets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;