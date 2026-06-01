import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function Analytics() {
  const [monthly, setMonthly] = useState<{ month: string; avg: number }[]>([]);
  const [byInstructor, setByInstructor] = useState<{ name: string; culture: number; attire: number; punctuality: number; choreo: number; attendance: number }[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    const from = new Date(since.getFullYear(), since.getMonth(), 1).toISOString().slice(0, 10);

    const { data: reports } = await supabase
      .from("instructor_reports")
      .select("instructor_id, session_date, compliance_pct, attire_rating, culture_rating, punctuality, attendance_marked, id")
      .gte("session_date", from);

    const { data: users } = await supabase.from("users").select("id, name").eq("organization_id", 1);
    const userMap = new Map<number, string>((users || []).map((u: any) => [u.id, u.name]));

    const { data: choreos } = await supabase
      .from("choreography_uploads")
      .select("report_id")
      .eq("kind", "choreography")
      .gte("taught_on", from);
    const haveChoreo = new Set<number>((choreos || []).map((c: any) => c.report_id));

    // Monthly trend
    const m = new Map<string, { sum: number; n: number }>();
    (reports || []).forEach((r: any) => {
      const month = (r.session_date as string).slice(0, 7);
      const cur = m.get(month) || { sum: 0, n: 0 };
      cur.sum += Number(r.compliance_pct || 0);
      cur.n += 1;
      m.set(month, cur);
    });
    setMonthly(
      Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, avg: v.n ? v.sum / v.n : 0 })),
    );

    // Per-instructor breakdown (current month)
    const curMonth = new Date().toISOString().slice(0, 7);
    const byI = new Map<number, { culture: number; attire: number; punctY: number; attendY: number; n: number; choreoY: number }>();
    (reports || []).forEach((r: any) => {
      if (!(r.session_date as string).startsWith(curMonth)) return;
      const cur = byI.get(r.instructor_id) || { culture: 0, attire: 0, punctY: 0, attendY: 0, n: 0, choreoY: 0 };
      cur.culture += r.culture_rating;
      cur.attire += r.attire_rating;
      cur.punctY += r.punctuality ? 1 : 0;
      cur.attendY += r.attendance_marked ? 1 : 0;
      cur.choreoY += haveChoreo.has(r.id) ? 1 : 0;
      cur.n += 1;
      byI.set(r.instructor_id, cur);
    });
    setByInstructor(
      Array.from(byI.entries()).map(([id, v]) => ({
        name: (userMap.get(id) || `#${id}`).split(" ")[0],
        culture: v.n ? v.culture / v.n : 0,
        attire: v.n ? v.attire / v.n : 0,
        punctuality: v.n ? (v.punctY / v.n) * 100 : 0,
        attendance: v.n ? (v.attendY / v.n) * 100 : 0,
        choreo: v.n ? (v.choreoY / v.n) * 100 : 0,
      })),
    );
  };

  return (
    <AdminLayout title="Performance Analytics">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold font-display">Performance Analytics</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Compliance Trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <ChartCard title="Culture Ratings (this month)" data={byInstructor} dataKey="culture" max={5} />
          <ChartCard title="Attire Ratings (this month)" data={byInstructor} dataKey="attire" max={5} />
          <ChartCard title="Punctuality %" data={byInstructor} dataKey="punctuality" max={100} />
          <ChartCard title="Attendance Compliance %" data={byInstructor} dataKey="attendance" max={100} />
          <ChartCard title="Choreography Upload %" data={byInstructor} dataKey="choreo" max={100} />
        </div>
      </div>
    </AdminLayout>
  );
}

function ChartCard({ title, data, dataKey, max }: { title: string; data: any[]; dataKey: string; max: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, max]} />
            <Tooltip />
            <Bar dataKey={dataKey} fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
