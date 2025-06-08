-- Enhanced conversation tracking and negotiation flow
-- This migration adds comprehensive conversation tracking and improved status management

-- Create conversation_messages table to track all email exchanges
CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('initial_debt', 'negotiation_sent', 'response_received', 'counter_offer', 'acceptance', 'rejection')),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject text,
  body text NOT NULL,
  from_email text,
  to_email text,
  message_id text, -- Postmark message ID for outbound, email ID for inbound
  ai_analysis jsonb DEFAULT '{}'::jsonb, -- AI analysis of the message content
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_debt_id ON conversation_messages(debt_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_type ON conversation_messages(message_type);

-- Update debts table status constraint to include new statuses
ALTER TABLE debts 
DROP CONSTRAINT IF EXISTS debts_status_check;

ALTER TABLE debts 
ADD CONSTRAINT debts_status_check 
CHECK (status IN (
  'received', 
  'negotiating', 
  'approved', 
  'sent', 
  'awaiting_response',
  'counter_negotiating', 
  'accepted', 
  'rejected',
  'settled', 
  'failed', 
  'opted_out'
));

-- Add conversation tracking fields to debts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS conversation_count integer DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();
ALTER TABLE debts ADD COLUMN IF NOT EXISTS negotiation_round integer DEFAULT 1;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS prospected_savings numeric DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS actual_savings numeric DEFAULT 0;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_debts_last_message_at ON debts(last_message_at);
CREATE INDEX IF NOT EXISTS idx_debts_negotiation_round ON debts(negotiation_round);

-- Enable RLS on conversation_messages
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for conversation_messages (users can only see their own debt conversations)
CREATE POLICY "Users can view their own conversation messages" ON conversation_messages
  FOR SELECT USING (
    debt_id IN (
      SELECT id FROM debts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own conversation messages" ON conversation_messages
  FOR INSERT WITH CHECK (
    debt_id IN (
      SELECT id FROM debts WHERE user_id = auth.uid()
    )
  );

-- Enable real-time for conversation_messages
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- Add comments for documentation
COMMENT ON TABLE conversation_messages IS 'Tracks all email exchanges in debt negotiations';
COMMENT ON COLUMN conversation_messages.message_type IS 'Type of message in the negotiation flow';
COMMENT ON COLUMN conversation_messages.direction IS 'Whether message was sent (outbound) or received (inbound)';
COMMENT ON COLUMN conversation_messages.ai_analysis IS 'AI analysis results including intent, sentiment, and extracted terms';
COMMENT ON COLUMN debts.conversation_count IS 'Total number of messages in this debt conversation';
COMMENT ON COLUMN debts.last_message_at IS 'Timestamp of the most recent message in conversation';
COMMENT ON COLUMN debts.negotiation_round IS 'Current round of negotiation (increments with each back-and-forth)';
