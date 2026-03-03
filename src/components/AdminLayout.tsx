import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Recycle, Users, Wrench, CalendarDays, Receipt } from "lucide-react";

const bottomNavItems = [
  { label: "Klanten", icon: Users, path: "/admin/klanten" },
  { label: "Klussen", icon: Wrench, path: "/admin/klussen" },
  { label: "Agenda", icon: CalendarDays, path: "/admin/agenda" },
  { label: "Financieel", icon: Receipt, path: "/admin/financieel" },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sm:h-14 flex items-center border-b px-3 sm:px-4 bg-card sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex items-center gap-2 ml-2 sm:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Recycle className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Komtgoed</span>
            </div>
          </header>
          <div className="flex-1 p-3 sm:p-6 overflow-auto pb-20 sm:pb-6">
            <Outlet />
          </div>

          {/* Mobile bottom navigation */}
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around h-16">
              {bottomNavItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors touch-manipulation ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
