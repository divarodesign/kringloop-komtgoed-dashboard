import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Plus, Minus, Trash2, Check, MapPin, Loader2, Search, Package, ChevronDown, ChevronRight, Pencil, DoorOpen, Camera, X, Save } from "lucide-react";
import { icons } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddressFields from "@/components/AddressFields";
import type { Customer, Product, ProductCategory } from "@/types/database";

const STEPS = ["Klant", "Type", "Producten", "Kosten", "Planning", "Overzicht"];

// Fixed travel cost - loaded from settings, default 89
let defaultTravelFixedPrice = 89;

const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

interface SelectedProduct {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

interface RoomPhoto {
  file: File;
  preview: string;
}

interface Room {
  id: string;
  name: string;
  products: SelectedProduct[];
  photos: RoomPhoto[];
  expanded: boolean;
  browsing: boolean;
  activeCategoryId: string | null;
  productSearch: string;
}

const renderLucideIcon = (name: string | null, className = "h-6 w-6") => {
  if (!name) return <Package className={className + " text-muted-foreground"} />;
  const LucideIcon = icons[name as keyof typeof icons];
  if (!LucideIcon) return <Package className={className + " text-muted-foreground"} />;
  return <LucideIcon className={className} />;
};

const NieuweKlus = () => {
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Room-based product selection
  const [rooms, setRooms] = useState<Room[]>([
    { id: crypto.randomUUID(), name: "Kamer 1", products: [], photos: [], expanded: true, browsing: false, activeCategoryId: null, productSearch: "" }
  ]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", phone: "", address: "", city: "", postal_code: "" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState<"producten" | "ontruiming">("ontruiming");
  // selectedProducts is derived from rooms (flattened) for backward compat
  const selectedProducts = useMemo(() => rooms.flatMap(r => r.products), [rooms]);
  const setSelectedProducts = (updater: SelectedProduct[] | ((prev: SelectedProduct[]) => SelectedProduct[])) => {
    // This is only used in sticky bar / step 4 delete — we update all rooms
    const newProducts = typeof updater === 'function' ? updater(rooms.flatMap(r => r.products)) : updater;
    // Rebuild rooms: clear all products and put remaining in first room
    setRooms(prev => {
      const first = prev[0];
      return prev.map((r, i) => i === 0 ? { ...r, products: newProducts } : { ...r, products: [] });
    });
  };
  const [advisedPrice, setAdvisedPrice] = useState(0);
  const [customPrice, setCustomPrice] = useState("");
  const [travelKm, setTravelKm] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "">("");
  const [discountValue, setDiscountValue] = useState("");
  const [extraCosts, setExtraCosts] = useState("");
  const [extraCostsDesc, setExtraCostsDesc] = useState("");
  const [surchargePercentage, setSurchargePercentage] = useState(0);
  const [workAddress, setWorkAddress] = useState("");
  const [workCity, setWorkCity] = useState("");
  const [workPostalCode, setWorkPostalCode] = useState("");
  const [sameAsCustomer, setSameAsCustomer] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isDirect, setIsDirect] = useState(false);
  const [isQuoteRequest, setIsQuoteRequest] = useState(false);
  const [stickyExpanded, setStickyExpanded] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [companyAddress, setCompanyAddress] = useState("");
  const [housingType, setHousingType] = useState("");
  const [conceptJobId, setConceptJobId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [savingConcept, setSavingConcept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [travelFixedPrice, setTravelFixedPrice] = useState(defaultTravelFixedPrice);

  // Category-product links
  const [categoryLinks, setCategoryLinks] = useState<{ product_id: string; category_id: string }[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("settings").select("*").eq("key", "company_info").single(),
      supabase.from("product_categories").select("*").order("name"),
      supabase.from("product_category_links").select("product_id, category_id"),
      supabase.from("settings").select("*").eq("key", "travel_costs").single(),
    ]).then(([{ data: c }, { data: p }, { data: ci }, { data: cats }, { data: links }, { data: tc }]) => {
      setCustomers((c as Customer[]) || []);
      setProducts((p as Product[]) || []);
      setCategories((cats as ProductCategory[]) || []);
      setCategoryLinks(links || []);
      if (ci) {
        const info = ci.value as any;
        const addr = [info.address, info.postal_code, info.city].filter(Boolean).join(", ");
        setCompanyAddress(addr);
      }
      if (tc) {
        const tcVal = tc.value as any;
        if (tcVal.fixed_price != null) setTravelFixedPrice(tcVal.fixed_price);
      }
      setLoading(false);

      // Pre-fill from URL params (e.g. when converting from appointment)
      const paramCustomerId = searchParams.get("customer_id");
      const paramTitle = searchParams.get("title");
      const paramDate = searchParams.get("date");
      const paramTime = searchParams.get("time");
      const paramDesc = searchParams.get("description");

      if (paramCustomerId) {
        setCustomerId(paramCustomerId);
        // Auto-fill work address from customer
        const cust = (c as Customer[])?.find(cu => cu.id === paramCustomerId);
        if (cust) {
          setSameAsCustomer(true);
          setWorkAddress(cust.address || "");
          setWorkCity(cust.city || "");
          setWorkPostalCode(cust.postal_code || "");
        }
        // Skip to step 1 (Type) since customer is already known
        setStep(1);
      }
      if (paramTitle) setTitle(paramTitle);
      if (paramDate) setScheduledDate(paramDate);
      if (paramTime) setScheduledTime(paramTime);
      if (paramDesc) setDescription(paramDesc);
    });
  }, []);

