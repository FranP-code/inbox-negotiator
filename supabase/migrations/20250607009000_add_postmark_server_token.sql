/*
  # Add Postmark Server Token

  1. Changes
    - Add postmark_server_token column to user_profiles table
    - This will be used for sending approved emails
*/

-- Add postmark_server_token to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS postmark_server_token text;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.postmark_server_token IS 'Postmark server token for sending approved negotiation emails';
