/*
  # Debt Negotiation AI Edge Function
  
  This function generates FDCPA-compliant negotiation responses based on debt amounts:
  - < $500: 30-day extension request
  - $500-$2000: 3-month installment plan
  - >= $2000: 60% lump-sum settlement offer
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DebtRecord {
  id: string;
  vendor: string;
  amount: number;
  raw_email: string;
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

    // Generate negotiation strategy based on amount
    let strategy = '';
    let projectedSavings = 0;

    if (record.amount < 500) {
      strategy = 'extension';
      projectedSavings = 0; // No savings, just time
    } else if (record.amount >= 500 && record.amount < 2000) {
      strategy = 'installment';
      projectedSavings = record.amount * 0.1; // 10% savings from avoiding late fees
    } else {
      strategy = 'settlement';
      projectedSavings = record.amount * 0.4; // 40% savings from 60% settlement
    }

    // Generate FDCPA-compliant response
    const negotiatedPlan = generateNegotiationResponse(record, strategy);

    // Update debt record
    const { error: updateError } = await supabase
      .from('debts')
      .update({
        negotiated_plan: negotiatedPlan,
        projected_savings: projectedSavings,
        status: 'negotiating'
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
          strategy,
          amount: record.amount,
          projected_savings: projectedSavings
        }
      });

    return new Response(
      JSON.stringify({ success: true, strategy, projected_savings: projectedSavings }),
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
  const vendorDomain = record.vendor.split('@')[1] || 'your company';
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