import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Fetch delivery with job and customer
    const { data: delivery, error: delErr } = await supabase
      .from("deliveries")
      .select("*, jobs(*, customers(*))")
      .eq("id", delivery_id)
      .single();
    if (delErr || !delivery) {
      return new Response(JSON.stringify({ error: "Delivery not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = delivery.jobs;
    const customer = job?.customers;

    // Fetch job items grouped by room
    const { data: jobItems } = await supabase
      .from("job_items")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at");

    // Fetch delivery photos
    const { data: photos } = await supabase
      .from("delivery_photos")
      .select("*")
      .eq("delivery_id", delivery_id)
      .order("created_at");

    // Fetch company info
    const { data: settingRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "company_info")
      .single();
    const companyInfo = settingRow?.value || {};

    // Try to fetch company logo
    let logoBase64: string | null = null;
    try {
      const { data: logoList } = await supabase.storage
        .from("company-assets")
        .list("", { limit: 10 });
      const logoFile = logoList?.find((f: any) =>
        f.name.toLowerCase().startsWith("logo")
      );
      if (logoFile) {
        const { data: logoData } = await supabase.storage
          .from("company-assets")
          .download(logoFile.name);
        if (logoData) {
          const arrayBuffer = await logoData.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
          const mimeType =
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          logoBase64 = `data:${mimeType};base64,${btoa(binary)}`;
        }
      }
    } catch {
      // No logo available, continue without
    }

    // ─── Generate PDF ───
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Helper
    const addText = (
      text: string,
      x: number,
      _y: number,
      size: number,
      style: string = "normal",
      color: number[] = [0, 0, 0]
    ) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, x, _y);
    };

    // ─── PAGE 1: Overview ───

    // Company logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", margin, y, 40, 20);
        y += 25;
      } catch {
        y += 5;
      }
    }

    // Company info
    const companyName = companyInfo.name || "Bedrijf";
    addText(companyName, margin, y, 16, "bold");
    y += 6;
    const companyLines = [
      companyInfo.address,
      [companyInfo.postal_code, companyInfo.city].filter(Boolean).join(" "),
      companyInfo.phone,
      companyInfo.email,
      companyInfo.kvk ? `KvK: ${companyInfo.kvk}` : null,
      companyInfo.btw ? `BTW: ${companyInfo.btw}` : null,
    ].filter(Boolean);
    companyLines.forEach((line: string) => {
      addText(line, margin, y, 9, "normal", [100, 100, 100]);
      y += 4;
    });

    y += 8;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Title
    addText("Opleveringsrapport", margin, y, 18, "bold");
    y += 10;

    // Job title
    addText(job.title || "Klus", margin, y, 13, "bold");
    y += 7;

    // Date
    if (job.scheduled_date) {
      const d = new Date(job.scheduled_date);
      addText(
        `Uitvoeringsdatum: ${d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`,
        margin,
        y,
        10,
        "normal",
        [80, 80, 80]
      );
      y += 6;
    }

    y += 4;

    // Customer info
    addText("Klantgegevens", margin, y, 12, "bold");
    y += 6;
    const custLines = [
      customer?.name,
      customer?.address,
      [customer?.postal_code, customer?.city].filter(Boolean).join(" "),
      customer?.phone,
      customer?.email,
    ].filter(Boolean);
    custLines.forEach((line: string) => {
      addText(line, margin, y, 10, "normal", [60, 60, 60]);
      y += 5;
    });

    y += 6;

    // Work address if different
    if (job.work_address) {
      addText("Werkadres", margin, y, 12, "bold");
      y += 6;
      const workLines = [
        job.work_address,
        [job.work_postal_code, job.work_city].filter(Boolean).join(" "),
      ].filter(Boolean);
      workLines.forEach((line: string) => {
        addText(line, margin, y, 10, "normal", [60, 60, 60]);
        y += 5;
      });
      y += 6;
    }

    // Items per room
    if (jobItems && jobItems.length > 0) {
      addText("Uitgevoerde werkzaamheden", margin, y, 12, "bold");
      y += 7;

      const roomGroups: Record<string, any[]> = {};
      jobItems.forEach((item: any) => {
        const room = item.room_name || "Overig";
        if (!roomGroups[room]) roomGroups[room] = [];
        roomGroups[room].push(item);
      });

      Object.entries(roomGroups).forEach(([roomName, items]) => {
        if (y > 260) {
          doc.addPage();
          y = margin;
        }
        addText(roomName, margin, y, 11, "bold", [40, 40, 40]);
        y += 5;
        items.forEach((item: any) => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          addText(`• ${item.description}`, margin + 4, y, 10, "normal", [60, 60, 60]);
          y += 5;
        });
        y += 3;
      });
    }

    // ─── PHOTO PAGES ───
    if (photos && photos.length > 0) {
      // Group photos by room (via job_item_id -> room_name mapping)
      const itemRoomMap: Record<string, string> = {};
      jobItems?.forEach((item: any) => {
        itemRoomMap[item.id] = item.room_name || "Overig";
      });

      for (const photo of photos) {
        doc.addPage();
        y = margin;

        const roomName =
          photo.job_item_id && itemRoomMap[photo.job_item_id]
            ? itemRoomMap[photo.job_item_id]
            : photo.description || "Foto";

        addText(roomName, margin, y, 14, "bold");
        y += 10;

        // Download and embed photo
        try {
          const response = await fetch(photo.photo_url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }

            const url = photo.photo_url.toLowerCase();
            const imgFormat = url.includes(".png") ? "PNG" : "JPEG";
            const imgData = `data:image/${imgFormat.toLowerCase()};base64,${btoa(binary)}`;

            // Calculate dimensions to fit page
            const maxW = contentW;
            const maxH = 230;
            doc.addImage(imgData, imgFormat, margin, y, maxW, maxH);
          }
        } catch {
          addText("Foto kon niet worden geladen", margin, y, 10, "normal", [150, 50, 50]);
        }
      }
    }

    // Generate PDF buffer
    const pdfOutput = doc.output("arraybuffer");
    const pdfBuffer = new Uint8Array(pdfOutput);

    // Upload to storage
    const fileName = `delivery-${delivery_id}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("delivery-pdfs")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF: " + uploadErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("delivery-pdfs")
      .getPublicUrl(fileName);
    const pdfUrl = urlData.publicUrl;

    // Save URL to delivery
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
