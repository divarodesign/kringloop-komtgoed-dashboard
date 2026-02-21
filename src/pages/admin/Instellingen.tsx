import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Setting } from "@/types/database";

const Instellingen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [travelCosts, setTravelCosts] = useState({ zone_1_max_km: 75, zone_1_price: 89, zone_2_max_km: 150, zone_2_price: 115, zone_3_price: 145 });
  const [companyInfo, setCompanyInfo] = useState({ name: "Kringloop Komtgoed", address: "", city: "", postal_code: "", phone: "", email: "", kvk: "", btw: "", logo_url: "" });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("settings").select("*");
      if (data) {
        const tc = (data as Setting[]).find((s) => s.key === "travel_costs");
        const ci = (data as Setting[]).find((s) => s.key === "company_info");
        if (tc) setTravelCosts(tc.value as any);
        if (ci) setCompanyInfo(ci.value as any);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const saveTravelCosts = async () => {
    const { error } = await supabase.from("settings").update({ value: travelCosts }).eq("key", "travel_costs");
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Voorrijkosten opgeslagen" });
  };

  const saveCompanyInfo = async () => {
    const { error } = await supabase.from("settings").update({ value: companyInfo }).eq("key", "company_info");
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else toast({ title: "Bedrijfsgegevens opgeslagen" });
  };

  const changePassword = async () => {
    if (password.length < 6) { toast({ title: "Wachtwoord moet minimaal 6 tekens zijn", variant: "destructive" }); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else { toast({ title: "Wachtwoord gewijzigd" }); setPassword(""); }
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Laden...</p>;

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-sm text-muted-foreground">Bedrijfsinstellingen en configuratie</p>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
          <CardTitle className="text-base">Voorrijkosten</CardTitle>
          <CardDescription className="text-xs">Configureer de tariefzones</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">Zone 1 max km</Label><Input type="number" value={travelCosts.zone_1_max_km} onChange={(e) => setTravelCosts({ ...travelCosts, zone_1_max_km: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Zone 1 prijs (€)</Label><Input type="number" step="0.01" value={travelCosts.zone_1_price} onChange={(e) => setTravelCosts({ ...travelCosts, zone_1_price: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">Zone 2 max km</Label><Input type="number" value={travelCosts.zone_2_max_km} onChange={(e) => setTravelCosts({ ...travelCosts, zone_2_max_km: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Zone 2 prijs (€)</Label><Input type="number" step="0.01" value={travelCosts.zone_2_price} onChange={(e) => setTravelCosts({ ...travelCosts, zone_2_price: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div></div>
            <div className="grid gap-1.5"><Label className="text-xs">Zone 3 prijs (€)</Label><Input type="number" step="0.01" value={travelCosts.zone_3_price} onChange={(e) => setTravelCosts({ ...travelCosts, zone_3_price: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <Button size="sm" onClick={saveTravelCosts} className="w-full sm:w-auto">Opslaan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
          <CardTitle className="text-base">Bedrijfsinformatie</CardTitle>
          <CardDescription className="text-xs">Voor op offertes en opleveringen</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-3">
          <div className="grid gap-1.5"><Label className="text-xs">Bedrijfsnaam</Label><Input value={companyInfo.name} onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label className="text-xs">Adres</Label><Input value={companyInfo.address} onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">Postcode</Label><Input value={companyInfo.postal_code} onChange={(e) => setCompanyInfo({ ...companyInfo, postal_code: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Plaats</Label><Input value={companyInfo.city} onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">Telefoon</Label><Input value={companyInfo.phone} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">E-mail</Label><Input value={companyInfo.email} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">KVK-nummer</Label><Input value={companyInfo.kvk} onChange={(e) => setCompanyInfo({ ...companyInfo, kvk: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">BTW-nummer</Label><Input value={companyInfo.btw} onChange={(e) => setCompanyInfo({ ...companyInfo, btw: e.target.value })} /></div>
          </div>
          <Button size="sm" onClick={saveCompanyInfo} className="w-full sm:w-auto">Opslaan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
          <CardTitle className="text-base">Wachtwoord wijzigen</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-3">
          <div className="grid gap-1.5"><Label className="text-xs">Nieuw wachtwoord</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 6 tekens" /></div>
          <Button size="sm" onClick={changePassword} className="w-full sm:w-auto">Wachtwoord wijzigen</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Instellingen;
