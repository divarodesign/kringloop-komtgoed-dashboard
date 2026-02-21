import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@/types/database";

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

const Klussen = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchJobs = async () => {
    const { data, error } = await supabase.from("jobs").select("*, customers(*)").order("created_at", { ascending: false });
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else setJobs((data as Job[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const filtered = jobs.filter((j) => {
    const matchSearch = [j.title, j.customers?.name].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "-";

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

      {/* Status filter - horizontally scrollable chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              statusFilter === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Zoek klussen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} klus{filtered.length !== 1 ? "sen" : ""}</p>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
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
                className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm active:scale-[0.98] transition-transform touch-manipulation text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{j.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{j.customers?.name || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[j.status] || ""}`}>
                      {statusLabels[j.status] || j.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {j.is_direct ? "Direct" : formatDate(j.scheduled_date)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="w-[80px]">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.title}</TableCell>
                      <TableCell className="text-muted-foreground">{j.customers?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[j.status] || ""}>{statusLabels[j.status] || j.status}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">{j.job_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{j.is_direct ? "Direct" : formatDate(j.scheduled_date)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/klussen/${j.id}`)}><Eye className="h-4 w-4" /></Button>
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
