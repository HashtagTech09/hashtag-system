import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayIST } from "@/lib/dateUtils";
import { Clock, FileCheck2, FileWarning, Upload, CheckCircle2, AlertTriangle, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { shouldRequirePromotionForLevel } from "@/lib/promotionUtils";
import { toast } from "sonner";

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
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [promotionNotes, setPromotionNotes] = useState("");
  const [submittingPromotion, setSubmittingPromotion] = useState(false);

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
      setStudentEnrollments([]);
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

    const [{ data: activeRows }, { data: targetBatches }] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id, student_id, batch_id, end_date, students(name), batches(id, name, batch_code, style_base, level, studio_id)")
        .in("batch_id", batchIds)
        .gte("end_date", today)
        .order("end_date", { ascending: false }),
      supabase
        .from("batches")
        .select("id, name, batch_code, style_base, level, studio_id, promotion_required")
        .eq("organization_id", 1)
        .order("name"),
    ]);
    setStudentEnrollments(activeRows || []);
    setAllBatches(targetBatches || []);
  };

  const selectedEnrollment = studentEnrollments.find((row) => String(row.id) === selectedEnrollmentId);
  const targetOptions = selectedEnrollment
    ? allBatches.filter((batch) =>
        batch.id !== selectedEnrollment.batch_id
        && batch.style_base === selectedEnrollment.batches?.style_base
        && batch.studio_id === selectedEnrollment.batches?.studio_id
        && shouldRequirePromotionForLevel(batch.level)
      )
    : [];

  const recommendPromotion = async () => {
    if (!staffUser || !selectedEnrollment || !targetBatchId) {
      toastMissingPromotionFields();
      return;
    }
    const targetBatch = allBatches.find((batch) => String(batch.id) === targetBatchId);
    if (!targetBatch) {
      toastMissingPromotionFields();
      return;
    }
    setSubmittingPromotion(true);
    const { error } = await supabase.from("student_promotions").insert({
      organization_id: 1,
      student_id: selectedEnrollment.student_id,
      source_enrollment_id: selectedEnrollment.id,
      from_batch_id: selectedEnrollment.batch_id,
      target_batch_id: targetBatch.id,
      style_base: targetBatch.style_base || selectedEnrollment.batches?.style_base || "",
      from_level: selectedEnrollment.batches?.level || null,
      to_level: targetBatch.level || "",
      recommended_by_user_id: staffUser.id,
      notes: promotionNotes.trim() || null,
      status: "pending",
    });
    setSubmittingPromotion(false);
    if (error) {
      toast.error(error.message || "Could not recommend promotion");
      return;
    }
    toast.success("Promotion request sent for approval");
    setPromotionOpen(false);
    setSelectedEnrollmentId("");
    setTargetBatchId("");
    setPromotionNotes("");
  };

  const toastMissingPromotionFields = () => {
    toast.error("Select a student and target batch");
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
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/attendance?batch=${s.batch_id}`)}
                      >
                        Mark Attendance
                      </Button>
                      {s.reportId ? (
                        <Badge className="bg-success/20 text-success gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Submitted
                        </Badge>
                      ) : (
                        <Button size="sm" onClick={() => navigate(`/instructor/report/${s.id}`)}>
                          Submit Report
                        </Button>
                      )}
                    </div>
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
          <Button className="gradient-primary" onClick={() => setPromotionOpen(true)}>
            <BadgeCheck className="h-4 w-4 mr-2" /> Recommend Promotion
          </Button>
        </div>
      </div>

      <Dialog open={promotionOpen} onOpenChange={setPromotionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recommend Promotion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              <Select value={selectedEnrollmentId} onValueChange={(value) => { setSelectedEnrollmentId(value); setTargetBatchId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                <SelectContent>
                  {studentEnrollments.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.students?.name} · {row.batches?.name} · {row.batches?.level || "Level"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Promote to</Label>
              <Select value={targetBatchId} onValueChange={setTargetBatchId} disabled={!selectedEnrollmentId}>
                <SelectTrigger><SelectValue placeholder="Select target batch..." /></SelectTrigger>
                <SelectContent>
                  {targetOptions.map((batch) => (
                    <SelectItem key={batch.id} value={String(batch.id)}>
                      {batch.name}{batch.batch_code ? ` (${batch.batch_code})` : ""} · {batch.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEnrollmentId && targetOptions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No higher locked batch found in the same style and studio.</p>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={promotionNotes} onChange={(e) => setPromotionNotes(e.target.value)} placeholder="Why is the student ready for this level?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromotionOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={recommendPromotion} disabled={submittingPromotion}>
              {submittingPromotion ? "Sending..." : "Send for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
