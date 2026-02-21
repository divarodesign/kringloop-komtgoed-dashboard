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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use tool calling for structured output instead of asking for JSON in prompt
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Je bent een Nederlands adres-lookup systeem. Gegeven een Nederlandse postcode en huisnummer, geef je de EXACTE straatnaam en plaatsnaam terug. Gebruik je kennis van het Nederlandse postcodesysteem. Elke Nederlandse postcode (4 cijfers + 2 letters) correspondeert met een specifieke straat in een specifieke plaats. Geef ALLEEN de straatnaam terug (zonder huisnummer).`
          },
          {
            role: "user",
            content: `Wat is het adres voor postcode ${postcode}, huisnummer ${huisnummer}? Geef de straatnaam (zonder huisnummer) en plaatsnaam.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_address",
              description: "Return the street name and city for the given Dutch postal code and house number.",
              parameters: {
                type: "object",
                properties: {
                  straat: { type: "string", description: "De straatnaam zonder huisnummer" },
                  stad: { type: "string", description: "De plaatsnaam/stad" },
                },
                required: ["straat", "stad"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_address" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Tegoed onvoldoende" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const addressData = JSON.parse(toolCall.function.arguments);
      console.log("Address found:", addressData);
      return new Response(JSON.stringify(addressData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content as JSON
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const addressData = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(addressData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Kon adres niet verwerken" }), {
      status: 500,
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
