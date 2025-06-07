import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Debt = {
  id: string;
  created_at: string;
  updated_at: string;
  vendor: string;
  amount: number;
  raw_email: string | null;
  status: 'received' | 'negotiating' | 'settled' | 'failed' | 'opted_out';
  negotiated_plan: string | null;
  projected_savings: number;
};

export type AuditLog = {
  id: string;
  created_at: string;
  debt_id: string;
  action: string;
  details: Record<string, any>;
};