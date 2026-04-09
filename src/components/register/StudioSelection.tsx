import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ChevronRight } from "lucide-react";

interface StudioSelectionProps {
  onSelectStudio: (studioId: number) => void;
}

export default function StudioSelection({ onSelectStudio }: StudioSelectionProps) {
  const [studios, setStudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: batchData } = await supabase.from("batches").select("studio_id").eq("organization_id", 1);
      const studioIds = [...new Set((batchData || []).map(b => b.studio_id).filter(Boolean))];

      if (studioIds.length === 0) {
        setStudios([]);
        setLoading(false);
        return;
      }

      const { data: studioData } = await supabase
        .from("studios")
        .select("*")
        .in("id", studioIds)
        .eq("organization_id", 1);
      setStudios(studioData || []);
      setLoading(false);

      if (studioData && studioData.length === 1) {
        onSelectStudio(studioData[0].id);
      }
    };
    fetch();
  }, []);

  if (loading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  if (studios.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No studios available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold text-foreground">Select Studio</h2>
        <p className="text-muted-foreground text-sm">Where would you like to dance?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {studios.map(s => (
          <Card
            key={s.id}
            className="cursor-pointer group hover:border-primary/60 transition-all duration-300 hover:scale-[1.02]"
            onClick={() => onSelectStudio(s.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-foreground">{s.name}</h3>
                {s.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{s.location}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
