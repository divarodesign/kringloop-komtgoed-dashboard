import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase, Users, Receipt, TrendingUp, Package, Calendar,
  ClipboardCheck, Settings, Plus, ChevronRight
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jobs: 0, customers: 0, openInvoices: 0, revenue: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: jobCount }, { count: custCount }, { data: invData }, { data: jobs }] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).not("status", "eq", "afgerond"),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount, status"),
        supabase.from("jobs").select("id, title, status, scheduled_date, customers(name)").order("created_at", { ascending: false }).limit(5),
      ]);
      const invoices = invData || [];
      const openAmount = invoices.filter((i: any) => i.status !== "betaald").reduce((s: number, i: any) => s + Number(i.total_amount), 0);
      const totalRevenue = invoices.filter((i: any) => i.status === "betaald").reduce((s: number, i: any) => s + Number(i.total_amount), 0);
      setStats({ jobs: jobCount || 0, customers: custCount || 0, openInvoices: openAmount, revenue: totalRevenue });
      setRecentJobs(jobs || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const formatPrice = (p: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

  const statCards = [
    { title: "Openstaand", value: loading ? "..." : String(stats.jobs), icon: Briefcase, bg: "bg-primary/10", color: "text-primary" },
    { title: "Klanten", value: loading ? "..." : String(stats.customers), icon: Users, bg: "bg-blue-500/10", color: "text-blue-600" },
    { title: "Te factureren", value: loading ? "..." : formatPrice(stats.openInvoices), icon: Receipt, bg: "bg-orange-500/10", color: "text-orange-500" },
    { title: "Omzet", value: loading ? "..." : formatPrice(stats.revenue), icon: TrendingUp, bg: "bg-emerald-500/10", color: "text-emerald-600" },
  ];

  const quickActions = [
    { label: "Nieuwe klus", icon: Plus, path: "/admin/klussen/nieuw", bg: "bg-primary", textColor: "text-primary-foreground" },
    { label: "Klussen", icon: Briefcase, path: "/admin/klussen", bg: "bg-card", textColor: "text-foreground" },
    { label: "Agenda", icon: Calendar, path: "/admin/agenda", bg: "bg-card", textColor: "text-foreground" },
    { label: "Opleveringen", icon: ClipboardCheck, path: "/admin/opleveringen", bg: "bg-card", textColor: "text-foreground" },
    { label: "Producten", icon: Package, path: "/admin/producten", bg: "bg-card", textColor: "text-foreground" },
    { label: "Klanten", icon: Users, path: "/admin/klanten", bg: "bg-card", textColor: "text-foreground" },
    { label: "Financieel", icon: Receipt, path: "/admin/financieel", bg: "bg-card", textColor: "text-foreground" },
    { label: "Instellingen", icon: Settings, path: "/admin/instellingen", bg: "bg-card", textColor: "text-foreground" },
  ];

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      nieuw: { label: "Nieuw", cls: "bg-blue-100 text-blue-700" },
      gepland: { label: "Gepland", cls: "bg-yellow-100 text-yellow-700" },
      onderweg: { label: "Onderweg", cls: "bg-orange-100 text-orange-700" },
      uitgevoerd: { label: "Uitgevoerd", cls: "bg-emerald-100 text-emerald-700" },
      afgerond: { label: "Afgerond", cls: "bg-muted text-muted-foreground" },
    };
    return map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Greeting */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welkom bij Kringloop Komtgoed</p>
      </div>

      {/* Stat cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className={`inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.bg} mb-2`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              <p className="text-lg sm:text-2xl font-bold leading-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions - scrollable on mobile, grid on desktop */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Snelle acties</h2>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-xl ${action.bg} ${action.textColor} shadow-sm border border-border/50 active:scale-95 transition-transform touch-manipulation min-h-[76px]`}
            >
              <action.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recente klussen</h2>
          <button
            onClick={() => navigate("/admin/klussen")}
            className="text-xs text-primary font-medium flex items-center gap-0.5 active:opacity-70 touch-manipulation"
          >
            Bekijk alle <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Nog geen klussen aangemaakt
              </CardContent>
            </Card>
          ) : (
            recentJobs.map((job) => {
              const st = statusLabel(job.status);
              return (
                <button
                  key={job.id}
                  onClick={() => navigate(`/admin/klussen/${job.id}`)}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 bg-card rounded-xl shadow-sm border border-border/50 active:scale-[0.98] transition-transform touch-manipulation text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{(job.customers as any)?.name || "—"}</p>
                  </div>
                  <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${st.cls}`}>
                    {st.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
