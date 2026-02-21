import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Delivery } from "@/types/database";

const Opleveringen = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("deliveries").select("*, jobs(*, customers(*))").order("created_at", { ascending: false })
      .then(({ data }) => { setDeliveries((data as Delivery[]) || []); setLoading(false); });
  }, []);

  const filtered = deliveries.filter((d) => statusFilter === "all" || d.status === statusFilter);

  const filterOptions = [
    { key: "all", label: "Alle", count: deliveries.length },
    { key: "concept", label: "Concept", count: deliveries.filter(d => d.status === "concept").length },
    { key: "afgerond", label: "Afgerond", count: deliveries.filter(d => d.status === "afgerond").length },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Opleveringen</h1>
        <p className="text-sm text-muted-foreground">Overzicht van alle opleveringen</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              statusFilter === opt.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nog geen opleveringen.</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {filtered.map((d) => (
              <div key={d.id} className="p-3 bg-card rounded-xl border border-border/50 shadow-sm">
                <p className="text-sm font-medium truncate">{(d.jobs as any)?.title || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{(d.jobs as any)?.customers?.name || "—"}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={d.status === "afgerond" ? "default" : "secondary"}
                    className={`text-[10px] px-1.5 py-0 ${d.status === "afgerond" ? "bg-emerald-100 text-emerald-700" : ""}`}>
                    {d.status === "afgerond" ? "Afgerond" : "Concept"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Klus</TableHead><TableHead>Klant</TableHead><TableHead>Status</TableHead><TableHead>Datum</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{(d.jobs as any)?.title || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{(d.jobs as any)?.customers?.name || "-"}</TableCell>
                      <TableCell><Badge variant={d.status === "afgerond" ? "default" : "secondary"}>{d.status === "afgerond" ? "Afgerond" : "Concept"}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString("nl-NL")}</TableCell>
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

export default Opleveringen;
