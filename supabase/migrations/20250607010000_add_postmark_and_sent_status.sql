-- Add postmark_server_token to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS postmark_server_token TEXT;

-- Update debts table status constraint to include 'sent'
ALTER TABLE debts 
DROP CONSTRAINT IF EXISTS debts_status_check;

ALTER TABLE debts 
ADD CONSTRAINT debts_status_check 
CHECK (status IN ('received', 'negotiating', 'sent', 'settled', 'failed', 'opted_out'));

-- Create index on postmark_server_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_postmark_token 
ON user_profiles(user_id) WHERE postmark_server_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.postmark_server_token IS 'Postmark server token for sending negotiation emails';
