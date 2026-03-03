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
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Recycle className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Kringloop</span>
            <span className="text-xs text-muted-foreground">Komtgoed</span>
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
