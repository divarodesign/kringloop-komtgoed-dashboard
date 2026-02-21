import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Calendar, User, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Job, JobItem } from "@/types/database";

const statusLabels: Record<string, string> = {
  nieuw: "Nieuw", offerte_verstuurd: "Offerte verstuurd", in_uitvoering: "In uitvoering",
  oplevering: "Oplevering", gefactureerd: "Gefactureerd", afgerond: "Afgerond",
};
const statusColors: Record<string, string> = {
  nieuw: "bg-blue-100 text-blue-700", offerte_verstuurd: "bg-amber-100 text-amber-700",
  in_uitvoering: "bg-primary/10 text-primary", oplevering: "bg-purple-100 text-purple-700",
  gefactureerd: "bg-orange-100 text-orange-700", afgerond: "bg-emerald-100 text-emerald-700",
};

const KlusDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJob = async () => {
    const [{ data: j }, { data: ji }] = await Promise.all([
      supabase.from("jobs").select("*, customers(*)").eq("id", id!).single(),
      supabase.from("job_items").select("*, products(*)").eq("job_id", id!),
    ]);
    setJob(j as Job);
    setItems((ji as JobItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (id) fetchJob(); }, [id]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id!);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else { toast({ title: "Status bijgewerkt" }); fetchJob(); }
  };

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;
  if (!job) return <p className="text-center py-12 text-muted-foreground">Klus niet gevonden.</p>;

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
  const discount = job.discount_type === "percentage"
    ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
    : job.discount_type === "fixed" ? job.discount_value : 0;
  const total = subtotal + job.travel_cost + (job.extra_costs || 0) - discount;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => navigate("/admin/klussen")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{job.title}</h1>
          <p className="text-sm text-muted-foreground truncate">{job.customers?.name}</p>
        </div>
      </div>

      {/* Status selector */}
      <Select value={job.status} onValueChange={updateStatus}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Info cards - stacked on mobile */}
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
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Planning</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> <Badge variant="secondary" className="capitalize text-xs">{job.job_type}</Badge></div>
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> <span className="text-xs">{job.is_direct ? "Direct uitvoeren" : job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("nl-NL") : "Niet gepland"}</span></div>
            {job.work_address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> <span className="text-xs truncate">{[job.work_address, job.work_postal_code, job.work_city].filter(Boolean).join(", ")}</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* Products - card list on mobile */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2"><CardTitle className="text-sm">Producten / Werkzaamheden</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            {/* Mobile */}
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
            {/* Desktop */}
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
