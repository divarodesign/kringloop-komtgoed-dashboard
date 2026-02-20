import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/admin/Dashboard";
import Klanten from "@/pages/admin/Klanten";
import Klussen from "@/pages/admin/Klussen";
import Planbord from "@/pages/admin/Planbord";
import Opleveringen from "@/pages/admin/Opleveringen";
import Producten from "@/pages/admin/Producten";
import Financieel from "@/pages/admin/Financieel";
import Gebruikers from "@/pages/admin/Gebruikers";
import Instellingen from "@/pages/admin/Instellingen";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="klanten" element={<Klanten />} />
              <Route path="klussen" element={<Klussen />} />
              <Route path="planbord" element={<Planbord />} />
              <Route path="opleveringen" element={<Opleveringen />} />
              <Route path="producten" element={<Producten />} />
              <Route path="financieel" element={<Financieel />} />
              <Route path="gebruikers" element={<Gebruikers />} />
              <Route path="instellingen" element={<Instellingen />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
