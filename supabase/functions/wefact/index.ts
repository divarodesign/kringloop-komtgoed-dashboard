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

const VAT_RATE = 1.21;

type WefactLine = {
  Description: string;
  Number: number;
  PriceExcl: number;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toExcl(priceIncl: number): number {
  return roundCurrency(priceIncl / VAT_RATE);
}

function makeLine(description: string, number: number, priceIncl: number): WefactLine {
  return {
    Description: description,
    Number: number,
    PriceExcl: toExcl(priceIncl),
  };
}

function makeZeroLine(description: string): WefactLine {
  return { Description: description, Number: 1, PriceExcl: 0 };
}

function getLinesExclTotal(lines: WefactLine[]): number {
  return roundCurrency(lines.reduce((sum, line) => sum + (toAmount(line.Number) * toAmount(line.PriceExcl)), 0));
}

// Simulate WeFact's per-line incl calculation: each line's incl = round(Number * PriceExcl * 1.21)
function getWefactInclTotal(lines: WefactLine[]): number {
  return lines.reduce((sum, line) => {
    const lineInclCents = Math.round(toAmount(line.Number) * toAmount(line.PriceExcl) * 121);
    return sum + lineInclCents;
  }, 0) / 100;
}

function getDiscountAmount(job: any, baseAmount: number): number {
  const discountValue = toAmount(job.discount_value);
  if (discountValue <= 0) return 0;
  return job.discount_type === "percentage"
    ? baseAmount * (discountValue / 100)
    : discountValue;
}

function getItemsTotal(jobItems: any[]): number {
  return roundCurrency((jobItems || []).reduce((sum: number, item: any) => sum + (toAmount(item.quantity) * toAmount(item.unit_price)), 0));
}

function getJobSubtotal(job: any, jobItems: any[]): number {
  const itemsTotal = getItemsTotal(jobItems);
  return job.job_type === "ontruiming"
    ? toAmount(job.custom_price ?? job.advised_price ?? itemsTotal)
    : itemsTotal;
}

function getQuoteTargetTotal(job: any, jobItems: any[]): number {
  const subtotal = getJobSubtotal(job, jobItems);
  const baseAmount = subtotal + toAmount(job.travel_cost) + toAmount(job.extra_costs);
  const discountAmount = getDiscountAmount(job, baseAmount);
  const beforeSurcharge = baseAmount - discountAmount;
  return roundCurrency(beforeSurcharge * (1 + (toAmount(job.surcharge_percentage) / 100)));
}

function getInvoiceTargetTotal(job: any, jobItems: any[], extraSales: any[]): number {
  const subtotal = getJobSubtotal(job, jobItems);
  const extraSalesTotal = roundCurrency((extraSales || []).reduce((sum: number, sale: any) => sum + toAmount(sale.amount), 0));
  const baseAmount = subtotal + toAmount(job.travel_cost) + toAmount(job.extra_costs);
  const discountAmount = getDiscountAmount(job, baseAmount);
  const beforeSurcharge = baseAmount + extraSalesTotal - discountAmount;
  return roundCurrency(beforeSurcharge * (1 + (toAmount(job.surcharge_percentage) / 100)));
}

function ensureExactTotal(lines: WefactLine[], targetTotalIncl: number): WefactLine[] {
  const currentInclCents = Math.round(getWefactInclTotal(lines) * 100);
  const targetInclCents = Math.round(targetTotalIncl * 100);
  
  if (currentInclCents === targetInclCents) return lines;

  // Try small corrections to find an excl value whose per-line incl rounds to exactly bridge the gap
  const diffCents = targetInclCents - currentInclCents;
  
  // Search for a PriceExcl correction value where round(corrExcl * 121) = diffCents
  for (let exclCents = diffCents - 50; exclCents <= diffCents + 50; exclCents++) {
    const resultInclCents = Math.round((exclCents * 121) / 100);
    if (resultInclCents === diffCents) {
      return [
        ...lines,
        {
          Description: "Afrondingscorrectie",
          Number: 1,
          PriceExcl: exclCents / 100,
        },
      ];
    }
  }

  // Fallback: use exact diff as excl (should rarely happen)
  return [
    ...lines,
    {
      Description: "Afrondingscorrectie",
      Number: 1,
      PriceExcl: roundCurrency(diffCents / 121),
    },
  ];
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

    const { action, job_id, lines: customInvoiceLines } = await req.json();

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
      const quoteTargetTotalIncl = getQuoteTargetTotal(job, jobItems || []);
      const subtotal = getJobSubtotal(job, jobItems || []);
      const travelCost = toAmount(job.travel_cost);
      const extraCosts = toAmount(job.extra_costs);
      const surchargePercentage = toAmount(job.surcharge_percentage);
      const discountBase = subtotal + travelCost + extraCosts;
      const discountAmount = roundCurrency(getDiscountAmount(job, discountBase));

      // Group items by room
      const roomGroups: Record<string, any[]> = {};
      (jobItems || []).forEach((item: any) => {
        const room = item.room_name || "Overig";
        if (!roomGroups[room]) roomGroups[room] = [];
        roomGroups[room].push(item);
      });

      const lines: WefactLine[] = [];
      const roomNames = Object.keys(roomGroups);
      const hasRooms = roomNames.length > 1 || (roomNames.length === 1 && roomNames[0] !== "Overig");

      if (job.job_type === "ontruiming") {
        if (hasRooms) {
          for (let ri = 0; ri < roomNames.length; ri++) {
            const roomName = roomNames[ri];
            if (ri > 0) {
              lines.push(makeZeroLine(" "));
            }
            lines.push(makeZeroLine(`=== ${roomName.toUpperCase()} ===`));
            for (const item of roomGroups[roomName]) {
              lines.push(makeZeroLine(`${item.quantity}x ${item.description}`));
            }
          }
        } else {
          for (const item of (jobItems || [])) {
            lines.push(makeZeroLine(`${(item as any).quantity}x ${(item as any).description}`));
          }
        }

        lines.push(makeZeroLine(" "));
        lines.push(makeLine("Totaalprijs project", 1, quoteTargetTotalIncl));
      } else {
        if (hasRooms) {
          for (let ri = 0; ri < roomNames.length; ri++) {
            const roomName = roomNames[ri];
            if (ri > 0) {
              lines.push(makeZeroLine(" "));
            }
            lines.push(makeZeroLine(`=== ${roomName.toUpperCase()} ===`));
            for (const item of roomGroups[roomName]) {
              lines.push(makeLine(`  ${item.description}`, item.quantity, item.unit_price));
            }
          }
        } else {
          for (const item of (jobItems || [])) {
            lines.push(makeLine((item as any).description, (item as any).quantity, (item as any).unit_price));
          }
        }

        if (travelCost > 0) {
          lines.push(makeLine(`Voorrijkosten (${job.travel_distance_km || 0} km)`, 1, travelCost));
        }

        if (extraCosts > 0) {
          lines.push(makeLine(job.extra_costs_description || "Overige kosten", 1, extraCosts));
        }

        if (discountAmount > 0) {
          lines.push(makeLine(`Korting${job.discount_type === "percentage" ? ` (${job.discount_value}%)` : ""}`, 1, -discountAmount));
        }

        if (surchargePercentage > 0) {
          const visibleBeforeSurcharge = roundCurrency(discountBase - discountAmount);
          const surchargeAmount = roundCurrency(quoteTargetTotalIncl - visibleBeforeSurcharge);
          if (Math.abs(surchargeAmount) >= 0.005) {
            lines.push(makeLine(`Toeslag (${job.surcharge_percentage}%)`, 1, surchargeAmount));
          }
        }
      }

      const finalLines = ensureExactTotal(lines, quoteTargetTotalIncl);

      // Build pricequote params
      const today = new Date().toISOString().split("T")[0];
      const quoteParams: Record<string, unknown> = {
        DebtorCode: debtorCode,
        Date: today,
        Description: job.title,
        Term: 30,
        VatCalcMethod: "incl",
        PriceQuoteLines: finalLines,
      };

      const quoteResult = await wefactRequest("pricequote", "add", quoteParams);

      const quoteNumber = quoteResult.pricequote?.PriceQuoteCode || null;

      // Save quote in our DB
      await supabase.from("quotes").insert({
        job_id,
        quote_number: quoteNumber,
        total_amount: quoteTargetTotalIncl,
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
      const { data: extraSales } = await supabase.from("extra_sales").select("*").eq("job_id", job_id);
      const invoiceTargetTotalIncl = getInvoiceTargetTotal(job, jobItems || [], extraSales || []);
      const subtotal = getJobSubtotal(job, jobItems || []);
      const travelCost = toAmount(job.travel_cost);
      const extraCosts = toAmount(job.extra_costs);
      const surchargePercentage = toAmount(job.surcharge_percentage);
      const extraSalesTotal = roundCurrency((extraSales || []).reduce((sum: number, sale: any) => sum + toAmount(sale.amount), 0));
      const discountBase = subtotal + travelCost + extraCosts;
      const discountAmount = roundCurrency(getDiscountAmount(job, discountBase));

      const lines: WefactLine[] = [];

      if (job.job_type === "ontruiming") {
        for (const item of (jobItems || [])) {
          lines.push(makeZeroLine(`${(item as any).quantity}x ${(item as any).description}`));
        }
        lines.push(makeZeroLine(" "));
        lines.push(makeLine("Totaalprijs project", 1, invoiceTargetTotalIncl));
      } else {
        for (const item of (jobItems || [])) {
          lines.push(makeLine(item.description, item.quantity, item.unit_price));
        }

        if (travelCost > 0) {
          lines.push(makeLine(`Voorrijkosten (${job.travel_distance_km || 0} km)`, 1, travelCost));
        }

        if (extraCosts > 0) {
          lines.push(makeLine(job.extra_costs_description || "Overige kosten", 1, extraCosts));
        }

        (extraSales || []).forEach((sale: any) => {
          lines.push(makeLine(`Bijverkoop: ${sale.description}`, 1, sale.amount));
        });

        if (discountAmount > 0) {
          lines.push(makeLine(`Korting${job.discount_type === "percentage" ? ` (${job.discount_value}%)` : ""}`, 1, -discountAmount));
        }

        if (surchargePercentage > 0) {
          const visibleBeforeSurcharge = roundCurrency(discountBase + extraSalesTotal - discountAmount);
          const surchargeAmount = roundCurrency(invoiceTargetTotalIncl - visibleBeforeSurcharge);
          if (Math.abs(surchargeAmount) >= 0.005) {
            lines.push(makeLine(`Toeslag (${job.surcharge_percentage}%)`, 1, surchargeAmount));
          }
        }
      }

      const finalLines = ensureExactTotal(lines, invoiceTargetTotalIncl);

      const invoiceResult = await wefactRequest("invoice", "add", {
        DebtorCode: debtorCode,
        VatCalcMethod: "incl",
        InvoiceLines: finalLines,
      });

      const invoiceNumber = invoiceResult.invoice?.InvoiceCode || null;

      await supabase.from("invoices").insert({
        job_id,
        invoice_number: invoiceNumber,
        total_amount: invoiceTargetTotalIncl,
        status: "onbetaald",
      });

      await supabase.from("jobs").update({ status: "gefactureerd" }).eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, invoice_number: invoiceNumber, wefact_id: invoiceResult.invoice?.Identifier }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_invoice_custom") {
      const wefactLines: WefactLine[] = (customInvoiceLines || []).map((line: any) => makeLine(line.description, line.quantity, line.price));
      const targetTotalIncl = roundCurrency((customInvoiceLines || []).reduce((sum: number, line: any) => sum + (toAmount(line.quantity) * toAmount(line.price)), 0));
      const finalLines = ensureExactTotal(wefactLines, targetTotalIncl);

      const invoiceResult = await wefactRequest("invoice", "add", {
        DebtorCode: debtorCode,
        VatCalcMethod: "incl",
        InvoiceLines: finalLines,
      });

      const invoiceNumber = invoiceResult.invoice?.InvoiceCode || null;

      await supabase.from("invoices").insert({
        job_id,
        invoice_number: invoiceNumber,
        total_amount: targetTotalIncl,
        status: "onbetaald",
      });

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
      const isPaid = wefactInvoice?.Status === "4" || wefactInvoice?.Status === 4;

      if (isPaid && invoice.status !== "betaald") {
        await supabase.from("invoices").update({
          status: "betaald",
          paid_at: wefactInvoice.DatePaid || new Date().toISOString(),
        }).eq("id", invoice.id);
      }

      return new Response(
        JSON.stringify({ success: true, paid: isPaid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert quote to concept invoice (no sending)
    if (action === "convert_quote_to_invoice") {
      const { data: quote } = await supabase
        .from("quotes")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!quote?.quote_number) throw new Error("Geen offerte gevonden om om te zetten");

      // Accept the quote and create a concept invoice in one WeFact call
      const convertResult = await wefactRequest("pricequote", "accept", {
        PriceQuoteCode: quote.quote_number,
        CreateInvoice: "yes",
      });

      const invoiceNumber = convertResult.invoice?.InvoiceCode || null;
      const totalAmount = parseFloat(convertResult.invoice?.AmountIncl) || quote.total_amount;

      // Update quote status
      await supabase.from("quotes").update({ status: "gefactureerd" }).eq("id", quote.id);

      // Create local invoice record
      await supabase.from("invoices").insert({
        job_id,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        status: "concept",
      });

      await supabase.from("jobs").update({ status: "gefactureerd" }).eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, invoice_number: invoiceNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert quote to invoice AND send it immediately
    if (action === "convert_quote_and_send") {
      const { data: quote } = await supabase
        .from("quotes")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!quote?.quote_number) throw new Error("Geen offerte gevonden om om te zetten");

      // First accept the quote in WeFact by setting Status to 3 (geaccepteerd)
      await wefactRequest("pricequote", "edit", {
        PriceQuoteCode: quote.quote_number,
        Status: 3,
      });

      // Convert pricequote to invoice
      const convertResult = await wefactRequest("pricequote", "convertToInvoice", {
        PriceQuoteCode: quote.quote_number,
      });

      if (convertResult.status !== "success") {
        throw new Error(convertResult.errors?.[0] || "Offerte kon niet omgezet worden naar factuur");
      }

      const invoiceNumber = convertResult.invoice?.InvoiceCode || null;
      const totalAmount = parseFloat(convertResult.invoice?.AmountIncl) || quote.total_amount;

      if (!invoiceNumber) throw new Error("Factuur aangemaakt maar geen factuurnummer ontvangen");

      // Send the invoice by email
      await wefactRequest("invoice", "sendbyemail", {
        InvoiceCode: invoiceNumber,
      });

      // Update quote status
      await supabase.from("quotes").update({ status: "gefactureerd" }).eq("id", quote.id);

      // Create local invoice record
      await supabase.from("invoices").insert({
        job_id,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        status: "verstuurd",
        sent_at: new Date().toISOString(),
      });

      await supabase.from("jobs").update({ status: "gefactureerd" }).eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, invoice_number: invoiceNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    console.error("WeFact function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
