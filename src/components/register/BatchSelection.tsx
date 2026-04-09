import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Users, User } from "lucide-react";

interface BatchSelectionProps {
  selectedStyle: string;
  studioId: number;
  selectedLevel: string;
  selectedBatchIds: string[];
  onToggleBatch: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function BatchSelection({ selectedStyle, studioId, selectedLevel, selectedBatchIds, onToggleBatch, onContinue, onBack }: BatchSelectionProps) {
  const [batches, setBatches] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<Record<number, string>>({});
  const [enrollCounts, setEnrollCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from("batches").select("*").eq("organization_id", 1).eq("studio_id", studioId).eq("level", selectedLevel);
      if (selectedStyle === "Kids") {
        query = query.ilike("level", "Kids%");
      } else {
        query = query.eq("style_base", selectedStyle);
      }
      const { data: batchData } = await query.order("name");
      const batchList = batchData || [];
      setBatches(batchList);

      const instrIds = [...new Set(batchList.map(b => b.instructor_id).filter(Boolean))];
      if (instrIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, name").in("id", instrIds);
        const map: Record<number, string> = {};
        (users || []).forEach(u => { map[u.id] = u.name; });
        setInstructors(map);
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const batchIds = batchList.map(b => b.id);
      if (batchIds.length > 0) {
        const { data: enrollData } = await supabase
          .from("enrollments")
          .select("batch_id")
          .in("batch_id", batchIds)
          .gte("end_date", todayStr);
        const counts: Record<number, number> = {};
        (enrollData || []).forEach(e => { counts[e.batch_id] = (counts[e.batch_id] || 0) + 1; });
        setEnrollCounts(counts);
      }

      setLoading(false);
    };
    fetch();
  }, [selectedStyle, studioId, selectedLevel]);

  const formatSchedule = (schedule: any) => {
    if (!schedule || !Array.isArray(schedule)) return null;
    return schedule.map((s: any) => `${s.day} ${s.start_time}–${s.end_time}`).join(" • ");
  };

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Select Batches</h2>
          <p className="text-sm text-muted-foreground">Pick one or more batches to join</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {batches.map(b => {
          const selected = selectedBatchIds.includes(String(b.id));
          const enrolled = enrollCounts[b.id] || 0;
          const spotsLeft = b.capacity ? b.capacity - enrolled : null;

          return (
            <Card
              key={b.id}
              className={`cursor-pointer transition-all duration-200 ${selected ? "ring-2 ring-primary glow-primary" : "hover:border-primary/50"}`}
              onClick={() => onToggleBatch(String(b.id))}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-foreground">{b.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      {b.style_base && <Badge variant="secondary" className="text-xs">{b.style_base}</Badge>}
                      {b.level && <Badge variant="outline" className="text-xs">{b.level}</Badge>}
                    </div>
                  </div>
                  {selected && <Badge className="gradient-primary text-xs shrink-0">Selected</Badge>}
                </div>

                {b.schedule && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{formatSchedule(b.schedule)}</span>
                  </div>
                )}

                {b.instructor_id && instructors[b.instructor_id] && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{instructors[b.instructor_id]}</span>
                  </div>
                )}

                {spotsLeft !== null && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className={spotsLeft <= 3 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {batches.length === 0 && (
        <p className="text-center text-muted-foreground py-6">No batches available</p>
      )}

      {selectedBatchIds.length > 0 && (
        <Button className="w-full gradient-primary text-base py-5" onClick={onContinue}>
          Continue with {selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? "es" : ""}
        </Button>
      )}
    </div>
  );
}
