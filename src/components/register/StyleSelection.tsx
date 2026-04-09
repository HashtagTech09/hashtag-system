import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ArrowLeft } from "lucide-react";

const STYLE_META: Record<string, { desc: string; gradient: string }> = {
  Jazz: { desc: "Expressive, technical, performance-focused", gradient: "from-pink-600 to-rose-500" },
  Ballet: { desc: "Build strength, posture, and grace", gradient: "from-purple-600 to-indigo-500" },
  Modern: { desc: "Fluid, expressive storytelling", gradient: "from-teal-600 to-cyan-500" },
  "Hip Hop": { desc: "High energy, freestyle, fun", gradient: "from-orange-600 to-amber-500" },
  Heels: { desc: "Confidence and performance", gradient: "from-red-600 to-pink-500" },
  Kids: { desc: "Fun and creativity for young dancers", gradient: "from-yellow-500 to-orange-400" },
};

const DEFAULT_GRADIENT = "from-slate-600 to-slate-500";

interface StyleSelectionProps {
  studioId: number;
  onSelectStyle: (styleBase: string) => void;
  onBack: () => void;
}

export default function StyleSelection({ studioId, onSelectStyle, onBack }: StyleSelectionProps) {
  const [styles, setStyles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("batches")
        .select("style_base, level")
        .eq("organization_id", 1)
        .eq("studio_id", studioId);
      const bases = new Set<string>();
      (data || []).forEach(b => {
        if (b.level && (b.level as string).toLowerCase().startsWith("kids")) {
          bases.add("Kids");
        } else if (b.style_base) {
          bases.add(b.style_base);
        }
      });
      const sorted = [...bases].sort();
      setStyles(sorted);
      setLoading(false);

      if (sorted.length === 1) {
        onSelectStyle(sorted[0]);
      }
    };
    fetch();
  }, [studioId]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Choose Your Style</h2>
          <p className="text-sm text-muted-foreground">Select a dance style to explore</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {styles.map(s => {
          const meta = STYLE_META[s];
          const gradient = meta?.gradient || DEFAULT_GRADIENT;
          const desc = meta?.desc || "";
          return (
            <Card
              key={s}
              className="cursor-pointer group overflow-hidden border-border/50 hover:border-primary/60 transition-all duration-300 hover:scale-[1.03]"
              onClick={() => onSelectStyle(s)}
            >
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${gradient} p-5 pb-8 relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <h3 className="relative font-display font-bold text-white text-lg leading-tight">{s === "Kids" ? "Kids Division" : s}</h3>
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
