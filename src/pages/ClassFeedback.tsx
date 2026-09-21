import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Search, Star } from "lucide-react";
import { getDisplayPhone } from "@/lib/studentUtils";
import { useScopedStudents } from "@/hooks/useScopedStudents";
import { toast } from "sonner";

const statusClass: Record<string, string> = {
  sent: "bg-blue-500/15 text-blue-300",
  submitted: "bg-success/20 text-success",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-destructive/20 text-destructive",
  no_recipient: "bg-warning/20 text-warning",
  created: "bg-muted text-muted-foreground",
};

const Stars = ({ value }: { value: number | null | undefined }) => {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="h-4 w-4 fill-primary text-primary" />
      {value}
    </span>
  );
};

const ClassFeedbackPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const scope = useScopedStudents();

  const fetchFeedback = async () => {
    let query: any = supabase
      .from("class_feedback_requests" as any)
      .select(`
        *,
        students(id, name, phone, email, users(phone, email)),
        batches(id, name, batch_code, studio_id, studios(name, code)),
        batch_sessions(session_date, start_time, end_time, style),
        class_feedback_responses(*)
      `)
      .eq("organization_id", 1)
      .order("created_at", { ascending: false });

    if (!scope.unrestricted) {
      if (scope.batchIds.length === 0) {
        setRows([]);
        return;
      }
      query = query.in("batch_id", scope.batchIds);
    }

    const { data } = await query;
    setRows((data || []) as any[]);
  };

  useEffect(() => {
    if (!scope.loading) fetchFeedback();
  }, [scope.loading, scope.unrestricted, scope.batchIds.join(",")]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const student = row.students;
      const batch = row.batches;
      return [
        student?.name,
        getDisplayPhone(student || {}),
        batch?.batch_code,
        batch?.name,
        batch?.studios?.name,
        row.attendance_date,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [rows, search]);

  const copyLink = async (url: string | null | undefined) => {
    if (!url) {
      toast.error("No feedback link available yet");
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Feedback link copied");
  };

  return (
    <AdminLayout title="Class Feedback">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student, batch, studio..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} feedback request{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Student Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="hidden lg:table-cell">Comments</TableHead>
                <TableHead className="hidden md:table-cell">Sent To</TableHead>
                <TableHead>Form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const response = Array.isArray(row.class_feedback_responses)
                  ? row.class_feedback_responses[0]
                  : row.class_feedback_responses;
                const session = row.batch_sessions;
                const batch = row.batches;
                const student = row.students;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{batch?.batch_code || batch?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.attendance_date}
                        {session?.start_time ? ` • ${session.start_time.slice(0, 5)}-${session.end_time?.slice(0, 5)}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">{batch?.studios?.name || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{student?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{getDisplayPhone(student || {})}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClass[row.status] || statusClass.created}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Overall: <Stars value={response?.rating} /></div>
                        <div className="text-muted-foreground">Energy: <Stars value={response?.energy_rating} /></div>
                        <div className="text-muted-foreground">Clarity: <Stars value={response?.clarity_rating} /></div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-md">
                      {response ? (
                        <div className="space-y-2 text-sm">
                          {response.liked && <p><span className="text-muted-foreground">Liked:</span> {response.liked}</p>}
                          {response.improve && <p><span className="text-muted-foreground">Improve:</span> {response.improve}</p>}
                          {response.wants_follow_up && <Badge variant="outline">Follow up ok</Badge>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Waiting</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">{row.contact_channel || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.recipient || row.notification_status || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyLink(row.feedback_url)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {row.feedback_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={row.feedback_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No feedback requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default ClassFeedbackPage;
