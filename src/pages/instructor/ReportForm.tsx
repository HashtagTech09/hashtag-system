import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ChecklistToggles } from "@/components/evaluations/ChecklistToggles";
import { VideoUploader } from "@/components/evaluations/VideoUploader";
import { StarRating } from "@/components/evaluations/StarRating";
import {
  CHECKLIST_KEYS,
  ChecklistValues,
  computeScore,
  MAX_SCORE,
} from "@/lib/evaluationScoring";

interface SessionInfo {
  id: number;
  batch_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  batches?: { name: string; batch_code: string | null; style: string | null; studio_id: number | null; studios?: { name: string } };
}

export default function ReportForm() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { staffUser } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentsPresent, setStudentsPresent] = useState<string>("");
  const [notes, setNotes] = useState("");
  const initialChecklist = useMemo(
    () => Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, false])) as ChecklistValues,
    [],
  );
  const [checklist, setChecklist] = useState<ChecklistValues>(initialChecklist);
  const [attireRating, setAttireRating] = useState(0);
  const [cultureRating, setCultureRating] = useState(0);
  const [choreoPath, setChoreoPath] = useState<{ storage_path: string; mime_type: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [absentees, setAbsentees] = useState<Array<{ name: string; reason: string | null }>>([]);

  useEffect(() => {
    if (!sessionId || !staffUser) return;
    void load();
  }, [sessionId, staffUser]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("batch_sessions")
      .select("*, batches(name, batch_code, style, studio_id, studios(name))")
      .eq("id", Number(sessionId))
      .single();
    setSession(data as any);

    const { data: existing } = await supabase
      .from("instructor_reports")
      .select("id")
      .eq("batch_session_id", Number(sessionId))
      .eq("instructor_id", staffUser!.id)
      .maybeSingle();
    setExistingId(existing?.id || null);

    // Load absentees for this session's batch+date
    if (data) {
      const sess = data as any;
      const { data: attRows } = await supabase
        .from("attendance")
        .select("student_id, status, absence_reason, students(name)")
        .eq("batch_id", sess.batch_id)
        .eq("date", sess.session_date)
        .eq("status", "absent");
      setAbsentees(
        (attRows || []).map((r: any) => ({
          name: r.students?.name || `Student #${r.student_id}`,
          reason: r.absence_reason || null,
        })),
      );
    }
    setLoading(false);
  };

  const { total, pct } = computeScore(checklist, attireRating, cultureRating);
  const pathPrefix = `${1}/instructor_${staffUser?.id}/${session?.session_date}/session_${session?.id}`;

  const handleSubmit = async () => {
    if (!staffUser || !session) return;
    if (existingId) {
      toast({ title: "Already submitted", description: "This class report has already been filed." });
      return;
    }
    if (!choreoPath) {
      toast({ title: "Choreography video required", variant: "destructive" });
      return;
    }
    if (!studentsPresent || isNaN(Number(studentsPresent))) {
      toast({ title: "Enter students present", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const insertPayload: any = {
        organization_id: 1,
        batch_session_id: session.id,
        batch_id: session.batch_id,
        studio_id: session.batches?.studio_id || null,
        instructor_id: staffUser.id,
        session_date: session.session_date,
        style: session.batches?.style || null,
        students_present: Number(studentsPresent),
        notes: notes || null,
        attire_rating: attireRating,
        culture_rating: cultureRating,
        ...checklist,
      };
      const { data: report, error } = await supabase
        .from("instructor_reports")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw error;

      const { error: uErr } = await supabase.from("choreography_uploads").insert({
        organization_id: 1,
        report_id: report.id,
        batch_id: session.batch_id,
        studio_id: session.batches?.studio_id || null,
        instructor_id: staffUser.id,
        style: session.batches?.style || null,
        taught_on: session.session_date,
        kind: "choreography",
        storage_path: choreoPath.storage_path,
        mime_type: choreoPath.mime_type,
      });
      if (uErr) throw uErr;

      toast({ title: "Report submitted", description: `Score ${total}/${MAX_SCORE}` });
      navigate("/instructor");
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Class Report">
        <div className="p-6 text-muted-foreground">Loading…</div>
      </AdminLayout>
    );
  }

  if (!session) {
    return (
      <AdminLayout title="Class Report">
        <div className="p-6">Session not found.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Class Report">
      <div className="container mx-auto max-w-2xl p-4 md:p-6 pb-24 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">Post-Class Report</h1>
            <p className="text-xs text-muted-foreground">Submit after every class</p>
          </div>
        </div>

        {existingId && (
          <div className="rounded-lg border border-success bg-success/10 p-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            You already submitted a report for this class.
          </div>
        )}

        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            <Row label="Date" value={session.session_date} />
            <Row label="Studio" value={session.batches?.studios?.name || "—"} />
            <Row
              label="Batch"
              value={
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {session.batches?.batch_code || "—"}
                  </Badge>
                  {session.batches?.name}
                </span>
              }
            />
            <Row label="Style" value={session.batches?.style || "—"} />
            <Row label="Instructor" value={staffUser?.name || "—"} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div>
            <Label htmlFor="present">Students Present</Label>
            <Input
              id="present"
              type="number"
              min={0}
              value={studentsPresent}
              onChange={(e) => setStudentsPresent(e.target.value)}
              disabled={!!existingId}
            />
          </div>
        </div>

        <ChecklistToggles
          values={checklist}
          onChange={(k, v) => setChecklist((p) => ({ ...p, [k]: v }))}
          disabled={!!existingId}
        />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ratings
          </h3>
          <div className="rounded-lg border divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">Attire</span>
              <StarRating value={attireRating} onChange={setAttireRating} disabled={!!existingId} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">Culture</span>
              <StarRating value={cultureRating} onChange={setCultureRating} disabled={!!existingId} />
            </div>
          </div>
        </div>


        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Choreography Video
          </h3>
          <VideoUploader
            label="Upload choreography taught (required)"
            accept="video/*"
            required
            pathPrefix={`${pathPrefix}/choreography`}
            onUploaded={(storage_path, mime_type) => setChoreoPath({ storage_path, mime_type })}
            onCleared={() => setChoreoPath(null)}
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={!!existingId}
          />
        </div>

        {/* Sticky submit */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur p-3 md:pl-64">
          <div className="container mx-auto max-w-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Checklist</p>
              <span className="text-lg font-bold">
                {total}/{MAX_SCORE} ({Math.round(pct)}%)
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !!existingId || !choreoPath} size="lg">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
