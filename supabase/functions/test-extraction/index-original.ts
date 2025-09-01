import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateObject } from "https://esm.sh/ai@3.4.7";
import { createGoogleGenerativeAI } from "https://esm.sh/@ai-sdk/google@0.0.52";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same schema as analyze-response
const responseAnalysisSchema = z.object({
  intent: z.enum([
    "acceptance",
    "rejection", 
    "counter_offer",
    "request_info",
    "unclear",
  ]).describe("The primary intent of the response"),
  sentiment: z.enum(["positive", "negative", "neutral"])
    .describe("Overall sentiment of the response"),
  confidence: z.number().min(0).max(1)
    .describe("Confidence in the intent classification"),
  extractedTerms: z.object({
    proposedAmount: z.number().optional().describe(
      "Any amount mentioned in response",
    ),
    proposedPaymentPlan: z.string().optional().describe(
      "Payment plan details if mentioned",
    ),
    paymentTerms: z.object({
      monthlyAmount: z.number().optional().describe("Monthly payment amount"),
      numberOfPayments: z.number().optional().describe(
        "Number of payments/installments",
      ),
      totalAmount: z.number().optional().describe("Total amount to be paid"),
      interestRate: z.number().optional().describe(
        "Interest rate if applicable",
      ),
      paymentFrequency: z.string().optional().describe(
        "Payment frequency (monthly, weekly, etc.)",
      ),
    }).optional().describe("Structured payment plan terms"),
    deadline: z.string().optional().describe("Any deadline mentioned"),
    conditions: z.array(z.string()).optional().describe(
      "Any conditions or requirements mentioned",
    ),
  }).describe("Key terms extracted from the response"),
  reasoning: z.string().describe("Explanation of the analysis"),
  suggestedNextAction: z.enum([
    "accept_offer",
    "send_counter",
    "request_clarification",
    "escalate_to_user",
    "mark_settled",
  ]).describe("Recommended next action"),
  requiresUserReview: z.boolean().describe(
    "Whether this response needs human review",
  ),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { testEmail } = await req.json();

    if (!testEmail) {
      return new Response(
        JSON.stringify({ error: "testEmail is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "Google API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Testing extraction with email:", testEmail);

    const result = await generateObject({
      model: createGoogleGenerativeAI({
        apiKey: googleApiKey,
      })("gemini-2.5-flash-preview-04-17"),
      system: `You are an expert financial analyst specializing in debt collection and negotiation responses. 
      Your job is to carefully analyze creditor responses and extract ALL financial terms mentioned.

      CRITICAL: Always extract financial information when present. Look for:

      AMOUNTS:
      - Any dollar amounts mentioned ($1,000, $500, etc.)
      - Settlement offers or counter-offers
      - Monthly payment amounts
      - Total payment amounts

      PAYMENT PLANS:
      - Monthly payment amounts (e.g., "$200 per month", "$150/month")
      - Number of payments/installments (e.g., "12 months", "24 payments")
      - Payment frequency (monthly, weekly, bi-weekly)
      - Total amounts for payment plans
      - Interest rates if mentioned

      EXTRACT EVERYTHING: Even if amounts seem obvious, always include them in extractedTerms.`,
      prompt: `Analyze this test email and extract ALL financial terms:

      EMAIL: ${testEmail}

      EXTRACTION REQUIREMENTS:
      1. Find ANY dollar amounts mentioned in the email
      2. Look for payment plan details (monthly amounts, number of payments)
      3. Identify payment frequency (monthly, weekly, etc.)
      4. Extract total amounts if mentioned
      5. Note any interest rates or fees
      6. Capture all conditions and requirements

      EXAMPLES OF WHAT TO EXTRACT:
      - "We can accept $250 per month" → monthlyAmount: 250
      - "for 18 months" → numberOfPayments: 18
      - "totaling $4,500" → totalAmount: 4500
      - "settlement of $3,200" → proposedAmount: 3200
      - "monthly payments" → paymentFrequency: "monthly"

      Be thorough and extract ALL financial information present in the email.`,
      schema: responseAnalysisSchema,
    });

    console.log("AI Analysis Result:", JSON.stringify(result.object, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        analysis: result.object,
        extractedTerms: result.object.extractedTerms,
        debug: {
          emailLength: testEmail.length,
          hasGoogleAPI: !!googleApiKey,
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in test-extraction function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
