-- Create user access logs table to track user login/logout and online duration
CREATE TABLE IF NOT EXISTS user_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_time TIMESTAMPTZ,
  online_duration_minutes INTEGER,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON user_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_login_time ON user_access_logs(login_time);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_profile_id ON user_access_logs(profile_id);

-- Create function to update online duration when logout_time is set
CREATE OR REPLACE FUNCTION update_online_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
    NEW.online_duration_minutes = EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time)) / 60;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update online duration
CREATE TRIGGER trigger_update_online_duration
  BEFORE UPDATE ON user_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_online_duration();

-- Enable RLS
ALTER TABLE user_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own access logs" ON user_access_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all access logs" ON user_access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own access logs" ON user_access_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own access logs" ON user_access_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_access_logs TO authenticated;
GRANT ALL ON user_access_logs TO service_role;




