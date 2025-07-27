/*
  # Add description column to groups table

  1. Changes
     - Add `description` column to `groups` table
     - Column is nullable to allow groups without descriptions
     - Uses TEXT type for unlimited text length

  2. Purpose
     - Fix frontend error where GroupsPage tries to insert/update description field
     - Maintain compatibility with existing groups (description can be null)
*/

-- Add description column to groups table
ALTER TABLE groups ADD COLUMN description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN groups.description IS 'Optional description for the group';