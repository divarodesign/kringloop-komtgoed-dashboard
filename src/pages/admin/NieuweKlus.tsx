import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, ArrowRight, Plus, Trash2, Check, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Product, ProductCategory } from "@/types/database";

const STEPS = ["Klant", "Type", "Kosten", "Adres", "Overzicht"];

const calcTravelCost = (km: number) => {
  if (km <= 75) return 89;
  if (km <= 150) return 115;
  return 145;
};

const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

interface SelectedProduct {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

const NieuweKlus = () => {
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", phone: "", address: "", city: "", postal_code: "" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState<"producten" | "ontruiming">("producten");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [advisedPrice, setAdvisedPrice] = useState(0);
  const [customPrice, setCustomPrice] = useState("");
  const [travelKm, setTravelKm] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "">("");
  const [discountValue, setDiscountValue] = useState("");
  const [extraCosts, setExtraCosts] = useState("");
  const [extraCostsDesc, setExtraCostsDesc] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [workCity, setWorkCity] = useState("");
  const [workPostalCode, setWorkPostalCode] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isDirect, setIsDirect] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [companyAddress, setCompanyAddress] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*, product_categories(*)").eq("is_active", true).order("name"),
      supabase.from("settings").select("*").eq("key", "company_info").single(),
    ]).then(([{ data: c }, { data: p }, { data: ci }]) => {
      setCustomers((c as Customer[]) || []);
      setProducts((p as Product[]) || []);
      if (ci) {
        const info = ci.value as any;
        const addr = [info.address, info.postal_code, info.city].filter(Boolean).join(", ");
        setCompanyAddress(addr);
      }
      setLoading(false);
    });
  }, []);

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

  const travelCost = travelKm ? calcTravelCost(parseInt(travelKm)) : 0;
  const productsTotal = selectedProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const subtotal = jobType === "ontruiming" ? (parseFloat(customPrice) || advisedPrice) : productsTotal;
  const extra = parseFloat(extraCosts) || 0;
  const discount = discountType === "percentage"
    ? (subtotal + travelCost + extra) * ((parseFloat(discountValue) || 0) / 100)
    : discountType === "fixed" ? (parseFloat(discountValue) || 0) : 0;
  const total = subtotal + travelCost + extra - discount;

  const addProduct = () => setSelectedProducts([...selectedProducts, { product_id: null, description: "", quantity: 1, unit_price: 0 }]);
  const removeProduct = (i: number) => setSelectedProducts(selectedProducts.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, field: string, value: any) => {
    const updated = [...selectedProducts];
    (updated[i] as any)[field] = value;
    if (field === "product_id") {
      const prod = products.find((p) => p.id === value);
      if (prod) { updated[i].description = prod.name; updated[i].unit_price = prod.price; }
    }
    setSelectedProducts(updated);
    if (jobType === "ontruiming") {
      setAdvisedPrice(updated.reduce((s, p) => s + p.quantity * p.unit_price, 0));
    }
  };

  const handleSubmit = async () => {
    let cid = customerId;
    if (newCustomer) {
      const { data, error } = await supabase.from("customers").insert(customerForm).select().single();
      if (error) { toast({ title: "Fout bij klant aanmaken", description: error.message, variant: "destructive" }); return; }
      cid = data.id;
    }
    const { data: job, error: jobErr } = await supabase.from("jobs").insert({
      customer_id: cid, title, description: description || null, job_type: jobType, status: "nieuw",
      travel_cost: travelCost, travel_distance_km: parseInt(travelKm) || null,
      discount_type: discountType || null, discount_value: parseFloat(discountValue) || 0,
      extra_costs: extra, extra_costs_description: extraCostsDesc || null,
      advised_price: jobType === "ontruiming" ? advisedPrice : null,
      custom_price: jobType === "ontruiming" && customPrice ? parseFloat(customPrice) : null,
      work_address: workAddress || null, work_city: workCity || null, work_postal_code: workPostalCode || null,
      scheduled_date: isDirect ? null : scheduledDate || null, is_direct: isDirect,
      created_by: user?.id || null,
    }).select().single();
    if (jobErr) { toast({ title: "Fout", description: jobErr.message, variant: "destructive" }); return; }
    if (selectedProducts.length > 0) {
      await supabase.from("job_items").insert(
        selectedProducts.map((p) => ({ job_id: job.id, product_id: p.product_id, description: p.description, quantity: p.quantity, unit_price: p.unit_price }))
      );
    }
    toast({ title: "Klus aangemaakt!" });
    navigate("/admin/klussen");
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-8">
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
                <div className="grid gap-1.5"><Label className="text-xs">Adres</Label><Input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label className="text-xs">Postcode</Label><Input value={customerForm.postal_code} onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Plaats</Label><Input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} /></div>
                </div>
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

      {/* Step 2: Type */}
      {step === 1 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base">Type opdracht</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setJobType("producten")} className={`rounded-xl border-2 p-3 sm:p-4 text-left transition-colors touch-manipulation ${jobType === "producten" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-medium">Producten</p>
                <p className="text-xs text-muted-foreground mt-0.5">Uit catalogus</p>
              </button>
              <button onClick={() => setJobType("ontruiming")} className={`rounded-xl border-2 p-3 sm:p-4 text-left transition-colors touch-manipulation ${jobType === "ontruiming" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-medium">Ontruiming</p>
                <p className="text-xs text-muted-foreground mt-0.5">Met adviesprijs</p>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Producten</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addProduct}><Plus className="mr-1 h-3 w-3" /> Product</Button>
              </div>
              {selectedProducts.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nog geen producten</p>}
              {selectedProducts.map((sp, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-2">
                  <Select value={sp.product_id || ""} onValueChange={(v) => updateProduct(i, "product_id", v)}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Kies product" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 grid gap-1">
                      <Label className="text-[10px]">Aantal</Label>
                      <Input type="number" min={1} value={sp.quantity} onChange={(e) => updateProduct(i, "quantity", parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                    </div>
                    <div className="flex-1 grid gap-1">
                      <Label className="text-[10px]">Prijs</Label>
                      <Input type="number" step="0.01" value={sp.unit_price} onChange={(e) => updateProduct(i, "unit_price", parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeProduct(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              {selectedProducts.length > 0 && (
                <p className="text-xs font-medium text-right">Subtotaal: {formatPrice(productsTotal)}</p>
              )}
            </div>

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

      {/* Step 3: Kosten */}
      {step === 2 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Kosten & Korting</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
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
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">Voorrijkosten</span><span className="text-xs">{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span className="text-xs">{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-xs text-muted-foreground">Overig</span><span className="text-xs">{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span className="text-xs">Korting</span><span className="text-xs">-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Werkadres */}
      {step === 3 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Werkadres & Planning</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Werkadres</Label>
              <Input value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} placeholder="Straat en huisnummer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label className="text-xs">Postcode</Label><Input value={workPostalCode} onChange={(e) => setWorkPostalCode(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Plaats</Label><Input value={workCity} onChange={(e) => setWorkCity(e.target.value)} /></div>
            </div>
            <div className="border rounded-xl p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label className="text-xs">Afstand (enkele reis)</Label>
                  <p className="text-[10px] text-muted-foreground truncate">Vanaf: {companyAddress || "Stel in bij Instellingen"}</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={calculateDistance} disabled={calculatingDistance || !workAddress}>
                  {calculatingDistance ? <Loader2 className="h-3 w-3 animate-spin" /> : <><MapPin className="mr-1 h-3 w-3" /> Bereken</>}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label className="text-[10px]">Afstand (km)</Label><Input type="number" value={travelKm} onChange={(e) => setTravelKm(e.target.value)} className="h-8 text-xs" /></div>
                <div className="flex items-end">{travelKm && <p className="text-xs font-medium pb-2">Voorrijkosten: {formatPrice(travelCost)}</p>}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="direct" checked={isDirect} onCheckedChange={(c) => { setIsDirect(!!c); if (c) setScheduledDate(""); }} />
              <Label htmlFor="direct" className="text-sm">Direct uitvoeren</Label>
            </div>
            {!isDirect && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Geplande datum</Label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Overzicht */}
      {step === 4 && (
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
              <div><span className="text-xs text-muted-foreground">Planning:</span> <span className="text-xs font-medium">{isDirect ? "Direct" : scheduledDate || "-"}</span></div>
              {workAddress && <div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Werkadres:</span> <span className="text-xs font-medium">{[workAddress, workPostalCode, workCity].filter(Boolean).join(", ")}</span></div>}
            </div>
            {selectedProducts.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                {selectedProducts.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate flex-1">{p.description} ×{p.quantity}</span>
                    <span className="font-medium ml-2">{formatPrice(p.quantity * p.unit_price)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">Voorrijkosten</span><span className="text-xs">{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-xs text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span className="text-xs">{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-xs text-muted-foreground">Overig</span><span className="text-xs">{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span className="text-xs">Korting</span><span className="text-xs">-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation - sticky on mobile */}
      <div className="flex justify-between sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-3 px-3 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent border-t sm:border-0">
        <Button variant="outline" size="sm" onClick={() => step > 0 ? setStep(step - 1) : navigate("/admin/klussen")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {step === 0 ? "Annuleren" : "Vorige"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep(step + 1)}>Volgende <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
        ) : (
          <Button size="sm" onClick={handleSubmit}><Check className="mr-1.5 h-4 w-4" /> Aanmaken</Button>
        )}
      </div>
    </div>
  );
};

export default NieuweKlus;
