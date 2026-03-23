import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS = ["AM", "PM"] as const;

function to12h(value: string): { hour: number; minute: number; period: "AM" | "PM" } {
  if (!value) return { hour: 12, minute: 0, period: "AM" };
  const [h, m] = value.split(":").map(Number);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: m, period };
}

function to24h(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour;
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay(value: string): string {
  if (!value) return "";
  const { hour, minute, period } = to12h(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

interface TimePickerPopoverProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

export function TimePickerPopover({ value, onChange, placeholder = "Pick time" }: TimePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const { hour, minute, period } = to12h(value);

  const [selHour, setSelHour] = useState(hour);
  const [selMinute, setSelMinute] = useState(minute);
  const [selPeriod, setSelPeriod] = useState(period);

  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const parsed = to12h(value);
      setSelHour(parsed.hour);
      setSelMinute(parsed.minute);
      setSelPeriod(parsed.period);
      setTimeout(() => {
        hourRef.current?.querySelector("[data-selected]")?.scrollIntoView({ block: "center" });
        minRef.current?.querySelector("[data-selected]")?.scrollIntoView({ block: "center" });
      }, 50);
    }
  }, [open, value]);

  const handleSelect = (h: number, m: number, p: "AM" | "PM") => {
    onChange(to24h(h, m, p));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal", !value && "text-muted-foreground")}>
          <Clock className="mr-2 h-4 w-4" />
          {value ? formatDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-0 h-48">
          {/* Hours */}
          <div className="h-48 w-14 overflow-y-auto border-r border-border" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }} onWheel={(e) => e.stopPropagation()}>
            <div ref={hourRef} className="py-2">
              {HOURS.map((h) => (
                <button
                  key={h}
                  data-selected={h === selHour ? "" : undefined}
                  className={cn(
                    "w-full py-1.5 text-center text-sm transition-colors hover:bg-accent",
                    h === selHour && "bg-primary text-primary-foreground font-medium"
                  )}
                  onClick={() => { setSelHour(h); handleSelect(h, selMinute, selPeriod); }}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          {/* Minutes */}
          <div className="h-48 w-14 overflow-y-auto border-r border-border" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }} onWheel={(e) => e.stopPropagation()}>
            <div ref={minRef} className="py-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  data-selected={m === selMinute ? "" : undefined}
                  className={cn(
                    "w-full py-1.5 text-center text-sm transition-colors hover:bg-accent",
                    m === selMinute && "bg-primary text-primary-foreground font-medium"
                  )}
                  onClick={() => { setSelMinute(m); handleSelect(selHour, m, selPeriod); }}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          {/* AM/PM */}
          <div className="flex flex-col justify-center gap-1 px-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={cn(
                  "px-3 py-2 rounded text-sm font-medium transition-colors",
                  p === selPeriod ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
                )}
                onClick={() => { setSelPeriod(p); handleSelect(selHour, selMinute, p); }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
