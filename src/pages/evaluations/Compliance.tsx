import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { todayIST } from "@/lib/dateUtils";

interface Row {
  instructor_id: number;
  instructor: string;
  choreo_missing: number;
  attendance_missing: number;
  story_missing: number;
  absentee_calls_missing: number;
  reg_followup_missing: number;
  renewal_followup_missing: number;
}

export default function Compliance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayIST());

  useEffect(() => {
    void load();
  }, [from, to]);

  const load = async () => {
    const { data: reports } = await supabase
      .from("instructor_reports")
      .select(
        "id, instructor_id, attendance_marked, story_posted, absentee_calls, registration_followup, renewal_followup",
      )
      .gte("session_date", from)
      .lte("session_date", to);

    const { data: choreos } = await supabase
      .from("choreography_uploads")
      .select("report_id, kind")
      .eq("kind", "choreography")
      .gte("taught_on", from)
      .lte("taught_on", to);
    const haveChoreo = new Set<number>((choreos || []).map((c: any) => c.report_id));

    const { data: users } = await supabase.from("users").select("id, name").eq("organization_id", 1);
    const userMap = new Map<number, string>((users || []).map((u: any) => [u.id, u.name]));

    const agg = new Map<number, Row>();
    (reports || []).forEach((r: any) => {
      const cur =
        agg.get(r.instructor_id) || {
          instructor_id: r.instructor_id,
          instructor: userMap.get(r.instructor_id) || `#${r.instructor_id}`,
          choreo_missing: 0,
          attendance_missing: 0,
          story_missing: 0,
          absentee_calls_missing: 0,
          reg_followup_missing: 0,
          renewal_followup_missing: 0,
        };
      if (!haveChoreo.has(r.id)) cur.choreo_missing += 1;
      if (!r.attendance_marked) cur.attendance_missing += 1;
      if (!r.story_posted) cur.story_missing += 1;
      if (!r.absentee_calls) cur.absentee_calls_missing += 1;
      if (!r.registration_followup) cur.reg_followup_missing += 1;
      if (!r.renewal_followup) cur.renewal_followup_missing += 1;
      agg.set(r.instructor_id, cur);
    });
    setRows(Array.from(agg.values()).sort((a, b) => {
      const A = a.choreo_missing + a.attendance_missing + a.story_missing + a.absentee_calls_missing + a.reg_followup_missing + a.renewal_followup_missing;
      const B = b.choreo_missing + b.attendance_missing + b.story_missing + b.absentee_calls_missing + b.reg_followup_missing + b.renewal_followup_missing;
      return B - A;
    }));
  };

  return (
    <AdminLayout title="Missing Compliance">
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold font-display">Missing Compliance Tracker</h1>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="text-right">Choreo</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Story</TableHead>
                  <TableHead className="text-right">Absentee Calls</TableHead>
                  <TableHead className="text-right">Reg F/U</TableHead>
                  <TableHead className="text-right">Renewal F/U</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No reports in range.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.instructor_id}>
                    <TableCell className="font-medium">{r.instructor}</TableCell>
                    <Miss n={r.choreo_missing} />
                    <Miss n={r.attendance_missing} />
                    <Miss n={r.story_missing} />
                    <Miss n={r.absentee_calls_missing} />
                    <Miss n={r.reg_followup_missing} />
                    <Miss n={r.renewal_followup_missing} />
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

function Miss({ n }: { n: number }) {
  return (
    <TableCell className="text-right">
      <span className={n > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>{n}</span>
    </TableCell>
  );
}
