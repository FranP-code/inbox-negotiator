/*
  # Debt Negotiation AI Edge Function

  This function generates FDCPA-compliant negotiation responses using AI analysis:
  - Analyzes debt details and vendor information
  - Generates personalized negotiation strategies
  - Creates contextually appropriate response letters
  - Ensures FDCPA compliance
*/

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateObject } from "npm:ai@4.3.16";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@1.2.19";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Schema for AI-generated negotiation email
const negotiationEmailSchema = z.object({
  subject: z.string().describe("The email subject line"),
  body: z.string().describe(
    "The complete email body text with proper formatting and placeholders for missing data",
  ),
  strategy: z.enum(["extension", "installment", "settlement", "dispute"])
    .describe("The recommended negotiation strategy"),
  confidenceLevel: z.number().min(0).max(1).describe(
    "Confidence in the strategy recommendation",
  ),
  projectedSavings: z.number().min(0).describe(
    "Estimated savings from this strategy",
  ),
  reasoning: z.string().describe("Explanation of why this strategy was chosen"),
  customTerms: z.object({
    extensionDays: z.number().optional().describe(
      "Days for extension if applicable",
    ),
    installmentMonths: z.number().optional().describe(
      "Number of months for installment plan",
    ),
    settlementPercentage: z.number().optional().describe(
      "Settlement percentage (0-1) if applicable",
    ),
    monthlyPayment: z.number().optional().describe(
      "Monthly payment amount for installments",
    ),
  }).describe("Custom terms based on the strategy"),
});

interface PersonalData {
  full_name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone_number?: string;
}

interface DebtRecord {
  id: string;
  vendor: string;
  amount: number;
  raw_email: string;
  description?: string;
  due_date?: string;
  user_id?: string;
  metadata?: {
    isDebtCollection?: boolean;
    subject?: string;
    fromEmail?: string;
  };
}

// AI-powered negotiation email generator
async function generateNegotiationEmail(
  record: DebtRecord,
  personalData: PersonalData,
) {
  try {
    const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!googleApiKey) {
      console.warn("Google API key not configured, falling back to template");
      return generateFallbackEmail(record, personalData);
    }

    const result = await generateObject({
      model: createGoogleGenerativeAI({
        apiKey: googleApiKey,
      })("gemini-2.5-flash-preview-04-17"),
      system:
        `You are an expert debt negotiation advisor specializing in FDCPA-compliant email generation.
      Create professional, formal negotiation emails that:
      - Include appropriate subject line and email body
      - Follow Fair Debt Collection Practices Act requirements
      - Use the provided personal data in proper letter format
      - Include specific negotiation terms based on debt amount
      - Use {{ variable }} syntax for missing or uncertain data (like account numbers, specific dates)
      - Maintain professional tone throughout
      - Include proper business letter formatting
      
      Strategy guidelines based on amount:
      - Extension: For temporary hardship, usually < $500
      - Installment: For manageable monthly payments, $500-$2000  
      - Settlement: For significant savings, typically $2000+
      - Dispute: If debt validity is questionable
      
      For missing personal data, use appropriate placeholders.
      For uncertain information like account numbers, use {{ Account Number }} format.`,
      prompt: `Generate a complete negotiation email for this debt:
      
      Debt Amount: $${record.amount}
      Vendor: ${record.vendor}
      Description: ${record.description || "Not specified"}
      Due Date: ${record.due_date || "Not specified"}
      Email Content Preview: ${record.raw_email.substring(0, 500)}...
      
      Personal Data Available:
      - Full Name: ${personalData.full_name || "{{ Full Name }}"}
      - Address: ${personalData.address_line_1 || "{{ Address Line 1 }}"} ${
        personalData.address_line_2 ? personalData.address_line_2 : ""
      }
      - City: ${personalData.city || "{{ City }}"}
      - State: ${personalData.state || "{{ State }}"}
      - Zip: ${personalData.zip_code || "{{ Zip Code }}"}
      - Phone: ${personalData.phone_number || "{{ Phone Number }}"}
      
      Create a professional negotiation email with subject and body.`,
      schema: negotiationEmailSchema,
    });

    return result.object;
  } catch (error) {
    console.error("AI email generation error:", error);
    return generateFallbackEmail(record, personalData);
  }
}

