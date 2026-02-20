import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opleveringen</h1>
        <p className="text-muted-foreground">Overzicht van alle opleveringen</p>
      </div>
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Alle ({deliveries.length})</TabsTrigger>
          <TabsTrigger value="concept">Concept ({deliveries.filter(d => d.status === "concept").length})</TabsTrigger>
          <TabsTrigger value="afgerond">Afgerond ({deliveries.filter(d => d.status === "afgerond").length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-center py-8 text-muted-foreground">Laden...</p> :
          filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nog geen opleveringen.</p> : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Opleveringen;
