import { useState, useEffect, useCallback } from "react";

import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, User, Briefcase, Pencil, Save, X, Search, Loader2, Phone, Navigation, Trash2, DoorOpen, Camera, FileText, Receipt, Send, CheckCircle, ClipboardCheck, Upload, Download, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval } from "date-fns";
import { nl } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { Job, JobItem, Profile, Delivery, DeliveryPhoto } from "@/types/database";

const statusLabels: Record<string, string> = {
  nieuw: "Nieuw", offerte_verstuurd: "Offerte verstuurd", offerte_geaccepteerd: "Offerte geaccepteerd",
  offerte_geweigerd: "Offerte geweigerd", in_uitvoering: "In uitvoering",
  oplevering: "Oplevering", gefactureerd: "Gefactureerd", afgerond: "Afgerond",
};

const KlusDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [roomPhotos, setRoomPhotos] = useState<{ id: string; room_name: string; photo_url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [wefactLoading, setWefactLoading] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);

  // Workflow state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedRange, setSchedRange] = useState<DateRange | undefined>();
  const [schedTime, setSchedTime] = useState("");
  const [schedAssignee, setSchedAssignee] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);

  // Delivery state
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<DeliveryPhoto[]>([]);
  const [uploadingRoom, setUploadingRoom] = useState<string | null>(null);
  const [completingDelivery, setCompletingDelivery] = useState(false);

  // Extra sales state
  const [extraSales, setExtraSales] = useState<any[]>([]);
  const [newExtraDesc, setNewExtraDesc] = useState("");
  const [newExtraAmount, setNewExtraAmount] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);

  // Invoice preview dialog state
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<{ description: string; quantity: number; price: number }[]>([]);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState<Date | undefined>();
  const [editIsDirect, setEditIsDirect] = useState(false);
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editExtraCosts, setEditExtraCosts] = useState(0);
  const [editExtraCostsDesc, setEditExtraCostsDesc] = useState("");

  // Address lookup
  const [huisnummer, setHuisnummer] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const fetchJob = async () => {
    const [{ data: j }, { data: ji }, { data: p }, { data: rp }, { data: q }, { data: inv }, { data: del }, { data: es }] = await Promise.all([
      supabase.from("jobs").select("*, customers(*)").eq("id", id!).single(),
      supabase.from("job_items").select("*, products(*)").eq("job_id", id!),
      supabase.from("profiles").select("*").eq("is_active", true),
      supabase.from("job_room_photos").select("*").eq("job_id", id!),
      supabase.from("quotes").select("*").eq("job_id", id!).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("job_id", id!).order("created_at", { ascending: false }),
      supabase.from("deliveries").select("*").eq("job_id", id!).order("created_at", { ascending: false }).limit(1),
      supabase.from("extra_sales").select("*").eq("job_id", id!).order("created_at"),
    ]);
    setJob(j as Job);
    setItems((ji as JobItem[]) || []);
    setRoomPhotos((rp as any[]) || []);
    setProfiles((p as Profile[]) || []);
    setQuotes(q || []);
    setInvoicesData(inv || []);
    setExtraSales(es || []);

    const deliveryRecord = del && del.length > 0 ? (del[0] as Delivery) : null;
    setDelivery(deliveryRecord);

    if (deliveryRecord) {
      const { data: dp } = await supabase
        .from("delivery_photos")
        .select("*")
        .eq("delivery_id", deliveryRecord.id)
        .order("created_at");
      setDeliveryPhotos((dp as DeliveryPhoto[]) || []);
    } else {
      setDeliveryPhotos([]);
    }

    setLoading(false);
  };

  useEffect(() => { if (id) fetchJob(); }, [id]);

  const startEditing = () => {
    if (!job) return;
    setEditTitle(job.title);
    setEditDescription(job.description || "");
    setEditAddress(job.work_address || "");
    setEditPostalCode(job.work_postal_code || "");
    setEditCity(job.work_city || "");
    setEditScheduledDate(job.scheduled_date ? new Date(job.scheduled_date) : undefined);
    setEditIsDirect(job.is_direct);
    setEditAssignedTo(job.assigned_to || "");
    setEditExtraCosts(job.extra_costs || 0);
    setEditExtraCostsDesc(job.extra_costs_description || "");
    setHuisnummer("");
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase.from("jobs").update({
      title: editTitle,
      description: editDescription || null,
      work_address: editAddress || null,
      work_postal_code: editPostalCode || null,
      work_city: editCity || null,
      scheduled_date: editScheduledDate ? format(editScheduledDate, "yyyy-MM-dd") : null,
      is_direct: editIsDirect,
      assigned_to: editAssignedTo || null,
      extra_costs: editExtraCosts,
      extra_costs_description: editExtraCostsDesc || null,
    }).eq("id", id!);
    setSaving(false);
    if (error) {
      toast({ title: "Fout bij opslaan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klus bijgewerkt" });
      setEditing(false);
      fetchJob();
    }
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id!);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else { toast({ title: "Status bijgewerkt" }); fetchJob(); }
  };

  const deleteJob = async () => {
    await supabase.from("job_items").delete().eq("job_id", id!);
    await supabase.from("extra_sales").delete().eq("job_id", id!);
    const { error } = await supabase.from("jobs").delete().eq("id", id!);
    if (error) {
      toast({ title: "Fout bij verwijderen", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klus verwijderd" });
      navigate("/admin/klussen");
    }
  };

  const lookupAddress = useCallback(async (postcode: string, nr: string) => {
    if (!postcode || postcode.replace(/\s/g, "").length < 6 || !nr) return;
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-address", {
        body: { postcode: postcode.replace(/\s/g, ""), huisnummer: nr },
      });
      if (error) throw error;
      if (data?.straat) {
        setEditAddress(`${data.straat} ${nr}`);
        if (data.stad) setEditCity(data.stad);
      } else if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
    setLookingUp(false);
  }, [toast]);

  useEffect(() => {
    if (!editing) return;
    const cleanPostcode = editPostalCode.replace(/\s/g, "");
    if (cleanPostcode.length >= 6 && huisnummer.length >= 1) {
      const timer = setTimeout(() => lookupAddress(editPostalCode, huisnummer), 600);
      return () => clearTimeout(timer);
    }
  }, [editPostalCode, huisnummer, editing, lookupAddress]);

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  const handleWefactAction = async (action: string) => {
    setWefactLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("wefact", {
        body: { action, job_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const messages: Record<string, string> = {
        create_quote: `Offerte ${data.quote_number || ""} aangemaakt in WeFact`,
        send_quote: "Offerte verstuurd via WeFact",
        create_invoice: `Factuur ${data.invoice_number || ""} aangemaakt in WeFact`,
        send_invoice: "Factuur verstuurd via WeFact",
        check_payment: data.is_paid ? "Factuur is betaald! ✅" : "Factuur is nog niet betaald",
        convert_quote_to_invoice: `Concept factuur ${data.invoice_number || ""} aangemaakt`,
        convert_quote_and_send: `Factuur ${data.invoice_number || ""} verstuurd naar klant`,
      };
      toast({ title: messages[action] || "Actie uitgevoerd" });
      fetchJob();
    } catch (e: any) {
      toast({ title: "WeFact fout", description: e.message, variant: "destructive" });
    }
    setWefactLoading(null);
  };

  const getProfileName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || "Onbekend";
  };

  const getFullAddress = () => {
    return [job?.work_address, job?.work_postal_code, job?.work_city].filter(Boolean).join(", ");
  };

  // ─── WORKFLOW ACTIONS ───
  const handleSchedule = async () => {
    if (!schedRange?.from) {
      toast({ title: "Kies minimaal één datum", variant: "destructive" });
      return;
    }
    setSchedSaving(true);
    const startDate = format(schedRange.from, "yyyy-MM-dd");
    const endDate = schedRange.to ? format(schedRange.to, "yyyy-MM-dd") : null;
    const { error } = await supabase.from("jobs").update({
      scheduled_date: startDate,
      scheduled_end_date: endDate,
      scheduled_time: schedTime || null,
      assigned_to: schedAssignee || null,
      status: "in_uitvoering",
    }).eq("id", id!);
    setSchedSaving(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klus ingepland en status bijgewerkt" });
      setShowScheduleDialog(false);
      fetchJob();
    }
  };

  const startDelivery = async () => {
    const { data, error } = await supabase.from("deliveries").insert({
      job_id: id!,
      status: "concept",
    }).select().single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("jobs").update({ status: "oplevering" }).eq("id", id!);
    toast({ title: "Oplevering gestart" });
    fetchJob();
  };

  const handlePhotoUpload = async (roomName: string, files: FileList) => {
    if (!delivery || files.length === 0) return;
    setUploadingRoom(roomName);

    const roomItem = items.find(i => (i as any).room_name === roomName || (!(i as any).room_name && roomName === "Overig"));

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${delivery.id}/${roomName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("delivery-photos")
        .upload(filePath, file, { contentType: file.type });

      if (uploadErr) {
        toast({ title: "Upload fout", description: uploadErr.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("delivery-photos")
        .getPublicUrl(filePath);

      await supabase.from("delivery_photos").insert({
        delivery_id: delivery.id,
        job_item_id: roomItem?.id || null,
        photo_url: urlData.publicUrl,
        description: roomName,
      });
    }

    const { data: dp } = await supabase
      .from("delivery_photos")
      .select("*")
      .eq("delivery_id", delivery.id)
      .order("created_at");
    setDeliveryPhotos((dp as DeliveryPhoto[]) || []);
    setUploadingRoom(null);
  };

  const deleteDeliveryPhoto = async (photoId: string) => {
    await supabase.from("delivery_photos").delete().eq("id", photoId);
    setDeliveryPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const completeDelivery = async () => {
    if (!delivery) return;
    setCompletingDelivery(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-delivery-pdf", {
        body: { delivery_id: delivery.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase.from("jobs").update({ status: "in_uitvoering" }).eq("id", id!);

      toast({ title: "Oplevering voltooid! PDF is gegenereerd." });
      fetchJob();
    } catch (e: any) {
      toast({ title: "Fout bij voltooien", description: e.message, variant: "destructive" });
    }
    setCompletingDelivery(false);
  };

  // ─── EXTRA SALES ───
  const addExtraSale = async () => {
    if (!newExtraDesc.trim() || !newExtraAmount) return;
    setAddingExtra(true);
    const { error } = await supabase.from("extra_sales").insert({
      job_id: id!,
      description: newExtraDesc.trim(),
      amount: Number(newExtraAmount),
    });
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      setNewExtraDesc("");
      setNewExtraAmount("");
      fetchJob();
    }
    setAddingExtra(false);
  };

  const updateExtraSale = async (esId: string, field: string, value: string | number) => {
    const { error } = await supabase.from("extra_sales").update({ [field]: value }).eq("id", esId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else {
      setExtraSales(prev => prev.map(es => es.id === esId ? { ...es, [field]: value } : es));
    }
  };

  const deleteExtraSale = async (esId: string) => {
    await supabase.from("extra_sales").delete().eq("id", esId);
    setExtraSales(prev => prev.filter(es => es.id !== esId));
  };

  // ─── INVOICE PREVIEW ───
  const buildInvoiceLines = () => {
    const lines: { description: string; quantity: number; price: number }[] = [];

    // Group items by room
    const roomGroups: Record<string, JobItem[]> = {};
    items.forEach(item => {
      const room = (item as any).room_name || "Overig";
      if (!roomGroups[room]) roomGroups[room] = [];
      roomGroups[room].push(item);
    });
    const roomNames = Object.keys(roomGroups);
    const hasRooms = roomNames.length > 1 || (roomNames.length === 1 && roomNames[0] !== "Overig");

    if (job?.job_type === "ontruiming" && job.custom_price) {
      lines.push({ description: "Ontruiming", quantity: 1, price: job.custom_price });
    } else if (hasRooms) {
      roomNames.forEach(roomName => {
        roomGroups[roomName].forEach(item => {
          lines.push({ description: `${roomName} — ${item.description}`, quantity: item.quantity, price: item.unit_price });
        });
      });
    } else {
      items.forEach(item => {
        lines.push({ description: item.description, quantity: item.quantity, price: item.unit_price });
      });
    }

    if (job && job.travel_cost > 0) {
      lines.push({ description: `Voorrijkosten (${job.travel_distance_km || 0} km)`, quantity: 1, price: job.travel_cost });
    }
    if (job && (job.extra_costs || 0) > 0) {
      lines.push({ description: job.extra_costs_description || "Overige kosten", quantity: 1, price: job.extra_costs || 0 });
    }

    // Extra sales
    extraSales.forEach(es => {
      lines.push({ description: `Bijverkoop: ${es.description}`, quantity: 1, price: Number(es.amount) });
    });

    // Discount
    if (job && job.discount_value && job.discount_value > 0) {
      const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
      const discountAmount = job.discount_type === "percentage"
        ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
        : job.discount_value;
      if (discountAmount > 0) {
        lines.push({ description: `Korting${job.discount_type === "percentage" ? ` (${job.discount_value}%)` : ""}`, quantity: 1, price: -discountAmount });
      }
    }

    return lines;
  };

  const openInvoicePreview = () => {
    setInvoiceLines(buildInvoiceLines());
    setShowInvoicePreview(true);
  };

  const updateInvoiceLine = (index: number, field: "description" | "quantity" | "price", value: string | number) => {
    setInvoiceLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const removeInvoiceLine = (index: number) => {
    setInvoiceLines(prev => prev.filter((_, i) => i !== index));
  };

  const addInvoiceLine = () => {
    setInvoiceLines(prev => [...prev, { description: "", quantity: 1, price: 0 }]);
  };

  const confirmCreateInvoice = async () => {
    // We pass the custom lines to a modified wefact action
    setShowInvoicePreview(false);
    setWefactLoading("create_invoice");
    try {
      const { data, error } = await supabase.functions.invoke("wefact", {
        body: { action: "create_invoice_custom", job_id: id, lines: invoiceLines },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Factuur ${data.invoice_number || ""} aangemaakt in WeFact` });
      fetchJob();
    } catch (e: any) {
      toast({ title: "WeFact fout", description: e.message, variant: "destructive" });
    }
    setWefactLoading(null);
  };

  const getRoomNames = (): string[] => {
    const rooms = new Set<string>();
    items.forEach(item => {
      rooms.add((item as any).room_name || "Overig");
    });
    return Array.from(rooms);
  };

  const allRoomsHavePhotos = (): boolean => {
    const rooms = getRoomNames();
    if (rooms.length === 0) return deliveryPhotos.length > 0;
    return rooms.every(room =>
      deliveryPhotos.some(p => p.description === room)
    );
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;
  if (!job) return <p className="text-center py-12 text-muted-foreground">Klus niet gevonden.</p>;

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
  const discount = job.discount_type === "percentage"
    ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
    : job.discount_type === "fixed" ? job.discount_value : 0;
  const extraSalesTotal = extraSales.reduce((s, es) => s + Number(es.amount), 0);
  const surchargePercentage = (job as any).surcharge_percentage || 0;
  const beforeSurcharge = subtotal + job.travel_cost + (job.extra_costs || 0) + extraSalesTotal - discount;
  const surchargeAmount = beforeSurcharge * (surchargePercentage / 100);
  const total = beforeSurcharge + surchargeAmount;
  const fullAddress = getFullAddress();

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => navigate("/admin/klussen")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-bold" />
          ) : (
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{job.title}</h1>
          )}
          <p className="text-sm text-muted-foreground truncate">{job.customers?.name}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}><X className="h-4 w-4" /></Button>
              <Button size="sm" onClick={saveChanges} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Opslaan</span>
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Bewerken</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">Verwijderen</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Klus verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je deze klus wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteJob} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Quick action cards: Bellen & Route */}
      {!editing && (job.customers?.phone || fullAddress) && (
        <div className="grid grid-cols-2 gap-3">
          {job.customers?.phone && (
            <a href={`tel:${job.customers.phone}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 bg-primary/5">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Bellen</p>
                    <p className="text-xs text-muted-foreground truncate">{job.customers.phone}</p>
                  </div>
                </CardContent>
              </Card>
            </a>
          )}
          {fullAddress && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20 bg-primary/5">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Navigation className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Route</p>
                    <p className="text-xs text-muted-foreground truncate">{job.work_city || job.work_address}</p>
                  </div>
                </CardContent>
              </Card>
            </a>
          )}
        </div>
      )}

      {/* Workflow Action Buttons */}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          {(job.status === "offerte_verstuurd" || job.status === "offerte_geaccepteerd") && (
            <Button onClick={() => {
              const from = job.scheduled_date ? new Date(job.scheduled_date) : undefined;
              const to = (job as any).scheduled_end_date ? new Date((job as any).scheduled_end_date) : undefined;
              setSchedRange(from ? { from, to } : undefined);
              setSchedTime(job.scheduled_time || "");
              setSchedAssignee(job.assigned_to || "");
              setShowScheduleDialog(true);
            }} className="gap-1.5">
              <CalendarIcon className="h-4 w-4" /> Inplannen
            </Button>
          )}
          {(job.status === "in_uitvoering" || (job.is_direct && !["oplevering", "gefactureerd", "afgerond"].includes(job.status))) && !delivery && (
            <Button onClick={startDelivery} className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" /> Oplevering starten
            </Button>
          )}
          {delivery && delivery.status === "afgerond" && delivery.pdf_url && (
            <Button variant="outline" asChild className="gap-1.5">
              <a href={delivery.pdf_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> PDF downloaden
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Status selector */}
      {(() => {
        const statusColors: Record<string, string> = {
          nieuw: "bg-muted text-muted-foreground",
          offerte_verstuurd: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
          offerte_geaccepteerd: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
          offerte_geweigerd: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
          in_uitvoering: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
          oplevering: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
          gefactureerd: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
          afgerond: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300",
        };
        return (
          <Select value={job.status} onValueChange={updateStatus}>
            <SelectTrigger className={cn("w-full sm:w-56 font-medium text-xs rounded-full h-8", statusColors[job.status] || "")}>
              <SelectValue>{statusLabels[job.status] || job.status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      })()}

      {/* ═══ DELIVERY SECTION — shown at the top when active ═══ */}
      {delivery && delivery.status === "concept" && !editing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Oplevering
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
            {/* Room photo uploads */}
            {getRoomNames().map(roomName => {
              const roomDeliveryPhotos = deliveryPhotos.filter(p => p.description === roomName);
              return (
                <div key={roomName} className="border rounded-xl p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-primary" /> {roomName}
                    </p>
                    <Badge variant={roomDeliveryPhotos.length > 0 ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${roomDeliveryPhotos.length > 0 ? "bg-emerald-100 text-emerald-700" : ""}`}>
                      {roomDeliveryPhotos.length} foto{roomDeliveryPhotos.length !== 1 ? "'s" : ""}
                    </Badge>
                  </div>

                  {roomDeliveryPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {roomDeliveryPhotos.map(photo => (
                        <div key={photo.id} className="relative group">
                          <a href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden aspect-square border block hover:opacity-80 transition-opacity">
                            <img src={photo.photo_url} alt={`${roomName} oplevering`} className="w-full h-full object-cover" />
                          </a>
                          <button
                            onClick={() => deleteDeliveryPhoto(photo.id)}
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                    {uploadingRoom === roomName ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Foto's uploaden
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handlePhotoUpload(roomName, e.target.files)}
                      disabled={uploadingRoom === roomName}
                    />
                  </label>
                </div>
              );
            })}

            {/* Extra diensten / werkzaamheden */}
            <div className="border rounded-xl p-3 space-y-3 bg-card">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" /> Extra werkzaamheden / bijverkoop
              </p>

              {extraSales.length > 0 && (
                <div className="space-y-2">
                  {extraSales.map(es => (
                    <div key={es.id} className="flex items-center gap-2">
                      <Input
                        value={es.description}
                        onChange={(e) => updateExtraSale(es.id, "description", e.target.value)}
                        onBlur={() => {}} 
                        className="h-8 text-xs flex-1"
                        placeholder="Omschrijving"
                      />
                      <Input
                        type="number"
                        value={es.amount}
                        onChange={(e) => updateExtraSale(es.id, "amount", Number(e.target.value))}
                        className="h-8 text-xs w-24"
                        placeholder="Bedrag"
                      />
                      <button onClick={() => deleteExtraSale(es.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={newExtraDesc}
                  onChange={(e) => setNewExtraDesc(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="Bijv. Extra schoonmaak"
                />
                <Input
                  type="number"
                  value={newExtraAmount}
                  onChange={(e) => setNewExtraAmount(e.target.value)}
                  className="h-8 text-xs w-24"
                  placeholder="€ bedrag"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addExtraSale} disabled={addingExtra || !newExtraDesc.trim()}>
                  {addingExtra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Complete delivery button */}
            <Button
              onClick={completeDelivery}
              disabled={!allRoomsHavePhotos() || completingDelivery}
              className="w-full gap-1.5"
            >
              {completingDelivery ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Oplevering voltooien
            </Button>
            {!allRoomsHavePhotos() && (
              <p className="text-[11px] text-muted-foreground text-center">
                Upload minimaal 1 foto per kamer om de oplevering te voltooien
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Klantgegevens</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> <span className="truncate">{job.customers?.name}</span></div>
            {job.customers?.email && <p className="text-xs text-muted-foreground ml-5 truncate">{job.customers.email}</p>}
            {job.customers?.phone && <p className="text-xs text-muted-foreground ml-5">{job.customers.phone}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Planning & Toewijzing</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge variant="secondary" className="capitalize text-xs">{job.job_type}</Badge>
              {(job as any).housing_type && (
                <Badge variant="outline" className="capitalize text-xs">{(job as any).housing_type}</Badge>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Datum</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !editScheduledDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {editScheduledDate ? format(editScheduledDate, "d MMMM yyyy", { locale: nl }) : "Kies een datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editScheduledDate} onSelect={setEditScheduledDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Toegewezen aan</Label>
                  <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Kies medewerker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || "Onbekend"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs">
                    {job.is_direct ? "Direct uitvoeren" : job.scheduled_date ? (
                      <>
                        {new Date(job.scheduled_date).toLocaleDateString("nl-NL")}
                        {(job as any).scheduled_end_date && (job as any).scheduled_end_date !== job.scheduled_date && (
                          <> — {new Date((job as any).scheduled_end_date).toLocaleDateString("nl-NL")}</>
                        )}
                      </>
                    ) : "Niet gepland"}
                  </span>
                </div>
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 ml-5">
                    <span className="text-xs text-muted-foreground">{job.scheduled_time}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs">
                    {job.assigned_to ? getProfileName(job.assigned_to) : <span className="text-muted-foreground italic">Niet toegewezen</span>}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Address card */}
      {(editing || job.work_address) && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Werkadres</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 text-sm">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Postcode</Label>
                    <Input value={editPostalCode} onChange={(e) => setEditPostalCode(e.target.value.toUpperCase())} placeholder="1234AB" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Huisnummer</Label>
                    <div className="flex gap-2">
                      <Input value={huisnummer} onChange={(e) => setHuisnummer(e.target.value)} placeholder="12a" className="h-9 text-sm flex-1" />
                      {lookingUp && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Adres</Label>
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Straat en huisnummer" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Plaats</Label>
                  <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="Stad" className="h-9 text-sm" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs">{fullAddress}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {(editing || job.description) && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Omschrijving</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            {editing ? (
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Omschrijving van de klus..." className="text-sm min-h-[80px]" />
            ) : (
              <p className="text-sm text-muted-foreground">{job.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products/Items grouped by room */}
      {items.length > 0 && (() => {
        const roomGroups: Record<string, JobItem[]> = {};
        items.forEach(item => {
          const room = (item as any).room_name || "Overig";
          if (!roomGroups[room]) roomGroups[room] = [];
          roomGroups[room].push(item);
        });
        const roomNames = Object.keys(roomGroups);
        const hasRooms = roomNames.length > 1 || (roomNames.length === 1 && roomNames[0] !== "Overig");

        return (
          <Card>
            <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Producten / Werkzaamheden</CardTitle></CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
              {hasRooms ? (
                roomNames.map(roomName => {
                  const roomItems = roomGroups[roomName];
                  const roomTotal = roomItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
                  const photos = roomPhotos.filter(p => p.room_name === roomName);

                  return (
                    <div key={roomName} className="border rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <DoorOpen className="h-3.5 w-3.5 text-primary" /> {roomName}
                      </p>
                      {roomItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-1 pl-5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{item.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 mx-2">×{item.quantity}</span>
                          <span className="text-sm font-medium shrink-0">{formatPrice(item.quantity * item.unit_price)}</span>
                        </div>
                      ))}
                      <p className="text-xs font-bold text-right border-t pt-1.5">Subtotaal: {formatPrice(roomTotal)}</p>
                      {photos.length > 0 && (
                        <div>
                          <p className="text-xs font-medium flex items-center gap-1 mb-1.5"><Camera className="h-3 w-3 text-muted-foreground" /> Foto's</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {photos.map(photo => (
                              <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden aspect-square border hover:opacity-80 transition-opacity">
                                <img src={photo.photo_url} alt={`${roomName} foto`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}× {formatPrice(item.unit_price)}</p>
                      </div>
                      <span className="text-sm font-medium shrink-0 ml-3">{formatPrice(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                </div>
              )}
              {!hasRooms && roomPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium flex items-center gap-1 mb-1.5"><Camera className="h-3 w-3 text-muted-foreground" /> Foto's</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {roomPhotos.map(photo => (
                      <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden aspect-square border hover:opacity-80 transition-opacity">
                        <img src={photo.photo_url} alt="Kamer foto" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Extra costs - editing */}
      {editing && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Overige kosten</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Bedrag</Label>
              <Input type="number" value={editExtraCosts} onChange={(e) => setEditExtraCosts(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Omschrijving</Label>
              <Input value={editExtraCostsDesc} onChange={(e) => setEditExtraCostsDesc(e.target.value)} placeholder="Bijv. materiaalkosten" className="h-9 text-sm" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* WeFact Acties */}
      {!editing && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-sm">WeFact</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
            {quotes.length > 0 && (
              <div className="space-y-1">
                {quotes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" /> Offerte {q.quote_number || "—"}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.status}</Badge>
                  </div>
                ))}
              </div>
            )}
            {invoicesData.length > 0 && (
              <div className="space-y-1">
                {invoicesData.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><Receipt className="h-3 w-3 text-muted-foreground" /> Factuur {inv.invoice_number || "—"}</span>
                    <Badge variant={inv.status === "betaald" ? "default" : "secondary"}
                      className={`text-[10px] px-1.5 py-0 ${inv.status === "betaald" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                      {inv.status === "betaald" ? "Betaald" : inv.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {quotes.length === 0 && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleWefactAction("create_quote")} disabled={!!wefactLoading}>
                  {wefactLoading === "create_quote" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                  Offerte aanmaken
                </Button>
              )}
              {quotes.length > 0 && quotes[0].status === "concept" && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleWefactAction("send_quote")} disabled={!!wefactLoading}>
                  {wefactLoading === "send_quote" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Offerte versturen
                </Button>
              )}
              {invoicesData.length === 0 && (
                <Button size="sm" variant="outline" className="text-xs" onClick={openInvoicePreview} disabled={!!wefactLoading}>
                  {wefactLoading === "create_invoice" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Receipt className="h-3 w-3 mr-1" />}
                  Factuur aanmaken
                </Button>
              )}
              {invoicesData.length > 0 && invoicesData[0].status !== "betaald" && invoicesData[0].status !== "verstuurd" && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleWefactAction("send_invoice")} disabled={!!wefactLoading}>
                  {wefactLoading === "send_invoice" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Factuur versturen
                </Button>
              )}
              {invoicesData.length > 0 && invoicesData[0].status !== "betaald" && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleWefactAction("check_payment")} disabled={!!wefactLoading}>
                  {wefactLoading === "check_payment" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  Betaalstatus checken
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost overview */}
      <Card>
        <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Kostenoverzicht</CardTitle></CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Voorrijkosten ({job.travel_distance_km || 0} km)</span><span>{formatPrice(job.travel_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{job.job_type === "ontruiming" ? "Ontruiming" : "Producten"}</span><span>{formatPrice(subtotal)}</span></div>
            {(job.extra_costs || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Overige kosten{job.extra_costs_description ? ` (${job.extra_costs_description})` : ""}</span><span>{formatPrice(job.extra_costs || 0)}</span></div>}
            {extraSalesTotal > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Extra werkzaamheden ({extraSales.length})</span><span>{formatPrice(extraSalesTotal)}</span></div>
            )}
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Korting</span><span>-{formatPrice(discount)}</span></div>}
            {surchargePercentage > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Toeslag ({surchargePercentage}%)</span><span>+{formatPrice(surchargeAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Klus inplannen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Datum(s) * — selecteer startdatum, klik daarna einddatum voor meerdere dagen</Label>
              <Calendar
                mode="range"
                selected={schedRange}
                onSelect={setSchedRange}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto rounded-md border")}
              />
              {schedRange?.from && (
                <p className="text-xs text-muted-foreground">
                  {format(schedRange.from, "d MMM yyyy", { locale: nl })}
                  {schedRange.to && schedRange.to.getTime() !== schedRange.from.getTime() && ` — ${format(schedRange.to, "d MMM yyyy", { locale: nl })}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tijd</Label>
              <Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Medewerker</Label>
              <Select value={schedAssignee} onValueChange={setSchedAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies medewerker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || "Onbekend"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Annuleren</Button>
            <Button onClick={handleSchedule} disabled={schedSaving}>
              {schedSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Inplannen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Factuurregels controleren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Controleer en pas de factuurregels aan voordat de factuur wordt aangemaakt in WeFact.</p>
            {invoiceLines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2 border rounded-lg p-2">
                <Input
                  value={line.description}
                  onChange={(e) => updateInvoiceLine(idx, "description", e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="Omschrijving"
                />
                <Input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateInvoiceLine(idx, "quantity", Number(e.target.value))}
                  className="h-8 text-xs w-16 text-center"
                  placeholder="Aantal"
                />
                <Input
                  type="number"
                  value={line.price}
                  onChange={(e) => updateInvoiceLine(idx, "price", Number(e.target.value))}
                  className="h-8 text-xs w-24"
                  placeholder="Prijs"
                />
                <span className="text-xs font-medium w-20 text-right shrink-0">{formatPrice(line.quantity * line.price)}</span>
                <button onClick={() => removeInvoiceLine(idx)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addInvoiceLine}>
              <Plus className="h-3 w-3" /> Regel toevoegen
            </Button>
            <div className="flex justify-between font-bold text-sm border-t pt-3">
              <span>Totaal</span>
              <span>{formatPrice(invoiceLines.reduce((s, l) => s + l.quantity * l.price, 0))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoicePreview(false)}>Annuleren</Button>
            <Button onClick={confirmCreateInvoice} disabled={!!wefactLoading}>
              {wefactLoading === "create_invoice" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
              Factuur aanmaken in WeFact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KlusDetail;