  // Products filtered by category for a specific room
  const getCategoryProducts = (catId: string | null, search: string) => {
    let filtered = products;
    if (catId) {
      const productIds = categoryLinks
        .filter(l => l.category_id === catId)
        .map(l => l.product_id);
      filtered = products.filter(p =>
        productIds.includes(p.id) || p.category_id === catId
      );
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return filtered;
  };

  const getRoomProductQuantity = (roomId: string, productId: string) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.products.find(p => p.product_id === productId)?.quantity || 0;
  };

  const setRoomProductQuantity = (roomId: string, product: Product, delta: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const existing = r.products.find(p => p.product_id === product.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return { ...r, products: r.products.filter(p => p.product_id !== product.id) };
        return { ...r, products: r.products.map(p => p.product_id === product.id ? { ...p, quantity: newQty } : p) };
      } else if (delta > 0) {
        return { ...r, products: [...r.products, { product_id: product.id, description: product.name, quantity: 1, unit_price: product.price }] };
      }
      return r;
    }));
  };

  const addRoom = () => {
    const nextNum = rooms.length + 1;
    setRooms(prev => [...prev, { id: crypto.randomUUID(), name: `Kamer ${nextNum}`, products: [], photos: [], expanded: true, browsing: false, activeCategoryId: null, productSearch: "" }]);
  };

  const removeRoom = (roomId: string) => {
    if (rooms.length <= 1) return;
    setRooms(prev => prev.filter(r => r.id !== roomId));
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...updates } : r));
  };

  const handleRoomPhotos = (roomId: string, files: FileList | null) => {
    if (!files) return;
    const newPhotos: RoomPhoto[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, photos: [...r.photos, ...newPhotos] } : r));
  };

  const removeRoomPhoto = (roomId: string, index: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const photo = r.photos[index];
      if (photo) URL.revokeObjectURL(photo.preview);
      return { ...r, photos: r.photos.filter((_, i) => i !== index) };
    }));
  };

  // Recalculate advisedPrice whenever selectedProducts changes
  useEffect(() => {
    if (jobType === "ontruiming") {
      setAdvisedPrice(selectedProducts.reduce((s, p) => s + p.quantity * p.unit_price, 0));
    }
  }, [selectedProducts, jobType]);

  const calculateDistance = async () => {
    const toAddr = [workAddress, workPostalCode, workCity].filter(Boolean).join(", ");
    if (!toAddr || !companyAddress) {
      toast({ title: "Vul werkadres in en stel bedrijfsadres in bij Instellingen", variant: "destructive" });
      return;
    }
    setCalculatingDistance(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-distance", {
        body: { from_address: companyAddress, to_address: toAddr },
      });
      if (error) throw error;
      if (data?.distance_km && data.distance_km > 0) {
        setTravelKm(String(data.distance_km));
        toast({ title: `Afstand: ${data.distance_km} km` });
      } else {
        toast({ title: "Kon afstand niet berekenen", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    }
    setCalculatingDistance(false);
  };

  // Auto-calculate distance when work address is filled
  useEffect(() => {
    if (workAddress && workCity && companyAddress && !travelKm && !calculatingDistance) {
      calculateDistance();
    }
  }, [workAddress, workCity, companyAddress]);

  // Load concept job if ?id= is provided
  useEffect(() => {
    const conceptId = searchParams.get("id");
    if (!conceptId) return;
    const loadConcept = async () => {
      const { data: job } = await supabase.from("jobs").select("*").eq("id", conceptId).eq("status", "concept").single();
      if (!job) return;
      setConceptJobId(job.id);
      setCustomerId(job.customer_id);
      setTitle(job.title);
      setDescription(job.description || "");
      setJobType(job.job_type as "producten" | "ontruiming");
      setWorkAddress(job.work_address || "");
      setWorkCity(job.work_city || "");
      setWorkPostalCode(job.work_postal_code || "");
      setTravelKm(job.travel_distance_km ? String(job.travel_distance_km) : "");
      setDiscountType((job.discount_type as any) || "");
      setDiscountValue(job.discount_value ? String(job.discount_value) : "");
      setExtraCosts(job.extra_costs ? String(job.extra_costs) : "");
      setExtraCostsDesc(job.extra_costs_description || "");
      setSurchargePercentage((job as any).surcharge_percentage || 0);
      setAdvisedPrice(job.advised_price || 0);
      setCustomPrice(job.custom_price ? String(job.custom_price) : "");
      setScheduledDate(job.scheduled_date || "");
      setScheduledTime(job.scheduled_time || "");
      setIsDirect(job.is_direct);
      // Load saved step from localStorage
      const savedStep = localStorage.getItem(`concept_step_${conceptId}`);
      if (savedStep) setStep(parseInt(savedStep));

      // Load job items into rooms
      const { data: items } = await supabase.from("job_items").select("*").eq("job_id", conceptId);
      if (items && items.length > 0) {
        const roomMap: Record<string, SelectedProduct[]> = {};
        items.forEach((item: any) => {
          const rn = item.room_name || "Kamer 1";
          if (!roomMap[rn]) roomMap[rn] = [];
          roomMap[rn].push({ product_id: item.product_id, description: item.description, quantity: item.quantity, unit_price: item.unit_price });
        });
        const loadedRooms: Room[] = Object.entries(roomMap).map(([name, prods]) => ({
          id: crypto.randomUUID(), name, products: prods, photos: [], expanded: true, browsing: false, activeCategoryId: null, productSearch: "",
        }));
        setRooms(loadedRooms);
      }
    };
    loadConcept();
  }, [searchParams]);

  // Load lead data if ?lead_id= is provided
  useEffect(() => {
    const lid = searchParams.get("lead_id");
    if (!lid) return;
    setLeadId(lid);
    const loadLead = async () => {
      const { data: lead } = await supabase.from("leads").select("*").eq("id", lid).single();
      if (!lead) return;
      // Prefill customer form (new customer)
      setNewCustomer(true);
      setCustomerForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        address: lead.address || "",
        city: lead.city || "",
        postal_code: lead.postal_code || "",
      });
      // Prefill work address
      if (lead.address || lead.city) {
        setWorkAddress(lead.address || "");
        setWorkCity(lead.city || "");
        setWorkPostalCode(lead.postal_code || "");
      }
      // Prefill job type
      setJobType("ontruiming");
      // Prefill rooms from lead
      const leadRooms = Array.isArray(lead.rooms) ? lead.rooms : [];
      if (leadRooms.length > 0) {
        const loadedRooms: Room[] = leadRooms.map((r: any) => ({
          id: crypto.randomUUID(),
          name: r.name || "Kamer",
          products: (r.products || []).map((p: any) => ({
            product_id: p.product_id || null,
            description: p.description || "",
            quantity: p.quantity || 1,
            unit_price: p.unit_price || 0,
          })),
          photos: [],
          expanded: true,
          browsing: false,
          activeCategoryId: null,
          productSearch: "",
        }));
        setRooms(loadedRooms);
      }
      // Set advised price
      if (lead.advised_price) {
        setAdvisedPrice(Number(lead.advised_price));
      }
      setTitle(`Ontruiming ${lead.name}`);
    };
    loadLead();
  }, [searchParams]);

  // Save as concept
  const saveConcept = useCallback(async () => {
    if (!customerId && !newCustomer) {
      toast({ title: "Selecteer eerst een klant", variant: "destructive" });
      return;
    }
    setSavingConcept(true);
    try {
      let cid = customerId;
      if (newCustomer && !cid) {
        const { data, error } = await supabase.from("customers").insert(customerForm).select().single();
        if (error) throw error;
        cid = data.id;
        setCustomerId(cid);
        setNewCustomer(false);
      }
      const tc = travelKm ? travelFixedPrice : 0;
      const ec = parseFloat(extraCosts) || 0;
      const jobData = {
        customer_id: cid, title: title || "Concept klus", description: description || null, job_type: jobType, housing_type: housingType || null, status: "concept" as const,
        travel_cost: tc, travel_distance_km: parseInt(travelKm) || null,
        discount_type: discountType || null, discount_value: parseFloat(discountValue) || 0,
        extra_costs: ec, extra_costs_description: extraCostsDesc || null,
        surcharge_percentage: surchargePercentage,
        advised_price: jobType === "ontruiming" ? advisedPrice : null,
        custom_price: jobType === "ontruiming" && customPrice ? parseFloat(customPrice) : null,
        work_address: workAddress || null, work_city: workCity || null, work_postal_code: workPostalCode || null,
        scheduled_date: (isDirect || isQuoteRequest) ? null : scheduledDate || null,
        scheduled_time: (isDirect || isQuoteRequest) ? null : scheduledTime || null,
        is_direct: isDirect,
        created_by: user?.id || null,
      };

      let jobId = conceptJobId;
      if (jobId) {
        await supabase.from("jobs").update(jobData).eq("id", jobId);
      } else {
        const { data: job, error: jobErr } = await supabase.from("jobs").insert(jobData).select().single();
        if (jobErr) throw jobErr;
        jobId = job.id;
        setConceptJobId(jobId);
      }

      // Save current step to localStorage
      localStorage.setItem(`concept_step_${jobId}`, String(step));

      // Upsert job items: delete old, insert new
      await supabase.from("job_items").delete().eq("job_id", jobId);
      const itemsWithRooms = rooms.flatMap(r => r.products.map(p => ({
        job_id: jobId!, product_id: p.product_id, description: p.description, quantity: p.quantity, unit_price: p.unit_price, room_name: r.name,
      })));
      if (itemsWithRooms.length > 0) {
        await supabase.from("job_items").insert(itemsWithRooms);
      }

      toast({ title: "Concept opgeslagen!" });
    } catch (e: any) {
      toast({ title: "Fout bij opslaan", description: e.message, variant: "destructive" });
    }
    setSavingConcept(false);
  }, [customerId, newCustomer, customerForm, title, description, jobType, travelKm, travelFixedPrice, discountType, discountValue, extraCosts, extraCostsDesc, surchargePercentage, advisedPrice, customPrice, workAddress, workCity, workPostalCode, scheduledDate, scheduledTime, isDirect, isQuoteRequest, step, conceptJobId, rooms, user]);

  const travelCost = travelKm ? travelFixedPrice : 0;
  const productsTotal = selectedProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const subtotal = jobType === "ontruiming" ? (parseFloat(customPrice) || advisedPrice) : productsTotal;
  const extra = parseFloat(extraCosts) || 0;
  const discount = discountType === "percentage"
    ? (subtotal + travelCost + extra) * ((parseFloat(discountValue) || 0) / 100)
    : discountType === "fixed" ? (parseFloat(discountValue) || 0) : 0;
  const beforeSurcharge = subtotal + travelCost + extra - discount;
  const surchargeAmount = beforeSurcharge * (surchargePercentage / 100);
  const total = beforeSurcharge + surchargeAmount;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
    let cid = customerId;
    if (newCustomer) {
      const { data, error } = await supabase.from("customers").insert(customerForm).select().single();
      if (error) { toast({ title: "Fout bij klant aanmaken", description: error.message, variant: "destructive" }); return; }
      cid = data.id;
    }
    const jobData = {
      customer_id: cid, title, description: description || null, job_type: jobType, housing_type: housingType || null, status: "nieuw",
      travel_cost: travelCost, travel_distance_km: parseInt(travelKm) || null,
      discount_type: discountType || null, discount_value: parseFloat(discountValue) || 0,
      extra_costs: extra, extra_costs_description: extraCostsDesc || null,
      surcharge_percentage: surchargePercentage,
      advised_price: jobType === "ontruiming" ? advisedPrice : null,
      custom_price: jobType === "ontruiming" && customPrice ? parseFloat(customPrice) : null,
      work_address: workAddress || null, work_city: workCity || null, work_postal_code: workPostalCode || null,
      scheduled_date: (isDirect || isQuoteRequest) ? null : scheduledDate || null, scheduled_time: (isDirect || isQuoteRequest) ? null : scheduledTime || null, is_direct: isDirect,
      created_by: user?.id || null,
    };

    let job: any;
    if (conceptJobId) {
      // Update existing concept job to "nieuw"
      const { data, error: jobErr } = await supabase.from("jobs").update(jobData).eq("id", conceptJobId).select().single();
      if (jobErr) { toast({ title: "Fout", description: jobErr.message, variant: "destructive" }); return; }
      job = data;
      // Delete old items, they'll be re-inserted below
      await supabase.from("job_items").delete().eq("job_id", conceptJobId);
      // Clean up localStorage
      localStorage.removeItem(`concept_step_${conceptJobId}`);
    } else {
      const { data, error: jobErr } = await supabase.from("jobs").insert(jobData).select().single();
      if (jobErr) { toast({ title: "Fout", description: jobErr.message, variant: "destructive" }); return; }
      job = data;
    }
    if (selectedProducts.length > 0) {
      // Map products to their room names
      const itemsWithRooms: { job_id: string; product_id: string | null; description: string; quantity: number; unit_price: number; room_name: string | null }[] = [];
      for (const room of rooms) {
        for (const p of room.products) {
          itemsWithRooms.push({ job_id: job.id, product_id: p.product_id, description: p.description, quantity: p.quantity, unit_price: p.unit_price, room_name: room.name });
        }
      }
      await supabase.from("job_items").insert(itemsWithRooms);
    }
    // Upload room photos
    const roomsWithPhotos = rooms.filter(r => r.photos.length > 0);
    for (const room of roomsWithPhotos) {
      for (const photo of room.photos) {
        const ext = photo.file.name.split('.').pop();
        const path = `${job.id}/${room.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("room-photos").upload(path, photo.file);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("room-photos").getPublicUrl(path);
          await supabase.from("job_room_photos").insert({
            job_id: job.id,
            room_name: room.name,
            photo_url: urlData.publicUrl,
          });
        }
      }
    }
    // If quote request, automatically create and send quote via WeFact
    if (isQuoteRequest) {
      toast({ title: "Klus aangemaakt, offerte wordt verstuurd..." });
      try {
        const { data: quoteData, error: quoteError } = await supabase.functions.invoke("wefact", {
          body: { action: "create_quote", job_id: job.id },
        });
        if (quoteError) throw quoteError;
        if (quoteData?.error) throw new Error(quoteData.error);

        // Also send the quote by email
        const { data: sendData, error: sendError } = await supabase.functions.invoke("wefact", {
          body: { action: "send_quote", job_id: job.id },
        });
        if (sendError) throw sendError;
        if (sendData?.error) throw new Error(sendData.error);

        toast({ title: "Offerte aangemaakt en verstuurd via WeFact!" });
      } catch (e: any) {
        console.error("WeFact offerte fout:", e);
        toast({ title: "Klus aangemaakt, maar offerte versturen mislukt", description: e.message, variant: "destructive" });
      }
    } else {
    toast({ title: "Klus aangemaakt!" });
    }
    // Mark lead as converted if applicable
    if (leadId) {
      await supabase.from("leads").update({ status: "omgezet", job_id: job.id }).eq("id", leadId);
    }
    navigate("/admin/klussen");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-20 sm:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/admin/klussen")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Nieuwe klus</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Stap {step + 1} van {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            <span className={`text-[9px] sm:text-[10px] ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Klantgegevens */}
      {step === 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base">Klantgegevens</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Klusnaam *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Ontruiming woning" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Beschrijving</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optioneel..." />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="new" checked={newCustomer} onCheckedChange={(c) => setNewCustomer(!!c)} />
              <Label htmlFor="new" className="text-sm">Nieuwe klant aanmaken</Label>
            </div>
            {newCustomer ? (
              <div className="grid gap-3 border rounded-xl p-3">
                <div className="grid gap-1.5"><Label className="text-xs">Naam *</Label><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label className="text-xs">E-mail</Label><Input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Telefoon</Label><Input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                </div>
                <AddressFields
                  address={customerForm.address}
                  postalCode={customerForm.postal_code}
                  city={customerForm.city}
                  onAddressChange={(v) => setCustomerForm({ ...customerForm, address: v })}
                  onPostalCodeChange={(v) => setCustomerForm({ ...customerForm, postal_code: v })}
                  onCityChange={(v) => setCustomerForm({ ...customerForm, city: v })}
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label className="text-xs">Bestaande klant *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Type opdracht */}
      {step === 1 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base">Type opdracht</CardTitle>
            <CardDescription className="text-xs">Kies het type en ga daarna producten selecteren</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setJobType("ontruiming")} className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation active:scale-[0.97] ${jobType === "ontruiming" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-semibold">Ontruiming</p>
                <p className="text-xs text-muted-foreground mt-1">Selecteer producten, stel adviesprijs samen</p>
              </button>
              <button onClick={() => setJobType("producten")} className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation active:scale-[0.97] ${jobType === "producten" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-semibold">Producten</p>
                <p className="text-xs text-muted-foreground mt-1">Selecteer producten uit de catalogus</p>
              </button>
            </div>

            <div className="pt-2">
              <p className="text-sm font-semibold mb-1">Type woning</p>
              <p className="text-xs text-muted-foreground mb-3">Selecteer het type woning</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: "appartement", label: "Appartement" },
                  { value: "tussenwoning", label: "Tussenwoning" },
                  { value: "twee-onder-een-kap", label: "Twee-onder-een-kap" },
                  { value: "vrijstaand", label: "Vrijstaand huis" },
                  { value: "zorgkamer", label: "Zorgkamer" },
                  { value: "hoarder", label: "Hoarder" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setHousingType(housingType === type.value ? "" : type.value)}
                    className={`rounded-xl border-2 p-3 text-center transition-all touch-manipulation active:scale-[0.97] ${housingType === type.value ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className="text-sm font-medium">{type.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Werkadres */}
            <div className="pt-2">
              <p className="text-sm font-semibold mb-1">Werkadres</p>
              <p className="text-xs text-muted-foreground mb-3">Vul het adres in waar de klus uitgevoerd wordt</p>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="sameAsCustomer"
                  checked={sameAsCustomer}
                  onCheckedChange={(checked) => {
                    setSameAsCustomer(!!checked);
                    if (checked) {
                      if (newCustomer) {
                        setWorkAddress(customerForm.address);
                        setWorkPostalCode(customerForm.postal_code);
                        setWorkCity(customerForm.city);
                      } else {
                        const customer = customers.find(c => c.id === customerId);
                        if (customer) {
                          setWorkAddress(customer.address || "");
                          setWorkPostalCode(customer.postal_code || "");
                          setWorkCity(customer.city || "");
                        }
                      }
                    } else {
                      setWorkAddress("");
                      setWorkPostalCode("");
                      setWorkCity("");
                    }
                  }}
                />
                <Label htmlFor="sameAsCustomer" className="text-xs">Zelfde als klantadres</Label>
              </div>
              <AddressFields
                address={workAddress}
                postalCode={workPostalCode}
                city={workCity}
                onAddressChange={setWorkAddress}
                onPostalCodeChange={setWorkPostalCode}
                onCityChange={setWorkCity}
              />
              {(travelKm || calculatingDistance) && (
                <div className="border rounded-xl p-3 mt-3 space-y-1.5 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">Voorrijkosten</p>
                      <p className="text-[10px] text-muted-foreground">Vanaf: {companyAddress || "Stel in bij Instellingen"}</p>
                    </div>
                    {calculatingDistance ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{travelKm} km</p>
                        <p className="text-sm font-bold">{formatPrice(travelCost)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Show selected products summary */}
            {selectedProducts.length > 0 && (
              <div className="border rounded-xl p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-medium">{selectedProducts.length} product(en) geselecteerd</p>
                {selectedProducts.map((sp, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate">{sp.description} ×{sp.quantity}</span>
                    <span className="font-medium ml-2">{formatPrice(sp.quantity * sp.unit_price)}</span>
                  </div>
                ))}
                <p className="text-xs font-semibold text-right border-t pt-1">Subtotaal: {formatPrice(productsTotal)}</p>
              </div>
            )}

            {jobType === "ontruiming" && selectedProducts.length > 0 && (
              <div className="border rounded-xl p-3 space-y-2 bg-muted/30">
                <p className="text-xs">Adviesprijs: <span className="font-medium">{formatPrice(advisedPrice)}</span></p>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Eigen prijs (optioneel)</Label>
                  <Input type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Laat leeg voor adviesprijs" className="h-8 text-xs" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Producten selecteren per kamer */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Kamers & Producten</h2>
              <p className="text-xs text-muted-foreground">Voeg producten toe per kamer</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addRoom}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Kamer toevoegen
            </Button>
          </div>

          {rooms.map((room) => {
            const roomTotal = room.products.reduce((s, p) => s + p.quantity * p.unit_price, 0);
            const roomCategoryProducts = getCategoryProducts(room.activeCategoryId, room.productSearch);

            return (
              <Card key={room.id} className="overflow-hidden">
                {/* Room header */}
                <button
                  onClick={() => updateRoom(room.id, { expanded: !room.expanded, browsing: false })}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-accent/30 transition-colors touch-manipulation"
                >
                  <div className="flex items-center gap-2">
                    {room.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <DoorOpen className="h-4 w-4 text-primary" />
                    {editingRoomId === room.id ? (
                      <Input
                        value={editingRoomName}
                        onChange={(e) => setEditingRoomName(e.target.value)}
                        onBlur={() => { updateRoom(room.id, { name: editingRoomName || room.name }); setEditingRoomId(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { updateRoom(room.id, { name: editingRoomName || room.name }); setEditingRoomId(null); } }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-sm font-semibold w-40"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-semibold">{room.name}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingRoomId(room.id); setEditingRoomName(room.name); }}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {room.products.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{room.products.reduce((s, p) => s + p.quantity, 0)} items · {formatPrice(roomTotal)}</Badge>
                    )}
                    {rooms.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }} className="p-1 rounded hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                </button>

                {/* Room content (expanded) */}
                {room.expanded && (
                  <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                    {/* Products already in this room */}
                    {room.products.length > 0 && (
                      <div className="space-y-1.5">
                        {room.products.map((sp, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <span className="truncate flex-1">{sp.description}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { const product = products.find(p => p.id === sp.product_id); if (product) setRoomProductQuantity(room.id, product, -1); }} className="h-6 w-6 rounded bg-muted flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                              <span className="w-5 text-center font-medium">{sp.quantity}</span>
                              <button onClick={() => { const product = products.find(p => p.id === sp.product_id); if (product) setRoomProductQuantity(room.id, product, 1); }} className="h-6 w-6 rounded bg-muted flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                            </div>
                            <span className="font-medium shrink-0 w-16 text-right">{formatPrice(sp.quantity * sp.unit_price)}</span>
                          </div>
                        ))}
                        <p className="text-xs font-bold text-right border-t pt-1.5">{formatPrice(roomTotal)}</p>
                      </div>
                    )}

                    {/* Add products button / category browser */}
                    {!room.browsing ? (
                      <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={() => updateRoom(room.id, { browsing: true, activeCategoryId: null, productSearch: "" })}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Producten toevoegen
                      </Button>
                    ) : (
                      <div className="border rounded-xl p-3 space-y-3 bg-muted/20">
                        {!room.activeCategoryId ? (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">Kies een categorie</p>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateRoom(room.id, { browsing: false })}>Sluiten</Button>
                            </div>
                            {/* Global product search */}
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Zoek product op naam..."
                                value={room.productSearch}
                                onChange={(e) => updateRoom(room.id, { productSearch: e.target.value })}
                                className="pl-8 h-8 text-xs"
                              />
                            </div>
                            {room.productSearch ? (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {getCategoryProducts(null, room.productSearch).map(product => {
                                    const qty = getRoomProductQuantity(room.id, product.id);
                                    const isSelected = qty > 0;
                                    return (
                                      <div
                                        key={product.id}
                                        onClick={() => !isSelected && setRoomProductQuantity(room.id, product, 1)}
                                        className={`flex flex-col items-center p-2.5 rounded-xl border transition-all shadow-sm cursor-pointer touch-manipulation active:scale-[0.97] ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card"}`}
                                      >
                                        <div className="h-8 w-8 flex items-center justify-center text-primary mb-1">
                                          {renderLucideIcon(product.icon, "h-5 w-5")}
                                        </div>
                                        <p className="text-[10px] font-medium text-center leading-tight line-clamp-2 mb-0.5">{product.name}</p>
                                        {isSelected ? (
                                          <div className="flex items-center gap-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => setRoomProductQuantity(room.id, product, -1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90"><Minus className="h-3 w-3" /></button>
                                            <span className="text-xs font-bold w-5 text-center">{qty}</span>
                                            <button onClick={() => setRoomProductQuantity(room.id, product, 1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90"><Plus className="h-3 w-3" /></button>
                                          </div>
                                        ) : (
                                          <div className="mt-auto h-7 w-7 rounded-lg bg-muted flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></div>
                                        )}
                                        <span className="text-[10px] text-muted-foreground mt-0.5">{formatPrice(product.price)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {getCategoryProducts(null, room.productSearch).length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-4">Geen producten gevonden</p>
                                )}
                              </>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {categories.map(cat => {
                                  const catProductIds = categoryLinks.filter(l => l.category_id === cat.id).map(l => l.product_id);
                                  const catProds = products.filter(p => catProductIds.includes(p.id) || p.category_id === cat.id);
                                  const selectedInCat = room.products.filter(sp => catProds.some(cp => cp.id === sp.product_id));
                                  return (
                                    <button
                                      key={cat.id}
                                      onClick={() => updateRoom(room.id, { activeCategoryId: cat.id, productSearch: "" })}
                                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-all touch-manipulation active:scale-[0.95] relative shadow-sm"
                                    >
                                      {selectedInCat.length > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                                          {selectedInCat.reduce((s, p) => s + p.quantity, 0)}
                                        </div>
                                      )}
                                      <div className="h-8 w-8 flex items-center justify-center text-primary">
                                        {renderLucideIcon(cat.icon, "h-5 w-5")}
                                      </div>
                                      <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">{cat.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => updateRoom(room.id, { activeCategoryId: null, productSearch: "" })}>
                                <ArrowLeft className="mr-1 h-3 w-3" /> Categorieën
                              </Button>
                              <div className="flex-1 relative">
                                <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder="Zoek product..."
                                  value={room.productSearch}
                                  onChange={(e) => updateRoom(room.id, { productSearch: e.target.value })}
                                  className="pl-8 h-7 text-xs"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {roomCategoryProducts.map(product => {
                                const qty = getRoomProductQuantity(room.id, product.id);
                                const isSelected = qty > 0;
                                return (
                                  <div
                                    key={product.id}
                                    onClick={() => !isSelected && setRoomProductQuantity(room.id, product, 1)}
                                    className={`flex flex-col items-center p-2.5 rounded-xl border transition-all shadow-sm cursor-pointer touch-manipulation active:scale-[0.97] ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card"}`}
                                  >
                                    <div className="h-8 w-8 flex items-center justify-center text-primary mb-1">
                                      {renderLucideIcon(product.icon, "h-5 w-5")}
                                    </div>
                                    <p className="text-[10px] font-medium text-center leading-tight line-clamp-2 mb-0.5">{product.name}</p>
                                    {isSelected ? (
                                      <div className="flex items-center gap-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => setRoomProductQuantity(room.id, product, -1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90"><Minus className="h-3 w-3" /></button>
                                        <span className="text-xs font-bold w-5 text-center">{qty}</span>
                                        <button onClick={() => setRoomProductQuantity(room.id, product, 1)} className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90"><Plus className="h-3 w-3" /></button>
                                      </div>
                                    ) : (
                                      <div className="mt-auto h-7 w-7 rounded-lg bg-muted flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></div>
                                    )}
                                    <span className="text-[10px] text-muted-foreground mt-0.5">{formatPrice(product.price)}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {roomCategoryProducts.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-4">Geen producten gevonden</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Photo upload section */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-muted-foreground" /> Foto's</p>
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleRoomPhotos(room.id, e.target.files)} />
                          <span className="text-xs text-primary hover:underline">+ Foto toevoegen</span>
                        </label>
                      </div>
                      {room.photos.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {room.photos.map((photo, pi) => (
                            <div key={pi} className="relative group rounded-lg overflow-hidden aspect-square border">
                              <img src={photo.preview} alt={`Foto ${pi + 1}`} className="w-full h-full object-cover" />
                              <button
                                onClick={() => removeRoomPhoto(room.id, pi)}
                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Step 4: Kosten */}
      {step === 3 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Kosten & Korting</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            {/* Products grouped by room */}
            {rooms.filter(r => r.products.length > 0).map(room => {
              const roomTotal = room.products.reduce((s, p) => s + p.quantity * p.unit_price, 0);
              return (
                <div key={room.id} className="border rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5 text-primary" /> {room.name}</p>
                  {room.products.map((sp, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 pl-5">
                      <span className="text-xs truncate flex-1">{sp.description}</span>
                      <span className="text-xs text-muted-foreground shrink-0">×{sp.quantity}</span>
                      <span className="text-xs font-medium shrink-0">{formatPrice(sp.quantity * sp.unit_price)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                        setRooms(prev => prev.map(r => r.id === room.id ? { ...r, products: r.products.filter((_, idx) => idx !== i) } : r));
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs font-bold text-right border-t pt-1.5">Subtotaal {room.name}: {formatPrice(roomTotal)}</p>
                  {room.photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {room.photos.map((photo, pi) => (
                        <div key={pi} className="rounded overflow-hidden aspect-square border">
                          <img src={photo.preview} alt={`${room.name} foto ${pi + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs font-bold text-right">Totaal producten: {formatPrice(productsTotal)}</p>

            {jobType === "ontruiming" && selectedProducts.length > 0 && (
              <div className="border rounded-xl p-3 space-y-2 bg-muted/30">
                <p className="text-xs">Adviesprijs: <span className="font-medium">{formatPrice(advisedPrice)}</span></p>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Eigen prijs (optioneel)</Label>
                  <Input type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Laat leeg voor adviesprijs" className="h-8 text-xs" />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs">Overige kosten (€)</Label>
              <Input type="number" step="0.01" value={extraCosts} onChange={(e) => setExtraCosts(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Omschrijving</Label>
              <Input value={extraCostsDesc} onChange={(e) => setExtraCostsDesc(e.target.value)} placeholder="Bijv. materiaalkosten" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Korting type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Geen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Vast bedrag (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Waarde</Label>
                  <Input type="number" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Toeslag percentage</Label>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    size="sm"
                    variant={surchargePercentage === pct ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setSurchargePercentage(surchargePercentage === pct ? 0 : pct)}
                  >
                    {pct}%
                  </Button>
                ))}
              </div>
            </div>
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">Voorrijkosten</span><span className="text-xs">{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span className="text-xs">{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-xs text-muted-foreground">Overig</span><span className="text-xs">{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span className="text-xs">Korting</span><span className="text-xs">-{formatPrice(discount)}</span></div>}
              {surchargePercentage > 0 && <div className="flex justify-between text-green-600"><span className="text-xs">Toeslag ({surchargePercentage}%)</span><span className="text-xs">+{formatPrice(surchargeAmount)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Planning */}
      {step === 4 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Planning</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="quote-request" checked={isQuoteRequest} onCheckedChange={(c) => { setIsQuoteRequest(!!c); if (c) { setIsDirect(false); setScheduledDate(""); setScheduledTime(""); } }} />
              <Label htmlFor="quote-request" className="text-sm">Dit is een offerte aanvraag (planning later)</Label>
            </div>
            {!isQuoteRequest && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox id="direct" checked={isDirect} onCheckedChange={(c) => { setIsDirect(!!c); if (c) { setScheduledDate(""); setScheduledTime(""); } }} />
                  <Label htmlFor="direct" className="text-sm">Direct uitvoeren</Label>
                </div>
                {!isDirect && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Geplande datum</Label>
                      <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Tijd</Label>
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}
            {isQuoteRequest && (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                De klus wordt aangemaakt als offerte aanvraag. Je kunt de planning later toevoegen wanneer de offerte is geaccepteerd.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Overzicht */}
      {step === 5 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base">Overzicht</CardTitle>
            <CardDescription className="text-xs">Controleer en bevestig</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-xs text-muted-foreground">Klus:</span> <span className="text-xs font-medium">{title}</span></div>
              <div><span className="text-xs text-muted-foreground">Type:</span> <Badge variant="secondary" className="capitalize text-[10px] ml-1">{jobType}</Badge></div>
              <div><span className="text-xs text-muted-foreground">Klant:</span> <span className="text-xs font-medium">{newCustomer ? customerForm.name : customers.find(c => c.id === customerId)?.name}</span></div>
              <div><span className="text-xs text-muted-foreground">Planning:</span> <span className="text-xs font-medium">{isQuoteRequest ? "Offerte aanvraag" : isDirect ? "Direct" : `${scheduledDate || "-"}${scheduledTime ? ` om ${scheduledTime}` : ""}`}</span></div>
              {workAddress && <div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Werkadres:</span> <span className="text-xs font-medium">{[workAddress, workPostalCode, workCity].filter(Boolean).join(", ")}</span></div>}
            </div>
            {rooms.filter(r => r.products.length > 0).map(room => (
              <div key={room.id} className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5 text-primary" /> {room.name}</p>
                {room.products.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs pl-5">
                    <span className="truncate flex-1">{p.description} ×{p.quantity}</span>
                    <span className="font-medium ml-2">{formatPrice(p.quantity * p.unit_price)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">Voorrijkosten</span><span className="text-xs">{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span className="text-xs">{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-xs text-muted-foreground">Overig</span><span className="text-xs">{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span className="text-xs">Korting</span><span className="text-xs">-{formatPrice(discount)}</span></div>}
              {surchargePercentage > 0 && <div className="flex justify-between text-green-600"><span className="text-xs">Toeslag ({surchargePercentage}%)</span><span className="text-xs">+{formatPrice(surchargeAmount)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky bottom: total + navigation */}
      <div className="fixed bottom-14 left-0 right-0 z-30 sm:bottom-0 sm:static sm:z-auto">
        {/* Running total bar - visible during product selection steps */}
        {selectedProducts.length > 0 && (step === 1 || step === 2) && (
          <div className="bg-card border-t sm:rounded-xl sm:border sm:mb-2 sm:mx-0">
            <button
              type="button"
              className="w-full px-4 py-2 flex items-center justify-between"
              onClick={() => setStickyExpanded(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{selectedProducts.reduce((s, p) => s + p.quantity, 0)} items</Badge>
                <span className="text-xs text-muted-foreground">{rooms.filter(r => r.products.length > 0).length} kamer(s)</span>
                {travelCost > 0 && <span className="text-xs text-muted-foreground">+ {formatPrice(travelCost)} voorrijkosten</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{formatPrice(productsTotal + travelCost)}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${stickyExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>
            {stickyExpanded && (
              <div className="px-4 pb-3 max-h-60 overflow-y-auto border-t space-y-2 pt-2">
                {rooms.filter(r => r.products.length > 0).map(room => (
                  <div key={room.id} className="space-y-1">
                    <p className="text-xs font-semibold flex items-center gap-1.5"><DoorOpen className="h-3 w-3 text-primary" />{room.name}</p>
                    {room.products.map((p, i) => (
                      <div key={i} className="flex items-center text-[11px] pl-4 text-muted-foreground gap-1">
                        <span className="truncate flex-1">{p.description}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted"
                            onClick={(e) => { e.stopPropagation(); setRooms(prev => prev.map(r => r.id !== room.id ? r : { ...r, products: r.products.map((pr, pi) => pi !== i ? pr : { ...pr, quantity: Math.max(1, pr.quantity - 1) }) })); }}
                          ><Minus className="h-3 w-3" /></button>
                          <span className="text-foreground font-medium w-4 text-center">{p.quantity}</span>
                          <button
                            type="button"
                            className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted"
                            onClick={(e) => { e.stopPropagation(); setRooms(prev => prev.map(r => r.id !== room.id ? r : { ...r, products: r.products.map((pr, pi) => pi !== i ? pr : { ...pr, quantity: pr.quantity + 1 }) })); }}
                          ><Plus className="h-3 w-3" /></button>
                          <button
                            type="button"
                            className="h-5 w-5 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 ml-1"
                            onClick={(e) => { e.stopPropagation(); setRooms(prev => prev.map(r => r.id !== room.id ? r : { ...r, products: r.products.filter((_, pi) => pi !== i) })); }}
                          ><Trash2 className="h-3 w-3" /></button>
                        </div>
                        <span className="font-medium text-foreground ml-1 w-16 text-right">{formatPrice(p.quantity * p.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center bg-background/95 backdrop-blur py-3 px-4 sm:static sm:px-0 sm:py-0 sm:bg-transparent border-t sm:border-0">
          <Button variant="outline" size="sm" onClick={() => {
            if (step > 0) {
              setStep(step - 1);
            } else {
              navigate("/admin/klussen");
            }
          }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {step === 0 ? "Annuleren" : "Vorige"}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={saveConcept} disabled={savingConcept}>
                <Save className="mr-1.5 h-4 w-4" /> {savingConcept ? "Opslaan..." : "Concept"}
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>Volgende <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                {submitting ? "Bezig..." : isQuoteRequest ? "Offerte versturen" : "Aanmaken"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NieuweKlus;
