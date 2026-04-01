import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const STYLES = [
  { key: "Jazz", label: "Jazz", desc: "Expressive, technical, performance-focused", gradient: "from-pink-600 to-rose-500" },
  { key: "Ballet", label: "Ballet", desc: "Build strength, posture, and grace", gradient: "from-purple-600 to-indigo-500" },
  { key: "Modern", label: "Modern", desc: "Fluid, expressive storytelling", gradient: "from-teal-600 to-cyan-500" },
  { key: "Hip Hop", label: "Hip Hop", desc: "High energy, freestyle, fun", gradient: "from-orange-600 to-amber-500" },
  { key: "Heels", label: "Heels", desc: "Confidence and performance", gradient: "from-red-600 to-pink-500" },
  { key: "Kids", label: "Kids Division", desc: "Fun and creativity for young dancers", gradient: "from-yellow-500 to-orange-400" },
];

interface StyleSelectionProps {
  onSelectStyle: (styleBase: string) => void;
}

export default function StyleSelection({ onSelectStyle }: StyleSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold text-foreground">Choose Your Style</h2>
        <p className="text-muted-foreground text-sm">Select a dance style to explore available batches</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STYLES.map(s => (
          <Card
            key={s.key}
            className="cursor-pointer group overflow-hidden border-border/50 hover:border-primary/60 transition-all duration-300 hover:scale-[1.03]"
            onClick={() => onSelectStyle(s.key)}
          >
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br ${s.gradient} p-5 pb-8 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                <h3 className="relative font-display font-bold text-white text-lg leading-tight">{s.label}</h3>
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground leading-snug">{s.desc}</p>
                <ChevronRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
