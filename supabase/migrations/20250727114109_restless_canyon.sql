/*
  # Add missing columns and relationships

  1. Add missing created_at columns
    - Add created_at to contacts table
    - Add created_at to groups table

  2. Create contact_groups junction table
    - Many-to-many relationship between contacts and groups
    - Enable proper group/contact counting queries

  3. Security
    - Enable RLS on contact_groups table
    - Add policy for authenticated users
*/

-- Add missing created_at columns
ALTER TABLE contacts ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE groups ADD COLUMN created_at timestamptz DEFAULT now();

-- Create contact_groups junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_groups_contact_id ON contact_groups(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_group_id ON contact_groups(group_id);

-- Enable RLS on contact_groups
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for contact_groups
CREATE POLICY "Allow all for authenticated users" ON contact_groups
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);