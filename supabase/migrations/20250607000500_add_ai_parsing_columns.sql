-- Add new columns for AI-enhanced debt parsing
-- Migration for improved debt information storage

-- Add new columns to debts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_metadata ON debts USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN debts.description IS 'AI-extracted description of what the debt is for';
COMMENT ON COLUMN debts.due_date IS 'Due date extracted from the email, if mentioned';
COMMENT ON COLUMN debts.metadata IS 'Additional metadata including isDebtCollection flag and other AI-extracted information';
