/*
  # Debt Negotiation AI Edge Function

  This function generates FDCPA-compliant negotiation responses using AI analysis:
  - Analyzes debt details and vendor information
  - Generates personalized negotiation strategies
  - Creates contextually appropriate response letters
  - Ensures FDCPA compliance
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Project has been disabled
  return new Response(
    JSON.stringify({ 
      error: "Project Disabled",
      message: "The project has been disabled (it was part of a hackathon). To enable it, please contact me."
    }), 
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});