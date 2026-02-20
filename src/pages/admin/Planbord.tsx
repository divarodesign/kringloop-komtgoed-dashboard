import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Job } from "@/types/database";

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planbord</h1>
          <p className="text-muted-foreground">Weekplanning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Vandaag</Button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split("T")[0];
          const dayJobs = jobs.filter((j) => j.scheduled_date === dateStr);
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          return (
            <Card key={i} className={isToday ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{DAYS[i]}</CardTitle>
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
