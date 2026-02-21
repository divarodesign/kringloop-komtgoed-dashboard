import { useState, useEffect, useMemo, useRef } from "react";
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
import { ArrowLeft, ArrowRight, Plus, Minus, Trash2, Check, MapPin, Loader2, Search, Package } from "lucide-react";
import { icons } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddressFields from "@/components/AddressFields";
import type { Customer, Product, ProductCategory } from "@/types/database";

const STEPS = ["Klant", "Type", "Producten", "Kosten", "Adres", "Overzicht"];

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
  const { toast } = useToast();

  // Product picker sub-state
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [totalBarExpanded, setTotalBarExpanded] = useState(false);

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

  // Category-product links
  const [categoryLinks, setCategoryLinks] = useState<{ product_id: string; category_id: string }[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("settings").select("*").eq("key", "company_info").single(),
      supabase.from("product_categories").select("*").order("name"),
      supabase.from("product_category_links").select("product_id, category_id"),
    ]).then(([{ data: c }, { data: p }, { data: ci }, { data: cats }, { data: links }]) => {
      setCustomers((c as Customer[]) || []);
      setProducts((p as Product[]) || []);
      setCategories((cats as ProductCategory[]) || []);
      setCategoryLinks(links || []);
      if (ci) {
        const info = ci.value as any;
        const addr = [info.address, info.postal_code, info.city].filter(Boolean).join(", ");
        setCompanyAddress(addr);
      }
      setLoading(false);
    });
  }, []);

  // Products filtered by active category
  const categoryProducts = useMemo(() => {
    let filtered = products;
    if (activeCategoryId) {
      const productIds = categoryLinks
        .filter(l => l.category_id === activeCategoryId)
        .map(l => l.product_id);
      filtered = products.filter(p =>
        productIds.includes(p.id) || p.category_id === activeCategoryId
      );
    }
    if (productSearch) {
      const q = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [activeCategoryId, products, categoryLinks, productSearch]);

  const getProductQuantity = (productId: string) => {
    const sp = selectedProducts.find(p => p.product_id === productId);
    return sp?.quantity || 0;
  };

  // Track which products have been added to prevent rapid duplicate clicks
  const addedProductsRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    addedProductsRef.current = new Set(selectedProducts.map(p => p.product_id).filter(Boolean) as string[]);
  }, [selectedProducts]);

  const setProductQuantity = (product: Product, delta: number) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.product_id === product.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return prev.filter(p => p.product_id !== product.id);
        }
        return prev.map(p =>
          p.product_id === product.id ? { ...p, quantity: newQty } : p
        );
      } else if (delta > 0) {
        // Check ref to prevent duplicate additions from rapid clicks
        if (addedProductsRef.current.has(product.id)) {
          return prev;
        }
        addedProductsRef.current.add(product.id);
        return [...prev, {
          product_id: product.id,
          description: product.name,
          quantity: 1,
          unit_price: product.price,
        }];
      }
      return prev;
    });
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

  const travelCost = travelKm ? calcTravelCost(parseInt(travelKm)) : 0;
  const productsTotal = selectedProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const subtotal = jobType === "ontruiming" ? (parseFloat(customPrice) || advisedPrice) : productsTotal;
  const extra = parseFloat(extraCosts) || 0;
  const discount = discountType === "percentage"
    ? (subtotal + travelCost + extra) * ((parseFloat(discountValue) || 0) / 100)
    : discountType === "fixed" ? (parseFloat(discountValue) || 0) : 0;
  const total = subtotal + travelCost + extra - discount;

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
              <button onClick={() => setJobType("producten")} className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation active:scale-[0.97] ${jobType === "producten" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-semibold">Producten</p>
                <p className="text-xs text-muted-foreground mt-1">Selecteer producten uit de catalogus</p>
              </button>
              <button onClick={() => setJobType("ontruiming")} className={`rounded-xl border-2 p-4 text-left transition-all touch-manipulation active:scale-[0.97] ${jobType === "ontruiming" ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="text-sm font-semibold">Ontruiming</p>
                <p className="text-xs text-muted-foreground mt-1">Selecteer producten, stel adviesprijs samen</p>
              </button>
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

      {/* Step 3: Producten selecteren via categorieën/cards */}
      {step === 2 && (
        <div className="space-y-3">
          {!activeCategoryId ? (
            <>
              {/* Category cards grid */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Categorieën</h2>
                  <p className="text-xs text-muted-foreground">Kies een categorie om producten te selecteren</p>
                </div>
                {selectedProducts.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{selectedProducts.length} geselecteerd</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {categories.map(cat => {
                  // Count selected products in this category
                  const catProductIds = categoryLinks.filter(l => l.category_id === cat.id).map(l => l.product_id);
                  const catProducts = products.filter(p => catProductIds.includes(p.id) || p.category_id === cat.id);
                  const selectedInCat = selectedProducts.filter(sp => catProducts.some(cp => cp.id === sp.product_id));
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategoryId(cat.id); setProductSearch(""); }}
                      className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-all touch-manipulation active:scale-[0.95] relative shadow-sm"
                    >
                      {selectedInCat.length > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                          {selectedInCat.reduce((s, p) => s + p.quantity, 0)}
                        </div>
                      )}
                      <div className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center text-primary">
                        {renderLucideIcon(cat.icon, "h-6 w-6 sm:h-7 sm:w-7")}
                      </div>
                      <span className="text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected products summary */}
              {selectedProducts.length > 0 && (
                <Card className="mt-3">
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-xs font-semibold">Geselecteerde producten</p>
                    {selectedProducts.map((sp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{sp.description} ×{sp.quantity}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="font-medium">{formatPrice(sp.quantity * sp.unit_price)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedProducts(selectedProducts.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs font-bold text-right border-t pt-1.5">Subtotaal: {formatPrice(productsTotal)}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Product cards within category */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => { setActiveCategoryId(null); setProductSearch(""); }}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Terug naar categorieën
                </Button>
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Zoek product..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-8 h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                {categoryProducts.map(product => {
                  const qty = getProductQuantity(product.id);
                  const isSelected = qty > 0;

                    return (
                    <div
                      key={product.id}
                      onClick={() => !isSelected && setProductQuantity(product, 1)}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all shadow-sm cursor-pointer touch-manipulation active:scale-[0.97] ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card"}`}
                    >
                      <div className="h-10 w-10 flex items-center justify-center text-primary mb-1.5">
                        {renderLucideIcon(product.icon, "h-6 w-6")}
                      </div>
                      <p className="text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2 mb-0.5">{product.name}</p>
                      {product.description && (
                        <p className="text-[9px] text-muted-foreground text-center line-clamp-2 mb-1">{product.description}</p>
                      )}

                      {/* Quantity controls */}
                      {isSelected ? (
                        <div className="flex items-center gap-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setProductQuantity(product, -1)}
                            className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90 transition-transform"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{qty}</span>
                          <button
                            onClick={() => setProductQuantity(product, 1)}
                            className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center touch-manipulation active:scale-90 transition-transform"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-auto h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <Plus className="h-4 w-4" />
                        </div>
                      )}

                      <span className="text-[10px] text-muted-foreground mt-1">{formatPrice(product.price)}</span>
                    </div>
                  );
                })}
              </div>

              {categoryProducts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Geen producten in deze categorie</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4: Kosten */}
      {step === 3 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Kosten & Korting</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            {/* Product summary with delete option */}
            {selectedProducts.length > 0 && (
              <div className="border rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold">Geselecteerde producten</p>
                {selectedProducts.map((sp, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate flex-1">{sp.description}</span>
                    <span className="text-xs text-muted-foreground shrink-0">×{sp.quantity}</span>
                    <span className="text-xs font-medium shrink-0">{formatPrice(sp.quantity * sp.unit_price)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelectedProducts(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs font-bold text-right border-t pt-1.5">Subtotaal producten: {formatPrice(productsTotal)}</p>
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

      {/* Step 5: Werkadres */}
      {step === 4 && (
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-base">Werkadres & Planning</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
            <AddressFields
              address={workAddress}
              postalCode={workPostalCode}
              city={workCity}
              onAddressChange={setWorkAddress}
              onPostalCodeChange={setWorkPostalCode}
              onCityChange={setWorkCity}
            />
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

      {/* Sticky bottom: total + navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:static sm:z-auto">
        {/* Running total bar - visible during product selection steps */}
        {selectedProducts.length > 0 && (step === 1 || step === 2 || step === 3) && (
          <div className="bg-card border-t sm:rounded-xl sm:border sm:mb-2 sm:mx-0">
            <button
              onClick={() => setTotalBarExpanded(!totalBarExpanded)}
              className="w-full px-4 py-2 flex items-center justify-between touch-manipulation"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{selectedProducts.reduce((s, p) => s + p.quantity, 0)} items</Badge>
                <span className="text-xs text-muted-foreground">{selectedProducts.length} product(en)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">{formatPrice(productsTotal)}</span>
                <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${totalBarExpanded ? "rotate-90" : "-rotate-90"}`} />
              </div>
            </button>
            {totalBarExpanded && (
              <div className="px-4 pb-3 space-y-1.5 border-t pt-2 max-h-48 overflow-y-auto">
                {selectedProducts.map((sp, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate flex-1">{sp.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setSelectedProducts(prev => prev.map((p, idx) => idx === i ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p)); }}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs w-5 text-center font-medium">{sp.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setSelectedProducts(prev => prev.map((p, idx) => idx === i ? { ...p, quantity: p.quantity + 1 } : p)); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-xs font-medium shrink-0 w-16 text-right">{formatPrice(sp.quantity * sp.unit_price)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); setSelectedProducts(prev => prev.filter((_, idx) => idx !== i)); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between bg-background/95 backdrop-blur py-3 px-4 sm:static sm:px-0 sm:py-0 sm:bg-transparent border-t sm:border-0">
          <Button variant="outline" size="sm" onClick={() => {
            if (step === 2 && activeCategoryId) {
              setActiveCategoryId(null);
              setProductSearch("");
            } else if (step > 0) {
              setStep(step - 1);
            } else {
              navigate("/admin/klussen");
            }
          }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {step === 0 ? "Annuleren" : step === 2 && activeCategoryId ? "Categorieën" : "Vorige"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>Volgende <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          ) : (
            <Button size="sm" onClick={handleSubmit}><Check className="mr-1.5 h-4 w-4" /> Aanmaken</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NieuweKlus;
