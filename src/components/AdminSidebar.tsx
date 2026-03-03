import {
  LayoutDashboard, Users, Briefcase, Calendar, ClipboardCheck,
  Package, Receipt, UserCog, Settings, LogOut, Recycle
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Klanten", url: "/admin/klanten", icon: Users },
  { title: "Klussen", url: "/admin/klussen", icon: Briefcase },
  { title: "Agenda", url: "/admin/agenda", icon: Calendar },
  { title: "Opleveringen", url: "/admin/opleveringen", icon: ClipboardCheck },
  { title: "Producten", url: "/admin/producten", icon: Package },
  { title: "Financieel", url: "/admin/financieel", icon: Receipt },
  { title: "Gebruikers", url: "/admin/gebruikers", icon: UserCog },
  { title: "Instellingen", url: "/admin/instellingen", icon: Settings },
];

export function AdminSidebar() {
  const { signOut } = useAuth();

  return (
    <Sidebar className="sm:w-64 w-full">

      <SidebarHeader className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Recycle className="h-7 w-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground">Kringloop</span>
            <span className="text-sm text-muted-foreground">Komtgoed</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold uppercase tracking-wider px-4 py-3">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg" className="h-14">
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent flex items-center gap-4 px-4 rounded-xl"
                      activeClassName="bg-sidebar-accent text-primary font-semibold"
                    >
                      <item.icon className="h-6 w-6 shrink-0" />
                      <span className="text-base">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive h-14 text-base gap-4 px-4" onClick={signOut}>
          <LogOut className="h-6 w-6" /> Uitloggen
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
