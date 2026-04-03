import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, ShieldCheck, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Profile, UserRole } from "@/types/database";

const Gebruikers = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", email: "", password: "", role: "medewerker" });
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

  const handleInvite = async () => {
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast({ title: "Vul naam, e-mail en wachtwoord in", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Wachtwoord moet minimaal 6 tekens zijn", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-user", {
        body: { email: formData.email, full_name: formData.full_name, role: formData.role, password: formData.password },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Onbekende fout");
      }

      toast({ title: "Gebruiker aangemaakt", description: `${formData.full_name} is toegevoegd.` });
      setDialogOpen(false);
      setFormData({ full_name: "", email: "", password: "", role: "medewerker" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Fout bij aanmaken", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gebruikers</h1>
          <p className="text-sm text-muted-foreground">Medewerkers beheren</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Medewerker</span><span className="sm:hidden">Nieuw</span></Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nog geen gebruikers.</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                    {getRole(p.user_id) === "admin" ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                    {getRole(p.user_id) === "admin" ? "Admin" : "Medewerker"}
                  </Badge>
                  <Badge variant={p.is_active ? "default" : "secondary"}
                    className={`text-[10px] px-1.5 py-0 ${p.is_active ? "bg-emerald-100 text-emerald-700" : ""}`}>
                    {p.is_active ? "Actief" : "Inactief"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Medewerker toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Naam</Label>
              <Input
                id="full_name"
                placeholder="Volledige naam"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="naam@voorbeeld.nl"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimaal 6 tekens"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medewerker">Medewerker</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              De gebruiker krijgt een tijdelijk wachtwoord. Bij eerste login kan het wachtwoord gereset worden via "Wachtwoord vergeten".
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Annuleren</Button>
            <Button onClick={handleInvite} disabled={inviting} className="w-full sm:w-auto">
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gebruikers;
