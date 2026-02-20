import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, FolderPlus, Upload, Layers } from "lucide-react";
import { icons } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import IconPicker from "@/components/IconPicker";
import * as XLSX from "xlsx";
import type { Product, ProductCategory } from "@/types/database";

const Producten = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [bulkCatDialogOpen, setBulkCatDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category_id: "", icon: "" });
  const [catForm, setCatForm] = useState({ name: "", description: "", icon: "" });
  const [bulkCatText, setBulkCatText] = useState("");
  const [importData, setImportData] = useState<any[]>([]);
  const [importCategoryId, setImportCategoryId] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*, product_categories(*)").order("name"),
      supabase.from("product_categories").select("*").order("name"),
    ]);
    setProducts((prods as any[]) || []);
    setCategories((cats as ProductCategory[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter((p) => {
    const matchSearch = [p.name, p.description].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchCat = activeCategory === "all" || p.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", price: "", category_id: "", icon: "" }); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || "", price: String(p.price), category_id: p.category_id || "", icon: p.icon || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Naam is verplicht", variant: "destructive" }); return; }
    const payload = { name: form.name, description: form.description || null, price: parseFloat(form.price) || 0, category_id: form.category_id || null, icon: form.icon || null };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product bijgewerkt" });
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product toegevoegd" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("products").delete().eq("id", deleteId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Product verwijderd" });
    setDeleteId(null);
    fetchData();
  };

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) { toast({ title: "Naam is verplicht", variant: "destructive" }); return; }
    const { error } = await supabase.from("product_categories").insert({ name: catForm.name, description: catForm.description || null, icon: catForm.icon || null });
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Categorie toegevoegd" });
    setCatDialogOpen(false);
    setCatForm({ name: "", description: "", icon: "" });
    fetchData();
  };

  const handleBulkCategories = async () => {
    const lines = bulkCatText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast({ title: "Voer minimaal één categorie in", variant: "destructive" }); return; }
    const payload = lines.map((name) => ({ name }));
    const { error } = await supabase.from("product_categories").insert(payload);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${lines.length} categorieën toegevoegd` });
    setBulkCatDialogOpen(false);
    setBulkCatText("");
    fetchData();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        setImportData(data);
        if (data.length === 0) toast({ title: "Leeg bestand", variant: "destructive" });
      } catch {
        toast({ title: "Ongeldig bestand", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    // Map columns: expects "naam" or "name", "beschrijving" or "description", "prijs" or "price"
    const payload = importData.map((row) => ({
      name: String(row.naam || row.name || row.Naam || row.Name || "").trim(),
      description: String(row.beschrijving || row.description || row.Beschrijving || row.Description || "").trim() || null,
      price: parseFloat(String(row.prijs || row.price || row.Prijs || row.Price || "0").replace(",", ".")) || 0,
      category_id: importCategoryId || null,
      icon: String(row.icoon || row.icon || row.Icoon || row.Icon || "").trim() || null,
    })).filter((p) => p.name);

    if (payload.length === 0) { toast({ title: "Geen geldige producten gevonden", description: "Zorg dat je kolom 'naam' of 'name' hebt", variant: "destructive" }); setImporting(false); return; }

    const { error } = await supabase.from("products").insert(payload);
    if (error) { toast({ title: "Fout bij import", description: error.message, variant: "destructive" }); }
    else { toast({ title: `${payload.length} producten geïmporteerd` }); setImportDialogOpen(false); setImportData([]); fetchData(); }
    setImporting(false);
  };

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  const renderIcon = (iconName: string | null | undefined) => {
    if (!iconName || !(iconName in icons)) return null;
    const LucideIcon = icons[iconName as keyof typeof icons];
    return <LucideIcon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Producten</h1>
          <p className="text-muted-foreground">Productcatalogus beheren</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Excel import</Button>
          <Button variant="outline" onClick={() => setBulkCatDialogOpen(true)}><Layers className="mr-2 h-4 w-4" /> Bulk categorieën</Button>
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}><FolderPlus className="mr-2 h-4 w-4" /> Categorie</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Product</Button>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Alle ({products.length})</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
              {renderIcon((c as any).icon)}
              {c.name} ({products.filter((p) => p.category_id === c.id).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Zoek producten..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Laden...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{search ? "Geen resultaten." : "Nog geen producten."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Prijs</TableHead>
                  <TableHead className="w-[100px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{renderIcon(p.icon)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.description && <p className="text-sm text-muted-foreground truncate max-w-xs">{p.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.product_categories ? (
                        <Badge variant="secondary" className="gap-1">
                          {renderIcon(p.product_categories.icon)}
                          {p.product_categories.name}
                        </Badge>
                      ) : <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(p.price)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Product bewerken" : "Nieuw product"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naam *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Beschrijving</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prijs (€)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Categorie</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Kies categorie" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Icoon</Label>
              <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleSave}>{editing ? "Opslaan" : "Toevoegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuwe categorie</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naam *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Beschrijving</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Icoon</Label>
              <IconPicker value={catForm.icon} onChange={(icon) => setCatForm({ ...catForm, icon })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleAddCategory}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk categories dialog */}
      <Dialog open={bulkCatDialogOpen} onOpenChange={setBulkCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk categorieën aanmaken</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Categorieën (één per regel)</Label>
              <Textarea
                value={bulkCatText}
                onChange={(e) => setBulkCatText(e.target.value)}
                rows={10}
                placeholder={"Meubels\nElektronica\nKleding\nBoeken\nHuishoudelijk\nTuinartikelen"}
              />
              <p className="text-xs text-muted-foreground">
                {bulkCatText.split("\n").filter((l) => l.trim()).length} categorieën
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCatDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleBulkCategories}>Aanmaken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setImportData([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Producten importeren vanuit Excel</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Excel bestand (.xlsx, .xls, .csv)</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground">
                Kolommen: <strong>naam</strong> (verplicht), <strong>beschrijving</strong>, <strong>prijs</strong>, <strong>icoon</strong> (Lucide icon naam)
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Categorie voor alle producten</Label>
              <Select value={importCategoryId} onValueChange={setImportCategoryId}>
                <SelectTrigger><SelectValue placeholder="Geen (of kies categorie)" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {importData.length > 0 && (
              <div className="border rounded-lg overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(importData[0]).map((key) => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <TableCell key={j} className="text-xs py-1">{String(val)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importData.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">...en {importData.length - 10} meer rijen</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportData([]); }}>Annuleren</Button>
            <Button onClick={handleImport} disabled={importData.length === 0 || importing}>
              {importing ? "Importeren..." : `${importData.length} producten importeren`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Product verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit product wordt permanent verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Producten;
