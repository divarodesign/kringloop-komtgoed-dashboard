import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Phone, Mail, MapPin, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@/types/database";

const emptyCustomer = { name: "", email: "", phone: "", address: "", city: "", postal_code: "", notes: "" };

const Klanten = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const { toast } = useToast();

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else setCustomers((data as Customer[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = customers.filter((c) =>
    [c.name, c.email, c.phone, c.city].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => { setEditing(null); setForm(emptyCustomer); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", city: c.city || "", postal_code: c.postal_code || "", notes: c.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Naam is verplicht", variant: "destructive" }); return; }
    if (editing) {
      const { error } = await supabase.from("customers").update(form).eq("id", editing.id);
      if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Klant bijgewerkt" });
    } else {
      const { error } = await supabase.from("customers").insert(form);
      if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Klant toegevoegd" });
    }
    setDialogOpen(false);
    fetchCustomers();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("customers").delete().eq("id", deleteId);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Klant verwijderd" });
    setDeleteId(null);
    fetchCustomers();
  };

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Klanten</h1>
          <p className="text-sm text-muted-foreground">Beheer je klanten</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Klant toevoegen</span><span className="sm:hidden">Nieuw</span></Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Zoek op naam, e-mail, telefoon..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} klant{filtered.length !== 1 ? "en" : ""}</p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {search ? "Geen resultaten gevonden." : "Nog geen klanten toegevoegd."}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="p-3 bg-card rounded-xl border border-border/50 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.city && <p className="text-xs text-muted-foreground truncate">{c.city}</p>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 ml-11 text-xs text-muted-foreground">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead className="w-[100px]">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(c.address || c.city) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {[c.address, c.postal_code, c.city].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog - responsive */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Naam *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Volledige naam" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="naam@voorbeeld.nl" />
              </div>
              <div className="grid gap-2">
                <Label>Telefoon</Label>
                <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="06-12345678" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Adres</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Straat en huisnummer" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Postcode</Label>
                <Input value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} placeholder="1234 AB" />
              </div>
              <div className="grid gap-2">
                <Label>Plaats</Label>
                <Input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Amsterdam" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notities</Label>
              <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Eventuele opmerkingen..." rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Annuleren</Button>
            <Button onClick={handleSave} className="w-full sm:w-auto">{editing ? "Opslaan" : "Toevoegen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze actie kan niet ongedaan worden gemaakt.</AlertDialogDescription>
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

export default Klanten;
