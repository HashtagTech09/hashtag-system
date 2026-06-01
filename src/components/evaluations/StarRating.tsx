import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  max?: number;
  readOnly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, max = 5, readOnly = false, size = 28 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(n === value ? 0 : n)}
            className={cn(
              "transition-transform hover:scale-110 disabled:hover:scale-100",
              readOnly && "cursor-default",
            )}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                filled ? "fill-warning text-warning" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
