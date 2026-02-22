import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brand colors
const BRAND = {
  primary: [41, 98, 255] as number[],      // Vibrant blue
  primaryDark: [30, 70, 200] as number[],
  dark: [28, 35, 51] as number[],
  gray: [100, 110, 130] as number[],
  lightGray: [230, 233, 240] as number[],
  white: [255, 255, 255] as number[],
  accent: [0, 184, 148] as number[],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { delivery_id } = await req.json();
    if (!delivery_id) {
      return new Response(JSON.stringify({ error: "delivery_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all data in parallel
    const [deliveryRes, settingRes] = await Promise.all([
      supabase.from("deliveries").select("*, jobs(*, customers(*))").eq("id", delivery_id).single(),
      supabase.from("settings").select("value").eq("key", "company_info").single(),
    ]);

    if (deliveryRes.error || !deliveryRes.data) {
      return new Response(JSON.stringify({ error: "Delivery not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const delivery = deliveryRes.data;
    const job = delivery.jobs;
    const customer = job?.customers;
    const companyInfo = settingRes.data?.value || {};

    const [jobItemsRes, photosRes] = await Promise.all([
      supabase.from("job_items").select("*").eq("job_id", job.id).order("created_at"),
      supabase.from("delivery_photos").select("*").eq("delivery_id", delivery_id).order("created_at"),
    ]);

    const jobItems = jobItemsRes.data || [];
    const photos = photosRes.data || [];

    // Fetch company logo
    let logoBase64: string | null = null;
    try {
      const { data: logoList } = await supabase.storage.from("company-assets").list("", { limit: 10 });
      const logoFile = logoList?.find((f: any) => f.name.toLowerCase().startsWith("logo"));
      if (logoFile) {
        const { data: logoData } = await supabase.storage.from("company-assets").download(logoFile.name);
        if (logoData) {
          const buf = await logoData.arrayBuffer();
          const u8 = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
          const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          logoBase64 = `data:${mime};base64,${btoa(bin)}`;
        }
      }
    } catch { /* no logo */ }

    // ─── PDF Setup ───
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ─── Helpers ───
    const setColor = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
    const setFill = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
    const setDraw = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

    const text = (t: string, x: number, _y: number, size: number, style = "normal", color = BRAND.dark) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      setColor(color);
      doc.text(t, x, _y);
    };

    const drawBrandBar = (_y: number, height: number, color = BRAND.primary) => {
      setFill(color);
      doc.rect(0, _y, pageW, height, "F");
    };

    const drawSectionHeader = (title: string, _y: number): number => {
      // Colored bar with white text
      setFill(BRAND.primary);
      doc.roundedRect(margin, _y, contentW, 9, 2, 2, "F");
      text(title.toUpperCase(), margin + 4, _y + 6.5, 10, "bold", BRAND.white);
      return _y + 13;
    };

    const drawRoomHeader = (title: string, _y: number): number => {
      // Lighter accent bar
      setFill(BRAND.lightGray);
      doc.roundedRect(margin, _y, contentW, 8, 1.5, 1.5, "F");
      // Small colored left accent
      setFill(BRAND.primary);
      doc.rect(margin, _y, 3, 8, "F");
      text(title, margin + 6, _y + 5.8, 9.5, "bold", BRAND.dark);
      return _y + 11;
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = margin;
      }
    };

    // ─── PAGE 1: Header band ───
    drawBrandBar(0, 50, BRAND.primary);

    // Logo in header
    let logoEndX = margin;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", margin, 8, 34, 17);
        logoEndX = margin + 38;
      } catch {
        logoEndX = margin;
      }
    }

    // Company name in header band
    const companyName = (companyInfo as any).name || "Bedrijf";
    text(companyName, logoEndX, 20, 18, "bold", BRAND.white);

    // Company details in header (smaller, under name)
    const companySubLines = [
      (companyInfo as any).address,
      [(companyInfo as any).postal_code, (companyInfo as any).city].filter(Boolean).join(" "),
      (companyInfo as any).phone,
      (companyInfo as any).email,
    ].filter(Boolean);
    let headerY = 26;
    companySubLines.forEach((line: string) => {
      text(line, logoEndX, headerY, 8, "normal", [200, 215, 255]);
      headerY += 3.5;
    });

    // Thin accent line under header
    setFill(BRAND.accent);
    doc.rect(0, 50, pageW, 1.5, "F");

    // ─── Document Title ───
    y = 60;
    text("OPLEVERINGSRAPPORT", margin, y, 20, "bold", BRAND.dark);
    y += 8;

    // Job title
    text(job.title || "Klus", margin, y, 13, "bold", BRAND.primary);
    y += 7;

    // Date
    if (job.scheduled_date) {
      const d = new Date(job.scheduled_date);
      const dateStr = d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
      let fullDate = `Uitvoeringsdatum: ${dateStr}`;
      if (job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date) {
        const d2 = new Date(job.scheduled_end_date);
        fullDate = `Uitvoeringsperiode: ${dateStr} — ${d2.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`;
      }
      text(fullDate, margin, y, 9, "normal", BRAND.gray);
      y += 5;
    }

    // Divider
    y += 3;
    setDraw(BRAND.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // ─── Customer Info Card ───
    y = drawSectionHeader("Klantgegevens", y);

    const custLines = [
      customer?.name,
      customer?.address,
      [customer?.postal_code, customer?.city].filter(Boolean).join(" "),
      customer?.phone,
      customer?.email,
    ].filter(Boolean);
    custLines.forEach((line: string) => {
      text(line, margin + 2, y, 10, "normal", BRAND.dark);
      y += 5;
    });
    y += 4;

    // Work address if different
    if (job.work_address) {
      y = drawSectionHeader("Werkadres", y);
      const workLines = [
        job.work_address,
        [job.work_postal_code, job.work_city].filter(Boolean).join(" "),
      ].filter(Boolean);
      workLines.forEach((line: string) => {
        text(line, margin + 2, y, 10, "normal", BRAND.dark);
        y += 5;
      });
      y += 4;
    }

    // ─── Items per room ───
    if (jobItems.length > 0) {
      checkPageBreak(20);
      y = drawSectionHeader("Uitgevoerde werkzaamheden", y);

      const roomGroups: Record<string, any[]> = {};
      jobItems.forEach((item: any) => {
        const room = item.room_name || "Overig";
        if (!roomGroups[room]) roomGroups[room] = [];
        roomGroups[room].push(item);
      });

      Object.entries(roomGroups).forEach(([roomName, items]) => {
        checkPageBreak(15 + items.length * 6);
        y = drawRoomHeader(roomName, y);

        items.forEach((item: any) => {
          checkPageBreak(7);
          // Bullet
          setFill(BRAND.primary);
          doc.circle(margin + 5, y - 1.2, 1, "F");
          text(item.description, margin + 9, y, 9.5, "normal", BRAND.dark);
          y += 5.5;
        });
        y += 3;
      });
    }

    // ─── KVK / BTW footer on page 1 ───
    const kvkBtw = [
      (companyInfo as any).kvk ? `KvK: ${(companyInfo as any).kvk}` : null,
      (companyInfo as any).btw ? `BTW: ${(companyInfo as any).btw}` : null,
    ].filter(Boolean).join("  |  ");
    if (kvkBtw) {
      // Footer bar
      setFill([245, 247, 250]);
      doc.rect(0, pageH - 15, pageW, 15, "F");
      text(kvkBtw, pageW / 2, pageH - 6, 7.5, "normal", BRAND.gray);
      // Center the text
      const tw = doc.getTextWidth(kvkBtw);
      doc.text(kvkBtw, (pageW - tw) / 2, pageH - 6);
    }

    // ─── PHOTO PAGES ───
    if (photos.length > 0) {
      const itemRoomMap: Record<string, string> = {};
      jobItems.forEach((item: any) => {
        itemRoomMap[item.id] = item.room_name || "Overig";
      });

      for (const photo of photos) {
        doc.addPage();

        // Top brand bar on photo pages
        drawBrandBar(0, 12, BRAND.primary);
        const roomName = photo.job_item_id && itemRoomMap[photo.job_item_id]
          ? itemRoomMap[photo.job_item_id]
          : photo.description || "Foto";
        text(roomName.toUpperCase(), margin, 8.5, 11, "bold", BRAND.white);

        // Company name small in top right
        const cNameW = doc.getTextWidth(companyName);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        setColor([200, 215, 255]);
        doc.text(companyName, pageW - margin - doc.getTextWidth(companyName), 8, { align: "left" });

        // Accent line
        setFill(BRAND.accent);
        doc.rect(0, 12, pageW, 1, "F");

        y = 18;

        // Download and embed photo
        try {
          const response = await fetch(photo.photo_url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);

            const url = photo.photo_url.toLowerCase();
            const imgFormat = url.includes(".png") ? "PNG" : "JPEG";
            const imgData = `data:image/${imgFormat.toLowerCase()};base64,${btoa(binary)}`;

            // Photo with border/shadow effect
            const imgW = contentW;
            const imgH = 240;
            const imgX = margin;
            const imgY = y;

            // Shadow
            setFill([220, 225, 235]);
            doc.rect(imgX + 1.5, imgY + 1.5, imgW, imgH, "F");
            // Border
            setFill(BRAND.white);
            doc.rect(imgX, imgY, imgW, imgH, "F");
            setDraw(BRAND.lightGray);
            doc.setLineWidth(0.3);
            doc.rect(imgX, imgY, imgW, imgH, "S");

            doc.addImage(imgData, imgFormat, imgX + 2, imgY + 2, imgW - 4, imgH - 4);
          }
        } catch {
          text("Foto kon niet worden geladen", margin, y + 10, 10, "normal", [200, 60, 60]);
        }

        // Page footer bar
        setFill([245, 247, 250]);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setFontSize(7);
        setColor(BRAND.gray);
        doc.text(companyName, pageW / 2 - doc.getTextWidth(companyName) / 2, pageH - 4);
      }
    }

    // ─── Upload PDF ───
    const pdfOutput = doc.output("arraybuffer");
    const pdfBuffer = new Uint8Array(pdfOutput);
    const fileName = `delivery-${delivery_id}-${Date.now()}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("delivery-pdfs")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF: " + uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = supabase.storage.from("delivery-pdfs").getPublicUrl(fileName);
    const pdfUrl = urlData.publicUrl;

    await supabase
      .from("deliveries")
      .update({ pdf_url: pdfUrl, status: "afgerond", completed_at: new Date().toISOString() })
      .eq("id", delivery_id);

    return new Response(JSON.stringify({ pdf_url: pdfUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
