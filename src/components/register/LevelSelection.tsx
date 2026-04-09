import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface LevelSelectionProps {
  studioId: number;
  selectedStyle: string;
  onSelectLevel: (level: string) => void;
  onBack: () => void;
}

export default function LevelSelection({ studioId, selectedStyle, onSelectLevel, onBack }: LevelSelectionProps) {
  const [levels, setLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from("batches").select("level").eq("organization_id", 1).eq("studio_id", studioId);
      if (selectedStyle === "Kids") {
        query = query.ilike("level", "Kids%");
      } else {
        query = query.eq("style_base", selectedStyle);
      }
      const { data } = await query;
      let unique = [...new Set((data || []).map(b => b.level).filter(Boolean))] as string[];
      unique.sort();

      // For Kids, only show the lowest level (e.g. "Kids Level 1") and auto-advance
      if (selectedStyle === "Kids" && unique.length > 0) {
        const lowest = unique.find(l => l.includes("1")) || unique[0];
        unique = [lowest];
      }

      setLevels(unique);
      setLoading(false);

      if (unique.length === 1) {
        onSelectLevel(unique[0]);
      }
    };
    fetch();
  }, [studioId, selectedStyle]);

  if (loading) return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  if (levels.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground">No levels found for {selectedStyle}</p>
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
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
          <h2 className="text-xl font-display font-bold text-foreground">Select Level</h2>
          <p className="text-sm text-muted-foreground">Choose your level for {selectedStyle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {levels.map(level => (
          <Card
            key={level}
            className="cursor-pointer group hover:border-primary/60 transition-all duration-300 hover:scale-[1.02]"
            onClick={() => onSelectLevel(level)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">{level}</h3>
              <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
