/*
  # Debt Negotiation AI Edge Function
  
  This function generates FDCPA-compliant negotiation responses using AI analysis:
  - Analyzes debt details and vendor information
  - Generates personalized negotiation strategies
  - Creates contextually appropriate response letters
  - Ensures FDCPA compliance
*/

import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateObject } from 'npm:ai@4.3.16';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@1.2.19';
import { z } from 'npm:zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Schema for AI negotiation strategy
const negotiationStrategySchema = z.object({
  strategy: z.enum(['extension', 'installment', 'settlement', 'dispute']).describe('The recommended negotiation strategy'),
  confidenceLevel: z.number().min(0).max(1).describe('Confidence in the strategy recommendation'),
  projectedSavings: z.number().min(0).describe('Estimated savings from this strategy'),
  reasoning: z.string().describe('Explanation of why this strategy was chosen'),
  customTerms: z.object({
    extensionDays: z.number().optional().describe('Days for extension if applicable'),
    installmentMonths: z.number().optional().describe('Number of months for installment plan'),
    settlementPercentage: z.number().optional().describe('Settlement percentage (0-1) if applicable'),
    monthlyPayment: z.number().optional().describe('Monthly payment amount for installments'),
  }).describe('Custom terms based on the strategy'),
});

// Schema for AI-generated negotiation letter
const negotiationLetterSchema = z.object({
  letter: z.string().describe('The complete negotiation letter text'),
  tone: z.enum(['formal', 'respectful', 'assertive', 'conciliatory']).describe('The tone used in the letter'),
  keyPoints: z.array(z.string()).describe('Key negotiation points included in the letter'),
  fdcpaCompliant: z.boolean().describe('Whether the letter meets FDCPA compliance requirements'),
});

interface DebtRecord {
  id: string;
  vendor: string;
  amount: number;
  raw_email: string;
  description?: string;
  due_date?: string;
  metadata?: {
    isDebtCollection?: boolean;
    subject?: string;
    fromEmail?: string;
  };
}

// AI-powered negotiation strategy generator
async function generateNegotiationStrategy(record: DebtRecord) {
  try {
    const googleApiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
    if (!googleApiKey) {
      console.warn('Google API key not configured, falling back to rule-based strategy');
      return generateFallbackStrategy(record);
    }

    const result = await generateObject({
      model: createGoogleGenerativeAI({
        apiKey: googleApiKey,
      })('gemini-2.5-flash-preview-04-17'),
      system: `You are an expert debt negotiation advisor specializing in FDCPA-compliant strategies.
      Analyze the debt details and recommend the best negotiation approach. Consider:
      - Debt amount and type
      - Vendor/creditor information
      - Legal compliance requirements
      - Realistic settlement possibilities
      - Consumer protection laws
      
      Strategy guidelines:
      - Extension: For temporary hardship, usually < $500
      - Installment: For manageable monthly payments, $500-$2000
      - Settlement: For significant savings, typically $2000+
      - Dispute: If debt validity is questionable
      
      Always ensure FDCPA compliance and realistic expectations.`,
      prompt: `Analyze this debt for negotiation strategy:
      
      Amount: $${record.amount}
      Vendor: ${record.vendor}
      Description: ${record.description || 'Not specified'}
      Due Date: ${record.due_date || 'Not specified'}
      Email Content Preview: ${record.raw_email.substring(0, 500)}...
      
      Recommend the best negotiation strategy with specific terms.`,
      schema: negotiationStrategySchema,
    });

    return result.object;
  } catch (error) {
    console.error('AI strategy generation error:', error);
    return generateFallbackStrategy(record);
  }
}

// Fallback rule-based strategy when AI is unavailable
function generateFallbackStrategy(record: DebtRecord) {
  let strategy: 'extension' | 'installment' | 'settlement' | 'dispute' = 'extension';
  let projectedSavings = 0;
  let customTerms = {};

  if (record.amount < 500) {
    strategy = 'extension';
    projectedSavings = 0;
    customTerms = { extensionDays: 30 };
  } else if (record.amount >= 500 && record.amount < 2000) {
    strategy = 'installment';
    projectedSavings = record.amount * 0.1;
    customTerms = { 
      installmentMonths: 3, 
      monthlyPayment: Math.round(record.amount / 3 * 100) / 100 
    };
  } else {
    strategy = 'settlement';
    projectedSavings = record.amount * 0.4;
    customTerms = { settlementPercentage: 0.6 };
  }

  return {
    strategy,
    confidenceLevel: 0.7,
    projectedSavings,
    reasoning: 'Generated using rule-based fallback logic',
    customTerms,
  };
}

