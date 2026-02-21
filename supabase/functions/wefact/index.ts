import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEFACT_URL = "https://api.mijnwefact.nl/v2/";

async function wefactRequest(controller: string, action: string, params: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get("WEFACT_API_KEY");
  if (!apiKey) throw new Error("WEFACT_API_KEY is not configured");

  const body = new URLSearchParams();
  body.append("api_key", apiKey);
  body.append("controller", controller);
  body.append("action", action);

  // Flatten params into form-encoded format that WeFact expects
  function flatten(obj: Record<string, unknown>, prefix = "") {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === "object" && item !== null) {
            flatten(item as Record<string, unknown>, `${fullKey}[${idx}]`);
          } else {
            body.append(`${fullKey}[${idx}]`, String(item));
          }
        });
      } else if (typeof value === "object" && value !== null) {
        flatten(value as Record<string, unknown>, fullKey);
      } else if (value !== null && value !== undefined) {
        body.append(fullKey, String(value));
      }
    }
  }
  flatten(params);

  const res = await fetch(WEFACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.errors?.[0]?.message || data.errors?.[0] || JSON.stringify(data.errors) || "WeFact API error");
  }
  return data;
}

// Find or create a debtor in WeFact by email
async function findOrCreateDebtor(customer: {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
}): Promise<string> {
  // Try to find by email first
  if (customer.email) {
    try {
      const listResult = await wefactRequest("debtor", "list", {
        searchat: "EmailAddress",
        searchfor: customer.email,
      });
      if (listResult.debtors && listResult.debtors.length > 0) {
        return listResult.debtors[0].DebtorCode;
      }
    } catch {
      // Not found, will create
    }
  }

  // Create new debtor
  const params: Record<string, unknown> = {
    SurName: customer.name,
  };
  if (customer.email) params.EmailAddress = customer.email;
  if (customer.phone) params.PhoneNumber = customer.phone;
  if (customer.address) params.Address = customer.address;
  if (customer.city) params.City = customer.city;
  if (customer.postal_code) params.ZipCode = customer.postal_code;
  params.Country = "NL";

  const createResult = await wefactRequest("debtor", "add", params);
  return createResult.debtor?.DebtorCode;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, job_id } = await req.json();

    if (!job_id) throw new Error("job_id is required");

    // Fetch job with customer and items
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, customers(*)")
      .eq("id", job_id)
      .single();
    if (jobError || !job) throw new Error("Job not found");

    const { data: jobItems } = await supabase
      .from("job_items")
      .select("*")
      .eq("job_id", job_id);

    const customer = job.customers;
    if (!customer) throw new Error("Customer not found for this job");

    // Find or create debtor
    const debtorCode = await findOrCreateDebtor(customer);

    if (action === "create_quote") {
      // Group items by room
      const roomGroups: Record<string, any[]> = {};
      (jobItems || []).forEach((item: any) => {
        const room = item.room_name || "Overig";
        if (!roomGroups[room]) roomGroups[room] = [];
        roomGroups[room].push(item);
      });

      const lines: any[] = [];
      const roomNames = Object.keys(roomGroups);
      const hasRooms = roomNames.length > 1 || (roomNames.length === 1 && roomNames[0] !== "Overig");

      if (hasRooms) {
        for (let ri = 0; ri < roomNames.length; ri++) {
          const roomName = roomNames[ri];
          // Add blank separator between rooms (not before first)
          if (ri > 0) {
            lines.push({ Description: "", Number: 0, PriceExcl: 0 });
          }
          // Add room header in bold (WeFact supports <b> in descriptions)
          lines.push({
            Description: `<b>${roomName}</b>`,
            Number: 0,
            PriceExcl: 0,
          });
          for (const item of roomGroups[roomName]) {
            lines.push({
              Description: `  ${item.description}`,
              Number: item.quantity,
              PriceExcl: item.unit_price,
            });
          }
        }
      } else {
        for (const item of (jobItems || [])) {
          lines.push({
            Description: (item as any).description,
            Number: (item as any).quantity,
            PriceExcl: (item as any).unit_price,
          });
        }
      }

      // Add travel cost
      if (job.travel_cost > 0) {
        lines.push({
          Description: `Voorrijkosten (${job.travel_distance_km || 0} km)`,
          Number: 1,
          PriceExcl: job.travel_cost,
        });
      }

      // Add extra costs
      if ((job.extra_costs || 0) > 0) {
        lines.push({
          Description: job.extra_costs_description || "Overige kosten",
          Number: 1,
          PriceExcl: job.extra_costs,
        });
      }

      // For ontruiming with custom price, replace product lines with single line
      if (job.job_type === "ontruiming" && job.custom_price) {
        lines.length = 0;
        lines.push({ Description: "Ontruiming", Number: 1, PriceExcl: job.custom_price });
        if (job.travel_cost > 0) lines.push({ Description: `Voorrijkosten (${job.travel_distance_km || 0} km)`, Number: 1, PriceExcl: job.travel_cost });
        if ((job.extra_costs || 0) > 0) lines.push({ Description: job.extra_costs_description || "Overige kosten", Number: 1, PriceExcl: job.extra_costs });
      }

      // Build pricequote params
      const today = new Date().toISOString().split("T")[0];
      const quoteParams: Record<string, unknown> = {
        DebtorCode: debtorCode,
        Date: today,
        Description: job.title,
        Term: 30,
        PriceQuoteLines: lines,
      };

      // Apply discount at quote level if percentage
      if (job.discount_value && job.discount_value > 0 && job.discount_type === "percentage") {
        quoteParams.Discount = job.discount_value;
      } else if (job.discount_value && job.discount_value > 0 && job.discount_type === "fixed") {
        // Add as negative line
        lines.push({
          Description: "Korting",
          Number: 1,
          PriceExcl: -job.discount_value,
        });
      }

      const quoteResult = await wefactRequest("pricequote", "add", quoteParams);

      const quoteNumber = quoteResult.pricequote?.PriceQuoteCode || null;
      const totalAmount = lines.filter((l: any) => l.Number > 0).reduce((s: number, l: any) => s + l.Number * l.PriceExcl, 0);

      // Save quote in our DB
      await supabase.from("quotes").insert({
        job_id,
        quote_number: quoteNumber,
        total_amount: totalAmount,
        status: "concept",
      });

      // Update job status
      await supabase.from("jobs").update({ status: "offerte_verstuurd" }).eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, quote_number: quoteNumber, wefact_id: quoteResult.pricequote?.Identifier }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_quote") {
      const { data: quote } = await supabase
        .from("quotes")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!quote?.quote_number) throw new Error("Geen offerte gevonden om te versturen");

      await wefactRequest("pricequote", "sendbyemail", {
        PriceQuoteCode: quote.quote_number,
      });

      await supabase.from("quotes").update({ status: "verstuurd", sent_at: new Date().toISOString() }).eq("id", quote.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_invoice") {
      // Build invoice lines
      const lines = (jobItems || []).map((item: any) => ({
        Description: item.description,
        Number: item.quantity,
        PriceExcl: item.unit_price,
      }));

      if (job.travel_cost > 0) {
        lines.push({ Description: `Voorrijkosten (${job.travel_distance_km || 0} km)`, Number: 1, PriceExcl: job.travel_cost });
      }
      if ((job.extra_costs || 0) > 0) {
        lines.push({ Description: job.extra_costs_description || "Overige kosten", Number: 1, PriceExcl: job.extra_costs });
      }

      if (job.job_type === "ontruiming" && job.custom_price) {
        lines.length = 0;
        lines.push({ Description: "Ontruiming", Number: 1, PriceExcl: job.custom_price });
        if (job.travel_cost > 0) lines.push({ Description: `Voorrijkosten (${job.travel_distance_km || 0} km)`, Number: 1, PriceExcl: job.travel_cost });
        if ((job.extra_costs || 0) > 0) lines.push({ Description: job.extra_costs_description || "Overige kosten", Number: 1, PriceExcl: job.extra_costs });
      }

      // Extra sales
      const { data: extraSales } = await supabase.from("extra_sales").select("*").eq("job_id", job_id);
      (extraSales || []).forEach((es: any) => {
        lines.push({ Description: `Bijverkoop: ${es.description}`, Number: 1, PriceExcl: es.amount });
      });

      // Discount
      if (job.discount_value && job.discount_value > 0) {
        const itemsTotal = (jobItems || []).reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
        const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
        const discountAmount = job.discount_type === "percentage"
          ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
          : job.discount_value;
        if (discountAmount > 0) {
          lines.push({ Description: `Korting${job.discount_type === "percentage" ? ` (${job.discount_value}%)` : ""}`, Number: 1, PriceExcl: -discountAmount });
        }
      }

      const invoiceResult = await wefactRequest("invoice", "add", {
        DebtorCode: debtorCode,
        InvoiceLines: lines,
      });

      const invoiceNumber = invoiceResult.invoice?.InvoiceCode || null;
      const totalAmount = lines.reduce((s: number, l: any) => s + l.Number * l.PriceExcl, 0);

      // Save invoice in our DB
      await supabase.from("invoices").insert({
        job_id,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        status: "onbetaald",
      });

      // Update job status
      await supabase.from("jobs").update({ status: "gefactureerd" }).eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, invoice_number: invoiceNumber, wefact_id: invoiceResult.invoice?.Identifier }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_invoice") {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!invoice?.invoice_number) throw new Error("Geen factuur gevonden om te versturen");

      await wefactRequest("invoice", "sendbyemail", {
        InvoiceCode: invoice.invoice_number,
      });

      await supabase.from("invoices").update({ status: "verstuurd", sent_at: new Date().toISOString() }).eq("id", invoice.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_payment") {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!invoice?.invoice_number) throw new Error("Geen factuur gevonden");

      const showResult = await wefactRequest("invoice", "show", {
        InvoiceCode: invoice.invoice_number,
      });

      const wefactInvoice = showResult.invoice;
      const isPaid = wefactInvoice?.Status === "4" || wefactInvoice?.Status === 4; // Status 4 = paid in WeFact

      if (isPaid && invoice.status !== "betaald") {
        await supabase.from("invoices").update({
          status: "betaald",
          paid_at: wefactInvoice.DatePaid || new Date().toISOString(),
        }).eq("id", invoice.id);

        await supabase.from("jobs").update({ status: "afgerond" }).eq("id", job_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          is_paid: isPaid,
          wefact_status: wefactInvoice?.Status,
          amount_paid: wefactInvoice?.AmountPaid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("WeFact error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
