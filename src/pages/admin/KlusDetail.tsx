import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/klussen")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            <p className="text-muted-foreground">{job.customers?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={job.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Klantgegevens</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {job.customers?.name}</div>
            {job.customers?.email && <p className="text-muted-foreground ml-6">{job.customers.email}</p>}
            {job.customers?.phone && <p className="text-muted-foreground ml-6">{job.customers.phone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Planning</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> <Badge variant="secondary" className="capitalize">{job.job_type}</Badge></div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {job.is_direct ? "Direct uitvoeren" : job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("nl-NL") : "Niet gepland"}</div>
            {job.work_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {[job.work_address, job.work_postal_code, job.work_city].filter(Boolean).join(", ")}</div>}
          </CardContent>
        </Card>
      </div>

      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Producten / Werkzaamheden</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Omschrijving</TableHead><TableHead className="text-right">Aantal</TableHead><TableHead className="text-right">Stuksprijs</TableHead><TableHead className="text-right">Totaal</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}><TableCell>{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell><TableCell className="text-right">{formatPrice(item.quantity * item.unit_price)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Kostenoverzicht</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Voorrijkosten ({job.travel_distance_km || 0} km)</span><span>{formatPrice(job.travel_cost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{job.job_type === "ontruiming" ? "Ontruiming" : "Producten"}</span><span>{formatPrice(subtotal)}</span></div>
            {(job.extra_costs || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Overige kosten{job.extra_costs_description ? ` (${job.extra_costs_description})` : ""}</span><span>{formatPrice(job.extra_costs || 0)}</span></div>}
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Korting</span><span>-{formatPrice(discount)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Totaal</span><span>{formatPrice(total)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KlusDetail;
