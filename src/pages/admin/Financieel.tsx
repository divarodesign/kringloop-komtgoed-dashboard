import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, FileText, TrendingUp } from "lucide-react";
import type { Quote, Invoice } from "@/types/database";

const Financieel = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState("offertes");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("quotes").select("*, jobs(*, customers(*))").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*, jobs(*, customers(*))").order("created_at", { ascending: false }),
    ]).then(([{ data: q }, { data: i }]) => {
      setQuotes((q as Quote[]) || []);
      setInvoices((i as Invoice[]) || []);
      setLoading(false);
    });
  }, []);

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPaid = invoices.filter(i => i.status === "betaald").reduce((s, i) => s + i.total_amount, 0);
  const totalOpen = totalInvoiced - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financieel</h1>
        <p className="text-muted-foreground">Offertes en facturen</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Totaal gefactureerd</CardTitle><Receipt className="h-5 w-5 text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-bold">{formatPrice(totalInvoiced)}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Betaald</CardTitle><TrendingUp className="h-5 w-5 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{formatPrice(totalPaid)}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Openstaand</CardTitle><FileText className="h-5 w-5 text-orange-500" /></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">{formatPrice(totalOpen)}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="offertes">Offertes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="facturen">Facturen ({invoices.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-center py-8 text-muted-foreground">Laden...</p> :
          tab === "offertes" ? (
            quotes.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nog geen offertes.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Nummer</TableHead><TableHead>Klus</TableHead><TableHead>Klant</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Bedrag</TableHead></TableRow></TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.quote_number || "-"}</TableCell>
                      <TableCell>{(q.jobs as any)?.title || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{(q.jobs as any)?.customers?.name || "-"}</TableCell>
                      <TableCell><Badge variant="secondary">{q.status}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(q.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            invoices.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nog geen facturen.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Nummer</TableHead><TableHead>Klus</TableHead><TableHead>Klant</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Bedrag</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number || "-"}</TableCell>
                      <TableCell>{(inv.jobs as any)?.title || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{(inv.jobs as any)?.customers?.name || "-"}</TableCell>
                      <TableCell><Badge variant={inv.status === "betaald" ? "default" : "secondary"} className={inv.status === "betaald" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}>{inv.status === "betaald" ? "Betaald" : "Onbetaald"}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(inv.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Financieel;
