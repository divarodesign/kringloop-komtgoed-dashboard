import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Eye, ArrowRightCircle, XCircle, Search, Inbox, Home, Calendar,
  Image, ChevronRight, ChevronLeft, Phone, Mail, MapPin, X, Trash2, PhoneCall, PhoneMissed
} from "lucide-react";

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
  contact_status: "niet_gebeld" | "gebeld" | "nabellen";
  created_at: string;
}

const formatPrice = (p: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p);

const statusConfig = {
  nieuw: { label: "Nieuw", variant: "default" as const },
  omgezet: { label: "Omgezet", variant: "secondary" as const },
  afgewezen: { label: "Afgewezen", variant: "destructive" as const },
};

function parseNotes(raw: string | null): {
  cleanNotes: string;
  woningtype: string | null;
  gewensteDatum: string | null;
  photos: string[];
} {
  if (!raw) return { cleanNotes: "", woningtype: null, gewensteDatum: null, photos: [] };

  let text = raw;
  let woningtype: string | null = null;
  let gewensteDatum: string | null = null;
  const photos: string[] = [];

  const woningMatch = text.match(/Woningtype:\s*([^\s]+(?:\s+[^\s]+)*?)(?=\s+Gewenste datum:|\s+Foto's:|$)/);
  if (woningMatch) { woningtype = woningMatch[1].trim(); text = text.replace(woningMatch[0], ""); }

  const datumMatch = text.match(/Gewenste datum:\s*(\d{4}-\d{2}-\d{2})/);
  if (datumMatch) { gewensteDatum = datumMatch[1]; text = text.replace(datumMatch[0], ""); }

  const fotosMatch = text.match(/Foto's:\s*([\s\S]*?)(?=$)/);
  if (fotosMatch) {
    const urls = fotosMatch[1].match(/https?:\/\/\S+/g) || [];
    photos.push(...urls);
    text = text.replace(fotosMatch[0], "");
  }

  return { cleanNotes: text.trim(), woningtype, gewensteDatum, photos };
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "nieuw" | "omgezet" | "afgewezen">("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
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
      setLeads((data as any[]).map(l => ({ ...l, rooms: Array.isArray(l.rooms) ? l.rooms : [], contact_status: l.contact_status ?? "niet_gebeld" })));
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
  const nogBellenCount = leads.filter(l => l.status === "nieuw" && l.contact_status !== "gebeld").length;

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

  const verwijderen = async (lead: Lead) => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead verwijderd" });
      setSelectedLead(null);
      fetchLeads();
    }
  };

  const cycleContactStatus = async (lead: Lead) => {
    const order: Array<"niet_gebeld" | "gebeld" | "nabellen"> = ["niet_gebeld", "gebeld", "nabellen"];
    const currentIdx = order.indexOf(lead.contact_status);
    const newStatus = order[(currentIdx + 1) % order.length];
    const { error } = await supabase.from("leads").update({ contact_status: newStatus } as any).eq("id", lead.id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      const updated = { ...lead, contact_status: newStatus };
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
      if (selectedLead?.id === lead.id) setSelectedLead(updated);
    }
  };

  const omzettenNaarKlus = (lead: Lead) => {
    setSelectedLead(null);
    navigate(`/admin/klussen/nieuw?lead_id=${lead.id}`);
  };

  const openNavigation = (lead: Lead) => {
    const addr = [lead.address, lead.postal_code, lead.city].filter(Boolean).join(", ");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, "_blank");
  };

  const DetailContent = ({ lead }: { lead: Lead }) => {
    const { cleanNotes, woningtype, gewensteDatum, photos } = parseNotes(lead.notes);
    return (
      <div className="space-y-4 pb-6">
        {/* Gesproken toggle */}
        <button
          onClick={() => toggleContacted(lead)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
            lead.contacted
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          {lead.contacted
            ? <PhoneCall className="h-4 w-4 shrink-0" />
            : <PhoneMissed className="h-4 w-4 shrink-0" />
          }
          <span className="font-medium text-sm">
            {lead.contacted ? "Gesproken ✓" : "Nog niet gesproken — tik om te markeren"}
          </span>
        </button>

        {/* Contact info */}
        <div className="space-y-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Telefoon</p>
                <p className="font-medium text-sm">{lead.phone}</p>
              </div>
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-sm truncate">{lead.email}</p>
              </div>
            </a>
          )}
          {(lead.address || lead.city) && (
            <button
              onClick={() => openNavigation(lead)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Adres — tik voor navigatie</p>
                <p className="font-medium text-sm">{[lead.address, lead.postal_code, lead.city].filter(Boolean).join(", ")}</p>
              </div>
            </button>
          )}
        </div>

        {lead.rooms && lead.rooms.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kamers & producten</p>
            <div className="space-y-2">
              {lead.rooms.map((room, i) => (
                <div key={i} className="rounded-xl border bg-card p-3">
                  <p className="font-medium text-sm mb-2">{room.name}</p>
                  <div className="space-y-1">
                    {room.products.map((p, j) => (
                      <div key={j} className="flex justify-between text-sm text-muted-foreground">
                        <span>{p.quantity}× {p.description}</span>
                        <span className="font-medium">{formatPrice(p.quantity * p.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(woningtype || gewensteDatum) && (
          <div className="grid grid-cols-2 gap-2">
            {woningtype && (
              <div className="flex items-center gap-2 p-3 rounded-xl border bg-card text-sm">
                <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Woningtype</p>
                  <p className="font-medium">{woningtype}</p>
                </div>
              </div>
            )}
            {gewensteDatum && (
              <div className="flex items-center gap-2 p-3 rounded-xl border bg-card text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Gewenste datum</p>
                  <p className="font-medium">{format(new Date(gewensteDatum), "d MMM yyyy", { locale: nl })}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted">
          <span className="font-semibold">Berekende prijs</span>
          <span className="text-xl font-bold">{formatPrice(lead.advised_price)}</span>
        </div>

        {cleanNotes && (
          <div className="p-3 rounded-xl border bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notities</p>
            <p className="text-sm">{cleanNotes}</p>
          </div>
        )}

        {photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5" />
              Foto's ({photos.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <button key={i} onClick={() => { setLightboxPhotos(photos); setLightboxIndex(i); }} className="block">
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-32 object-cover rounded-xl border hover:opacity-90 transition-opacity"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Acties */}
        {lead.status === "nieuw" && (
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={() => omzettenNaarKlus(lead)}>
              <ArrowRightCircle className="mr-2 h-4 w-4" />
              Omzetten naar klus
            </Button>
            <Button variant="destructive" onClick={() => afwijzen(lead)}>
              <XCircle className="mr-2 h-4 w-4" />
              Afwijzen
            </Button>
          </div>
        )}
        {lead.status === "omgezet" && lead.job_id && (
          <Button variant="outline" className="w-full" onClick={() => navigate(`/admin/klussen/${lead.job_id}`)}>
            Bekijk klus →
          </Button>
        )}

        {/* Verwijderen */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => verwijderen(lead)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Lead verwijderen
        </Button>
      </div>
    );
  };

  const PanelHeader = ({ lead }: { lead: Lead }) => (
    <div className="mb-4">
      <h2 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
        {lead.name}
        <Badge variant={statusConfig[lead.status].variant}>
          {statusConfig[lead.status].label}
        </Badge>
        {lead.contacted && (
          <Badge variant="outline" className="text-primary border-primary text-xs">
            <PhoneCall className="h-3 w-3 mr-1" />Gesproken
          </Badge>
        )}
      </h2>
      <p className="text-sm text-muted-foreground">
        Ontvangen op {format(new Date(lead.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
      </p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Leads
            {nieuweCount > 0 && <Badge className="ml-1">{nieuweCount} nieuw</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aanvragen via de website
            {nogBellenCount > 0 && (
              <span className="ml-2 text-destructive font-medium">· {nogBellenCount} nog bellen</span>
            )}
          </p>
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
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "nieuw", "omgezet", "afgewezen"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Alle" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Geen leads gevonden</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {filtered.map(lead => (
              <button
                key={lead.id}
                className="w-full text-left rounded-xl border bg-card p-4 flex items-center gap-3 active:bg-muted/50 transition-colors"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-sm">{lead.name}</span>
                    <Badge variant={statusConfig[lead.status].variant} className="text-[10px] px-1.5 py-0">
                      {statusConfig[lead.status].label}
                    </Badge>
                    {lead.status === "nieuw" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${lead.contacted ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {lead.contacted ? "Gesproken" : "Bellen"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lead.city && <span>{lead.city}</span>}
                    {lead.city && <span>·</span>}
                    <span>{formatPrice(lead.advised_price)}</span>
                    <span>·</span>
                    <span>{format(new Date(lead.created_at), "d MMM", { locale: nl })}</span>
                  </div>
                  {lead.phone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{lead.phone}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Telefoon</TableHead>
                    <TableHead className="hidden sm:table-cell">Stad</TableHead>
                    <TableHead>Prijs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Datum</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(lead => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelectedLead(lead)}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.email || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lead.phone || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{lead.city || "—"}</TableCell>
                      <TableCell>{formatPrice(lead.advised_price)}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[lead.status].variant}>
                          {statusConfig[lead.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={e => { e.stopPropagation(); toggleContacted(lead); }}
                          title={lead.contacted ? "Markeer als niet gesproken" : "Markeer als gesproken"}
                        >
                          {lead.contacted
                            ? <PhoneCall className="h-4 w-4 text-primary" />
                            : <PhoneMissed className="h-4 w-4 text-destructive" />
                          }
                        </button>
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
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail panel — pure div, no overlay */}
      {selectedLead && (
        <>
          {/* Mobile: bottom panel */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl max-h-[92vh] overflow-y-auto px-4 pt-4 bg-background border-t shadow-2xl">
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />
            <button
              className="absolute right-4 top-4 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setSelectedLead(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Sluiten</span>
            </button>
            <PanelHeader lead={selectedLead} />
            <DetailContent lead={selectedLead} />
          </div>

          {/* Desktop: right side panel */}
          <div className="hidden sm:flex flex-col fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-background border-l shadow-2xl p-6">
            <button
              className="absolute right-4 top-4 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setSelectedLead(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Sluiten</span>
            </button>
            <PanelHeader lead={selectedLead} />
            <DetailContent lead={selectedLead} />
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxPhotos([])}
        >
          <button
            className="absolute right-3 top-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={() => setLightboxPhotos([])}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium z-10">
            {lightboxIndex + 1} / {lightboxPhotos.length}
          </div>

          {/* Previous */}
          {lightboxPhotos.length > 1 && (
            <button
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length); }}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* Next */}
          {lightboxPhotos.length > 1 && (
            <button
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % lightboxPhotos.length); }}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          <img
            src={lightboxPhotos[lightboxIndex]}
            alt={`Foto ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain select-none"
            onClick={e => e.stopPropagation()}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
