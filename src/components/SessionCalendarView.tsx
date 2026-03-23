import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, XCircle, Sun, Ban, CheckCircle, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type Session = { id: number; session_date: string; day: string; start_time: string; end_time: string; status: string; available_slots: number | null };

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; color: string }> = {
  scheduled: { label: "Scheduled", variant: "default", color: "bg-blue-500" },
  cancelled: { label: "Cancelled", variant: "destructive", color: "bg-destructive" },
  holiday: { label: "Holiday", variant: "secondary", color: "bg-yellow-500" },
  sold_out: { label: "Sold Out", variant: "outline", color: "bg-muted-foreground" },
  completed: { label: "Completed", variant: "secondary", color: "bg-green-500" },
};

interface Props {
  sessions: Session[];
  onUpdateStatus: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onSaveSlots: (id: number, slots: number | null) => void;
}

export default function SessionCalendarView({ sessions, onUpdateStatus, onDelete, onSaveSlots }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [editingSlotsId, setEditingSlotsId] = useState<number | null>(null);
  const [slotsValue, setSlotsValue] = useState("");

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of sessions) {
      (map[s.session_date] ||= []).push(s);
    }
    return map;
  }, [sessions]);

  const sessionDates = useMemo(() => {
    const dates: Date[] = [];
    for (const dateStr of Object.keys(sessionsByDate)) {
      dates.push(parseISO(dateStr));
    }
    return dates;
  }, [sessionsByDate]);

  // Build modifiers by status
  const modifiers = useMemo(() => {
    const scheduled: Date[] = [], cancelled: Date[] = [], holiday: Date[] = [], sold_out: Date[] = [], completed: Date[] = [];
    for (const [dateStr, dateSessions] of Object.entries(sessionsByDate)) {
      const date = parseISO(dateStr);
      // Priority: cancelled > holiday > sold_out > completed > scheduled
      const statuses = dateSessions.map(s => s.status);
      if (statuses.includes("cancelled")) cancelled.push(date);
      else if (statuses.includes("holiday")) holiday.push(date);
      else if (statuses.includes("sold_out")) sold_out.push(date);
      else if (statuses.includes("completed")) completed.push(date);
      else scheduled.push(date);
    }
    return { sessionScheduled: scheduled, sessionCancelled: cancelled, sessionHoliday: holiday, sessionSoldOut: sold_out, sessionCompleted: completed };
  }, [sessionsByDate]);

  const modifiersStyles = {
    sessionScheduled: { backgroundColor: "hsl(217 91% 60%)", color: "white", borderRadius: "50%" },
    sessionCancelled: { backgroundColor: "hsl(0 84% 60%)", color: "white", borderRadius: "50%" },
    sessionHoliday: { backgroundColor: "hsl(45 93% 47%)", color: "white", borderRadius: "50%" },
    sessionSoldOut: { backgroundColor: "hsl(0 0% 64%)", color: "white", borderRadius: "50%" },
    sessionCompleted: { backgroundColor: "hsl(142 71% 45%)", color: "white", borderRadius: "50%" },
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedSessions = selectedDateStr ? (sessionsByDate[selectedDateStr] || []) : [];

  const handleSaveSlots = (id: number) => {
    onSaveSlots(id, slotsValue === "" ? null : Number(slotsValue));
    setEditingSlotsId(null);
    setSlotsValue("");
  };

  const startEditSlots = (session: Session) => {
    setEditingSlotsId(session.id);
    setSlotsValue(session.available_slots != null ? String(session.available_slots) : "");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="p-3 pointer-events-auto"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center text-xs">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={cn("h-3 w-3 rounded-full inline-block", cfg.color)} />
            <span className="text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="font-medium text-sm">{format(selectedDate, "EEEE, MMM d, yyyy")}</h4>
          {selectedSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions on this date</p>
          ) : (
            selectedSessions.map((s) => {
              const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                    <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    {editingSlotsId === s.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          className="w-16 h-7 text-xs"
                          value={slotsValue}
                          onChange={(e) => setSlotsValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveSlots(s.id); if (e.key === "Escape") setEditingSlotsId(null); }}
                          autoFocus
                        />
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveSlots(s.id)}>✓</Button>
                      </div>
                    ) : (
                      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => startEditSlots(s)}>
                        Slots: {s.available_slots != null ? s.available_slots : "—"}
                      </button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {s.status !== "scheduled" && <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "scheduled")}><CheckCircle className="h-4 w-4 mr-2" />Scheduled</DropdownMenuItem>}
                      {s.status !== "cancelled" && <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "cancelled")}><XCircle className="h-4 w-4 mr-2" />Cancel</DropdownMenuItem>}
                      {s.status !== "holiday" && <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "holiday")}><Sun className="h-4 w-4 mr-2" />Holiday</DropdownMenuItem>}
                      {s.status !== "sold_out" && <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "sold_out")}><Ban className="h-4 w-4 mr-2" />Sold Out</DropdownMenuItem>}
                      {s.status !== "completed" && <DropdownMenuItem onClick={() => onUpdateStatus(s.id, "completed")}><CheckCircle className="h-4 w-4 mr-2" />Completed</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => startEditSlots(s)}><Users className="h-4 w-4 mr-2" />Set Slots</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
