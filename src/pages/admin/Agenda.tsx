import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressFields from "@/components/AddressFields";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Clock, Plus, Briefcase, CalendarDays, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import type { Job, Appointment, Customer } from "@/types/database";

type ViewMode = "day" | "week" | "month";

interface AgendaItem {
  id: string;
  title: string;
  time: string | null;
  date: string;
  type: "job" | "appointment";
  subtitle?: string;
  detail?: string;
  address?: string;
  status?: string;
  description?: string;
  customerId?: string | null;
}

const DAYS_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTHS_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateStr = (d: Date) => d.toISOString().split("T")[0];
const isToday = (d: Date) => toDateStr(d) === toDateStr(new Date());
const formatDateShort = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
const formatDateFull = (d: Date) => d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const Agenda = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AgendaItem | null>(null);
  const [newAppt, setNewAppt] = useState({ title: "", description: "", date: "", time: "", customer_id: "" });
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", address: "", postal_code: "", city: "" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { rangeStart, rangeEnd, dates } = useMemo(() => {
    if (view === "day") {
      const d = new Date(currentDate);
      d.setHours(0, 0, 0, 0);
      return { rangeStart: toDateStr(d), rangeEnd: toDateStr(d), dates: [d] };
    }
    if (view === "week") {
      const monday = getMonday(currentDate);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      });
      return { rangeStart: toDateStr(days[0]), rangeEnd: toDateStr(days[6]), dates: days };
    }
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay() || 7;
    const start = new Date(first);
    start.setDate(first.getDate() - (startDay - 1));
    const endDay = last.getDay() || 7;
    const end = new Date(last);
    end.setDate(last.getDate() + (7 - endDay));
    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return { rangeStart: toDateStr(start), rangeEnd: toDateStr(end), dates: days };
  }, [view, currentDate]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [jobsRes, apptsRes, cusRes] = await Promise.all([
        supabase.from("jobs").select("*, customers(*)").gte("scheduled_date", rangeStart).lte("scheduled_date", rangeEnd).order("scheduled_date"),
        supabase.from("appointments").select("*, customers(*)").gte("appointment_date", rangeStart).lte("appointment_date", rangeEnd).order("appointment_date"),
        supabase.from("customers").select("*").order("name"),
      ]);
      setJobs((jobsRes.data as Job[]) || []);
      setAppointments((apptsRes.data as Appointment[]) || []);
      setCustomers((cusRes.data as Customer[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, [rangeStart, rangeEnd]);

  // Merge jobs + appointments into unified items per date
  const itemsByDate = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    jobs.forEach((j) => {
      if (!j.scheduled_date) return;
      if (!map[j.scheduled_date]) map[j.scheduled_date] = [];
      map[j.scheduled_date].push({
        id: j.id, title: j.title, time: (j as any).scheduled_time || null,
        date: j.scheduled_date, type: "job", subtitle: j.customers?.name,
        detail: j.work_address ? `${j.work_address}, ${j.work_city}` : undefined,
        status: j.status,
      });
    });
    appointments.forEach((a) => {
      if (!map[a.appointment_date]) map[a.appointment_date] = [];
      const cust = a.customers;
      const addr = cust?.address ? `${cust.address}${cust.city ? `, ${cust.city}` : ""}` : undefined;
      map[a.appointment_date].push({
        id: a.id, title: a.title, time: a.appointment_time || null,
        date: a.appointment_date, type: "appointment", subtitle: cust?.name || undefined,
        detail: a.description || undefined, address: addr,
        description: a.description || undefined, customerId: a.customer_id || null,
      });
    });
    // Sort each day by time
    Object.values(map).forEach((items) => items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")));
    return map;
  }, [jobs, appointments]);

  const navigate_ = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  const headerLabel = () => {
    if (view === "day") return formatDateFull(currentDate);
    if (view === "week") {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${formatDateShort(monday)} – ${formatDateShort(sunday)}`;
    }
    return `${MONTHS_NL[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const openAddDialog = (preDate?: string) => {
    setNewAppt({ title: "", description: "", date: preDate || toDateStr(currentDate), time: "", customer_id: "" });
    setNewCustomer(false);
    setCustomerForm({ name: "", phone: "", email: "", address: "", postal_code: "", city: "" });
    setShowAddDialog(true);
  };

  const saveAppointment = async () => {
    if (!newAppt.title || !newAppt.date) { toast({ title: "Vul titel en datum in", variant: "destructive" }); return; }
    let custId = newAppt.customer_id || null;
    if (newCustomer) {
      if (!customerForm.name) { toast({ title: "Vul klantnaam in", variant: "destructive" }); return; }
      const { data, error } = await supabase.from("customers").insert(customerForm).select().single();
      if (error) { toast({ title: "Fout bij klant aanmaken", description: error.message, variant: "destructive" }); return; }
      custId = data.id;
      setCustomers((prev) => [...prev, data as Customer].sort((a, b) => a.name.localeCompare(b.name)));
    }
    const { error } = await supabase.from("appointments").insert({
      title: newAppt.title, description: newAppt.description || null,
      appointment_date: newAppt.date, appointment_time: newAppt.time || null,
      customer_id: custId, created_by: user?.id || null,
    });
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Afspraak toegevoegd" });
    setShowAddDialog(false);
    const { data } = await supabase.from("appointments").select("*, customers(*)").gte("appointment_date", rangeStart).lte("appointment_date", rangeEnd).order("appointment_date");
    setAppointments((data as Appointment[]) || []);
  };

  const deleteAppointment = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Afspraak verwijderd" });
  };

  const openAppointmentDetail = (item: AgendaItem) => {
    setSelectedAppointment(item);
    setShowDetailDialog(true);
  };

  const convertToJob = () => {
    if (!selectedAppointment) return;
    const params = new URLSearchParams();
    if (selectedAppointment.customerId) params.set("customer_id", selectedAppointment.customerId);
    if (selectedAppointment.date) params.set("date", selectedAppointment.date);
    if (selectedAppointment.time) params.set("time", selectedAppointment.time);
    params.set("title", selectedAppointment.title);
    if (selectedAppointment.description) params.set("description", selectedAppointment.description);
    params.set("from_appointment", selectedAppointment.id);
    navigate(`/admin/klussen/nieuw?${params.toString()}`);
  };

  // ─── ITEM CARD ──────────────────────────────────
  const ItemCard = ({ item, compact = false }: { item: AgendaItem; compact?: boolean }) => (
    <div
      onClick={() => item.type === "job" ? navigate(`/admin/klussen/${item.id}`) : openAppointmentDetail(item)}
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer active:scale-[0.98] transition-transform ${
        item.type === "job" ? "bg-primary/10 border-primary/20" : "bg-accent/50 border-accent"
      }`}
    >
      <div className={`w-0.5 self-stretch rounded-full shrink-0 ${item.type === "job" ? "bg-primary" : "bg-orange-500"}`} />
      {!compact && item.time && (
        <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-10">{item.time}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`${compact ? "text-[11px]" : "text-sm"} font-medium truncate`}>{compact && item.time ? `${item.time} ` : ""}{item.title}</p>
        {!compact && item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
        {!compact && item.address && <p className="text-[11px] text-muted-foreground truncate">{item.address}</p>}
      </div>
      {!compact && item.type === "appointment" && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); deleteAppointment(item.id); }}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
      {!compact && item.type === "job" && item.status && (
        <Badge variant="secondary" className="text-[10px] shrink-0">{item.status}</Badge>
      )}
    </div>
  );

  // ─── DAY VIEW ────────────────────────────────────
  const DayView = () => {
    const dateStr = toDateStr(currentDate);
    const items = itemsByDate[dateStr] || [];
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => openAddDialog(dateStr)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Afspraak toevoegen
        </Button>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Laden...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Geen items gepland</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    );
  };

  // ─── WEEK VIEW ───────────────────────────────────
  const WeekView = () => (
    <>
      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {dates.map((date, i) => {
          const dateStr = toDateStr(date);
          const items = itemsByDate[dateStr] || [];
          const today = isToday(date);
          return (
            <div key={i}>
              <div className={`flex items-center gap-2 mb-1.5 ${today ? "text-primary" : "text-muted-foreground"}`}>
                <span className="text-xs font-semibold uppercase">{DAYS_SHORT[i]}</span>
                <span className={`text-sm font-bold ${today ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center" : ""}`}>
                  {date.getDate()}
                </span>
                <span className="text-xs">{MONTHS_NL[date.getMonth()].slice(0, 3)}</span>
                {items.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">{items.length}</Badge>}
              </div>
              {items.length === 0 ? (
                <div className="py-2 text-xs text-muted-foreground text-center">—</div>
              ) : (
                <div className="space-y-1.5 pl-1">
                  {items.map((item) => <ItemCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Desktop */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
        {dates.map((date, i) => {
          const dateStr = toDateStr(date);
          const items = itemsByDate[dateStr] || [];
          const today = isToday(date);
          return (
            <div key={i} className={`rounded-xl border p-2 min-h-[140px] ${today ? "border-primary/50 bg-primary/5" : "border-border"}`}>
              <div className="text-center mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">{DAYS_SHORT[i]}</p>
                <p className={`text-lg font-bold ${today ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>{date.getDate()}</p>
              </div>
              <div className="space-y-1">
                {items.map((item) => <ItemCard key={item.id} item={item} compact />)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // ─── MONTH VIEW ──────────────────────────────────
  const MonthView = () => {
    const currentMonth = currentDate.getMonth();
    const selectedDateStr = toDateStr(selectedDay);
    const selectedItems = itemsByDate[selectedDateStr] || [];

    return (
      <>
        {/* Mobile: iPhone-style */}
        <div className="sm:hidden">
          <div className="bg-card rounded-2xl border border-border p-3 mb-3">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {dates.map((date, i) => {
                const dateStr = toDateStr(date);
                const hasItems = (itemsByDate[dateStr]?.length || 0) > 0;
                const today = isToday(date);
                const inMonth = date.getMonth() === currentMonth;
                const isSelected = dateStr === selectedDateStr;
                return (
                  <button key={i} onClick={() => setSelectedDay(new Date(date))} className="flex flex-col items-center py-1 rounded-xl transition-colors">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" : today ? "bg-primary/15 text-primary font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/30"
                    }`}>{date.getDate()}</span>
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${hasItems && !isSelected ? "bg-primary" : hasItems && isSelected ? "bg-primary-foreground" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {selectedDay.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {isToday(selectedDay) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Vandaag</Badge>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddDialog(selectedDateStr)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Laden...</div>
          ) : selectedItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Geen items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => <ItemCard key={item.id} item={item} />)}
            </div>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-0 border border-border rounded-xl overflow-hidden">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="p-2 text-center text-[11px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">{d}</div>
            ))}
            {dates.map((date, i) => {
              const dateStr = toDateStr(date);
              const items = itemsByDate[dateStr] || [];
              const today = isToday(date);
              const inMonth = date.getMonth() === currentMonth;
              return (
                <div key={i} className={`min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 ${!inMonth ? "bg-muted/30" : today ? "bg-primary/5" : "bg-background"}`}>
                  <p className={`text-xs font-medium mb-1 ${today ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : !inMonth ? "text-muted-foreground/40" : "text-foreground"}`}>{date.getDate()}</p>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.type === "job" ? navigate(`/admin/klussen/${item.id}`) : openAppointmentDetail(item)}
                        className={`text-[10px] leading-tight p-1 rounded truncate cursor-pointer transition-colors ${
                          item.type === "job" ? "bg-primary/10 hover:bg-primary/20 text-foreground" : "bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-foreground"
                        }`}
                      >
                        {item.time ? `${item.time} ` : ""}{item.title}
                      </div>
                    ))}
                    {items.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{items.length - 3} meer</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">{headerLabel()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => openAddDialog()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Afspraak
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate_(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={goToday}>Vandaag</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate_(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="day" className="flex-1 sm:flex-initial text-xs">Dag</TabsTrigger>
          <TabsTrigger value="week" className="flex-1 sm:flex-initial text-xs">Week</TabsTrigger>
          <TabsTrigger value="month" className="flex-1 sm:flex-initial text-xs">Maand</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {loading && jobs.length === 0 && appointments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Laden...</div>
      ) : (
        <>
          {view === "day" && <DayView />}
          {view === "week" && <WeekView />}
          {view === "month" && <MonthView />}
        </>
      )}

      {/* Add Appointment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Afspraak toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Titel *</Label>
              <Input placeholder="Bijv. Bezichtiging" value={newAppt.title} onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Datum *</Label>
                <Input type="date" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tijd</Label>
                <Input type="time" value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Klant (optioneel)</Label>
                <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => { setNewCustomer(!newCustomer); setNewAppt({ ...newAppt, customer_id: "" }); }}>
                  {newCustomer ? "Bestaande klant" : "+ Nieuwe klant"}
                </Button>
              </div>
              {newCustomer ? (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
                  <Input placeholder="Naam *" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Telefoon" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                    <Input placeholder="E-mail" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  </div>
                  <AddressFields
                    postalCode={customerForm.postal_code}
                    address={customerForm.address}
                    city={customerForm.city}
                    onPostalCodeChange={(v) => setCustomerForm({ ...customerForm, postal_code: v })}
                    onAddressChange={(v) => setCustomerForm({ ...customerForm, address: v })}
                    onCityChange={(v) => setCustomerForm({ ...customerForm, city: v })}
                    labelSize="text-[11px]"
                  />
                </div>
              ) : (
                <Select value={newAppt.customer_id} onValueChange={(v) => setNewAppt({ ...newAppt, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Omschrijving</Label>
              <Textarea placeholder="Optionele notities..." value={newAppt.description} onChange={(e) => setNewAppt({ ...newAppt, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuleren</Button>
            <Button onClick={saveAppointment}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-500" />
              {selectedAppointment?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Datum</p>
                  <p className="text-sm">{new Date(selectedAppointment.date).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {selectedAppointment.time && (
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Tijd</p>
                    <p className="text-sm">{selectedAppointment.time}</p>
                  </div>
                )}
              </div>
              {selectedAppointment.subtitle && (
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Klant</p>
                  <p className="text-sm">{selectedAppointment.subtitle}</p>
                </div>
              )}
              {selectedAppointment.address && (
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Adres</p>
                  <p className="text-sm">{selectedAppointment.address}</p>
                </div>
              )}
              {selectedAppointment.description && (
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">Omschrijving</p>
                  <p className="text-sm">{selectedAppointment.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" size="sm" onClick={() => { deleteAppointment(selectedAppointment!.id); setShowDetailDialog(false); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Verwijderen
            </Button>
            <Button onClick={convertToJob} className="gap-1.5">
              <Briefcase className="h-4 w-4" /> Omzetten naar klus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
