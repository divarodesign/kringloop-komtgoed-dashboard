import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Job } from "@/types/database";

type ViewMode = "day" | "week" | "month";

const DAYS_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTHS_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

// Get Monday of the week for a given date
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateStr = (d: Date) => d.toISOString().split("T")[0];
const isToday = (d: Date) => toDateStr(d) === toDateStr(new Date());

const formatDateShort = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

const formatDateFull = (d: Date) =>
  d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const Agenda = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  // Compute date range based on view
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
    // month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // pad to full weeks (Mon–Sun)
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
    const fetchJobs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jobs")
        .select("*, customers(*)")
        .gte("scheduled_date", rangeStart)
        .lte("scheduled_date", rangeEnd)
        .order("scheduled_date");
      setJobs((data as Job[]) || []);
      setLoading(false);
    };
    fetchJobs();
  }, [rangeStart, rangeEnd]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs.forEach((j) => {
      if (j.scheduled_date) {
        if (!map[j.scheduled_date]) map[j.scheduled_date] = [];
        map[j.scheduled_date].push(j);
      }
    });
    return map;
  }, [jobs]);

  const navigate_ = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

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

  const JobCard = ({ job }: { job: Job }) => (
    <div
      onClick={() => navigate(`/admin/klussen/${job.id}`)}
      className="p-2 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
    >
      <p className="text-xs sm:text-sm font-medium truncate text-foreground">{job.title}</p>
      <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{job.customers?.name}</p>
    </div>
  );

  // ─── DAY VIEW ────────────────────────────────────
  const DayView = () => {
    const dateStr = toDateStr(currentDate);
    const dayJobs = jobsByDate[dateStr] || [];
    return (
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Laden...</div>
        ) : dayJobs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Geen klussen gepland</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayJobs.map((j) => (
              <Card key={j.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/klussen/${j.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{j.customers?.name}</p>
                      {j.work_address && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{j.work_address}, {j.work_city}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{j.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── WEEK VIEW ───────────────────────────────────
  const WeekView = () => (
    <>
      {/* Mobile: vertical list */}
      <div className="sm:hidden space-y-3">
        {dates.map((date, i) => {
          const dateStr = toDateStr(date);
          const dayJobs = jobsByDate[dateStr] || [];
          const today = isToday(date);
          return (
            <div key={i}>
              <div className={`flex items-center gap-2 mb-1.5 ${today ? "text-primary" : "text-muted-foreground"}`}>
                <span className="text-xs font-semibold uppercase">{DAYS_SHORT[i]}</span>
                <span className={`text-sm font-bold ${today ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center" : ""}`}>
                  {date.getDate()}
                </span>
                <span className="text-xs">{MONTHS_NL[date.getMonth()].slice(0, 3)}</span>
                {dayJobs.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">{dayJobs.length}</Badge>
                )}
              </div>
              {dayJobs.length === 0 ? (
                <div className="py-2 text-xs text-muted-foreground text-center">—</div>
              ) : (
                <div className="space-y-1.5 pl-1">
                  {dayJobs.map((j) => <JobCard key={j.id} job={j} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
        {dates.map((date, i) => {
          const dateStr = toDateStr(date);
          const dayJobs = jobsByDate[dateStr] || [];
          const today = isToday(date);
          return (
            <div key={i} className={`rounded-xl border p-2 min-h-[140px] ${today ? "border-primary/50 bg-primary/5" : "border-border"}`}>
              <div className="text-center mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">{DAYS_SHORT[i]}</p>
                <p className={`text-lg font-bold ${today ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
                  {date.getDate()}
                </p>
              </div>
              <div className="space-y-1">
                {dayJobs.map((j) => <JobCard key={j.id} job={j} />)}
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
    return (
      <>
        {/* Mobile: list only days with jobs */}
        <div className="sm:hidden space-y-3">
          {dates
            .filter((d) => d.getMonth() === currentMonth && (jobsByDate[toDateStr(d)]?.length || 0) > 0)
            .map((date, i) => {
              const dateStr = toDateStr(date);
              const dayJobs = jobsByDate[dateStr] || [];
              const today = isToday(date);
              return (
                <div key={i}>
                  <div className={`flex items-center gap-2 mb-1.5 ${today ? "text-primary" : "text-muted-foreground"}`}>
                    <span className={`text-sm font-bold ${today ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center" : ""}`}>
                      {date.getDate()}
                    </span>
                    <span className="text-xs">
                      {date.toLocaleDateString("nl-NL", { weekday: "long", month: "short" })}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">{dayJobs.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {dayJobs.map((j) => <JobCard key={j.id} job={j} />)}
                  </div>
                </div>
              );
            })}
          {dates.filter((d) => d.getMonth() === currentMonth && (jobsByDate[toDateStr(d)]?.length || 0) > 0).length === 0 && !loading && (
            <div className="text-center py-12">
              <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Geen klussen deze maand</p>
            </div>
          )}
        </div>

        {/* Desktop: calendar grid */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-0 border border-border rounded-xl overflow-hidden">
            {/* Header */}
            {DAYS_SHORT.map((d) => (
              <div key={d} className="p-2 text-center text-[11px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
                {d}
              </div>
            ))}
            {/* Days */}
            {dates.map((date, i) => {
              const dateStr = toDateStr(date);
              const dayJobs = jobsByDate[dateStr] || [];
              const today = isToday(date);
              const inMonth = date.getMonth() === currentMonth;
              return (
                <div
                  key={i}
                  className={`min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 ${
                    !inMonth ? "bg-muted/30" : today ? "bg-primary/5" : "bg-background"
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                      : !inMonth
                        ? "text-muted-foreground/40"
                        : "text-foreground"
                  }`}>
                    {date.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayJobs.slice(0, 3).map((j) => (
                      <div
                        key={j.id}
                        onClick={() => navigate(`/admin/klussen/${j.id}`)}
                        className="text-[10px] leading-tight p-1 rounded bg-primary/10 text-foreground truncate cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        {j.title}
                      </div>
                    ))}
                    {dayJobs.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayJobs.length - 3} meer</p>
                    )}
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate_(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={goToday}>
            Vandaag
          </Button>
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
      {loading && jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Laden...</div>
      ) : (
        <>
          {view === "day" && <DayView />}
          {view === "week" && <WeekView />}
          {view === "month" && <MonthView />}
        </>
      )}
    </div>
  );
};

export default Agenda;
