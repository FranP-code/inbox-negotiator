/*
  # Debt Approval Edge Function

  This function handles debt approval without sending emails:
  - Updates debt status to "approved"
  - Logs the approval action
  - Saves finalized negotiation data
  - Updates metadata with approval timestamp
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApproveDebtRequest {
  debtId: string;
  approvalNote?: string;
}

interface DebtRecord {
  id: string;
  vendor: string;
  amount: number;
  raw_email: string;
  negotiated_plan?: string;
  status: string;
  metadata?: {
    aiEmail?: {
      subject: string;
      body: string;
      strategy: string;
    };
    fromEmail?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client with auth context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { debtId, approvalNote }: ApproveDebtRequest = await req.json();

    if (!debtId) {
      return new Response(
        JSON.stringify({ error: "Missing debtId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch debt record - RLS will ensure user can only access their own debts
    const { data: debtRecord, error: debtError } = await supabaseClient
      .from("debts")
      .select("*")
      .eq("id", debtId)
      .eq("user_id", user.id)
      .single();

    if (debtError || !debtRecord) {
      return new Response(
        JSON.stringify({ error: "Debt not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const debt = debtRecord as DebtRecord;

    // Validate that the debt is in negotiating status
    if (debt.status !== "negotiating") {
      return new Response(
        JSON.stringify({
          error: "Debt is not in negotiating status",
          currentStatus: debt.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate that AI email exists
    if (!debt.metadata?.aiEmail) {
      return new Response(
        JSON.stringify({ error: "No AI-generated email found for this debt" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const currentTimestamp = new Date().toISOString();

    // Update debt status to approved - using authenticated client
    const { error: updateError } = await supabaseClient
      .from("debts")
      .update({
        status: "approved",
        metadata: {
          ...debt.metadata,
          approved: {
            approvedAt: currentTimestamp,
            approvalNote: approvalNote || "Approved without sending email",
            strategy: debt.metadata.aiEmail.strategy,
            finalizedSubject: debt.metadata.aiEmail.subject,
            finalizedBody: debt.metadata.aiEmail.body,
          },
        },
      })
      .eq("id", debtId);

    if (updateError) {
      console.error("Error updating debt status:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to update debt status",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Log the approval action - using authenticated client
    const { error: auditError } = await supabaseClient
      .from("audit_logs")
      .insert({
        debt_id: debtId,
        action: "debt_approved",
        details: {
          approvedAt: currentTimestamp,
          approvalNote: approvalNote || "Approved without sending email",
          strategy: debt.metadata.aiEmail.strategy,
          subject: debt.metadata.aiEmail.subject,
          vendor: debt.vendor,
          amount: debt.amount,
        },
      });

    if (auditError) {
      console.warn("Failed to log approval action:", auditError);
      // Don't fail the entire operation for audit log issues
    }

    return new Response(
      JSON.stringify({
        success: true,
        debtId: debtId,
        status: "approved",
        approvedAt: currentTimestamp,
        vendor: debt.vendor,
        amount: debt.amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in approve-debt function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
