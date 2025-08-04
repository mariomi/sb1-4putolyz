-- Comprehensive database fix migration - SAFE VERSION
-- This migration addresses all known database issues and ensures consistency
-- Handles views and avoids column rename conflicts

-- 1. Fix campaigns table structure
DO $$
BEGIN
  -- Ensure campaigns table has all required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'name'
  ) THEN
    -- If we have 'nome' column, rename it to 'name'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'nome'
    ) THEN
      ALTER TABLE campaigns RENAME COLUMN nome TO name;
    ELSE
      ALTER TABLE campaigns ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;

  -- Ensure 'subject' column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'subject'
  ) THEN
    -- If we have 'oggetto' column, rename it to 'subject'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'oggetto'
    ) THEN
      ALTER TABLE campaigns RENAME COLUMN oggetto TO subject;
    ELSE
      ALTER TABLE campaigns ADD COLUMN subject TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;

  -- Ensure 'html_content' column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'html_content'
  ) THEN
    -- If we have 'contenuto_html' column, rename it to 'html_content'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'contenuto_html'
    ) THEN
      ALTER TABLE campaigns RENAME COLUMN contenuto_html TO html_content;
    ELSE
      ALTER TABLE campaigns ADD COLUMN html_content TEXT;
    END IF;
  END IF;

  -- Ensure 'status' column exists with correct values
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'status'
  ) THEN
    -- If we have 'stato' column, rename it to 'status'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'stato'
    ) THEN
      ALTER TABLE campaigns RENAME COLUMN stato TO status;
    ELSE
      ALTER TABLE campaigns ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
  END IF;

  -- Update status values to be consistent
  UPDATE campaigns SET status = 'draft' WHERE status = 'bozza';
  UPDATE campaigns SET status = 'sending' WHERE status = 'in_progress';
  UPDATE campaigns SET status = 'completed' WHERE status = 'completata';

  -- Add missing columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN start_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN end_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'selected_groups'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN selected_groups JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'start_time_of_day'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN start_time_of_day TIME DEFAULT '09:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'warm_up_days'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN warm_up_days INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'emails_per_batch'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN emails_per_batch INTEGER DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'batch_interval_minutes'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN batch_interval_minutes INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'send_duration_hours'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN send_duration_hours INTEGER DEFAULT 24;
  END IF;
END $$;

-- 2. Fix groups table structure
DO $$
BEGIN
  -- Ensure groups table has 'name' column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'name'
  ) THEN
    -- If we have 'nome' column, rename it to 'name'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'groups' AND column_name = 'nome'
    ) THEN
      ALTER TABLE groups RENAME COLUMN nome TO name;
    ELSE
      ALTER TABLE groups ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;

  -- Add missing columns to groups
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'description'
  ) THEN
    ALTER TABLE groups ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'contact_count'
  ) THEN
    ALTER TABLE groups ADD COLUMN contact_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE groups ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE groups ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE groups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3. Fix contacts table structure
DO $$
BEGIN
  -- Add missing columns to contacts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE contacts ADD COLUMN first_name TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE contacts ADD COLUMN last_name TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'phone'
  ) THEN
    ALTER TABLE contacts ADD COLUMN phone TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE contacts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN import_batch_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN imported_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'source'
  ) THEN
    ALTER TABLE contacts ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

-- 4. Fix senders table structure
DO $$
BEGIN
  -- Add missing columns to senders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE senders ADD COLUMN display_name TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE senders ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'emails_sent_today'
  ) THEN
    ALTER TABLE senders ADD COLUMN emails_sent_today INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'current_day'
  ) THEN
    ALTER TABLE senders ADD COLUMN current_day INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE senders ADD COLUMN last_sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE senders ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'resend_domain_id'
  ) THEN
    ALTER TABLE senders ADD COLUMN resend_domain_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'resend_status'
  ) THEN
    ALTER TABLE senders ADD COLUMN resend_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'warm_up_stage'
  ) THEN
    ALTER TABLE senders ADD COLUMN warm_up_stage INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'domain_id'
  ) THEN
    ALTER TABLE senders ADD COLUMN domain_id UUID REFERENCES domains(id);
  END IF;
END $$;

-- 5. Fix campaign_queues table structure
DO $$
BEGIN
  -- Ensure correct column names
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'scheduled_for'
  ) THEN
    -- If we have 'scheduled_time' column, rename it to 'scheduled_for'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaign_queues' AND column_name = 'scheduled_time'
    ) THEN
      ALTER TABLE campaign_queues RENAME COLUMN scheduled_time TO scheduled_for;
    ELSE
      ALTER TABLE campaign_queues ADD COLUMN scheduled_for TIMESTAMPTZ;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'sent_at'
  ) THEN
    -- If we have 'sent_time' column, rename it to 'sent_at'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'campaign_queues' AND column_name = 'sent_time'
    ) THEN
      ALTER TABLE campaign_queues RENAME COLUMN sent_time TO sent_at;
    ELSE
      ALTER TABLE campaign_queues ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;
  END IF;

  -- Add missing columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN resend_email_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN error_message TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_queues' AND column_name = 'priority'
  ) THEN
    ALTER TABLE campaign_queues ADD COLUMN priority INTEGER DEFAULT 1;
  END IF;
