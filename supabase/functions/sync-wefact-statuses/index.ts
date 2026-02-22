import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEFACT_URL = "https://api.mijnwefact.nl/v2/";

// WeFact status mappings
const QUOTE_STATUS_MAP: Record<string, string> = {
  "0": "concept",
  "1": "definitief",
  "2": "verstuurd",
  "3": "geaccepteerd",
  "4": "gefactureerd",   // accepted + converted to invoice
  "8": "geweigerd",
};

const INVOICE_STATUS_MAP: Record<string, string> = {
  "0": "concept",
  "1": "definitief",
  "2": "verstuurd",
  "3": "deels_betaald",
  "4": "betaald",
  "5": "verlopen",
};

async function wefactRequest(apiKey: string, controller: string, action: string, params: Record<string, unknown> = {}) {
  const body = new URLSearchParams();
  body.append("api_key", apiKey);
  body.append("controller", controller);
  body.append("action", action);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) body.append(key, String(value));
  }

  const res = await fetch(WEFACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("WEFACT_API_KEY");
    if (!apiKey) throw new Error("WEFACT_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let quotesUpdated = 0;
    let invoicesUpdated = 0;

    // ─── Sync Quotes ───
    // Fetch quotes that are not in a final state
    const { data: openQuotes } = await supabase
      .from("quotes")
      .select("id, quote_number, status, job_id")
      .not("quote_number", "is", null)
      .not("status", "in", '("geaccepteerd","geweigerd","gefactureerd")');

    for (const quote of (openQuotes || [])) {
      try {
        const result = await wefactRequest(apiKey, "pricequote", "show", {
          PriceQuoteCode: quote.quote_number,
        });
        if (result.status !== "success" || !result.pricequote) continue;

        const wfStatus = String(result.pricequote.Status);
        const newStatus = QUOTE_STATUS_MAP[wfStatus] || quote.status;

        if (newStatus !== quote.status) {
          await supabase.from("quotes").update({ status: newStatus }).eq("id", quote.id);
          quotesUpdated++;

          // If quote was accepted or converted to invoice, update job status
          if (newStatus === "geaccepteerd" || newStatus === "gefactureerd") {
            await supabase.from("jobs").update({ status: "offerte_geaccepteerd" }).eq("id", quote.job_id);
          }
          // If quote was declined
          if (newStatus === "geweigerd") {
            await supabase.from("jobs").update({ status: "offerte_geweigerd" }).eq("id", quote.job_id);
          }

          // If quote was converted to invoice in WeFact, create local invoice record
          if (newStatus === "gefactureerd" && result.pricequote.InvoiceCode) {
            // Check if we already have this invoice
            const { data: existing } = await supabase
              .from("invoices")
              .select("id")
              .eq("invoice_number", result.pricequote.InvoiceCode)
              .limit(1);

            if (!existing || existing.length === 0) {
              // Fetch invoice details from WeFact
              const invResult = await wefactRequest(apiKey, "invoice", "show", {
                InvoiceCode: result.pricequote.InvoiceCode,
              });
              if (invResult.status === "success" && invResult.invoice) {
                const inv = invResult.invoice;
                const invStatus = INVOICE_STATUS_MAP[String(inv.Status)] || "onbetaald";
                await supabase.from("invoices").insert({
                  job_id: quote.job_id,
                  invoice_number: inv.InvoiceCode,
                  total_amount: parseFloat(inv.AmountIncl) || 0,
                  status: invStatus,
                  sent_at: inv.DateSent || null,
                  paid_at: invStatus === "betaald" ? (inv.DatePaid || new Date().toISOString()) : null,
                });
                await supabase.from("jobs").update({ status: "gefactureerd" }).eq("id", quote.job_id);
                invoicesUpdated++;
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error syncing quote ${quote.quote_number}:`, e);
      }
    }

    // ─── Sync Invoices ───
    // Fetch invoices that are not in a final state
    const { data: openInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, job_id")
      .not("invoice_number", "is", null)
      .not("status", "in", '("betaald")');

    for (const invoice of (openInvoices || [])) {
      try {
        const result = await wefactRequest(apiKey, "invoice", "show", {
          InvoiceCode: invoice.invoice_number,
        });
        if (result.status !== "success" || !result.invoice) continue;

        const wfStatus = String(result.invoice.Status);
        const newStatus = INVOICE_STATUS_MAP[wfStatus] || invoice.status;

        if (newStatus !== invoice.status) {
          const updateData: Record<string, unknown> = { status: newStatus };

          if (newStatus === "betaald") {
            updateData.paid_at = result.invoice.DatePaid || new Date().toISOString();
          }
          if (newStatus === "verstuurd" && !invoice.status.includes("verstuurd")) {
            updateData.sent_at = result.invoice.DateSent || new Date().toISOString();
          }

          await supabase.from("invoices").update(updateData).eq("id", invoice.id);
          invoicesUpdated++;

          // Update job status based on invoice status
          if (newStatus === "betaald") {
            await supabase.from("jobs").update({ status: "afgerond" }).eq("id", invoice.job_id);
          }
        }
      } catch (e) {
        console.error(`Error syncing invoice ${invoice.invoice_number}:`, e);
      }
    }

    console.log(`Sync complete: ${quotesUpdated} quotes, ${invoicesUpdated} invoices updated`);

    return new Response(
      JSON.stringify({
        success: true,
        quotes_updated: quotesUpdated,
        invoices_updated: invoicesUpdated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
