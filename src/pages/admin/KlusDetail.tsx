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
import { ArrowLeft, MapPin, Calendar as CalendarIcon, User, Briefcase, Pencil, Save, X, Search, Loader2, Phone, Navigation, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Job, JobItem, Profile } from "@/types/database";

const statusLabels: Record<string, string> = {
  nieuw: "Nieuw", offerte_verstuurd: "Offerte verstuurd", in_uitvoering: "In uitvoering",
  oplevering: "Oplevering", gefactureerd: "Gefactureerd", afgerond: "Afgerond",
};

const KlusDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

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
    const [{ data: j }, { data: ji }, { data: p }] = await Promise.all([
      supabase.from("jobs").select("*, customers(*)").eq("id", id!).single(),
      supabase.from("job_items").select("*, products(*)").eq("job_id", id!),
      supabase.from("profiles").select("*").eq("is_active", true),
    ]);
    setJob(j as Job);
    setItems((ji as JobItem[]) || []);
    setProfiles((p as Profile[]) || []);
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
    // Delete related records first, then the job
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

  // Auto address lookup when postcode and huisnummer are filled
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

  // Auto-trigger lookup
  useEffect(() => {
    if (!editing) return;
    const cleanPostcode = editPostalCode.replace(/\s/g, "");
    if (cleanPostcode.length >= 6 && huisnummer.length >= 1) {
      const timer = setTimeout(() => lookupAddress(editPostalCode, huisnummer), 600);
      return () => clearTimeout(timer);
    }
  }, [editPostalCode, huisnummer, editing, lookupAddress]);

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  const getProfileName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || "Onbekend";
  };

  const getFullAddress = () => {
    return [job?.work_address, job?.work_postal_code, job?.work_city].filter(Boolean).join(", ");
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;
  if (!job) return <p className="text-center py-12 text-muted-foreground">Klus niet gevonden.</p>;

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
  const discount = job.discount_type === "percentage"
    ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
    : job.discount_type === "fixed" ? job.discount_value : 0;
  const total = subtotal + job.travel_cost + (job.extra_costs || 0) - discount;
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

      {/* Status selector */}
      <Select value={job.status} onValueChange={updateStatus}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

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
                    {job.is_direct ? "Direct uitvoeren" : job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("nl-NL") : "Niet gepland"}
                  </span>
                </div>
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

      {/* Products */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Producten / Werkzaamheden</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="sm:hidden space-y-2">
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
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Omschrijving</th><th className="text-right py-2 font-medium text-muted-foreground">Aantal</th><th className="text-right py-2 font-medium text-muted-foreground">Stuksprijs</th><th className="text-right py-2 font-medium text-muted-foreground">Totaal</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0"><td className="py-2">{item.description}</td><td className="text-right py-2">{item.quantity}</td><td className="text-right py-2">{formatPrice(item.unit_price)}</td><td className="text-right py-2">{formatPrice(item.quantity * item.unit_price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Cost overview */}
      <Card>
        <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Kostenoverzicht</CardTitle></CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Voorrijkosten ({job.travel_distance_km || 0} km)</span><span>{formatPrice(job.travel_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{job.job_type === "ontruiming" ? "Ontruiming" : "Producten"}</span><span>{formatPrice(subtotal)}</span></div>
            {(job.extra_costs || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Overige kosten{job.extra_costs_description ? ` (${job.extra_costs_description})` : ""}</span><span>{formatPrice(job.extra_costs || 0)}</span></div>}
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Korting</span><span>-{formatPrice(discount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KlusDetail;
