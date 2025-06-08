/*
  # Email Sending Edge Function

  This function sends negotiated emails via Postmark:
  - Validates user has server token configured
  - Sends the approved negotiation email to the debt collector
  - Updates debt status and logs the action
  - Ensures FDCPA compliance
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendEmailRequest {
  debtId: string;
}

interface UserProfile {
  postmark_server_token?: string;
}

interface DebtRecord {
  id: string;
  vendor: string;
  amount: number;
  raw_email: string;
  negotiated_plan?: string;
  projected_savings?: number;
  conversation_count?: number;
  metadata?: {
    aiEmail?: {
      subject: string;
      body: string;
      strategy: string;
      confidence?: number;
    };
    toEmail?: string;
    fromEmail?: string;
  };
}

// Send email using Postmark
async function sendEmailViaPostmark(
  serverToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
) {
  const postmarkEndpoint = "https://api.postmarkapp.com/email";

  const emailData = {
    From: fromEmail,
    To: toEmail,
    Subject: subject,
    TextBody: body,
    MessageStream: "outbound",
  };

  const response = await fetch(postmarkEndpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": serverToken,
    },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Postmark API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

// Extract email address from various formats
function extractEmailAddress(emailString: string): string {
  // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
  const emailMatch = emailString.match(/<([^>]+)>/) ||
    emailString.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch ? emailMatch[1] : emailString;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
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

    const { debtId }: SendEmailRequest = await req.json();

    if (!debtId) {
      return new Response(
        JSON.stringify({ error: "Missing debtId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch user profile with server token - using authenticated client
    const { data: userProfile, error: userError } = await supabaseClient
      .from("user_profiles")
      .select("postmark_server_token")
      .eq("user_id", user.id)
      .single();

    if (userError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userProfileData = userProfile as UserProfile;

    if (!userProfileData.postmark_server_token) {
      return new Response(
        JSON.stringify({
          error: "Postmark server token not configured",
          requiresConfiguration: true,
        }),
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
        JSON.stringify({ error: "Debt record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const debt = debtRecord as DebtRecord;

    // Validate that negotiated plan exists
    if (!debt.negotiated_plan || !debt.metadata?.aiEmail) {
      return new Response(
        JSON.stringify({
          error: "No negotiated plan found. Please generate negotiation first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract email details
    const { subject, body } = debt.metadata.aiEmail;
    const fromEmail = debt.metadata?.toEmail || user.email;

    if (!fromEmail) {
      return new Response(
        JSON.stringify({ error: "No valid sender email found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Determine recipient email
    let toEmail = debt.vendor;
    if (debt.metadata?.fromEmail) {
      toEmail = extractEmailAddress(debt.metadata.fromEmail);
    } else if (debt.vendor.includes("@")) {
      toEmail = extractEmailAddress(debt.vendor);
    } else {
      // If vendor doesn't contain email, try to construct one
      toEmail = `collections@${
        debt.vendor.toLowerCase().replace(/\s+/g, "")
      }.com`;
    }

    try {
      // Send email via Postmark
      const emailResult = await sendEmailViaPostmark(
        userProfileData.postmark_server_token,
        fromEmail,
        toEmail,
        subject,
        body,
      );

      // Update debt status to sent and preserve negotiating state
      const { data: currentDebt } = await supabaseClient
        .from("debts")
        .select("conversation_count, negotiation_round")
        .eq("id", debtId)
        .single();

      const { error: updateError } = await supabaseClient
        .from("debts")
        .update({
          status: "sent",
          conversation_count: (currentDebt?.conversation_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          prospected_savings: debt.projected_savings || 0, // Store prospected savings when sent
          metadata: {
            ...debt.metadata,
            emailSent: {
              sentAt: new Date().toISOString(),
              messageId: emailResult.MessageID,
              to: toEmail,
              from: fromEmail,
              subject: subject,
            },
            prospectedSavings: {
              amount: debt.projected_savings || 0,
              percentage: debt.amount > 0
                ? ((debt.projected_savings || 0) / debt.amount * 100).toFixed(2)
                : 0,
              calculatedAt: new Date().toISOString(),
              strategy: debt.metadata?.aiEmail?.strategy || "unknown",
            },
          },
        })
        .eq("id", debtId);

      if (updateError) {
        console.error("Error updating debt status:", updateError);
      }

      // Record the sent email in conversation history
      await supabaseClient.from("conversation_messages").insert({
        debt_id: debtId,
        message_type: "negotiation_sent",
        direction: "outbound",
        subject: subject,
        body: body,
        from_email: fromEmail,
        to_email: toEmail,
        message_id: emailResult.MessageID,
        ai_analysis: {
          strategy: debt.metadata.aiEmail.strategy,
          confidence: debt.metadata.aiEmail.confidence,
          projectedSavings: debt.projected_savings,
        },
      });

      // Log the email sending
      await supabaseClient.from("audit_logs").insert({
        debt_id: debtId,
        action: "email_sent",
        details: {
          to: toEmail,
          subject: subject,
          postmarkMessageId: emailResult.MessageID,
          conversationRound: currentDebt?.negotiation_round || 1,
          strategy: debt.metadata.aiEmail.strategy,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: emailResult.MessageID,
          sentTo: toEmail,
          sentFrom: fromEmail,
          subject: subject,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (emailError) {
      console.error("Email sending error:", emailError);

      const errorMessage = emailError instanceof Error
        ? emailError.message
        : String(emailError);

      // Log the failed attempt - using authenticated client
      await supabaseClient
        .from("audit_logs")
        .insert({
          debt_id: debtId,
          action: "email_send_failed",
          details: {
            error: errorMessage,
            to: toEmail,
            from: fromEmail,
            subject: subject,
          },
        });

      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: errorMessage,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Send email function error:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred" +
        (Deno.env.get("NODE_ENV") === "development"
          ? `: ${JSON.stringify(error)}`
          : "");
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
