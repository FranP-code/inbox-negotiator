-- Create debt_variables table to store variable values for each debt
CREATE TABLE IF NOT EXISTS debt_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  variable_name text NOT NULL,
  variable_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(debt_id, variable_name)
);

-- Enable RLS
ALTER TABLE debt_variables ENABLE ROW LEVEL SECURITY;

-- Create policies for debt_variables
CREATE POLICY "Users can manage their debt variables"
  ON debt_variables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM debts 
      WHERE debts.id = debt_variables.debt_id 
      AND debts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debts 
      WHERE debts.id = debt_variables.debt_id 
      AND debts.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_debt_variables_debt_id ON debt_variables(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_variables_name ON debt_variables(variable_name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_debt_variables_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_debt_variables_updated_at ON debt_variables;
CREATE TRIGGER update_debt_variables_updated_at
  BEFORE UPDATE ON debt_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_debt_variables_updated_at_column();
