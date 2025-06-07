-- Add 'approved' status to debts table
ALTER TABLE debts 
DROP CONSTRAINT IF EXISTS debts_status_check;

ALTER TABLE debts 
ADD CONSTRAINT debts_status_check 
CHECK (status IN ('received', 'negotiating', 'approved', 'sent', 'settled', 'failed', 'opted_out'));
