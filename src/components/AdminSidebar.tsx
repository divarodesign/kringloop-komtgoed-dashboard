import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Briefcase, Calendar, ClipboardCheck,
  Package, Receipt, UserCog, Settings, LogOut, Recycle, Inbox
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Klanten", url: "/admin/klanten", icon: Users },
  { title: "Klussen", url: "/admin/klussen", icon: Briefcase },
  { title: "Leads", url: "/admin/leads", icon: Inbox, badge: true },
  { title: "Agenda", url: "/admin/agenda", icon: Calendar },
  { title: "Opleveringen", url: "/admin/opleveringen", icon: ClipboardCheck },
  { title: "Producten", url: "/admin/producten", icon: Package },
  { title: "Financieel", url: "/admin/financieel", icon: Receipt },
  { title: "Gebruikers", url: "/admin/gebruikers", icon: UserCog },
  { title: "Instellingen", url: "/admin/instellingen", icon: Settings },
];

export function AdminSidebar() {
  const { signOut } = useAuth();
  const [nieuwLeadsCount, setNieuwLeadsCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count, error } = await (supabase
        .from("leads") as any)
        .select("*", { count: "exact", head: true })
        .eq("is_viewed", false);
      if (!error) setNieuwLeadsCount(count ?? 0);
    };
    fetchCount();

    // Realtime subscription
    const channel = supabase
      .channel("leads-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        setTimeout(fetchCount, 300);
      })
      .subscribe();

    // Poll every 30s as fallback
    const interval = setInterval(fetchCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Recycle className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Kringloop</span>
            <span className="text-xs text-muted-foreground">Komt Goed</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {item.badge && nieuwLeadsCount > 0 && (
                    <SidebarMenuBadge>{nieuwLeadsCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Uitloggen
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
