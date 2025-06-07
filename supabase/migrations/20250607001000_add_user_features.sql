/*
  # User Features Migration

  1. New Tables
    - `user_profiles` - Track user onboarding and additional info
    - `additional_emails` - Store additional email addresses per user
    - `email_processing_usage` - Track email processing usage

  2. Security
    - Enable RLS on all new tables
    - Add policies for user-specific data access

  3. Performance
    - Add indexes for optimal querying
*/

-- Create user_profiles table for tracking onboarding and user preferences
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  onboarding_completed boolean DEFAULT false,
  first_login_at timestamptz,
  email_processing_limit integer DEFAULT 1000, -- monthly limit
  UNIQUE(user_id)
);

-- Create additional_emails table
CREATE TABLE IF NOT EXISTS additional_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_address text NOT NULL,
  verified boolean DEFAULT false,
  verification_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email_address),
  CHECK (email_address ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create email_processing_usage table to track usage
CREATE TABLE IF NOT EXISTS email_processing_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_year text NOT NULL, -- format: YYYY-MM
  emails_processed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_usage ENABLE ROW LEVEL SECURITY;

-- Add user_id column to debts table for proper user association
ALTER TABLE debts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update debts policies to be user-specific
DROP POLICY IF EXISTS "Allow all operations on debts" ON debts;
CREATE POLICY "Users can manage their own debts"
  ON debts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for additional_emails
CREATE POLICY "Users can manage their own additional emails"
  ON additional_emails
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for email_processing_usage
CREATE POLICY "Users can view their own usage"
  ON email_processing_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage usage records"
  ON email_processing_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_additional_emails_user_id ON additional_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_additional_emails_email ON additional_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_email_processing_usage_user_id ON email_processing_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_usage_month ON email_processing_usage(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_additional_emails_updated_at ON additional_emails;
CREATE TRIGGER update_additional_emails_updated_at
  BEFORE UPDATE ON additional_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_processing_usage_updated_at ON email_processing_usage;
CREATE TRIGGER update_email_processing_usage_updated_at
  BEFORE UPDATE ON email_processing_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user_add_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, first_login_at)
  VALUES (NEW.id, now());
  RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- Trigger to create user profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_add_user_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_add_user_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_add_user_profiles();

-- Function to increment email processing usage
CREATE OR REPLACE FUNCTION increment_email_usage(target_user_id uuid)
RETURNS void AS $$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO public.email_processing_usage (user_id, month_year, emails_processed)
  VALUES (target_user_id, current_month, 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET 
    emails_processed = email_processing_usage.emails_processed + 1,
    updated_at = now();
END;
$$ language 'plpgsql';

-- Enable real-time for new tables
ALTER publication supabase_realtime ADD TABLE user_profiles;
ALTER publication supabase_realtime ADD TABLE additional_emails;
ALTER publication supabase_realtime ADD TABLE email_processing_usage;
