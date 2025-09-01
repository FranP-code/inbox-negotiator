/*
  # Email Sending Edge Function

  This function sends negotiated emails via Postmark:
  - Validates user has server token configured
  - Processes email variables and replaces placeholders
  - Sends the approved negotiation email to the debt collector
  - Updates debt status and logs the action
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