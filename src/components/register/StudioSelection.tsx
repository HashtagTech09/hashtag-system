import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ChevronRight, ArrowLeft } from "lucide-react";

interface StudioSelectionProps {
  selectedStyle: string;
  onSelectStudio: (studioId: number) => void;
  onBack: () => void;
}

export default function StudioSelection({ selectedStyle, onSelectStudio, onBack }: StudioSelectionProps) {
  const [studios, setStudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get batches matching this style to find which studios have them
      let batchQuery = supabase.from("batches").select("studio_id").eq("organization_id", 1);
      if (selectedStyle === "Kids") {
        batchQuery = batchQuery.ilike("level", "Kids%");
      } else {
        batchQuery = batchQuery.eq("style_base", selectedStyle);
      }
      const { data: batchData } = await batchQuery;
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

      // Auto-select if only one studio
      if (studioData && studioData.length === 1) {
        onSelectStudio(studioData[0].id);
      }
    };
    fetch();
  }, [selectedStyle]);

  if (loading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  if (studios.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground">No studios found for this style</p>
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Styles</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Select Studio</h2>
          <p className="text-sm text-muted-foreground">Where would you like to dance {selectedStyle === "Kids" ? "Kids" : selectedStyle}?</p>
        </div>
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
