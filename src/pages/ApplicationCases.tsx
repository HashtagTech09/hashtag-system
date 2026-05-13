import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { nowIST } from "@/lib/dateUtils";
import { format } from "date-fns";

type CaseRow = any;

const ApplicationCasesPage = () => {
  const { staffUser, isAdmin } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [activeCase, setActiveCase] = useState<CaseRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
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
    setCases(data || []);
  };

  useEffect(() => {
    fetchData();
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
  }, []);

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
        reviewed_at: nowIST(),
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
        reviewed_at: nowIST(),
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
          <Tabs value={tab} onValueChange={v => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && <Badge className="ml-2" variant="secondary">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
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
                {tab === "pending" && isAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                          <div className="text-xs italic mt-1">"{c.review_notes}"</div>
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
    </AdminLayout>
  );
};

export default ApplicationCasesPage;