// AI-powered negotiation letter generator
async function generateNegotiationLetter(record: DebtRecord, strategy: any) {
  try {
    const googleApiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
    if (!googleApiKey) {
      console.warn('Google API key not configured, falling back to template');
      return generateFallbackLetter(record, strategy);
    }

    const result = await generateObject({
      model: createGoogleGenerativeAI({
        apiKey: googleApiKey,
      })('gemini-2.5-flash-preview-04-17'),
      system: `You are an expert at writing FDCPA-compliant debt negotiation letters.
      Create professional, respectful letters that:
      - Follow Fair Debt Collection Practices Act requirements
      - Are appropriately formal but human
      - Include specific negotiation terms
      - Maintain consumer rights protections
      - Are personalized to the specific situation
      
      Always include FDCPA compliance language and validation requests.
      Keep tone professional but not overly legal or intimidating.`,
      prompt: `Generate a negotiation letter for this debt:
      
      Debt Amount: $${record.amount}
      Vendor: ${record.vendor}
      Strategy: ${strategy.strategy}
      Custom Terms: ${JSON.stringify(strategy.customTerms)}
      Reasoning: ${strategy.reasoning}
      
      Create a complete, ready-to-send negotiation letter.`,
      schema: negotiationLetterSchema,
    });

    return result.object;
  } catch (error) {
    console.error('AI letter generation error:', error);
    return generateFallbackLetter(record, strategy);
  }
}

// Fallback letter generation
function generateFallbackLetter(record: DebtRecord, strategy: any) {
  const letter = generateNegotiationResponse(record, strategy.strategy);
  return {
    letter,
    tone: 'formal' as const,
    keyPoints: ['Payment arrangement', 'FDCPA compliance', 'Good faith negotiation'],
    fdcpaCompliant: true,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const { record }: { record: DebtRecord } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate AI-powered negotiation strategy
    const strategy = await generateNegotiationStrategy(record);
    
    // Generate AI-powered negotiation letter
    const letterResult = await generateNegotiationLetter(record, strategy);

    // Update debt record with AI-generated content
    const { error: updateError } = await supabase
      .from('debts')
      .update({
        negotiated_plan: letterResult.letter,
        projected_savings: strategy.projectedSavings,
        status: 'negotiating',
        metadata: {
          ...record.metadata,
          aiStrategy: {
            strategy: strategy.strategy,
            confidence: strategy.confidenceLevel,
            reasoning: strategy.reasoning,
            customTerms: strategy.customTerms,
            letterTone: letterResult.tone,
            keyPoints: letterResult.keyPoints,
            fdcpaCompliant: letterResult.fdcpaCompliant,
          }
        }
      })
      .eq('id', record.id);

    if (updateError) {
      throw updateError;
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        debt_id: record.id,
        action: 'negotiation_generated',
        details: {
          strategy: strategy.strategy,
          amount: record.amount,
          projected_savings: strategy.projectedSavings,
          ai_confidence: strategy.confidenceLevel,
          reasoning: strategy.reasoning
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        strategy: strategy.strategy, 
        projected_savings: strategy.projectedSavings,
        confidence: strategy.confidenceLevel,
        reasoning: strategy.reasoning
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Negotiation function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateNegotiationResponse(record: DebtRecord, strategy: string): string {
  const vendorDomain = record.vendor.includes('@') ? record.vendor.split('@')[1] : record.vendor;
  const companyName = vendorDomain.split('.')[0].toUpperCase();
  
  const baseResponse = `Dear ${companyName} Collections Department,

I am writing in response to your recent communication regarding account balance of $${record.amount.toFixed(2)}.

I acknowledge this debt and am committed to resolving this matter in good faith. Due to current financial circumstances, I would like to propose the following arrangement:

`;

  let proposal = '';
  
  switch (strategy) {
    case 'extension':
      proposal = `I respectfully request a 30-day extension to arrange full payment. I anticipate being able to settle this account in full by ${getDateAfterDays(30)}.

During this extension period, I request that no additional fees or interest be applied to maintain the current balance.`;
      break;
      
    case 'installment':
      const monthlyPayment = (record.amount / 3).toFixed(2);
      proposal = `I would like to propose a 3-month payment plan with the following terms:
- Monthly payments of $${monthlyPayment}
- First payment due: ${getDateAfterDays(30)}
- Subsequent payments on the same date for the following 2 months
- No additional fees or interest during the payment plan period`;
      break;
      
    case 'settlement':
      const settlementAmount = (record.amount * 0.6).toFixed(2);
      proposal = `I would like to propose a lump-sum settlement offer of $${settlementAmount} (60% of the current balance) to resolve this matter completely.

This settlement would be paid within 10 business days of written acceptance of this offer. Upon payment, I request written confirmation that this account will be considered paid in full and closed.`;
      break;

    case 'dispute':
      proposal = `I am formally disputing this debt and requesting validation under Section 809(b) of the Fair Debt Collection Practices Act.

Please provide:
- Verification of the debt amount
- Name and address of the original creditor
- Copy of any judgment (if applicable)
- Verification of your authority to collect this debt

Until proper validation is provided, I request that all collection activities cease.`;
      break;
  }

  const closingResponse = `

Please confirm receipt of this correspondence and your acceptance of the proposed arrangement. I am committed to honoring any agreement we reach and appreciate your consideration of this proposal.

I look forward to your prompt response so we can resolve this matter efficiently.

Sincerely,
[Account Holder Name]

---
This correspondence is sent in accordance with the Fair Debt Collection Practices Act (FDCPA). If you are a debt collector, this serves as formal notice that I am disputing this debt and requesting validation as outlined under Section 809(b) of the FDCPA.`;

  return baseResponse + proposal + closingResponse;
}

function getDateAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}