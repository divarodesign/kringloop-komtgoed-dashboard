import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Shield, ShieldCheck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Profile, UserRole } from "@/types/database";

const Gebruikers = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Om een nieuwe medewerker toe te voegen, maak een gebruiker aan in het Supabase Dashboard onder Authentication → Users. De gebruiker verschijnt automatisch hier.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gebruikers;
