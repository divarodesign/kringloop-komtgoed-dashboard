import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, Receipt, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({ jobs: 0, customers: 0, openInvoices: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ count: jobCount }, { count: custCount }, { data: invData }] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).not("status", "eq", "afgerond"),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount, status"),
      ]);
      const invoices = invData || [];
      const openAmount = invoices.filter((i: any) => i.status !== "betaald").reduce((s: number, i: any) => s + Number(i.total_amount), 0);
      const totalRevenue = invoices.filter((i: any) => i.status === "betaald").reduce((s: number, i: any) => s + Number(i.total_amount), 0);
      setStats({ jobs: jobCount || 0, customers: custCount || 0, openInvoices: openAmount, revenue: totalRevenue });
      setLoading(false);
    };
    fetch();
  }, []);

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  const cards = [
    { title: "Openstaande klussen", value: loading ? "..." : String(stats.jobs), icon: Briefcase, color: "text-primary" },
    { title: "Klanten", value: loading ? "..." : String(stats.customers), icon: Users, color: "text-blue-600" },
    { title: "Openstaande facturen", value: loading ? "..." : formatPrice(stats.openInvoices), icon: Receipt, color: "text-orange-500" },
    { title: "Omzet (betaald)", value: loading ? "..." : formatPrice(stats.revenue), icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welkom bij Kringloop Komtgoed</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