END $$;

-- 6. Ensure campaign_groups table exists and has all required columns
CREATE TABLE IF NOT EXISTS campaign_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    percentage_start INTEGER DEFAULT 0,
    percentage_end INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, group_id)
);

-- 7. Ensure contact_groups table exists
CREATE TABLE IF NOT EXISTS contact_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_id, group_id)
);

-- 8. Ensure campaign_senders table exists
CREATE TABLE IF NOT EXISTS campaign_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES senders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, sender_id)
);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id ON campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_groups_profile_id ON groups(profile_id);
CREATE INDEX IF NOT EXISTS idx_contacts_profile_id ON contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active ON contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_senders_profile_id ON senders(profile_id);
CREATE INDEX IF NOT EXISTS idx_senders_is_active ON senders(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_queues_campaign_id ON campaign_queues(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_queues_status ON campaign_queues(status);
CREATE INDEX IF NOT EXISTS idx_campaign_queues_scheduled_for ON campaign_queues(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_contact_groups_contact_id ON contact_groups(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_group_id ON contact_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_campaign_id ON campaign_senders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_sender_id ON campaign_senders(sender_id);

-- 10. Enable Row Level Security on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_groups ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for all tables
-- Campaigns policies
DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns;
CREATE POLICY "Users can manage own campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Groups policies
DROP POLICY IF EXISTS "Users can manage own groups" ON groups;
CREATE POLICY "Users can manage own groups"
  ON groups FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Contacts policies
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Senders policies
DROP POLICY IF EXISTS "Users can manage own senders" ON senders;
CREATE POLICY "Users can manage own senders"
  ON senders FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Campaign queues policies
DROP POLICY IF EXISTS "Users can manage own campaign queues" ON campaign_queues;
CREATE POLICY "Users can manage own campaign queues"
  ON campaign_queues FOR ALL
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  );

-- Contact groups policies
DROP POLICY IF EXISTS "Users can manage own contact groups" ON contact_groups;
CREATE POLICY "Users can manage own contact groups"
  ON contact_groups FOR ALL
  TO authenticated
  USING (
    group_id IN (
      SELECT id FROM groups WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM groups WHERE profile_id = auth.uid()
    )
  );

-- Campaign senders policies
DROP POLICY IF EXISTS "Users can manage own campaign senders" ON campaign_senders;
CREATE POLICY "Users can manage own campaign senders"
  ON campaign_senders FOR ALL
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  );

-- Campaign groups policies
DROP POLICY IF EXISTS "Users can manage own campaign groups" ON campaign_groups;
CREATE POLICY "Users can manage own campaign groups"
  ON campaign_groups FOR ALL
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE profile_id = auth.uid()
    )
  );

-- 12. Create or update the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 13. Create triggers for updated_at columns
DO $$
BEGIN
  -- Campaigns trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at'
  ) THEN
    CREATE TRIGGER update_campaigns_updated_at
      BEFORE UPDATE ON campaigns
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Groups trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_groups_updated_at
      BEFORE UPDATE ON groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Contacts trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_contacts_updated_at
      BEFORE UPDATE ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Senders trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_senders_updated_at'
  ) THEN
    CREATE TRIGGER update_senders_updated_at
      BEFORE UPDATE ON senders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Campaign queues trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_queues_updated_at'
  ) THEN
    CREATE TRIGGER update_campaign_queues_updated_at
      BEFORE UPDATE ON campaign_queues
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Campaign groups trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_campaign_groups_updated_at
      BEFORE UPDATE ON campaign_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 14. Update contact counts in groups
UPDATE groups 
SET contact_count = (
  SELECT COUNT(*) 
  FROM contact_groups 
  WHERE contact_groups.group_id = groups.id
);

-- 15. Create a view for groups with contact count (SAFE VERSION - FIXED)
-- Drop the view if it exists to avoid conflicts
DROP VIEW IF EXISTS groups_with_contact_count;

CREATE VIEW groups_with_contact_count AS
SELECT 
  g.id,
  g.name,
  g.description,
  g.profile_id,
  g.created_at,
  g.updated_at,
  g.contact_count,
  COUNT(cg.contact_id) as active_contact_count
FROM groups g
LEFT JOIN contact_groups cg ON g.id = cg.group_id
LEFT JOIN contacts c ON cg.contact_id = c.id AND c.is_active = true
GROUP BY g.id, g.name, g.description, g.profile_id, g.created_at, g.updated_at, g.contact_count;

-- 16. Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 