import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const statCards = [
    { title: "Gefactureerd", value: formatPrice(totalInvoiced), icon: Receipt, bg: "bg-muted", color: "text-muted-foreground" },
    { title: "Betaald", value: formatPrice(totalPaid), icon: TrendingUp, bg: "bg-primary/10", color: "text-primary" },
    { title: "Openstaand", value: formatPrice(totalOpen), icon: FileText, bg: "bg-orange-500/10", color: "text-orange-500" },
  ];

  const tabs = [
    { key: "offertes", label: "Offertes", count: quotes.length },
    { key: "facturen", label: "Facturen", count: invoices.length },
  ];

  const renderQuoteItem = (q: Quote) => (
    <div key={q.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/50 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{(q.jobs as any)?.title || "—"}</p>
        <p className="text-xs text-muted-foreground truncate">{(q.jobs as any)?.customers?.name || "—"}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.status}</Badge>
          {q.quote_number && <span className="text-[10px] text-muted-foreground">{q.quote_number}</span>}
        </div>
      </div>
      <span className="text-sm font-semibold shrink-0 ml-3">{formatPrice(q.total_amount)}</span>
    </div>
  );

  const renderInvoiceItem = (inv: Invoice) => (
    <div key={inv.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/50 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{(inv.jobs as any)?.title || "—"}</p>
        <p className="text-xs text-muted-foreground truncate">{(inv.jobs as any)?.customers?.name || "—"}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={inv.status === "betaald" ? "default" : "secondary"}
            className={`text-[10px] px-1.5 py-0 ${inv.status === "betaald" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
            {inv.status === "betaald" ? "Betaald" : "Onbetaald"}
          </Badge>
          {inv.invoice_number && <span className="text-[10px] text-muted-foreground">{inv.invoice_number}</span>}
        </div>
      </div>
      <span className="text-sm font-semibold shrink-0 ml-3">{formatPrice(inv.total_amount)}</span>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financieel</h1>
        <p className="text-sm text-muted-foreground">Offertes en facturen</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className={`inline-flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-xl ${stat.bg} mb-1.5`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-sm sm:text-xl font-bold leading-tight">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab chips */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : tab === "offertes" ? (
        quotes.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Nog geen offertes.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {quotes.map(renderQuoteItem)}
            </div>
            {/* Desktop */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </>
        )
      ) : (
        invoices.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Nog geen facturen.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-2">
              {invoices.map(renderInvoiceItem)}
            </div>
            {/* Desktop */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  );
};

export default Financieel;
