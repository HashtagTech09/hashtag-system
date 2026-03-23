import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ScheduleEntry = { day: string; start_time: string; end_time: string };
type Session = { id: number; session_date: string; day: string; start_time: string; end_time: string; status: string };

const DAY_MAP: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: any;
}

export default function BatchSessionsDialog({ open, onOpenChange, batch }: Props) {
  const [tab, setTab] = useState<"generate" | "list">("list");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [preview, setPreview] = useState<{ day: string; date: Date; start_time: string; end_time: string }[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const schedule: ScheduleEntry[] = Array.isArray(batch?.schedule) ? batch.schedule : [];

  useEffect(() => {
    if (open && batch) fetchSessions();
  }, [open, batch]);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("batch_sessions")
      .select("*")
      .eq("batch_id", batch.id)
      .order("session_date", { ascending: true });
    setSessions(data || []);
  };

  useEffect(() => {
    if (!startDate || !endDate || schedule.length === 0) { setPreview([]); return; }
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const results: typeof preview = [];
    for (const d of days) {
      const dayName = DAY_MAP[getDay(d)];
      for (const entry of schedule) {
        if (entry.day === dayName) {
          results.push({ day: dayName, date: d, start_time: entry.start_time, end_time: entry.end_time });
        }
      }
    }
    setPreview(results);
  }, [startDate, endDate, schedule]);

  const handleGenerate = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    const rows = preview.map((p) => ({
      organization_id: batch.organization_id,
      batch_id: batch.id,
      session_date: format(p.date, "yyyy-MM-dd"),
      day: p.day,
      start_time: p.start_time,
      end_time: p.end_time,
    }));
    const { error } = await supabase.from("batch_sessions").upsert(rows, { onConflict: "batch_id,session_date,start_time" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} sessions generated`);
    setStartDate(undefined);
    setEndDate(undefined);
    setPreview([]);
    setTab("list");
    fetchSessions();
  };

  const handleCancel = async (id: number) => {
    await supabase.from("batch_sessions").update({ status: "cancelled" }).eq("id", id);
    toast.success("Session cancelled");
    fetchSessions();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sessions — {batch?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button variant={tab === "list" ? "default" : "outline"} size="sm" onClick={() => setTab("list")}>Sessions</Button>
          <Button variant={tab === "generate" ? "default" : "outline"} size="sm" onClick={() => setTab("generate")}>Generate</Button>
        </div>

        {tab === "generate" && (
          <div className="space-y-4">
            {schedule.length === 0 && (
              <p className="text-sm text-muted-foreground">This batch has no schedule configured. Add days & times first.</p>
            )}
            {schedule.length > 0 && (
              <>
                <div className="flex gap-4 flex-wrap">
                  <DatePicker label="Start date" date={startDate} onSelect={setStartDate} />
                  <DatePicker label="End date" date={endDate} onSelect={setEndDate} />
                </div>
                {preview.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{preview.length}</span> sessions will be generated
                  </div>
                )}
                <Button className="gradient-primary" disabled={preview.length === 0 || loading} onClick={handleGenerate}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate {preview.length} Sessions
                </Button>
              </>
            )}
          </div>
        )}

        {tab === "list" && (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.session_date}</TableCell>
                    <TableCell>{s.day}</TableCell>
                    <TableCell>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "cancelled" ? "destructive" : s.status === "completed" ? "secondary" : "default"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.status === "scheduled" && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleCancel(s.id)}>Cancel</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sessions generated yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DatePicker({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
