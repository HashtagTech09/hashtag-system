import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SessionBrowserProps {
  selectedSessionId: number | null;
  onSelectSession: (session: any) => void;
}

export default function SessionBrowser({ selectedSessionId, onSelectSession }: SessionBrowserProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const [sessRes, batchRes] = await Promise.all([
        supabase.from("batch_sessions")
          .select("*")
          .eq("organization_id", 1)
          .eq("status", "scheduled")
          .gte("session_date", todayStr)
          .order("session_date")
          .limit(50),
        supabase.from("batches").select("id, name, style").eq("organization_id", 1),
      ]);
      setSessions(sessRes.data || []);
      setBatches(batchRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getBatchName = (id: number) => batches.find(b => b.id === id)?.name || `Batch ${id}`;

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  if (sessions.length === 0) return <p className="text-muted-foreground text-center py-8">No upcoming sessions available</p>;

  // Group by date
  const grouped = sessions.reduce((acc: Record<string, any[]>, s) => {
    (acc[s.session_date] = acc[s.session_date] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pick a session to drop in</p>
      {Object.entries(grouped).map(([date, dateSessions]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            {format(parseISO(date), "EEEE, MMM d, yyyy")}
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {(dateSessions as any[]).map(s => {
              const selected = selectedSessionId === s.id;
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary glow-primary" : "hover:border-primary/50"}`}
                  onClick={() => onSelectSession(s)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-foreground">{getBatchName(s.batch_id)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>{s.start_time} – {s.end_time}</span>
                          {s.style && <Badge variant="secondary" className="text-xs">{s.style}</Badge>}
                        </div>
                      </div>
                    </div>
                    {s.available_slots != null && (
                      <Badge variant={s.available_slots > 0 ? "secondary" : "destructive"} className="text-xs">
                        {s.available_slots > 0 ? `${s.available_slots} slots` : "Full"}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
