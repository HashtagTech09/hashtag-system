import { performanceLevel, toneToBadgeClass } from "@/lib/evaluationScoring";
import { cn } from "@/lib/utils";

export function ScoreBadge({ pct, className }: { pct: number; className?: string }) {
  const lvl = performanceLevel(pct);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        toneToBadgeClass(lvl.tone),
        className,
      )}
    >
      {pct.toFixed(0)}% · {lvl.label}
    </span>
  );
}
