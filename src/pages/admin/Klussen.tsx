import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ChevronRight, MapPin, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Job, JobItem } from "@/types/database";

const statusLabels: Record<string, string> = {
  nieuw: "Nieuw",
  offerte_verstuurd: "Offerte verstuurd",
  in_uitvoering: "In uitvoering",
  oplevering: "Oplevering",
  gefactureerd: "Gefactureerd",
  afgerond: "Afgerond",
};

const statusColors: Record<string, string> = {
  nieuw: "bg-blue-100 text-blue-700",
  offerte_verstuurd: "bg-amber-100 text-amber-700",
  in_uitvoering: "bg-primary/10 text-primary",
  oplevering: "bg-purple-100 text-purple-700",
  gefactureerd: "bg-orange-100 text-orange-700",
  afgerond: "bg-emerald-100 text-emerald-700",
};

const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

const Klussen = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchJobs = async () => {
    const [{ data, error }, { data: items }] = await Promise.all([
      supabase.from("jobs").select("*, customers(*)").order("created_at", { ascending: false }),
      supabase.from("job_items").select("*"),
    ]);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else setJobs((data as Job[]) || []);
    setJobItems((items as JobItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const deleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    await supabase.from("job_items").delete().eq("job_id", jobId);
    await supabase.from("extra_sales").delete().eq("job_id", jobId);
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) toast({ title: "Fout bij verwijderen", description: error.message, variant: "destructive" });
    else { toast({ title: "Klus verwijderd" }); fetchJobs(); }
  };

  const getJobTotal = (job: Job) => {
    const items = jobItems.filter(i => i.job_id === job.id);
    const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const subtotal = job.job_type === "ontruiming" ? (job.custom_price || job.advised_price || itemsTotal) : itemsTotal;
    const discount = job.discount_type === "percentage"
      ? (subtotal + job.travel_cost + (job.extra_costs || 0)) * (job.discount_value / 100)
      : job.discount_type === "fixed" ? job.discount_value : 0;
    return subtotal + job.travel_cost + (job.extra_costs || 0) - discount;
  };

  const filtered = jobs.filter((j) => {
    const matchSearch = [j.title, j.customers?.name, j.work_city, j.work_address].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "-";

  const getAddressShort = (j: Job) => {
    const parts = [j.work_city || j.work_address].filter(Boolean);
    return parts.length ? parts[0] : null;
  };

  const statusFilterOptions = [
    { key: "all", label: "Alle", count: jobs.length },
    ...Object.entries(statusLabels).map(([key, label]) => ({
      key, label, count: jobs.filter((j) => j.status === key).length,
    })),
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Klussen</h1>
          <p className="text-sm text-muted-foreground">Overzicht van alle klussen</p>
        </div>
        <Button size="sm" onClick={() => navigate("/admin/klussen/nieuw")}>
          <Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Nieuwe klus</span><span className="sm:hidden">Nieuw</span>
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {opt.label} ({opt.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek op naam, klant, locatie..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} klus{filtered.length !== 1 ? "sen" : ""}</p>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {search ? "Geen resultaten." : "Nog geen klussen."}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filtered.map((j) => (
              <button
                key={j.id}
                onClick={() => navigate(`/admin/klussen/${j.id}`)}
                className="w-full flex items-center gap-3 p-3.5 bg-card rounded-xl border border-border/50 shadow-sm active:scale-[0.98] transition-transform touch-manipulation text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{j.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{j.customers?.name || "—"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[j.status] || ""}`}>
                      {statusLabels[j.status] || j.status}
                    </Badge>
                    {getAddressShort(j) && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />{getAddressShort(j)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {j.is_direct ? "Direct" : formatDate(j.scheduled_date)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <p className="text-sm font-semibold">{formatPrice(getJobTotal(j))}</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Klus verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>Weet je zeker dat je "{j.title}" wilt verwijderen?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => deleteJob(e, j.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klus</TableHead>
                    <TableHead>Klant</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Bedrag</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j) => (
                    <TableRow key={j.id} className="cursor-pointer" onClick={() => navigate(`/admin/klussen/${j.id}`)}>
                      <TableCell className="font-medium">{j.title}</TableCell>
                      <TableCell className="text-muted-foreground">{j.customers?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {j.work_city || j.work_address || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[j.status] || ""}>{statusLabels[j.status] || j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{j.is_direct ? "Direct" : formatDate(j.scheduled_date)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(getJobTotal(j))}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Klus verwijderen?</AlertDialogTitle>
                              <AlertDialogDescription>Weet je zeker dat je "{j.title}" wilt verwijderen?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuleren</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => deleteJob(e, j.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Klussen;