// Fallback email generation when AI is unavailable
function generateFallbackEmail(record: DebtRecord, personalData: PersonalData) {
  let strategy: "extension" | "installment" | "settlement" | "dispute" =
    "extension";
  let projectedSavings = 0;
  let customTerms = {};

  if (record.amount < 500) {
    strategy = "extension";
    projectedSavings = 0;
    customTerms = { extensionDays: 30 };
  } else if (record.amount >= 500 && record.amount < 2000) {
    strategy = "installment";
    projectedSavings = record.amount * 0.1;
    customTerms = {
      installmentMonths: 3,
      monthlyPayment: Math.round(record.amount / 3 * 100) / 100,
    };
  } else {
    strategy = "settlement";
    projectedSavings = record.amount * 0.4;
    customTerms = { settlementPercentage: 0.6 };
  }

  const subject =
    `Account Number: {{ Account Number }} - Payment Arrangement Request`;
  const body = generateNegotiationLetter(record, strategy, personalData);

  return {
    subject,
    body,
    strategy,
    confidenceLevel: 0.7,
    projectedSavings,
    reasoning: "Generated using rule-based fallback logic",
    customTerms,
  };
}

// Generate negotiation letter for fallback
function generateNegotiationLetter(
  record: DebtRecord,
  strategy: string,
  personalData: PersonalData,
): string {
  const senderInfo = `${personalData.full_name || "{{ Full Name }}"}
${personalData.address_line_1 || "{{ Address Line 1 }}"} ${
    personalData.address_line_2 ? personalData.address_line_2 : ""
  }
${personalData.city || "{{ City }}"}, ${personalData.state || "{{ State }}"} ${
    personalData.zip_code || "{{ Zip Code }}"
  }

${personalData.phone_number || "{{ Phone Number }}"}

{{ Date }}`;

  const vendorDomain = record.vendor.includes("@")
    ? record.vendor.split("@")[1]
    : record.vendor;
  const companyName = vendorDomain.split(".")[0].toUpperCase();

  const recipientInfo = `${companyName} Collections Department
{{ Collection Agency Address }}`;

  const baseResponse = `${senderInfo}

${recipientInfo}

Subject: Account Number: {{ Account Number }}

To Whom It May Concern,

This letter is regarding the debt associated with the account number referenced above, originally with ${record.vendor}, in the amount of $${
    record.amount.toFixed(2)
  }.

I am writing to propose a payment arrangement to resolve this matter.`;

  let proposal = "";

  switch (strategy) {
    case "extension": {
      proposal =
        ` I respectfully request a 30-day extension to arrange full payment. I anticipate being able to settle this account in full by {{ Proposed Payment Date }}.

During this extension period, I request that no additional fees or interest be applied to maintain the current balance.`;
      break;
    }

    case "installment": {
      const monthlyPayment = (record.amount / 3).toFixed(2);
      proposal = ` I am able to pay the full balance of $${
        record.amount.toFixed(2)
      } through an installment plan. I propose to make three (3) equal monthly payments of $${monthlyPayment}, with the first payment to be made on {{ Proposed Start Date }}.`;
      break;
    }

    case "settlement": {
      const settlementAmount = (record.amount * 0.6).toFixed(2);
      proposal =
        ` I would like to propose a lump-sum settlement offer of $${settlementAmount} (60% of the current balance) to resolve this matter completely.

This settlement would be paid within 10 business days of written acceptance of this offer. Upon payment, I request written confirmation that this account will be considered paid in full and closed.`;
      break;
    }

    case "dispute": {
      proposal =
        ` I am formally disputing this debt and requesting validation under Section 809(b) of the Fair Debt Collection Practices Act.

Please provide:
- Verification of the debt amount
- Name and address of the original creditor
- Copy of any judgment (if applicable)  
- Verification of your authority to collect this debt

Until proper validation is provided, I request that all collection activities cease.`;
      break;
    }
  }

  const closingResponse = `

Please confirm in writing your acceptance of this installment plan. Upon receiving your written agreement, I will begin making the proposed payments according to the schedule.

In accordance with the Fair Debt Collection Practices Act (FDCPA), I request validation of this debt. Please provide verification of the debt, including documentation showing the original creditor, the amount owed, and that you are legally authorized to collect this debt. I understand that you must cease collection efforts until this validation is provided.

I look forward to your prompt response and confirmation of this payment arrangement.

Sincerely,
${personalData.full_name || "{{ Your Typed Name }}"}`;

  return baseResponse + proposal + closingResponse;
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

    // Check if this is a webhook call (using service role) or authenticated user call
    const authHeader = req.headers.get("Authorization");
    const isServiceRoleCall = authHeader?.includes(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    let user: { id: string } | null = null;
    let supabaseClient;

    if (isServiceRoleCall) {
      // This is a webhook/service call - use admin client
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // For webhook calls, we'll get the userId from the request body along with the record
      const { record }: { record: DebtRecord } = await req.json();

      if (!record || !record.user_id) {
        return new Response(
          JSON.stringify({
            error: "Missing record or user_id for service call",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      user = { id: record.user_id };

      // Use the record as-is for webhook calls
      const personalData = await fetchUserPersonalData(supabaseClient, user.id);
      return await processNegotiation(supabaseClient, record, personalData);
    } else {
      // This is an authenticated user call
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization header required" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Initialize Supabase client with auth context
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: {
            headers: { Authorization: authHeader },
          },
        },
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      user = userData.user;

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { debtId }: { debtId: string } = await req.json();

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

      const record = debtRecord as DebtRecord;
      const personalData = await fetchUserPersonalData(supabaseClient, user.id);
      return await processNegotiation(supabaseClient, record, personalData);
    }
  } catch (error) {
    console.error("Negotiation function error:", error);
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

// Helper function to fetch user personal data
async function fetchUserPersonalData(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<PersonalData>;
async function fetchUserPersonalData(
  supabaseClient: unknown,
  userId: string,
): Promise<PersonalData>;
async function fetchUserPersonalData(
  supabaseClient: unknown,
  userId: string,
): Promise<PersonalData> {
  const client = supabaseClient as ReturnType<typeof createClient>;
  const { data: userPersonalData, error: userError } = await client
    .from("users")
    .select(
      "full_name, address_line_1, address_line_2, city, state, zip_code, phone_number",
    )
    .eq("id", userId)
    .single();

  if (userError) {
    console.error("Error fetching user data:", userError);
  }

  return (userPersonalData as PersonalData) || {};
}

// Helper function to process the negotiation
async function processNegotiation(
  supabaseClient: ReturnType<typeof createClient>,
  record: DebtRecord,
  personalData: PersonalData,
): Promise<Response>;
async function processNegotiation(
  supabaseClient: unknown,
  record: DebtRecord,
  personalData: PersonalData,
): Promise<Response>;
async function processNegotiation(
  supabaseClient: unknown,
  record: DebtRecord,
  personalData: PersonalData,
): Promise<Response> {
  const client = supabaseClient as ReturnType<typeof createClient>;

  // Generate AI-powered negotiation email
  const emailResult = await generateNegotiationEmail(record, personalData);

  // Update debt record with AI-generated content - using provided client
  const { error: updateError } = await client
    .from("debts")
    .update({
      negotiated_plan: `Subject: ${emailResult.subject}\n\n${emailResult.body}`,
      projected_savings: emailResult.projectedSavings,
      status: "negotiating",
      metadata: {
        ...record.metadata,
        aiEmail: {
          subject: emailResult.subject,
          body: emailResult.body,
          strategy: emailResult.strategy,
          confidence: emailResult.confidenceLevel,
          reasoning: emailResult.reasoning,
          customTerms: emailResult.customTerms,
        },
      },
    })
    .eq("id", record.id);

  if (updateError) {
    throw updateError;
  }

  // Log the action - using provided client
  await client
    .from("audit_logs")
    .insert({
      debt_id: record.id,
      action: "negotiation_generated",
      details: {
        strategy: emailResult.strategy,
        amount: record.amount,
        projected_savings: emailResult.projectedSavings,
        ai_confidence: emailResult.confidenceLevel,
        reasoning: emailResult.reasoning,
      },
    });

  return new Response(
    JSON.stringify({
      success: true,
      strategy: emailResult.strategy,
      projected_savings: emailResult.projectedSavings,
      confidence: emailResult.confidenceLevel,
      reasoning: emailResult.reasoning,
      subject: emailResult.subject,
      body: emailResult.body,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
