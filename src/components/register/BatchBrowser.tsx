import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Users } from "lucide-react";

interface BatchBrowserProps {
  selectedBatchIds: string[];
  onToggleBatch: (id: string) => void;
}

export default function BatchBrowser({ selectedBatchIds, onToggleBatch }: BatchBrowserProps) {
  const [batches, setBatches] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [batchRes, studioRes] = await Promise.all([
        supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
        supabase.from("studios").select("*").eq("organization_id", 1),
      ]);
      setBatches(batchRes.data || []);
      setStudios(studioRes.data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getStudioName = (id: number | null) => studios.find(s => s.id === id)?.name || "";

  const formatSchedule = (schedule: any) => {
    if (!schedule || !Array.isArray(schedule)) return null;
    return schedule.map((s: any) => `${s.day} ${s.start_time}–${s.end_time}`).join(", ");
  };

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select one or more batches to enroll in</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {batches.map(b => {
          const selected = selectedBatchIds.includes(String(b.id));
          return (
            <Card
              key={b.id}
              className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary glow-primary" : "hover:border-primary/50"}`}
              onClick={() => onToggleBatch(String(b.id))}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{b.name}</h3>
                    {b.style && <Badge variant="secondary" className="text-xs mt-1">{b.style}</Badge>}
                  </div>
                  {selected && <Badge className="gradient-primary text-xs">Selected</Badge>}
                </div>
                {b.level && <p className="text-xs text-muted-foreground">Level: {b.level}</p>}
                {b.studio_id && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{getStudioName(b.studio_id)}</span>
                  </div>
                )}
                {b.schedule && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatSchedule(b.schedule)}</span>
                  </div>
                )}
                {b.capacity && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Capacity: {b.capacity}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
