import { Client, Account, Databases, Functions } from "appwrite";

const appwriteEndpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const appwriteProjectId = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;

if (!appwriteEndpoint || !appwriteProjectId) {
  throw new Error("Missing Appwrite environment variables");
}

export const client = new Client()
  .setEndpoint(appwriteEndpoint)
  .setProject(appwriteProjectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client);

// Database and collection IDs (to be configured in Appwrite)
export const DATABASE_ID = import.meta.env.PUBLIC_APPWRITE_DATABASE_ID || "inbox-negotiator-db";
export const COLLECTIONS = {
  DEBTS: "debts",
  AUDIT_LOGS: "audit_logs", 
  USER_PROFILES: "user_profiles",
  ADDITIONAL_EMAILS: "additional_emails",
  EMAIL_PROCESSING_USAGE: "email_processing_usage",
  DEBT_VARIABLES: "debt_variables",
  CONVERSATION_MESSAGES: "conversation_messages"
};

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
    | "awaiting_response"
    | "counter_negotiating"
    | "requires_manual_review"
    | "accepted"
    | "rejected"
    | "settled"
    | "failed"
    | "opted_out";
  negotiated_plan: string | null;
  projected_savings: number;
  user_id: string;
  description?: string | null;
  due_date?: string | null;
  conversation_count?: number;
  last_message_at?: string;
  negotiation_round?: number;
  prospected_savings?: number;
  actual_savings?: number;
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

export type ConversationMessage = {
  id: string;
  debt_id: string;
  message_type:
    | "initial_debt"
    | "negotiation_sent"
    | "response_received"
    | "counter_offer"
    | "acceptance"
    | "rejection"
    | "manual_response";
  direction: "inbound" | "outbound";
  subject?: string;
  body: string;
  from_email?: string;
  to_email?: string;
  message_id?: string;
  ai_analysis?: Record<string, any>;
  created_at: string;
  updated_at: string;
};