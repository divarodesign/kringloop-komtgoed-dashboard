import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  const { error } = await adminClient
    .from("profiles")
    .update({ full_name: "Kamal" })
    .eq("user_id", "cf455556-26d7-4298-9a64-1c1cbef7aeb2");
    
  await adminClient.auth.admin.updateUserById("cf455556-26d7-4298-9a64-1c1cbef7aeb2", {
    user_metadata: { full_name: "Kamal" },
  });
    
  return new Response(JSON.stringify({ success: !error, error: error?.message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
