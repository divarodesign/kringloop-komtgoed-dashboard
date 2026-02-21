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
import { Checkbox } from "@/components/ui/checkbox";

import { Plus, Search, Pencil, Trash2, FolderPlus, Upload, Layers, Download, AlertTriangle } from "lucide-react";
import { icons } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import IconPicker from "@/components/IconPicker";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { Product, ProductCategory } from "@/types/database";

interface MultiCatProduct {
  existingProductId: string;
  name: string;
  existingCategories: string[];
  newCategory: string;
  newCategoryId: string;
  selected: boolean;
}

type ImportRowStatus = 'new' | 'duplicate' | 'multi_cat' | 'new_extra_cat';

interface AnalyzedRow {
  name: string;
  description: string;
  price: number;
  category: string;
  category_id: string | null;
  status: ImportRowStatus;
  existingCategories?: string[];
  icon: string | null;
}

const Producten = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productCategoryLinks, setProductCategoryLinks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [bulkCatDialogOpen, setBulkCatDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [multiCatDialogOpen, setMultiCatDialogOpen] = useState(false);
  const [multiCatProducts, setMultiCatProducts] = useState<MultiCatProduct[]>([]);
  const [pendingNewProducts, setPendingNewProducts] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category_id: "", icon: "" });
  const [catForm, setCatForm] = useState({ name: "", description: "", icon: "" });
  const [bulkCatText, setBulkCatText] = useState("");
  const [importData, setImportData] = useState<any[]>([]);
  const [analyzedRows, setAnalyzedRows] = useState<AnalyzedRow[]>([]);
  const [importCategoryId, setImportCategoryId] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: prods }, { data: cats }, { data: links }] = await Promise.all([
      supabase.from("products").select("*, product_categories(*)").order("name"),
      supabase.from("product_categories").select("*").order("name"),
      supabase.from("product_category_links").select("*, product_categories(*)"),
    ]);
    setProducts((prods as any[]) || []);
    setCategories((cats as ProductCategory[]) || []);
    setProductCategoryLinks(links || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Get all categories for a product (from junction table)
  const getCategoriesForProduct = (productId: string) => {
    return productCategoryLinks
      .filter((l) => l.product_id === productId)
      .map((l) => l.product_categories)
      .filter(Boolean);
  };

  const filtered = products.filter((p) => {
    const matchSearch = [p.name, p.description].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    if (activeCategory === "all") return matchSearch;
    // Check both legacy category_id and junction table
    const linkedCatIds = productCategoryLinks
      .filter((l) => l.product_id === p.id)
      .map((l) => l.category_id);
    return matchSearch && (p.category_id === activeCategory || linkedCatIds.includes(activeCategory));
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
      // Update category link
      if (form.category_id) {
        await supabase.from("product_category_links").upsert(
          { product_id: editing.id, category_id: form.category_id },
          { onConflict: "product_id,category_id" }
        );
      }
      toast({ title: "Product bijgewerkt" });
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
      // Create category link
      if (data && form.category_id) {
        await supabase.from("product_category_links").insert({ product_id: data.id, category_id: form.category_id });
      }
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

  // Auto-icon mapping
  const iconKeywords: Record<string, string[]> = {
    Sofa: ["bank", "sofa", "zetel", "couch"],
    Bed: ["bed", "matras", "slaap"],
    ArmchairIcon: ["stoel", "fauteuil", "chair"],
    Table: ["tafel", "bureau", "desk"],
    Lamp: ["lamp", "verlichting", "light"],
    Tv: ["tv", "televisie", "scherm", "monitor"],
    Refrigerator: ["koelkast", "vriezer", "fridge"],
    WashingMachine: ["wasmachine", "droger", "washer"],
    Microwave: ["magnetron", "oven", "microwave"],
    Bike: ["fiets", "bike"],
    Car: ["auto", "car", "voertuig"],
    Shirt: ["kleding", "shirt", "broek", "jas", "clothes"],
    BookOpen: ["boek", "book", "magazine"],
    Monitor: ["computer", "laptop", "pc"],
    Smartphone: ["telefoon", "phone", "mobiel", "smartphone"],
    Music: ["muziek", "instrument", "piano", "gitaar"],
    Dumbbell: ["sport", "fitness", "gym"],
    Flower2: ["tuin", "plant", "bloem", "garden"],
    Utensils: ["keuken", "bestek", "pan", "bord"],
    Package: ["doos", "box", "verpakking", "container"],
    Trash2: ["afval", "grof", "puin", "sloop"],
    TreePine: ["hout", "plank", "timber"],
    Paintbrush: ["verf", "decoratie", "schilderij"],
    Baby: ["baby", "kinder", "speelgoed"],
    GraduationCap: ["school", "kantoor", "office"],
    Wine: ["horeca", "restaurant", "bar"],
    Wrench: ["gereedschap", "tool", "werktuig"],
  };

  const guessIcon = (name: string): string | null => {
    const lower = name.toLowerCase();
    for (const [icon, keywords] of Object.entries(iconKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) return icon;
    }
    return "Package";
  };

  const downloadTemplate = async () => {
    const catNames = categories.map((c) => c.name);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Producten");
    ws.columns = [
      { header: "naam", key: "naam", width: 30 },
      { header: "beschrijving", key: "beschrijving", width: 40 },
      { header: "prijs", key: "prijs", width: 12 },
      { header: "categorie", key: "categorie", width: 25 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRow({ naam: "Voorbeeld product", beschrijving: "Beschrijving hier", prijs: 25.00, categorie: catNames[0] || "" });
    if (catNames.length > 0) {
      for (let i = 2; i <= 500; i++) {
        ws.getCell(`D${i}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${catNames.join(",")}"`],
        };
      }
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "producten-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template gedownload", description: "Open in Excel en gebruik de dropdown bij 'categorie'." });
  };

  const analyzeImportData = (data: any[]) => {
    const catMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
    const catIdToName = new Map(categories.map((c) => [c.id, c.name]));

    const existingProductMap = new Map<string, { id: string; categoryIds: string[] }>();
    for (const p of products) {
      const key = p.name.toLowerCase().trim();
      const linkedCatIds = productCategoryLinks
        .filter((l) => l.product_id === p.id)
        .map((l) => l.category_id as string);
      if (p.category_id && !linkedCatIds.includes(p.category_id)) {
        linkedCatIds.push(p.category_id);
      }
      existingProductMap.set(key, { id: p.id, categoryIds: linkedCatIds });
    }

    // Track new products we've seen in this import (with their categories)
    const seenNew = new Map<string, Set<string>>(); // name -> set of category_ids

    const rows: AnalyzedRow[] = data.map((row) => {
      const name = String(row.naam || row.name || row.Naam || row.Name || "").trim();
      const catName = String(row.categorie || row.category || row.Categorie || row.Category || "").trim();
      const matchedCatId = catMap.get(catName.toLowerCase()) || importCategoryId || null;
      const description = String(row.beschrijving || row.description || row.Beschrijving || row.Description || "").trim();
      const price = parseFloat(String(row.prijs || row.price || row.Prijs || row.Price || "0").replace(",", ".")) || 0;
      const categoryLabel = catName || (importCategoryId ? catIdToName.get(importCategoryId) || "" : "");

      if (!name) return null as any;
      const key = name.toLowerCase().trim();

      const existing = existingProductMap.get(key);

      if (existing) {
        if (matchedCatId && !existing.categoryIds.includes(matchedCatId)) {
          return {
            name, description, price, category: categoryLabel, category_id: matchedCatId,
            status: 'multi_cat' as ImportRowStatus,
            existingCategories: existing.categoryIds.map((id) => catIdToName.get(id) || "Onbekend"),
            icon: guessIcon(name),
          };
        }
        return {
          name, description, price, category: categoryLabel, category_id: matchedCatId,
          status: 'duplicate' as ImportRowStatus,
          icon: guessIcon(name),
        };
      }

      // New product - check if we've already seen it in this import
      const seenCats = seenNew.get(key);
      if (seenCats) {
        // Already seen this product name - it's an extra category for a new product
        if (matchedCatId && !seenCats.has(matchedCatId)) {
          seenCats.add(matchedCatId);
          return {
            name, description, price, category: categoryLabel, category_id: matchedCatId,
            status: 'new_extra_cat' as ImportRowStatus,
            icon: guessIcon(name),
          };
        }
        // Same product, same category = true duplicate
        return {
          name, description, price, category: categoryLabel, category_id: matchedCatId,
          status: 'duplicate' as ImportRowStatus,
          icon: guessIcon(name),
        };
      }

      // First time seeing this product
      const catSet = new Set<string>();
      if (matchedCatId) catSet.add(matchedCatId);
      seenNew.set(key, catSet);
      return {
        name, description, price, category: categoryLabel, category_id: matchedCatId,
        status: 'new' as ImportRowStatus,
        icon: guessIcon(name),
      };
    }).filter(Boolean);

    setAnalyzedRows(rows);
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

  // Re-analyze when importData or importCategoryId changes
  useEffect(() => {
    if (importData.length > 0) analyzeImportData(importData);
    else setAnalyzedRows([]);
  }, [importData, importCategoryId, products, productCategoryLinks]);

  const handleImport = async () => {
    if (analyzedRows.length === 0) return;
    setImporting(true);

    const catIdToName = new Map(categories.map((c) => [c.id, c.name]));

    // Build existing product lookup
    const existingProductMap = new Map<string, { id: string; categoryIds: string[] }>();
    for (const p of products) {
      const key = p.name.toLowerCase().trim();
      const linkedCatIds = productCategoryLinks
        .filter((l) => l.product_id === p.id)
        .map((l) => l.category_id as string);
      if (p.category_id && !linkedCatIds.includes(p.category_id)) linkedCatIds.push(p.category_id);
      existingProductMap.set(key, { id: p.id, categoryIds: linkedCatIds });
    }

    const newRows = analyzedRows.filter((r) => r.status === 'new');
    const newExtraCatRows = analyzedRows.filter((r) => r.status === 'new_extra_cat');
    const multiCatRows = analyzedRows.filter((r) => r.status === 'multi_cat');

    // If multi-cat items exist (existing products needing new categories), show confirmation dialog
    if (multiCatRows.length > 0) {
      const multiCatItems: MultiCatProduct[] = [];
      const seenKeys = new Set<string>();
      for (const row of multiCatRows) {
        const existing = existingProductMap.get(row.name.toLowerCase().trim());
        if (!existing || !row.category_id) continue;
        const uniqueKey = `${existing.id}_${row.category_id}`;
        if (seenKeys.has(uniqueKey)) continue;
        seenKeys.add(uniqueKey);
        multiCatItems.push({
          existingProductId: existing.id,
          name: row.name,
          existingCategories: row.existingCategories || [],
          newCategory: catIdToName.get(row.category_id) || "Onbekend",
          newCategoryId: row.category_id,
          selected: true,
        });
      }
      setMultiCatProducts(multiCatItems);
      setPendingNewProducts(newRows.map((r) => ({
        name: r.name, description: r.description || null, price: r.price,
        category_id: r.category_id, icon: r.icon,
      })));
      setMultiCatDialogOpen(true);
      setImporting(false);
      return;
    }

    // No multi-cat for existing products, just import new products + their extra categories
    const payload = newRows.map((r) => ({
      name: r.name, description: r.description || null, price: r.price,
      category_id: r.category_id, icon: r.icon,
    }));
    await executeImport(payload, [], newExtraCatRows);
  };

  const executeImport = async (newProducts: any[], categoryLinks: { productId: string; categoryId: string }[], newExtraCatRows: AnalyzedRow[] = []) => {
    setImporting(true);
    let importedCount = 0;
    let linkedCount = 0;

    // Insert new products
    if (newProducts.length > 0) {
      const { data: inserted, error } = await supabase.from("products").insert(newProducts).select();
      if (error) {
        toast({ title: "Fout bij import", description: error.message, variant: "destructive" });
        setImporting(false);
        return;
      }
      importedCount = inserted?.length || 0;

      // Create category links for new products (primary category)
      if (inserted) {
        const newLinks = inserted
          .filter((p) => p.category_id)
          .map((p) => ({ product_id: p.id, category_id: p.category_id }));

        // Also add extra category links for new products that appear multiple times in the Excel
        for (const extraRow of newExtraCatRows) {
          if (!extraRow.category_id) continue;
          const matchedProduct = inserted.find((p) => p.name.toLowerCase().trim() === extraRow.name.toLowerCase().trim());
          if (matchedProduct) {
            newLinks.push({ product_id: matchedProduct.id, category_id: extraRow.category_id });
          }
        }

        if (newLinks.length > 0) {
          await supabase.from("product_category_links").insert(newLinks);
          linkedCount += newExtraCatRows.filter((r) => r.category_id).length;
        }
      }
    }

    // Create additional category links for existing products
    if (categoryLinks.length > 0) {
      const links = categoryLinks.map((l) => ({ product_id: l.productId, category_id: l.categoryId }));
      const { error } = await supabase.from("product_category_links").insert(links);
      if (error) {
        toast({ title: "Fout bij categorie-links", description: error.message, variant: "destructive" });
      } else {
        linkedCount = links.length;
      }
    }

    const parts: string[] = [];
    if (importedCount > 0) parts.push(`${importedCount} nieuwe producten`);
    if (linkedCount > 0) parts.push(`${linkedCount} extra categorie-koppelingen`);

    toast({
      title: parts.length > 0 ? parts.join(", ") : "Geen wijzigingen",
      description: importedCount > 0 ? "Icons automatisch toegewezen." : undefined,
    });

    setImportDialogOpen(false);
    setMultiCatDialogOpen(false);
    setImportData([]);
    setMultiCatProducts([]);
    setPendingNewProducts([]);
    fetchData();
    setImporting(false);
  };

  const handleConfirmMultiCat = async () => {
    const selectedLinks = multiCatProducts
      .filter((m) => m.selected)
      .map((m) => ({ productId: m.existingProductId, categoryId: m.newCategoryId }));

    const newExtraCatRows = analyzedRows.filter((r) => r.status === 'new_extra_cat');
    await executeImport(pendingNewProducts, selectedLinks, newExtraCatRows);
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

      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Categorie:</Label>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Alle categorieën" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën ({products.length})</SelectItem>
                {categories.map((c) => {
                  const count = products.filter((p) => {
                    const linkedCatIds = productCategoryLinks.filter((l) => l.product_id === p.id).map((l) => l.category_id);
                    return p.category_id === c.id || linkedCatIds.includes(c.id);
                  }).length;
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Categorieën</TableHead>
                  <TableHead className="text-right">Prijs</TableHead>
                  <TableHead className="w-[100px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => {
                  const linkedCats = getCategoriesForProduct(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{renderIcon(p.icon)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{p.name}</span>
                          {p.description && <p className="text-sm text-muted-foreground truncate max-w-xs">{p.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {linkedCats.length > 0 ? linkedCats.map((cat: any) => (
                            <Badge key={cat.id} variant="secondary" className="gap-1">
                              {renderIcon(cat.icon)}
                              {cat.name}
                            </Badge>
                          )) : p.product_categories ? (
                            <Badge variant="secondary" className="gap-1">
                              {renderIcon(p.product_categories.icon)}
                              {p.product_categories.name}
                            </Badge>
                          ) : <span className="text-muted-foreground text-sm">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(p.price)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
            <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/50">
              <Download className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Stap 1: Download het template</p>
                <p className="text-xs text-muted-foreground">Excel bestand met categorie-dropdown en voorbeelddata</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Template downloaden
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>Stap 2: Upload je ingevulde bestand</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground">
                Kolommen: <strong>naam</strong> (verplicht), <strong>beschrijving</strong>, <strong>prijs</strong>, <strong>categorie</strong> (naam van bestaande categorie)
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Fallback categorie (als kolom 'categorie' leeg is)</Label>
              <Select value={importCategoryId} onValueChange={setImportCategoryId}>
                <SelectTrigger><SelectValue placeholder="Geen fallback categorie" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">💡 <strong>Dubbele producten</strong> worden niet opnieuw aangemaakt. Als een product al bestaat maar in een andere categorie staat, kun je het aan meerdere categorieën koppelen.</p>
            </div>
            {analyzedRows.length > 0 && (() => {
              const newCount = analyzedRows.filter((r) => r.status === 'new').length;
              const dupCount = analyzedRows.filter((r) => r.status === 'duplicate').length;
              const multiCount = analyzedRows.filter((r) => r.status === 'multi_cat').length;
              const newExtraCount = analyzedRows.filter((r) => r.status === 'new_extra_cat').length;
              return (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{newCount} nieuw</Badge>
                    {newExtraCount > 0 && <Badge variant="secondary" className="bg-accent text-accent-foreground">{newExtraCount} extra categorie (nieuw product)</Badge>}
                    {dupCount > 0 && <Badge variant="secondary" className="bg-muted text-muted-foreground">{dupCount} dubbel (overgeslagen)</Badge>}
                    {multiCount > 0 && <Badge variant="secondary" className="bg-accent text-accent-foreground">{multiCount} extra categorie (bestaand)</Badge>}
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-[70px]">Status</TableHead>
                          <TableHead className="text-xs">Naam</TableHead>
                          <TableHead className="text-xs">Beschrijving</TableHead>
                          <TableHead className="text-xs">Prijs</TableHead>
                          <TableHead className="text-xs">Categorie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyzedRows.slice(0, 20).map((row, i) => (
                          <TableRow key={i} className={row.status === 'duplicate' ? 'opacity-40' : ''}>
                            <TableCell className="text-xs py-1">
                              {row.status === 'new' && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Nieuw</Badge>}
                              {row.status === 'duplicate' && <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">Dubbel</Badge>}
                              {row.status === 'multi_cat' && <Badge variant="secondary" className="text-[10px] bg-accent text-accent-foreground">+ Cat</Badge>}
                              {row.status === 'new_extra_cat' && <Badge variant="secondary" className="text-[10px] bg-accent text-accent-foreground">+ Cat</Badge>}
                            </TableCell>
                            <TableCell className="text-xs py-1">{row.name}</TableCell>
                            <TableCell className="text-xs py-1">{row.description}</TableCell>
                            <TableCell className="text-xs py-1">€ {row.price.toFixed(2)}</TableCell>
                            <TableCell className="text-xs py-1">{row.category || <span className="text-muted-foreground">-</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {analyzedRows.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">...en {analyzedRows.length - 20} meer rijen</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportData([]); }}>Annuleren</Button>
            <Button onClick={handleImport} disabled={analyzedRows.length === 0 || importing || (analyzedRows.filter((r) => r.status !== 'duplicate').length === 0)}>
              {importing ? "Importeren..." : (() => {
                const newCount = analyzedRows.filter((r) => r.status === 'new').length;
                const multiCount = analyzedRows.filter((r) => r.status === 'multi_cat').length;
                const extraCatCount = analyzedRows.filter((r) => r.status === 'new_extra_cat').length;
                const totalLinks = multiCount + extraCatCount;
                const parts: string[] = [];
                if (newCount > 0) parts.push(`${newCount} nieuw`);
                if (totalLinks > 0) parts.push(`${totalLinks} koppeling${totalLinks > 1 ? 'en' : ''}`);
                return parts.length > 0 ? `${parts.join(" + ")} importeren` : "Geen nieuwe producten";
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-category confirmation dialog */}
      <Dialog open={multiCatDialogOpen} onOpenChange={(open) => { if (!open) { setMultiCatDialogOpen(false); setMultiCatProducts([]); setPendingNewProducts([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Producten in meerdere categorieën
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              De volgende producten bestaan al maar staan in het Excel bestand bij een andere categorie.
              Vink aan welke producten je aan de extra categorie wilt koppelen.
            </p>
            <div className="border rounded-lg overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Huidige categorie(ën)</TableHead>
                    <TableHead>Nieuwe categorie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multiCatProducts.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(checked) => {
                            setMultiCatProducts((prev) =>
                              prev.map((m, j) => j === i ? { ...m, selected: !!checked } : m)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.existingCategories.map((cat, j) => (
                            <Badge key={j} variant="secondary">{cat}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                          + {item.newCategory}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pendingNewProducts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Daarnaast worden <strong>{pendingNewProducts.length} nieuwe producten</strong> aangemaakt.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMultiCatDialogOpen(false); setMultiCatProducts([]); setPendingNewProducts([]); }}>
              Annuleren
            </Button>
            <Button onClick={handleConfirmMultiCat} disabled={importing}>
              {importing ? "Verwerken..." : "Bevestigen & importeren"}
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
