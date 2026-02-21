import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function geocodeWithPDOK(address: string): Promise<{ lat: number; lon: number } | null> {
  // Try PDOK first (best for Dutch addresses)
  const pdokUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&rows=1`;
  try {
    const res = await fetch(pdokUrl);
    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (doc?.centroide_ll) {
      // Format: "POINT(lon lat)"
      const match = doc.centroide_ll.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
  } catch (e) {
    console.error("PDOK geocode error:", e);
  }
  return null;
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  // Try full address with PDOK
  let result = await geocodeWithPDOK(address);
  if (result) return result;

  // Fallback: extract postal code, try with just that
  const postalMatch = address.match(/\d{4}\s?[A-Za-z]{2}/);
  if (postalMatch) {
    console.log(`Full address failed, trying postal code fallback: ${postalMatch[0]}`);
    result = await geocodeWithPDOK(postalMatch[0]);
    if (result) return result;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from_address, to_address } = await req.json();

    if (!from_address || !to_address) {
      return new Response(
        JSON.stringify({ error: "Both from_address and to_address are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geocode both addresses
    const [fromCoords, toCoords] = await Promise.all([
      geocode(from_address),
      geocode(to_address),
    ]);

    if (!fromCoords || !toCoords) {
      const missing = !fromCoords ? "from_address" : "to_address";
      console.error(`Could not geocode ${missing}:`, !fromCoords ? from_address : to_address);
      return new Response(
        JSON.stringify({ distance_km: 0, estimated: false, error: `Kon adres niet vinden: ${missing}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate route via OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=false`;
    const routeRes = await fetch(osrmUrl);
    const routeData = await routeRes.json();

    if (routeData.code !== "Ok" || !routeData.routes?.length) {
      console.error("OSRM error:", routeData);
      return new Response(
        JSON.stringify({ distance_km: 0, estimated: false, error: "Kon route niet berekenen" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distanceKm = Math.round(routeData.routes[0].distance / 1000);
    console.log(`Distance from "${from_address}" to "${to_address}": ${distanceKm} km`);

    return new Response(
      JSON.stringify({ distance_km: distanceKm, estimated: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("calculate-distance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", distance_km: 0, estimated: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
