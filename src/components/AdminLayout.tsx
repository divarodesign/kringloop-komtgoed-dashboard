import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Outlet } from "react-router-dom";
import { Recycle } from "lucide-react";

const AdminLayout = () => {
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
          <div className="flex-1 p-3 sm:p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
