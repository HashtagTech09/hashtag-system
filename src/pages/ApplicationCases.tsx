import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, AlertTriangle, Check, X, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useScopedStudents } from "@/hooks/useScopedStudents";
import { nowIST } from "@/lib/dateUtils";
import { format } from "date-fns";

type CaseRow = any;

type TabKey = "pending" | "approved" | "rejected" | "restored";

const ApplicationCasesPage = () => {
  const { staffUser, isAdmin } = useAuth();
  const scope = useScopedStudents();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("pending");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [activeCase, setActiveCase] = useState<CaseRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [restoreNote, setRestoreNote] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    let q: any = supabase
      .from("application_cases")
      .select(
        `*,
         students(name, phone),
         batches(name, batch_code, studios(name, code)),
         enrollments(start_date, end_date, status_type, start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)),
         requested_by:users!application_cases_requested_by_user_id_fkey(name),
         reviewed_by:users!application_cases_reviewed_by_user_id_fkey(name)`
      )
      .eq("organization_id", 1)
      .order("created_at", { ascending: false });
    if (!scope.unrestricted) {
      if (scope.studentIds.length === 0) { setCases([]); return; }
      q = q.in("student_id", scope.studentIds);
    }
    const { data } = await q;
    setCases(data || []);
  };

  const fetchBatches = async () => {
    const { data } = await supabase
      .from("batches")
      .select("id, name, batch_code, studios(name, code)")
      .eq("organization_id", 1)
      .order("name");
    setBatches(data || []);
  };

  useEffect(() => {
    if (scope.loading) return;
    fetchData();
    fetchBatches();
    const channel = supabase
      .channel("application_cases_page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_cases" },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [scope.loading, scope.unrestricted, scope.studentIds.join(",")]);

  const filtered = cases.filter(c => {
    if (c.status !== tab) return false;
    if (!search) return true;
    return (c.students?.name || "").toLowerCase().includes(search.toLowerCase());
  });

  const pendingCount = cases.filter(c => c.status === "pending").length;

  const approve = async (c: CaseRow) => {
    if (!isAdmin) {
      toast.error("Only admins can approve application cases");
      return;
    }
    const { error: updErr } = await supabase
      .from("application_cases")
      .update({
        status: "approved",
        reviewed_by_user_id: staffUser?.id ?? null,
        reviewed_at: nowIST().toISOString(),
      })
      .eq("id", c.id);
    if (updErr) {
      toast.error("Failed to approve");
      return;
    }
    const { error: enrErr } = await supabase
      .from("enrollments")
      .update({ is_active: false })
      .eq("id", c.enrollment_id);
    if (enrErr) {
      toast.error("Approved case but failed to deactivate enrollment");
      return;
    }
    toast.success("Application case approved");
    fetchData();
  };

  const openReject = (c: CaseRow) => {
    setActiveCase(c);
    setReviewNotes("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!activeCase) return;
    if (!isAdmin) {
      toast.error("Only admins can reject");
      return;
    }
    const { error } = await supabase
      .from("application_cases")
      .update({
        status: "rejected",
        reviewed_by_user_id: staffUser?.id ?? null,
        reviewed_at: nowIST().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq("id", activeCase.id);
    if (error) {
      toast.error("Failed to reject");
      return;
    }
    toast.success("Application case rejected");
    setRejectOpen(false);
    setActiveCase(null);
    fetchData();
  };

  const openRestore = (c: CaseRow) => {
    setActiveCase(c);
    setSelectedBatchId(String(c.batch_id));
    setRestoreNote("");
    setRestoreOpen(true);
  };

  const confirmRestore = async () => {
    if (!activeCase) return;
    if (!isAdmin) {
      toast.error("Only admins can restore");
      return;
    }
    if (!selectedBatchId) {
      toast.error("Please select a batch");
      return;
    }
    setSubmitting(true);
    try {
      const targetBatchId = Number(selectedBatchId);
      if (targetBatchId === activeCase.batch_id) {
        const { error } = await supabase
          .from("enrollments")
          .update({ is_active: true })
          .eq("id", activeCase.enrollment_id);
        if (error) throw error;
      } else {
        const { data: orig, error: fetchErr } = await supabase
          .from("enrollments")
          .select("*")
          .eq("id", activeCase.enrollment_id)
          .single();
        if (fetchErr || !orig) throw fetchErr || new Error("Original enrollment not found");
        const { id, created_at, ...rest } = orig as any;
        const { error: insErr } = await supabase.from("enrollments").insert({
          ...rest,
          batch_id: targetBatchId,
          previous_batch_id: orig.batch_id,
          is_active: true,
        });
        if (insErr) throw insErr;
      }
      const existingNotes = activeCase.review_notes ? `${activeCase.review_notes}\n` : "";
      const restoreLine = `Restored on ${format(nowIST(), "dd MMM yyyy, HH:mm")}${restoreNote ? `: ${restoreNote}` : ""}`;
      const { error: caseErr } = await supabase
        .from("application_cases")
        .update({
          status: "restored",
          reviewed_by_user_id: staffUser?.id ?? null,
          reviewed_at: nowIST().toISOString(),
          review_notes: existingNotes + restoreLine,
        })
        .eq("id", activeCase.id);
      if (caseErr) throw caseErr;
      toast.success("Enrollment restored");
      setRestoreOpen(false);
      setActiveCase(null);
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to restore enrollment");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (s?: string | null) =>
    s ? format(new Date(s), "dd MMM yyyy, HH:mm") : "—";

  return (
    <AdminLayout title="Application Cases">
      <div className="flex flex-col gap-4 mb-6">
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/40 bg-warning/10">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">
                {pendingCount} application case{pendingCount > 1 ? "s" : ""} awaiting{" "}
                {isAdmin ? "your" : "admin"} approval
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Review pending requests below to move enrollments out of the active list."
                  : "Only admins can approve or reject these requests."}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={tab} onValueChange={v => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && <Badge className="ml-2" variant="secondary">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="restored">Restored</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="hidden md:table-cell">Studio</TableHead>
                <TableHead className="hidden lg:table-cell">Validity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="hidden md:table-cell">Requested By</TableHead>
                <TableHead className="hidden md:table-cell">Requested At</TableHead>
                {tab !== "pending" && (
                  <>
                    <TableHead className="hidden md:table-cell">Reviewed By</TableHead>
                    <TableHead className="hidden md:table-cell">Reviewed At</TableHead>
                  </>
                )}
                {(tab === "pending" || tab === "approved") && isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{c.students?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.batches?.name || "—"}
                    {c.batches?.batch_code && (
                      <span className="text-xs ml-1 opacity-60 font-mono">({c.batches.batch_code})</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.batches?.studios?.name || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {c.enrollments?.start_cycle?.name && c.enrollments?.end_cycle?.name
                      ? `${c.enrollments.start_cycle.name} → ${c.enrollments.end_cycle.name}`
                      : c.enrollments
                        ? `${c.enrollments.start_date} → ${c.enrollments.end_date}`
                        : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {c.reason || <span className="opacity-50">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.requested_by?.name || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {fmtDate(c.requested_at)}
                  </TableCell>
                  {tab !== "pending" && (
                    <>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {c.reviewed_by?.name || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {fmtDate(c.reviewed_at)}
                        {c.review_notes && (
                          <div className="text-xs italic mt-1 whitespace-pre-wrap">"{c.review_notes}"</div>
                        )}
                      </TableCell>
                    </>
                  )}
                  {tab === "pending" && isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openReject(c)}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="gradient-primary" onClick={() => approve(c)}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  {tab === "approved" && isAdmin && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openRestore(c)}>
                        <Undo2 className="h-4 w-4 mr-1" /> Restore to Enrollment
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No {tab} application cases
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Optionally add a note explaining the rejection.
            </p>
            <Textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Notes (optional)..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore to Enrollment</DialogTitle>
          </DialogHeader>
          {activeCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Student</div>
                  <div className="font-medium">{activeCase.students?.name || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Original Batch</div>
                  <div className="font-medium">
                    {activeCase.batches?.name}
                    {activeCase.batches?.batch_code && (
                      <span className="text-xs ml-1 opacity-60 font-mono">({activeCase.batches.batch_code})</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Validity</div>
                  <div className="font-medium">
                    {activeCase.enrollments?.start_cycle?.name && activeCase.enrollments?.end_cycle?.name
                      ? `${activeCase.enrollments.start_cycle.name} → ${activeCase.enrollments.end_cycle.name}`
                      : activeCase.enrollments
                        ? `${activeCase.enrollments.start_date} → ${activeCase.enrollments.end_date}`
                        : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Batch</label>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                        {b.batch_code ? ` (${b.batch_code})` : ""}
                        {b.studios?.name ? ` — ${b.studios.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Defaults to original batch. Choosing a different batch creates a new enrollment with the same validity.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={restoreNote}
                  onChange={e => setRestoreNote(e.target.value)}
                  placeholder="Reason for restoration..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="gradient-primary" onClick={confirmRestore} disabled={submitting}>
              {submitting ? "Restoring..." : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ApplicationCasesPage;
