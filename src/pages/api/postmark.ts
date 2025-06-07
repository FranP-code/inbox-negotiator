import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'OPT-OUT', 'REMOVE'];
    const textBody = data.TextBody || '';
    const hasOptOut = optOutKeywords.some(keyword => 
      textBody.toUpperCase().includes(keyword)
    );

    if (hasOptOut) {
      // Log opt-out and don't process further
      const { error } = await supabase.from('debts').insert({
        vendor: data.FromFull?.Email || 'unknown',
        amount: 0,
        raw_email: textBody,
        status: 'opted_out'
      });

      if (error) {
        console.error('Error logging opt-out:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Opt-out processed', { status: 200 });
    }

    // Extract debt amount using regex
    const amountMatch = textBody.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

    // Insert debt record
    const { data: insertedDebt, error: insertError } = await supabase
      .from('debts')
      .insert({
        vendor: data.FromFull?.Email || 'unknown',
        amount: amount,
        raw_email: textBody,
        status: 'received'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting debt:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the email receipt
    await supabase.from('audit_logs').insert({
      debt_id: insertedDebt.id,
      action: 'email_received',
      details: {
        vendor: data.FromFull?.Email,
        amount: amount,
        subject: data.Subject
      }
    });

    // Trigger negotiation function
    if (amount > 0) {
      const negotiateUrl = `${import.meta.env.SUPABASE_URL}/functions/v1/negotiate`;
      
      try {
        await fetch(negotiateUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ record: insertedDebt })
        });
      } catch (negotiateError) {
        console.error('Error triggering negotiation:', negotiateError);
        // Don't fail the webhook if negotiation fails
      }
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Postmark webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};