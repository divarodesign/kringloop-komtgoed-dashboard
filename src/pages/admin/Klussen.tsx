import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Eye } from "lucide-react";
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

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("nl-NL") : "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Klussen</h1>
          <p className="text-muted-foreground">Overzicht van alle klussen en aanvragen</p>
        </div>
        <Button onClick={() => navigate("/admin/klussen/nieuw")}><Plus className="mr-2 h-4 w-4" /> Nieuwe klus</Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Alle ({jobs.length})</TabsTrigger>
          {Object.entries(statusLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>{label} ({jobs.filter((j) => j.status === key).length})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Zoek klussen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Laden...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{search ? "Geen resultaten." : "Nog geen klussen."}</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Klussen;
