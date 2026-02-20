import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Profile, UserRole } from "@/types/database";

const Gebruikers = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "medewerker" });
  const { toast } = useToast();

  const fetchData = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    setProfiles((p as Profile[]) || []);
    setRoles((r as UserRole[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getRole = (userId: string) => roles.find((r) => r.user_id === userId)?.role || "medewerker";

  const handleAdd = async () => {
    if (!form.email || !form.password) { toast({ title: "E-mail en wachtwoord zijn verplicht", variant: "destructive" }); return; }
    toast({ title: "Info", description: "Nieuwe gebruikers moeten worden aangemaakt via Supabase Dashboard > Authentication > Users" });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gebruikers</h1>
          <p className="text-muted-foreground">Medewerkers beheren</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Medewerker toevoegen</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-center py-8 text-muted-foreground">Laden...</p> :
          profiles.length === 0 ? <p className="text-center py-8 text-muted-foreground">Nog geen gebruikers.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Naam</TableHead><TableHead>E-mail</TableHead><TableHead>Rol</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        {getRole(p.user_id) === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {getRole(p.user_id) === "admin" ? "Admin" : "Medewerker"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-emerald-100 text-emerald-700" : ""}>{p.is_active ? "Actief" : "Inactief"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Medewerker toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Om een nieuwe medewerker toe te voegen, maak een gebruiker aan in het Supabase Dashboard onder Authentication → Users. De gebruiker verschijnt automatisch hier.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gebruikers;
