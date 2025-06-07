import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  email: string;
  created_at: string;
};

export type Debt = {
  id: string;
  created_at: string;
  updated_at: string;
  vendor: string;
  amount: number;
  raw_email: string | null;
  status:
    | "received"
    | "negotiating"
    | "approved"
    | "sent"
    | "settled"
    | "failed"
    | "opted_out";
  negotiated_plan: string | null;
  projected_savings: number;
  user_id: string;
  description?: string | null;
  due_date?: string | null;
  metadata?: Record<string, any> | null;
};

export type AuditLog = {
  id: string;
  created_at: string;
  debt_id: string;
  action: string;
  details: Record<string, any>;
};

export type UserProfile = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  first_login_at: string | null;
  email_processing_limit: number;
  postmark_server_token: string | null;
};

export type AdditionalEmail = {
  id: string;
  user_id: string;
  email_address: string;
  verified: boolean;
  verification_token: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailProcessingUsage = {
  id: string;
  user_id: string;
  month_year: string;
  emails_processed: number;
  created_at: string;
  updated_at: string;
};

export type DebtVariable = {
  id: string;
  debt_id: string;
  variable_name: string;
  variable_value: string | null;
  created_at: string;
  updated_at: string;
};
