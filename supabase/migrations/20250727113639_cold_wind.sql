/*
  # New Email Campaign System Schema

  Creates the complete database structure for the new email campaign system:

  1. New Tables
    - `campaigns` - Main campaign table with status tracking
    - `groups` - Contact groups for targeting
    - `contacts` - Individual contacts linked to groups
    - `senders` - Email senders/domains with daily limits
    - `campaign_senders` - Many-to-many relationship campaigns-senders
    - `campaign_queues` - Email sending queue with scheduling
    - `logs` - Detailed logging for all email activities

  2. Security
    - Row Level Security enabled on all tables
    - Appropriate constraints and foreign keys
    - Status checks for data integrity
*/

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS campaign_queues CASCADE;
DROP TABLE IF EXISTS campaign_senders CASCADE;
DROP TABLE IF EXISTS senders CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- Create campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    oggetto TEXT NOT NULL,
    contenuto_html TEXT,
    stato TEXT CHECK (stato IN ('bozza','in_progress','completed')) DEFAULT 'bozza',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL
);

-- Create contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    email TEXT NOT NULL
);

-- Create senders table
CREATE TABLE senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    email_from TEXT NOT NULL,
    daily_limit INTEGER DEFAULT 500,
    status TEXT CHECK (status IN ('active','inactive')) DEFAULT 'active'
);

-- Create campaign_senders junction table
CREATE TABLE campaign_senders (
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES senders(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, sender_id)
);

-- Create campaign_queues table
CREATE TABLE campaign_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES senders(id),
    status TEXT CHECK (status IN ('pending','sending','sent','failed')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    scheduled_time TIMESTAMPTZ,
    sent_time TIMESTAMPTZ
);

-- Create logs table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    email TEXT,
    sender_email TEXT,
    status TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_contacts_group_id ON contacts(group_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_campaign_queues_campaign_id ON campaign_queues(campaign_id);
CREATE INDEX idx_campaign_queues_status ON campaign_queues(status);
CREATE INDEX idx_campaign_queues_scheduled_time ON campaign_queues(scheduled_time);
CREATE INDEX idx_logs_campaign_id ON logs(campaign_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);

-- Enable Row Level Security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for authenticated users for now)
-- You may want to restrict these further based on user ownership

CREATE POLICY "Allow all for authenticated users" ON campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON groups
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON contacts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON senders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON campaign_senders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON campaign_queues
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);