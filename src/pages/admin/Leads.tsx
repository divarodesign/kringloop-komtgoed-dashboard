import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Eye, ArrowRightCircle, XCircle, Search, Inbox } from "lucide-react";

interface LeadRoom {
  id: string;
  name: string;
  products: { description: string; quantity: number; unit_price: number }[];
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  rooms: LeadRoom[];
  advised_price: number;
  status: "nieuw" | "omgezet" | "afgewezen";
  job_id: string | null;
  notes: string | null;
  created_at: string;
}

const formatPrice = (p: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

const statusConfig = {
  nieuw: { label: "Nieuw", variant: "default" as const },
  omgezet: { label: "Omgezet", variant: "secondary" as const },
  afgewezen: { label: "Afgewezen", variant: "destructive" as const },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "nieuw" | "omgezet" | "afgewezen">("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Fout bij laden", description: error.message, variant: "destructive" });
    } else {
      setLeads((data as any[]).map(l => ({ ...l, rooms: Array.isArray(l.rooms) ? l.rooms : [] })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = leads.filter(l => {
    if (filter !== "all" && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q) || l.phone?.includes(q);
    }
    return true;
  });

  const nieuweCount = leads.filter(l => l.status === "nieuw").length;

  const afwijzen = async (lead: Lead) => {
    const { error } = await supabase.from("leads").update({ status: "afgewezen" }).eq("id", lead.id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead afgewezen" });
      setSelectedLead(null);
      fetchLeads();
    }
  };

  const omzettenNaarKlus = (lead: Lead) => {
    setSelectedLead(null);
    navigate(`/admin/klussen/nieuw?lead_id=${lead.id}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Leads
              {nieuweCount > 0 && (
                <Badge className="ml-1">{nieuweCount} nieuw</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Aanvragen via de website</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoeken op naam, email, stad..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "nieuw", "omgezet", "afgewezen"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Alle" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">Geen leads gevonden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Telefoon</TableHead>
                  <TableHead className="hidden sm:table-cell">Stad</TableHead>
                  <TableHead>Prijs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Datum</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(lead => (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{lead.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{lead.phone || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{lead.city || "—"}</TableCell>
                    <TableCell>{formatPrice(lead.advised_price)}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[lead.status].variant}>
                        {statusConfig[lead.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {format(new Date(lead.created_at), "d MMM yyyy", { locale: nl })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedLead(lead); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={open => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedLead.name}
                  <Badge variant={statusConfig[selectedLead.status].variant}>
                    {statusConfig[selectedLead.status].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Ontvangen op {format(new Date(selectedLead.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Contact */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contactgegevens</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Email:</span> <span>{selectedLead.email || "—"}</span></div>
                    <div><span className="text-muted-foreground">Telefoon:</span> <span>{selectedLead.phone || "—"}</span></div>
                    <div><span className="text-muted-foreground">Adres:</span> <span>{selectedLead.address || "—"}</span></div>
                    <div><span className="text-muted-foreground">Stad:</span> <span>{selectedLead.city ? `${selectedLead.postal_code ? selectedLead.postal_code + " " : ""}${selectedLead.city}` : "—"}</span></div>
                  </CardContent>
                </Card>

                {/* Kamers & producten */}
                {selectedLead.rooms && selectedLead.rooms.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kamers & producten</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {selectedLead.rooms.map((room, i) => (
                        <div key={i}>
                          <p className="font-medium text-sm mb-1">{room.name}</p>
                          <div className="space-y-1">
                            {room.products.map((p, j) => (
                              <div key={j} className="flex justify-between text-sm text-muted-foreground">
                                <span>{p.quantity}× {p.description}</span>
                                <span>{formatPrice(p.quantity * p.unit_price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Prijs */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <span className="font-semibold">Berekende prijs</span>
                  <span className="text-xl font-bold">{formatPrice(selectedLead.advised_price)}</span>
                </div>

                {/* Notities */}
                {selectedLead.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Notities</p>
                    <p className="text-sm">{selectedLead.notes}</p>
                  </div>
                )}

                {/* Acties */}
                {selectedLead.status === "nieuw" && (
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1" onClick={() => omzettenNaarKlus(selectedLead)}>
                      <ArrowRightCircle className="mr-2 h-4 w-4" />
                      Omzetten naar klus
                    </Button>
                    <Button variant="destructive" onClick={() => afwijzen(selectedLead)}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Afwijzen
                    </Button>
                  </div>
                )}
                {selectedLead.status === "omgezet" && selectedLead.job_id && (
                  <Button variant="outline" onClick={() => navigate(`/admin/klussen/${selectedLead.job_id}`)}>
                    Bekijk klus →
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
