import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/evaluations/ScoreBadge";
import { todayIST } from "@/lib/dateUtils";

interface Row {
  instructor_id: number;
  instructor: string;
  studio: string;
  monthly_avg: number;
  reports: number;
  pending: number;
}

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [studioFilter, setStudioFilter] = useState<string>("all");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayIST());

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("studios").select("id, name").eq("organization_id", 1).order("name");
      setStudios(data || []);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [from, to, studioFilter]);

  const load = async () => {
    // Pull reports in date range
    let q = supabase
      .from("instructor_reports")
      .select("instructor_id, studio_id, compliance_pct, session_date")
      .gte("session_date", from)
      .lte("session_date", to);
    if (studioFilter !== "all") q = q.eq("studio_id", Number(studioFilter));
    const { data: reports } = await q;

    // Instructors lookup
    const { data: instructors } = await supabase
      .from("users")
      .select("id, name")
      .eq("organization_id", 1);
    const userMap = new Map<number, string>((instructors || []).map((u: any) => [u.id, u.name]));
    const studioMap = new Map<number, string>((studios || []).map((s: any) => [s.id, s.name]));

    // Pending = scheduled+completed sessions in range, instructor matches, no report
    const { data: batches } = await supabase
      .from("batches")
      .select("id, instructor_id, instructor_2_id, studio_id")
      .eq("organization_id", 1);
    const batchById = new Map<number, any>((batches || []).map((b: any) => [b.id, b]));
    const batchIds = (batches || []).map((b: any) => b.id);

    let sessionsQ = supabase
      .from("batch_sessions")
      .select("id, batch_id, session_date, status")
      .in("batch_id", batchIds.length ? batchIds : [0])
      .gte("session_date", from)
      .lte("session_date", to)
      .lte("session_date", todayIST());
    const { data: sessions } = await sessionsQ;

    const reportSet = new Set<string>(
      (reports || []).map((r: any) => `${r.instructor_id}|${r.session_date}|${r.studio_id}`),
    );

    // Aggregate per instructor
    const agg = new Map<number, { sum: number; n: number; pending: number; studioName: string }>();

    (reports || []).forEach((r: any) => {
      const cur = agg.get(r.instructor_id) || { sum: 0, n: 0, pending: 0, studioName: studioMap.get(r.studio_id) || "—" };
      cur.sum += Number(r.compliance_pct || 0);
      cur.n += 1;
      agg.set(r.instructor_id, cur);
    });

    (sessions || []).forEach((s: any) => {
      const b = batchById.get(s.batch_id);
      if (!b) return;
      const instructors = [b.instructor_id, b.instructor_2_id].filter(Boolean) as number[];
      instructors.forEach((iid) => {
        const key = `${iid}|${s.session_date}|${b.studio_id || null}`;
        if (!reportSet.has(`${iid}|${s.session_date}|${b.studio_id}`)) {
          const cur = agg.get(iid) || { sum: 0, n: 0, pending: 0, studioName: studioMap.get(b.studio_id) || "—" };
          cur.pending += 1;
          if (!cur.studioName || cur.studioName === "—") cur.studioName = studioMap.get(b.studio_id) || "—";
          agg.set(iid, cur);
        }
      });
    });

    const out: Row[] = [];
    agg.forEach((v, instructor_id) => {
      out.push({
        instructor_id,
        instructor: userMap.get(instructor_id) || `#${instructor_id}`,
        studio: v.studioName,
        monthly_avg: v.n > 0 ? v.sum / v.n : 0,
        reports: v.n,
        pending: v.pending,
      });
    });
    out.sort((a, b) => b.monthly_avg - a.monthly_avg);
    setRows(out);
  };

  return (
    <AdminLayout title="Instructor Evaluations">
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold font-display">Instructor Leaderboard</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Studio</label>
            <Select value={studioFilter} onValueChange={setStudioFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All studios</SelectItem>
                {studios.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Studio</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No data in range.</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={r.instructor_id}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.instructor}</TableCell>
                    <TableCell>{r.studio}</TableCell>
                    <TableCell className="text-right">{r.reports}</TableCell>
                    <TableCell className="text-right">
                      {r.pending > 0 ? <span className="text-warning font-semibold">{r.pending}</span> : 0}
                    </TableCell>
                    <TableCell className="text-right"><ScoreBadge pct={r.monthly_avg} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
