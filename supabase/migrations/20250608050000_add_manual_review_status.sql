-- Add manual review status and message type
-- This migration adds support for manual review when AI can't determine creditor intent

-- Update debts table status constraint to include requires_manual_review
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
  'requires_manual_review',
  'accepted', 
  'rejected',
  'settled', 
  'failed', 
  'opted_out'
));

-- Update conversation_messages table message_type constraint to include manual_response
ALTER TABLE conversation_messages 
DROP CONSTRAINT IF EXISTS conversation_messages_message_type_check;

ALTER TABLE conversation_messages 
ADD CONSTRAINT conversation_messages_message_type_check 
CHECK (message_type IN (
  'initial_debt', 
  'negotiation_sent', 
  'response_received', 
  'counter_offer', 
  'acceptance', 
  'rejection',
  'manual_response'
));

-- Add comments for documentation
COMMENT ON CONSTRAINT debts_status_check ON debts IS 'Valid debt statuses including manual review for unclear AI responses';
COMMENT ON CONSTRAINT conversation_messages_message_type_check ON conversation_messages IS 'Valid message types including manual responses from users';

-- Add index for manual review status for performance
CREATE INDEX IF NOT EXISTS idx_debts_manual_review ON debts(status) WHERE status = 'requires_manual_review';

-- Update RLS policies to handle manual responses (already covered by existing policies)
-- No additional RLS changes needed as existing policies cover manual_response message type
