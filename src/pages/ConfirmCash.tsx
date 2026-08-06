import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import hashtagLogo from "@/assets/hashtag-pink.png";
import { canStudentSelectBatch, isBatchPromotionLocked, type ApprovedPromotionLike } from "@/lib/promotionUtils";

const ConfirmCashPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [batchNames, setBatchNames] = useState<string[]>([]);

  useEffect(() => {
    if (!token) { setError("Invalid link — no token provided."); setLoading(false); return; }

    const fetchRequest = async () => {
      const { data, error: fetchErr } = await supabase
        .from("cash_payment_requests")
        .select("*")
        .eq("token", token)
        .single();

      if (fetchErr || !data) {
        setError("Cash payment request not found or invalid link.");
        setLoading(false);
        return;
      }

      if (data.status === "confirmed") {
        setConfirmed(true);
        setRequest(data);
        setLoading(false);
        return;
      }

      if (data.status === "expired") {
        setError("This confirmation link has expired.");
        setLoading(false);
        return;
      }

      if (data.status === "cancelled") {
        setError("This request has been cancelled.");
        setLoading(false);
        return;
      }

      if (data.status === "rejected") {
        setError("This request has been rejected.");
        setLoading(false);
        return;
      }

      if (data.status === "processing") {
        setError("This request is already being processed.");
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
        await supabase.from("cash_payment_requests")
          .update({ status: "expired" })
          .eq("id", data.id)
          .eq("status", "pending");
        setError("This confirmation link has expired.");
        setLoading(false);
        return;
      }

      setRequest(data);

      // Fetch student name, staff name, batch names
      const [studentRes, staffRes, batchRes] = await Promise.all([
        supabase.from("students").select("name").eq("id", data.student_id).single(),
        supabase.from("users").select("name").eq("id", data.staff_user_id).single(),
        supabase.from("batches").select("id, name").in("id", data.batch_ids as number[]),
      ]);

      setStudentName(studentRes.data?.name || "Unknown");
      setStaffName(staffRes.data?.name || "Unknown");
      setBatchNames(batchRes.data?.map((b: any) => b.name) || []);
      setLoading(false);
    };

    fetchRequest();
  }, [token]);

  const handleConfirm = async () => {
    if (!request) return;
    setConfirming(true);
    try {
      if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
        await supabase.from("cash_payment_requests")
          .update({ status: "expired" })
          .eq("id", request.id)
          .eq("status", "pending");
        setError("This confirmation link has expired.");
        return;
      }

      const { data: claimed, error: claimErr } = await supabase
        .from("cash_payment_requests")
        .update({ status: "processing", confirmed_at: new Date().toISOString() })
        .eq("id", request.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .select()
        .single();
      if (claimErr || !claimed) {
        setError("This request has already been handled or has expired.");
        return;
      }

      const enrollmentData = request.enrollment_data as any;
      const enrolledBatchIds = [
        ...(enrollmentData.enrollments || []).map((enrollment: any) => enrollment.batch_id),
        ...(enrollmentData.existing_extensions || []).map((extension: any) => extension.batch_id),
      ].filter(Boolean);
      if (enrolledBatchIds.length > 0) {
        const [{ data: selectedBatches }, { data: promotions }, { data: existingEnrollments }] = await Promise.all([
          supabase.from("batches").select("id, name, style_base, level, promotion_required").in("id", enrolledBatchIds),
          supabase
            .from("student_promotions")
            .select("student_id, style_base, to_level, target_batch_id, status")
            .eq("student_id", request.student_id)
            .eq("status", "approved"),
          supabase
            .from("enrollments")
            .select("batch_id, batches(style_base, level)")
            .eq("student_id", request.student_id),
        ]);

        const hasExistingAccess = (batch: any) => (existingEnrollments || []).some((enrollment: any) => (
          enrollment.batch_id === batch.id
          || (enrollment.batches?.style_base === batch.style_base && enrollment.batches?.level === batch.level)
        ));
        const lockedWithoutApproval = (selectedBatches || []).filter((batch: any) => (
          isBatchPromotionLocked(batch)
          && !hasExistingAccess(batch)
          && !canStudentSelectBatch(batch, (promotions || []) as ApprovedPromotionLike[])
        ));
        if (lockedWithoutApproval.length > 0) {
          throw new Error(`Promotion approval is required for: ${lockedWithoutApproval.map((batch: any) => batch.name).join(", ")}`);
        }
      }

      // Create payment
      const { data: payment, error: payErr } = await supabase.from("payments").insert({
        organization_id: request.organization_id,
        student_id: request.student_id,
        amount: request.amount,
        gst: request.gst,
        final_amount: request.final_amount,
        payment_mode: "cash",
        status: "success",
        confirmed_by_staff_id: request.staff_user_id,
      }).select().single();
      if (payErr) throw payErr;

      // Create enrollments
      let insertedEnrollments: any[] = [];
      if (enrollmentData.enrollments && enrollmentData.enrollments.length > 0) {
        const records = enrollmentData.enrollments.map((r: any) => ({
          ...r,
          payment_id: payment.id,
        }));
        const { data: inserted, error: enrErr } = await supabase.from("enrollments").insert(records).select();
        if (enrErr) throw enrErr;
        insertedEnrollments = inserted || [];
      }

      // Create enrollment_cycles for each new enrollment
      const cyclesTemplate = enrollmentData.enrollment_cycles_template || [];
      if (insertedEnrollments.length > 0 && cyclesTemplate.length > 0) {
        const cycleRows = insertedEnrollments.flatMap((e: any) =>
          cyclesTemplate.map((c: any) => ({
            enrollment_id: e.id,
            student_id: e.student_id,
            batch_id: e.batch_id,
            cycle_id: c.cycle_id,
            cycle_type: c.cycle_type || "regular",
          }))
        );
        const { error: ecErr } = await supabase.from("enrollment_cycles").insert(cycleRows);
        if (ecErr) throw ecErr;
      }

      // Extend existing enrollments for Add Batch requests.
      const existingExtensions = enrollmentData.existing_extensions || [];
      for (const extension of existingExtensions) {
        if (extension.missing_cycles?.length) {
          const missingRows = extension.missing_cycles.map((cycle: any) => ({
            enrollment_id: extension.enrollment_id,
            student_id: request.student_id,
            batch_id: extension.batch_id,
            cycle_id: cycle.cycle_id,
            cycle_type: cycle.cycle_type || "regular",
          }));
          const { error: missingErr } = await supabase.from("enrollment_cycles").insert(missingRows);
          if (missingErr) throw missingErr;
        }

        const update: Record<string, unknown> = {};
        if (extension.end_date) update.end_date = extension.end_date;
        if (extension.end_cycle_id) update.end_cycle_id = extension.end_cycle_id;
        if (Object.keys(update).length > 0) {
          const { error: updateErr } = await supabase
            .from("enrollments")
            .update(update)
            .eq("id", extension.enrollment_id);
          if (updateErr) throw updateErr;
        }
      }

      // Create payment allocations
      if (enrollmentData.payment_allocations && enrollmentData.payment_allocations.length > 0) {
        await supabase.from("payment_allocations").insert(
          enrollmentData.payment_allocations.map((a: any) => ({ ...a, payment_id: payment.id }))
        );
      }

      // Mark cash request as confirmed
      await supabase.from("cash_payment_requests")
        .update({ status: "confirmed" })
        .eq("id", request.id);

      setConfirmed(true);
      toast.success("Payment confirmed successfully!");
    } catch (e: any) {
      await supabase.from("cash_payment_requests")
        .update({ status: "pending", confirmed_at: null })
        .eq("id", request.id)
        .eq("status", "processing");
      toast.error("Failed to confirm: " + e.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src={hashtagLogo} alt="Hashtag" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="font-display font-bold text-foreground text-lg">Hashtag</h1>
            <p className="text-xs text-muted-foreground">Cash Payment Confirmation</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card className="glass-card">
            <CardContent className="p-6 text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-foreground font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {confirmed && (
          <Card className="glass-card">
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-lg font-display font-semibold text-foreground">Cash Confirmed</h2>
              <p className="text-sm text-muted-foreground">The cash payment has been recorded and the student has been enrolled.</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && !confirmed && request && (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-display font-semibold text-foreground">Confirm Cash Received</h2>
              <p className="text-sm text-muted-foreground">
                You ({staffName}) are confirming cash received from <span className="text-foreground font-medium">{studentName}</span>. This will enroll the student immediately.
              </p>

              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium text-foreground">{studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batches</span>
                  <span className="text-foreground text-right">{batchNames.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{Number(request.amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (18%)</span>
                  <span>₹{Number(request.gst).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                  <span>Total Amount</span>
                  <span className="text-primary">₹{Number(request.final_amount).toLocaleString("en-IN")}</span>
                </div>
                {request.expires_at && (
                  <div className="flex justify-between text-xs border-t border-border pt-2 mt-2">
                    <span className="text-muted-foreground">Accept by</span>
                    <span className="text-warning">{new Date(request.expires_at).toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              <Button
                className="w-full gradient-primary"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : (
                  `Confirm Cash Received & Enroll`
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ConfirmCashPage;
