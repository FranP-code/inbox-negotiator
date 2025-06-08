import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateObject } from "https://esm.sh/ai@3.4.7";
import { createGoogleGenerativeAI } from "https://esm.sh/@ai-sdk/google@0.0.52";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Schema for AI response analysis
const responseAnalysisSchema = z.object({
  intent: z.enum([
    "acceptance",
    "rejection",
    "counter_offer",
    "request_info",
    "unclear",
  ])
    .describe("The primary intent of the response"),
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

interface EmailResponseData {
  debtId: string;
  fromEmail: string;
  subject: string;
  body: string;
  messageId?: string;
}

// AI-powered response analysis
async function analyzeEmailResponse(
  debtId: string,
  fromEmail: string,
  subject: string,
  body: string,
  originalNegotiation?: any,
) {
  try {
    const googleApiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!googleApiKey) {
      console.warn("Google API key not configured, using fallback analysis");
      return getFallbackAnalysis(body);
    }

    console.log("Analyzing email with AI:", {
      fromEmail,
      subject,
      bodyLength: body.length,
    });

    console.log({
      debtId,
      fromEmail,
      subject,
      body,
      originalNegotiation,
    });

    const system =
      `You are an expert financial analysis AI. Your sole function is to meticulously analyze creditor emails and populate a structured JSON object that conforms to the provided schema.

Your entire output MUST be a single, valid JSON object. Do not include any markdown, explanations, or conversational text outside of the JSON structure itself.

--- FIELD-BY-FIELD INSTRUCTIONS ---

1.  **intent**: Classify the creditor's primary intent.
    - "acceptance": Clear agreement to our original proposal.
    - "rejection": Clear refusal of our proposal without offering new terms.
    - "counter_offer": Proposes ANY new financial terms (different amount, payment plan, etc.). This is the most common intent besides acceptance.
    - "request_info": Asks for more information (e.g., "Can you provide proof of hardship?").
    - "unclear": The purpose of the email cannot be determined.

2.  **sentiment**: Classify the emotional tone of the email.
    - "positive": Cooperative, polite, agreeable language.
    - "negative": Hostile, demanding, or threatening language.
    - "neutral": Strictly professional, factual, and devoid of emotional language.

3.  **confidence**: Provide a score from 0.0 to 1.0 for your "intent" classification. (e.g., 0.95).

4.  **extractedTerms**:
    - **proposedAmount**: Extract a single, lump-sum settlement amount if offered. If the offer is a payment plan, this field should be null.
    - **proposedPaymentPlan**: Capture the payment plan offer as a descriptive string, exactly as the creditor states it. e.g., "$100 a month for 12 months". If no plan is mentioned, this is null.
    - **paymentTerms**: If a payment plan is mentioned, break it down into its structured components here. If no plan is mentioned, this entire object should be null.
        - **monthlyAmount**: The specific amount for each payment.
        - **numberOfPayments**: The number of installments.
        - **totalAmount**: The total payout of the plan, ONLY if explicitly stated (e.g., "...totaling $1200").
        - **interestRate**: The interest rate as a number (e.g., for "5% interest", extract 5).
        - **paymentFrequency**: The frequency (e.g., "monthly", "weekly", "bi-weekly").
    - **deadline**: Extract any specific date or timeframe for action (e.g., "by June 30th", "within 10 days").
    - **conditions**: Extract all non-financial requirements as an array of strings. Example: ["Payment must be via certified funds", "A settlement agreement must be signed"]. If none, use an empty array [].

5.  **reasoning**: Briefly explain the logic behind your "intent" and "suggestedNextAction" classifications, referencing parts of the email.

6.  **suggestedNextAction**: Recommend the most logical business action.
    - "accept_offer": The creditor's offer matches or is better than our goal.
    - "send_counter": The creditor made a counter-offer that we should negotiate.
    - "request_clarification": The email is ambiguous or missing key information.
    - "escalate_to_user": The response is hostile, contains legal threats, is complex, or requires a human decision.
    - "mark_settled": The email confirms the debt is fully settled and no further action is needed.

7.  **requiresUserReview**: Set to 'true' if intent is "unclear", sentiment is "negative", confidence is below 0.85, the email contains unusual legal language, or the "suggestedNextAction" is "escalate_to_user". Otherwise, set to 'false'.`;

    const prompt =
      `Analyze the following email and extract the financial details and intent, populating the JSON object according to your system instructions.

--- EMAIL TO ANALYZE ---
From: ${fromEmail}
Subject: ${subject}
Body: ${body}

${
        originalNegotiation
          ? `--- ORIGINAL CONTEXT FOR YOUR ANALYSIS ---
Our Negotiation Strategy: ${originalNegotiation.strategy}
Our Proposed Amount: $${originalNegotiation.proposedAmount || "N/A"}
Our Proposed Terms: ${originalNegotiation.terms || "N/A"}
Our Reasoning: ${originalNegotiation.reasoning || "N/A"}
Our Latest Email Body: ${originalNegotiation.body || "N/A"}
`
          : ""
      }`;

    console.log("AI Analysis System:", system);
    console.log("AI Analysis Prompt:", prompt);

    const result = await generateObject({
      model: createGoogleGenerativeAI({
        apiKey: googleApiKey,
      })("gemini-2.5-flash-preview-04-17"),
      system,
      prompt,
      schema: responseAnalysisSchema,
    });

    console.log("AI Analysis Result:", JSON.stringify(result.object, null, 2));
    console.log(
      "Extracted Terms:",
      JSON.stringify(result.object.extractedTerms, null, 2),
    );

    return result.object;
  } catch (error) {
    console.error("AI response analysis error:", error);
    console.log("Falling back to regex-based analysis");
    return getFallbackAnalysis(body);
  }
}

// Calculate financial outcome when offer is accepted
function calculateFinancialOutcome(debt: any, analysis: any): any {
  try {
    const originalAmount = debt.amount || 0;
    let acceptedAmount = originalAmount;
    let paymentStructure = null;
    let financialBenefit = null;

    // Try to extract accepted amount from AI analysis
    if (analysis.extractedTerms?.proposedAmount) {
      acceptedAmount = analysis.extractedTerms.proposedAmount;
    } else if (analysis.extractedTerms?.paymentTerms?.totalAmount) {
      acceptedAmount = analysis.extractedTerms.paymentTerms.totalAmount;
    } else if (debt.metadata?.prospectedSavings?.amount) {
      // Fall back to original negotiation terms if no specific amount mentioned
      acceptedAmount = originalAmount - debt.metadata.prospectedSavings.amount;
    }

    // Analyze payment structure if present
    if (analysis.extractedTerms?.paymentTerms) {
      const terms = analysis.extractedTerms.paymentTerms;
      paymentStructure = {
        type: "installment_plan",
        monthlyAmount: terms.monthlyAmount,
        numberOfPayments: terms.numberOfPayments,
        totalAmount: terms.totalAmount || acceptedAmount,
        frequency: terms.paymentFrequency || "monthly",
        interestRate: terms.interestRate || 0,
      };

      // Calculate time value and cash flow benefits
      if (terms.monthlyAmount && terms.numberOfPayments) {
        const totalPayments = terms.monthlyAmount * terms.numberOfPayments;
        const timeToComplete = terms.numberOfPayments; // in months

        financialBenefit = {
          type: "payment_restructuring",
          principalReduction: Math.max(0, originalAmount - totalPayments),
          cashFlowRelief: {
            monthlyReduction: originalAmount - terms.monthlyAmount,
            extendedTermMonths: timeToComplete,
            totalCashFlowBenefit: (originalAmount - terms.monthlyAmount) *
              timeToComplete,
          },
          timeValueBenefit: calculateTimeValueBenefit(
            originalAmount,
            terms.monthlyAmount,
            timeToComplete,
          ),
        };
      }
    }

    // Calculate actual savings (principal reduction)
    const actualSavings = Math.max(0, originalAmount - acceptedAmount);

    // Determine the primary financial benefit
    if (actualSavings > 0) {
      financialBenefit = {
        type: "principal_reduction",
        amount: actualSavings,
        percentage: (actualSavings / originalAmount * 100).toFixed(2),
        description: `${
          ((actualSavings / originalAmount) * 100).toFixed(1)
        }% principal reduction`,
      };
    } else if (paymentStructure && paymentStructure.monthlyAmount) {
      // No principal reduction but payment restructuring
      const monthlyReduction = originalAmount - paymentStructure.monthlyAmount;
      financialBenefit = {
        type: "payment_restructuring",
        monthlyReduction: monthlyReduction,
        extendedTermMonths: paymentStructure.numberOfPayments,
        description:
          `Payment restructured to $${paymentStructure.monthlyAmount}/month over ${paymentStructure.numberOfPayments} months`,
        cashFlowBenefit: monthlyReduction > 0
          ? `$${monthlyReduction}/month cash flow relief`
          : "Extended payment terms",
      };
    }

    console.log(
      `Financial outcome: Original: $${originalAmount}, Accepted: $${acceptedAmount}, Savings: $${actualSavings}`,
    );

    return {
      actualSavings,
      acceptedAmount,
      paymentStructure,
      financialBenefit,
      originalAmount,
    };
  } catch (error) {
    console.error("Error calculating financial outcome:", error);
    // Return basic fallback
    return {
      actualSavings: debt.projected_savings || 0,
      acceptedAmount: debt.amount,
      paymentStructure: null,
      financialBenefit: null,
      originalAmount: debt.amount,
    };
  }
}

// Calculate time value benefit of extended payment terms
function calculateTimeValueBenefit(
  originalAmount: number,
  monthlyPayment: number,
  months: number,
): any {
  // Simple present value calculation assuming 5% annual discount rate
  const monthlyRate = 0.05 / 12;
  let presentValue = 0;

  for (let i = 1; i <= months; i++) {
    presentValue += monthlyPayment / Math.pow(1 + monthlyRate, i);
  }

  const timeValueBenefit = originalAmount - presentValue;

  return {
    presentValueOfPayments: presentValue.toFixed(2),
    timeValueBenefit: timeValueBenefit.toFixed(2),
    effectiveDiscount: ((timeValueBenefit / originalAmount) * 100).toFixed(2),
  };
}

// Fallback analysis when AI is unavailable
function getFallbackAnalysis(
  body: string,
): typeof responseAnalysisSchema._type {
  const lowerBody = body.toLowerCase();

  // Simple keyword-based analysis
  let intent:
    | "acceptance"
    | "rejection"
    | "counter_offer"
    | "request_info"
    | "unclear" = "unclear";
  let sentiment: "positive" | "negative" | "neutral" = "neutral";

  if (
    lowerBody.includes("accept") || lowerBody.includes("agree") ||
    lowerBody.includes("approved")
  ) {
    intent = "acceptance";
    sentiment = "positive";
  } else if (
    lowerBody.includes("reject") || lowerBody.includes("decline") ||
    lowerBody.includes("denied")
  ) {
    intent = "rejection";
    sentiment = "negative";
  } else if (
    lowerBody.includes("counter") || lowerBody.includes("instead") ||
    lowerBody.includes("however")
  ) {
    intent = "counter_offer";
    sentiment = "neutral";
  } else if (
    lowerBody.includes("information") || lowerBody.includes("clarify") ||
    lowerBody.includes("details")
  ) {
    intent = "request_info";
    sentiment = "neutral";
  }

  // Enhanced extraction using multiple regex patterns
  const extractFinancialTerms = (text: string) => {
    // Extract dollar amounts
    const amountMatches = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    const amounts =
      amountMatches?.map((match) => parseFloat(match.replace(/[$,]/g, ""))) ||
      [];

    // Extract monthly payment patterns
    const monthlyMatch = text.match(
      /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|\/month|monthly)/i,
    );
    const monthlyAmount = monthlyMatch
      ? parseFloat(monthlyMatch[1].replace(/,/g, ""))
      : undefined;

    // Extract number of payments/months
    const paymentsMatch = text.match(
      /(\d+)\s*(?:months?|payments?|installments?)/i,
    );
    const numberOfPayments = paymentsMatch
      ? parseInt(paymentsMatch[1])
      : undefined;

    // Extract total amount patterns
    const totalMatch = text.match(
      /(?:total|totaling|total amount)\s*(?:of\s*)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    );
    const totalAmount = totalMatch
      ? parseFloat(totalMatch[1].replace(/,/g, ""))
      : undefined;

    // Determine payment frequency
    let paymentFrequency = undefined;
    if (text.match(/monthly|per month|\/month/i)) paymentFrequency = "monthly";
    else if (text.match(/weekly|per week|\/week/i)) paymentFrequency = "weekly";
    else if (text.match(/bi-weekly|biweekly|every two weeks/i)) {
      paymentFrequency = "bi-weekly";
    }

    return {
      proposedAmount: amounts.length > 0 ? amounts[0] : undefined,
      monthlyAmount,
      numberOfPayments,
      totalAmount,
      paymentFrequency,
      allAmounts: amounts,
    };
  };

  const terms = extractFinancialTerms(body);

  console.log(
    "Fallback Analysis - Extracted Terms:",
    JSON.stringify(terms, null, 2),
  );

  const result = {
    intent,
    sentiment,
    confidence: 0.6, // Lower confidence for fallback
    extractedTerms: {
      proposedAmount: terms.proposedAmount,
      proposedPaymentPlan: terms.monthlyAmount ? "payment plan" : undefined,
      paymentTerms: (terms.monthlyAmount || terms.numberOfPayments)
        ? {
          monthlyAmount: terms.monthlyAmount,
          numberOfPayments: terms.numberOfPayments,
          totalAmount: terms.totalAmount,
          paymentFrequency: terms.paymentFrequency,
        }
        : undefined,
      deadline: undefined,
      conditions: [],
    },
    reasoning:
      `Generated using enhanced keyword-based fallback analysis. Found ${terms.allAmounts.length} amounts.`,
    suggestedNextAction: intent === "acceptance"
      ? "mark_settled"
      : intent === "rejection"
      ? "escalate_to_user"
      : intent === "counter_offer"
      ? "send_counter"
      : "escalate_to_user",
    requiresUserReview: true, // Always require review for fallback
  };

  console.log("Fallback Analysis Result:", JSON.stringify(result, null, 2));
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const { debtId, fromEmail, subject, body, messageId }: EmailResponseData =
      await req.json();

    if (!debtId || !fromEmail || !body) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: debtId, fromEmail, body",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get the debt record and original negotiation context
    const { data: debt, error: debtError } = await supabaseClient
      .from("debts")
      .select("*")
      .eq("id", debtId)
      .single();

    if (debtError || !debt) {
      return new Response(
        JSON.stringify({ error: "Debt record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Analyze the response using AI
    const analysis = await analyzeEmailResponse(
      debtId,
      fromEmail,
      subject,
      body,
      debt.metadata?.aiEmail,
    );

    // Store the conversation message
    const { error: messageError } = await supabaseClient
      .from("conversation_messages")
      .update({
        debt_id: debtId,
        message_type: analysis.intent === "acceptance"
          ? "acceptance"
          : analysis.intent === "rejection"
          ? "rejection"
          : analysis.intent === "counter_offer"
          ? "counter_offer"
          : "response_received",
        direction: "inbound",
        subject,
        body,
        from_email: fromEmail,
        to_email: debt.metadata?.toEmail || debt.metadata?.fromEmail,
        ai_analysis: analysis,
      })
      .eq("message_id", messageId);

    if (messageError) {
      console.error("Error storing conversation message:", messageError);
    }

    // Determine next status and actions based on analysis
    let newStatus = debt.status;
    let newNegotiationRound = debt.negotiation_round || 1;
    let financialOutcome = null;
    let shouldAutoRespond = false;
    let nextAction = null;

    switch (analysis.intent) {
      case "acceptance":
        newStatus = "accepted";
        nextAction = "mark_settled";
        // Calculate financial outcome when offer is accepted
        financialOutcome = calculateFinancialOutcome(debt, analysis);
        break;
      case "rejection":
        newStatus = "rejected";
        nextAction = "escalate_to_user";
        break;
      case "counter_offer":
        newStatus = "counter_negotiating";
        newNegotiationRound += 1;
        shouldAutoRespond = !analysis.requiresUserReview &&
          analysis.confidence > 0.8;
        nextAction = analysis.suggestedNextAction;
        break;
      case "request_info":
        newStatus = "awaiting_response";
        nextAction = "escalate_to_user";
        break;
      default:
        newStatus = "awaiting_response";
        nextAction = "escalate_to_user";
    }

    // Update debt record
    const updateData: any = {
      status: newStatus,
      negotiation_round: newNegotiationRound,
      conversation_count: (debt.conversation_count || 0) + 1,
      last_message_at: new Date().toISOString(),
      metadata: {
        ...debt.metadata,
        lastResponse: {
          analysis,
          receivedAt: new Date().toISOString(),
          fromEmail,
          subject,
        },
      },
    };

    // Add financial outcome if offer was accepted
    if (analysis.intent === "acceptance" && financialOutcome) {
      updateData.actual_savings = financialOutcome.actualSavings;
      updateData.status = "settled"; // Set final status here instead of separate update
      updateData.metadata.financialOutcome = {
        ...financialOutcome,
        calculatedAt: new Date().toISOString(),
      };

      // Keep backward compatibility with actualSavings field
      updateData.metadata.actualSavings = {
        amount: financialOutcome.actualSavings,
        calculatedAt: new Date().toISOString(),
        originalAmount: financialOutcome.originalAmount,
        acceptedAmount: financialOutcome.acceptedAmount,
        savingsPercentage: financialOutcome.originalAmount > 0
          ? (financialOutcome.actualSavings / financialOutcome.originalAmount *
            100).toFixed(2)
          : 0,
      };
    }

    const { error: updateError } = await supabaseClient
      .from("debts")
      .update(updateData)
      .eq("id", debtId);

    if (updateError) {
      console.error("Error updating debt:", updateError);
    }

    // Log the action
    const auditDetails: any = {
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      fromEmail,
      subject,
      suggestedAction: analysis.suggestedNextAction,
      requiresReview: analysis.requiresUserReview,
    };

    // Add financial outcome to audit log if offer was accepted
    if (analysis.intent === "acceptance" && financialOutcome) {
      auditDetails.financialOutcome = financialOutcome;
      auditDetails.actualSavings = financialOutcome.actualSavings;
      auditDetails.originalAmount = financialOutcome.originalAmount;
      auditDetails.acceptedAmount = financialOutcome.acceptedAmount;
      auditDetails.savingsPercentage = financialOutcome.originalAmount > 0
        ? (financialOutcome.actualSavings / financialOutcome.originalAmount *
          100).toFixed(2)
        : 0;
    }

    await supabaseClient
      .from("audit_logs")
      .insert({
        debt_id: debtId,
        action: analysis.intent === "acceptance"
          ? "offer_accepted"
          : "response_analyzed",
        details: {
          ...auditDetails,
          nextAction,
          shouldAutoRespond,
          negotiationRound: newNegotiationRound,
          reasoning: analysis.reasoning,
        },
      });

    // If this is an acceptance, mark as settled
    if (analysis.intent === "acceptance") {
      // await supabaseClient
      //   .from("debts")
      //   .update({ status: "settled" })
      //   .eq("id", debtId);

      await supabaseClient.from("audit_logs").insert({
        debt_id: debtId,
        action: "debt_settled",
        details: {
          finalAmount: financialOutcome?.acceptedAmount || debt.amount,
          actualSavings: financialOutcome?.actualSavings || 0,
          settlementTerms: analysis.extractedTerms,
        },
      });
    }

    // If auto-response is recommended and confidence is high, trigger negotiation
    if (
      shouldAutoRespond && analysis.confidence > 0.8 &&
      analysis.intent === "counter_offer"
    ) {
      try {
        const negotiateUrl = `${
          Deno.env.get("SUPABASE_URL")
        }/functions/v1/negotiate`;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (negotiateUrl && serviceKey) {
          await fetch(negotiateUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              record: {
                ...debt,
                status: newStatus,
                conversation_count: (debt.conversation_count || 0) + 1,
                negotiation_round: newNegotiationRound,
              },
              counterOfferContext: {
                previousResponse: body,
                extractedTerms: analysis.extractedTerms,
                sentiment: analysis.sentiment,
              },
            }),
          });

          await supabaseClient.from("audit_logs").insert({
            debt_id: debtId,
            action: "auto_counter_triggered",
            details: {
              confidence: analysis.confidence,
              extractedTerms: analysis.extractedTerms,
            },
          });
        }
      } catch (autoResponseError) {
        console.error("Error triggering auto-response:", autoResponseError);
      }
    }

    const responseData: any = {
      success: true,
      analysis,
      newStatus,
      negotiationRound: newNegotiationRound,
    };

    // Include financial outcome in response if offer was accepted
    if (analysis.intent === "acceptance" && financialOutcome) {
      responseData.financialOutcome = financialOutcome;
      responseData.actualSavings = financialOutcome.actualSavings;
      responseData.savingsCalculated = true;
      responseData.originalAmount = financialOutcome.originalAmount;
      responseData.acceptedAmount = financialOutcome.acceptedAmount;
      responseData.savingsPercentage = financialOutcome.originalAmount > 0
        ? (financialOutcome.actualSavings / financialOutcome.originalAmount *
          100).toFixed(2)
        : 0;
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in analyze-response function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
