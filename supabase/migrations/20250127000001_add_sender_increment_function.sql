/*
  # Add RPC function for atomic sender stats updates
  
  This function allows atomic increments of email counts for senders
  to avoid race conditions when processing batches.
*/

-- Create function to atomically increment sender email counts
CREATE OR REPLACE FUNCTION increment_emails_sent(
  sender_id uuid,
  increment_amount integer,
  last_sent_time timestamptz
)
RETURNS TABLE(
  new_emails_sent_today integer,
  new_current_day integer
) AS $$
BEGIN
  UPDATE senders 
  SET 
    emails_sent_today = emails_sent_today + increment_amount,
    last_sent_at = last_sent_time,
    updated_at = last_sent_time
  WHERE id = sender_id;
  
  RETURN QUERY
  SELECT 
    s.emails_sent_today,
    s.current_day
  FROM senders s
  WHERE s.id = sender_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_emails_sent(uuid, integer, timestamptz) TO service_role;