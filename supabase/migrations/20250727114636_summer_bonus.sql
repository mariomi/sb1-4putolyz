/*
  # Add missing columns to align with application schema

  This migration adds all the missing columns that the application expects
  but are not present in the current database schema.

  ## Changes Made:
  1. **senders table**: Added created_at, updated_at, profile_id, display_name, resend_domain_id, resend_status, emails_sent_today, current_day, last_sent_at, warm_up_stage
  2. **groups table**: Added profile_id, updated_at columns
  3. **contacts table**: Added first_name, last_name, phone, is_active, updated_at, profile_id columns
  4. **Security**: Added RLS policies for profile_id relationships
  5. **Triggers**: Added update triggers for updated_at columns
*/

-- Add missing columns to senders table
ALTER TABLE senders ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE senders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE senders ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS display_name text DEFAULT '';
ALTER TABLE senders ADD COLUMN IF NOT EXISTS resend_domain_id text;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS resend_status text DEFAULT 'pending';
ALTER TABLE senders ADD COLUMN IF NOT EXISTS emails_sent_today integer DEFAULT 0;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS current_day integer DEFAULT 1;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS warm_up_stage integer DEFAULT 1;

-- Add missing columns to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add missing columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name text DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name text DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

-- Add update triggers for updated_at columns
DROP TRIGGER IF EXISTS update_senders_updated_at ON senders;
CREATE TRIGGER update_senders_updated_at 
    BEFORE UPDATE ON senders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_senders_profile_id ON senders(profile_id);
CREATE INDEX IF NOT EXISTS idx_senders_created_at ON senders(created_at);
CREATE INDEX IF NOT EXISTS idx_groups_profile_id ON groups(profile_id);
CREATE INDEX IF NOT EXISTS idx_contacts_profile_id ON contacts(profile_id);

-- Update RLS policies for profile_id relationships
DROP POLICY IF EXISTS "Users can manage own senders" ON senders;
CREATE POLICY "Users can manage own senders" ON senders
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own groups" ON groups;
CREATE POLICY "Users can manage own groups" ON groups
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());