/*
  # Add missing generated columns

  1. Generated Columns
    - Add `is_active` to `senders` table (generated from status = 'active')
    - Add `name` to `groups` table (generated from nome)
  
  2. Indexes
    - Add indexes for the new generated columns for better query performance
*/

-- Add is_active generated column to senders table
ALTER TABLE senders ADD COLUMN is_active boolean GENERATED ALWAYS AS (status = 'active') STORED;

-- Add name generated column to groups table  
ALTER TABLE groups ADD COLUMN name text GENERATED ALWAYS AS (nome) STORED;

-- Add indexes for better query performance
CREATE INDEX idx_senders_is_active ON senders(is_active);
CREATE INDEX idx_groups_name ON groups(name);