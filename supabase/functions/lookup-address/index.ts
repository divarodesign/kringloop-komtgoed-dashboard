import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { postcode, huisnummer } = await req.json();

    if (!postcode || !huisnummer) {
      return new Response(JSON.stringify({ error: "Postcode en huisnummer zijn verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the official Dutch government PDOK Locatieserver API (free, no key needed, always accurate)
    const query = encodeURIComponent(`${postcode} ${huisnummer}`);
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${query}&fq=type:adres&rows=1`;
    
    console.log("PDOK lookup URL:", url);

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("PDOK API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Adres API fout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const docs = data?.response?.docs;

    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ error: "Adres niet gevonden" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = docs[0];
    // PDOK returns: straatnaam, woonplaatsnaam, postcode, huisnummer etc.
    const straat = doc.straatnaam || "";
    const stad = doc.woonplaatsnaam || "";

    console.log("Address found:", { straat, stad, score: doc.score });

    return new Response(JSON.stringify({ straat, stad }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lookup-address error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
