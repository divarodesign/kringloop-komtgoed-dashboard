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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Plus, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Product, ProductCategory } from "@/types/database";

const STEPS = ["Klantgegevens", "Type opdracht", "Kosten & Korting", "Werkadres & Planning", "Overzicht"];

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

  // Form state
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

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*, product_categories(*)").eq("is_active", true).order("name"),
    ]).then(([{ data: c }, { data: p }]) => {
      setCustomers((c as Customer[]) || []);
      setProducts((p as Product[]) || []);
      setLoading(false);
    });
  }, []);

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/klussen")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nieuwe klus</h1>
          <p className="text-muted-foreground">Stap {step + 1} van {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 1: Klantgegevens */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Klantgegevens</CardTitle>
            <CardDescription>Selecteer een bestaande klant of maak een nieuwe aan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Klusnaam *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Ontruiming woning Amsterdam" />
            </div>
            <div className="grid gap-2">
              <Label>Beschrijving</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optionele beschrijving..." />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="new" checked={newCustomer} onCheckedChange={(c) => setNewCustomer(!!c)} />
              <Label htmlFor="new">Nieuwe klant aanmaken</Label>
            </div>
            {newCustomer ? (
              <div className="grid gap-4 border rounded-lg p-4">
                <div className="grid gap-2"><Label>Naam *</Label><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>E-mail</Label><Input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Telefoon</Label><Input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Adres</Label><Input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Postcode</Label><Input value={customerForm.postal_code} onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Plaats</Label><Input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} /></div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Bestaande klant *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Selecteer een klant" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Afstand (km) — voor berekening voorrijkosten</Label>
              <Input type="number" value={travelKm} onChange={(e) => setTravelKm(e.target.value)} placeholder="Bijv. 50" />
              {travelKm && <p className="text-sm text-muted-foreground">Voorrijkosten: {formatPrice(travelCost)}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Type opdracht */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Type opdracht</CardTitle>
            <CardDescription>Kies het type en voeg producten toe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setJobType("producten")} className={`rounded-lg border-2 p-4 text-left transition-colors ${jobType === "producten" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <p className="font-medium">Producten</p>
                <p className="text-sm text-muted-foreground">Selecteer producten uit de catalogus</p>
              </button>
              <button onClick={() => setJobType("ontruiming")} className={`rounded-lg border-2 p-4 text-left transition-colors ${jobType === "ontruiming" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <p className="font-medium">Ontruiming</p>
                <p className="text-sm text-muted-foreground">Selecteer producten, stel adviesprijs samen</p>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Producten</Label>
                <Button variant="outline" size="sm" onClick={addProduct}><Plus className="mr-1 h-3 w-3" /> Product</Button>
              </div>
              {selectedProducts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nog geen producten toegevoegd</p>}
              {selectedProducts.map((sp, i) => (
                <div key={i} className="flex gap-2 items-end border rounded-lg p-3">
                  <div className="flex-1 grid gap-1">
                    <Label className="text-xs">Product</Label>
                    <Select value={sp.product_id || ""} onValueChange={(v) => updateProduct(i, "product_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Kies product" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 grid gap-1">
                    <Label className="text-xs">Aantal</Label>
                    <Input type="number" min={1} value={sp.quantity} onChange={(e) => updateProduct(i, "quantity", parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="w-28 grid gap-1">
                    <Label className="text-xs">Prijs</Label>
                    <Input type="number" step="0.01" value={sp.unit_price} onChange={(e) => updateProduct(i, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeProduct(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {selectedProducts.length > 0 && (
                <p className="text-sm font-medium text-right">Subtotaal producten: {formatPrice(productsTotal)}</p>
              )}
            </div>

            {jobType === "ontruiming" && selectedProducts.length > 0 && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm">Adviesprijs (op basis van producten): <span className="font-medium">{formatPrice(advisedPrice)}</span></p>
                <div className="grid gap-2">
                  <Label>Eigen prijs (optioneel)</Label>
                  <Input type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Laat leeg voor adviesprijs" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Kosten & Korting */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Kosten & Korting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Overige kosten (€)</Label>
              <Input type="number" step="0.01" value={extraCosts} onChange={(e) => setExtraCosts(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>Omschrijving overige kosten</Label>
              <Input value={extraCostsDesc} onChange={(e) => setExtraCostsDesc(e.target.value)} placeholder="Bijv. materiaalkosten" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Korting type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger><SelectValue placeholder="Geen korting" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Vast bedrag (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType && (
                <div className="grid gap-2">
                  <Label>Korting waarde</Label>
                  <Input type="number" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
              )}
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Voorrijkosten</span><span>{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span>{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Overige kosten</span><span>{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span>Korting</span><span>-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Werkadres & Planning */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Werkadres & Planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Werkadres</Label>
              <Input value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} placeholder="Straat en huisnummer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Postcode</Label><Input value={workPostalCode} onChange={(e) => setWorkPostalCode(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Plaats</Label><Input value={workCity} onChange={(e) => setWorkCity(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="direct" checked={isDirect} onCheckedChange={(c) => { setIsDirect(!!c); if (c) setScheduledDate(""); }} />
              <Label htmlFor="direct">Direct uitvoeren</Label>
            </div>
            {!isDirect && (
              <div className="grid gap-2">
                <Label>Geplande datum</Label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Overzicht */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Overzicht</CardTitle>
            <CardDescription>Controleer de gegevens en maak de klus aan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Klus:</span> <span className="font-medium">{title}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <Badge variant="secondary" className="capitalize">{jobType}</Badge></div>
              <div><span className="text-muted-foreground">Klant:</span> <span className="font-medium">{newCustomer ? customerForm.name : customers.find(c => c.id === customerId)?.name}</span></div>
              <div><span className="text-muted-foreground">Planning:</span> <span className="font-medium">{isDirect ? "Direct" : scheduledDate || "-"}</span></div>
              {workAddress && <div className="col-span-2"><span className="text-muted-foreground">Werkadres:</span> <span className="font-medium">{[workAddress, workPostalCode, workCity].filter(Boolean).join(", ")}</span></div>}
            </div>
            {selectedProducts.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Aantal</TableHead><TableHead className="text-right">Prijs</TableHead><TableHead className="text-right">Totaal</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedProducts.map((p, i) => (
                    <TableRow key={i}><TableCell>{p.description}</TableCell><TableCell className="text-right">{p.quantity}</TableCell><TableCell className="text-right">{formatPrice(p.unit_price)}</TableCell><TableCell className="text-right">{formatPrice(p.quantity * p.unit_price)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Voorrijkosten</span><span>{formatPrice(travelCost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{jobType === "ontruiming" ? "Ontruiming" : "Producten"}</span><span>{formatPrice(subtotal)}</span></div>
              {extra > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Overige kosten</span><span>{formatPrice(extra)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-destructive"><span>Korting</span><span>-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate("/admin/klussen")} >
          <ArrowLeft className="mr-2 h-4 w-4" /> {step === 0 ? "Annuleren" : "Vorige"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}> Volgende <ArrowRight className="ml-2 h-4 w-4" /></Button>
        ) : (
          <Button onClick={handleSubmit}><Check className="mr-2 h-4 w-4" /> Klus aanmaken</Button>
        )}
      </div>
    </div>
  );
};

export default NieuweKlus;
