/*
  # InboxNegotiator Database Schema

  1. New Tables
    - `debts`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `vendor` (text) - creditor email address
      - `amount` (numeric) - debt amount
      - `raw_email` (text) - full email content
      - `status` (text) - current negotiation status
      - `negotiated_plan` (text) - AI-generated response
      - `projected_savings` (numeric) - estimated savings
      - `updated_at` (timestamp)
    - `audit_logs`
      - `id` (uuid, primary key)
      - `debt_id` (uuid, foreign key)
      - `action` (text) - action performed
      - `details` (jsonb) - additional details
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to access their data
    - Create indexes for performance

  3. Real-time
    - Enable real-time for debts table
*/

-- Create debts table
CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  vendor text NOT NULL,
  amount numeric DEFAULT 0,
  raw_email text,
  status text DEFAULT 'received' CHECK (status IN ('received', 'negotiating', 'settled', 'failed', 'opted_out')),
  negotiated_plan text,
  projected_savings numeric DEFAULT 0
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  debt_id uuid REFERENCES debts(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (for demo purposes, allowing all authenticated users)
CREATE POLICY "Allow all operations on debts"
  ON debts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on audit_logs"
  ON audit_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_created_at ON debts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_debt_id ON audit_logs(debt_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON debts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable real-time for debts table
ALTER publication supabase_realtime ADD TABLE debts;