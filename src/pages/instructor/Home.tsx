import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { todayIST } from "@/lib/dateUtils";
import { Clock, FileCheck2, FileWarning, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SessionRow {
  id: number;
  batch_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  batches?: { name: string; batch_code: string | null; style: string | null };
  reportId?: number | null;
}

export default function InstructorHome() {
  const { staffUser } = useAuth();
  const navigate = useNavigate();
  const [todaySessions, setTodaySessions] = useState<SessionRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [monthlyPct, setMonthlyPct] = useState<number | null>(null);
  const [choreoCount, setChoreoCount] = useState(0);

  useEffect(() => {
    if (!staffUser) return;
    void load();
  }, [staffUser]);

  const load = async () => {
    if (!staffUser) return;
    const today = todayIST();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const { data: batches } = await supabase
      .from("batches")
      .select("id")
      .or(`instructor_id.eq.${staffUser.id},instructor_2_id.eq.${staffUser.id}`)
      .eq("organization_id", 1);
    const batchIds = (batches || []).map((b: any) => b.id);

    if (batchIds.length === 0) {
      setTodaySessions([]);
      return;
    }

    const { data: sessions } = await supabase
      .from("batch_sessions")
      .select("*, batches(name, batch_code, style)")
      .in("batch_id", batchIds)
      .eq("session_date", today)
      .order("start_time");

    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: reports } = sessionIds.length
      ? await supabase
          .from("instructor_reports")
          .select("id, batch_session_id")
          .in("batch_session_id", sessionIds)
          .eq("instructor_id", staffUser.id)
      : { data: [] as any[] };
    const reportMap = new Map<number, number>((reports || []).map((r: any) => [r.batch_session_id, r.id]));

    const enriched = (sessions || []).map((s: any) => ({ ...s, reportId: reportMap.get(s.id) || null }));
    setTodaySessions(enriched);

    // Pending = today's sessions without report
    setPendingCount(enriched.filter((s) => !s.reportId).length);

    // Submitted this month + monthly score + choreo count
    const { data: monthReports } = await supabase
      .from("instructor_reports")
      .select("id, compliance_pct, session_date")
      .eq("instructor_id", staffUser.id)
      .gte("session_date", monthStart);
    setSubmittedCount(monthReports?.length || 0);
    if (monthReports && monthReports.length > 0) {
      const avg = monthReports.reduce((a, r: any) => a + Number(r.compliance_pct || 0), 0) / monthReports.length;
      setMonthlyPct(avg);
    } else {
      setMonthlyPct(null);
    }

    const { count: choreo } = await supabase
      .from("choreography_uploads")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", staffUser.id)
      .eq("kind", "choreography")
      .gte("taught_on", monthStart);
    setChoreoCount(choreo || 0);
  };

  return (
    <AdminLayout title="My Classes">
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">
            Hi {staffUser?.name?.split(" ")[0] || "Instructor"} 👋
          </h1>
          <p className="text-muted-foreground">Submit reports for today's classes.</p>
        </div>

        {pendingCount > 0 && (
          <div className="rounded-lg border border-warning bg-warning/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {pendingCount} pending report{pendingCount > 1 ? "s" : ""} for today
              </p>
              <p className="text-xs text-muted-foreground">Submit before end of day to stay compliant.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="Today's Classes" value={todaySessions.length} />
          <StatCard icon={FileWarning} label="Pending" value={pendingCount} tone="warning" />
          <StatCard icon={FileCheck2} label="Submitted (mo)" value={submittedCount} tone="success" />
          <StatCard icon={Upload} label="Choreos (mo)" value={choreoCount} />
        </div>


        <div>
          <h2 className="text-lg font-semibold mb-3">Today's Classes</h2>
          {todaySessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No classes scheduled for today.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todaySessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {s.batches?.batch_code || "—"}
                        </Badge>
                        <span className="font-semibold truncate">{s.batches?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.start_time} – {s.end_time} · {s.batches?.style || "—"}
                      </p>
                    </div>
                    {s.reportId ? (
                      <Badge className="bg-success/20 text-success gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Submitted
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => navigate(`/instructor/report/${s.id}`)}>
                        Submit Report
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/instructor/reports")}>
            View My Reports
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: "warning" | "success";
}) {
  const color =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className={`h-4 w-4 ${color} mb-2`} />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
