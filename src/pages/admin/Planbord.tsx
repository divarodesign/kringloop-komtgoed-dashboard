import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Job } from "@/types/database";

const DAYS_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAYS_FULL = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const getWeekDates = (offset: number) => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const Planbord = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0].toISOString().split("T")[0];
  const weekEnd = weekDates[6].toISOString().split("T")[0];

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jobs").select("*, customers(*)")
        .gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd)
        .order("scheduled_date");
      setJobs((data as Job[]) || []);
      setLoading(false);
    };
    fetch();
  }, [weekOffset]);

  const formatDate = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Planbord</h1>
          <p className="text-sm text-muted-foreground">Weekplanning</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => setWeekOffset(0)}>Vandaag</Button>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Mobile: vertical list per day */}
      <div className="sm:hidden space-y-3">
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split("T")[0];
          const dayJobs = jobs.filter((j) => j.scheduled_date === dateStr);
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          return (
            <div key={i}>
              <div className={`flex items-center gap-2 mb-1.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`text-xs font-semibold uppercase ${isToday ? "text-primary" : ""}`}>{DAYS_FULL[i]}</span>
                <span className="text-xs">{formatDate(date)}</span>
                {isToday && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Vandaag</Badge>}
              </div>
              {dayJobs.length === 0 && !loading ? (
                <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground text-center">Geen klussen</div>
              ) : (
                <div className="space-y-1.5">
                  {dayJobs.map((j) => (
                    <div key={j.id} className="p-3 bg-card rounded-xl border border-border/50 shadow-sm">
                      <p className="text-sm font-medium truncate">{j.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{j.customers?.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid grid-cols-7 gap-3">
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split("T")[0];
          const dayJobs = jobs.filter((j) => j.scheduled_date === dateStr);
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          return (
            <Card key={i} className={isToday ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{DAYS_FULL[i]}</CardTitle>
                <p className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{formatDate(date)}</p>
              </CardHeader>
              <CardContent className="p-3 pt-1 space-y-2 min-h-[120px]">
                {dayJobs.map((j) => (
                  <div key={j.id} className="rounded-md bg-muted p-2 text-xs space-y-1">
                    <p className="font-medium truncate">{j.title}</p>
                    <p className="text-muted-foreground truncate">{j.customers?.name}</p>
                  </div>
                ))}
                {dayJobs.length === 0 && !loading && (
                  <p className="text-xs text-muted-foreground text-center pt-4">Geen klussen</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Planbord;
