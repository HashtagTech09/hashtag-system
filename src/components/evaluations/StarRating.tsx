import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  max?: number;
}

export function StarRating({ value, onChange, disabled, max = 5 }: Props) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? 0 : n)}
            className={cn(
              "p-1 rounded transition-colors",
              disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
            )}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "h-6 w-6",
                active ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}
