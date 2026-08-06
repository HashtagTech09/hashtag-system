import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

type PromotionRow = any;

export default function PromotionRequestsPage() {
  const { staffUser, isAdmin, isManager } = useAuth();
  const [requests, setRequests] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<PromotionRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_promotions")
      .select(`
        *,
        students(name, phone),
        recommended_by:users!student_promotions_recommended_by_user_id_fkey(name),
        manager_approved_by:users!student_promotions_manager_approved_by_user_id_fkey(name),
        dreamcatcher_approved_by:users!student_promotions_dreamcatcher_approved_by_user_id_fkey(name),
        from_batch:batches!student_promotions_from_batch_id_fkey(name, batch_code),
        target_batch:batches!student_promotions_target_batch_id_fkey(name, batch_code, studio_id, studios(name, wingperson_id, dreamcatcher_id))
      `)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message || "Failed to load promotion requests");
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  const getApprovalScope = (request: PromotionRow) => {
    const studio = request.target_batch?.studios;
    const canManagerApprove = isAdmin || isManager || studio?.wingperson_id === staffUser?.id;
    const canDreamcatcherApprove = isAdmin || studio?.dreamcatcher_id === staffUser?.id;
    return { canManagerApprove, canDreamcatcherApprove };
  };

  const approve = async (request: PromotionRow) => {
    if (!staffUser) return;
    const now = new Date().toISOString();
    const scope = getApprovalScope(request);
    const update: Record<string, string | number | null> = { updated_at: now };

    if (scope.canManagerApprove && !request.manager_approved_by_user_id) {
      update.manager_approved_by_user_id = staffUser.id;
      update.manager_approved_at = now;
    }
    if (scope.canDreamcatcherApprove && !request.dreamcatcher_approved_by_user_id) {
      update.dreamcatcher_approved_by_user_id = staffUser.id;
      update.dreamcatcher_approved_at = now;
    }

    const managerDone = request.manager_approved_by_user_id || update.manager_approved_by_user_id;
    const dreamDone = request.dreamcatcher_approved_by_user_id || update.dreamcatcher_approved_by_user_id;
    if (!managerDone && !dreamDone) {
      toast.error("You are not assigned to approve this promotion.");
      return;
    }
    if (managerDone && dreamDone) {
      update.status = "approved";
      update.approved_at = now;
    }

    const { error } = await supabase.from("student_promotions").update(update).eq("id", request.id);
    if (error) {
      toast.error(error.message || "Approval failed");
      return;
    }
    toast.success(managerDone && dreamDone ? "Promotion approved" : "Approval recorded");
    await load();
  };

  const reject = async () => {
    if (!staffUser || !rejecting) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("student_promotions").update({
      status: "rejected",
      rejected_by_user_id: staffUser.id,
      rejected_at: now,
      review_notes: reviewNotes.trim() || null,
      updated_at: now,
    }).eq("id", rejecting.id);
    if (error) {
      toast.error(error.message || "Rejection failed");
      return;
    }
    toast.success("Promotion rejected");
    setRejecting(null);
    setReviewNotes("");
    await load();
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-success/20 text-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-destructive/20 text-destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    return <Badge className="bg-warning/20 text-warning"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  };

  return (
    <AdminLayout title="Promotion Requests">
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading promotion requests...</p>
        ) : requests.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No promotion requests yet.</CardContent></Card>
        ) : (
          requests.map((request) => {
            const scope = getApprovalScope(request);
            const canAct = request.status === "pending" && (scope.canManagerApprove || scope.canDreamcatcherApprove);
            return (
              <Card key={request.id} className="glass-card">
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{request.students?.name || "Student"}</h3>
                        {statusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {request.style_base} {request.from_level || "Current"} → {request.to_level}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Target: {request.target_batch?.name || "Any matching batch"}{request.target_batch?.batch_code ? ` (${request.target_batch.batch_code})` : ""}
                        {request.target_batch?.studios?.name ? ` · ${request.target_batch.studios.name}` : ""}
                      </p>
                    </div>
                    {canAct && (
                      <div className="flex gap-2">
                        <Button size="sm" className="gradient-primary" onClick={() => approve(request)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejecting(request)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Recommended by</p>
                      <p className="font-medium text-foreground">{request.recommended_by?.name || "—"}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Wingperson / Manager</p>
                      <p className="font-medium text-foreground">{request.manager_approved_by?.name || "Pending"}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Dreamcatcher</p>
                      <p className="font-medium text-foreground">{request.dreamcatcher_approved_by?.name || "Pending"}</p>
                    </div>
                  </div>

                  {(request.notes || request.review_notes) && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      {request.notes && <p><span className="text-muted-foreground">Instructor note:</span> {request.notes}</p>}
                      {request.review_notes && <p><span className="text-muted-foreground">Review note:</span> {request.review_notes}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Promotion</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add a short reason for the instructor/student record." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
