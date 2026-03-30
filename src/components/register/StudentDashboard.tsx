import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isPlanValid, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getStartCycleIndex, getDiscount } from "@/lib/enrollmentUtils";
import type { PlanCycle, SubPlan } from "@/lib/enrollmentUtils";
import { allocateCyclesForPlan, insertEnrollmentCycles } from "@/lib/cycleUtils";
import FeeBreakdownDisplay from "./FeeBreakdown";

interface StudentDashboardProps {
  student: any;
  user: any;
  onDone: () => void;
}

export default function StudentDashboard({ student, user, onDone }: StudentDashboardProps) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subPlans, setSubPlans] = useState<SubPlan[]>([]);
  const [planCycles, setPlanCycles] = useState<PlanCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "renew" | "add">("view");

  // Renew state
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [student.id]);

  const fetchData = async () => {
    const [enrollRes, batchRes, planRes, cycleRes] = await Promise.all([
      supabase.from("enrollments").select("*, batches(name), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)").eq("student_id", student.id).eq("organization_id", 1).order("end_date", { ascending: false }),
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
      supabase.from("subscription_plans").select("*").eq("organization_id", 1).eq("is_active", true).order("id"),
      supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
    ]);
    setEnrollments(enrollRes.data || []);
    setBatches(batchRes.data || []);
    setSubPlans(planRes.data || []);
    setPlanCycles(cycleRes.data || []);
    setLoading(false);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const activeEnrollments = enrollments.filter(e => e.end_date >= todayStr);
  const expiredEnrollments = enrollments.filter(e => e.end_date < todayStr);

  const startCycleIdx = planCycles.length > 0 ? getStartCycleIndex(planCycles) : 0;
  const validPlans = subPlans.filter(p => isPlanValid(p, planCycles, startCycleIdx));

  const { status: detectedStatus, latestEndDate } = detectStudentStatus(
    enrollments.map(e => ({ end_date: e.end_date })),
    planCycles
  );

  // Previous batch ids from latest enrollment set
  const previousBatchIds = (() => {
    if (enrollments.length === 0) return [];
    const latest = enrollments[0].end_date;
    return enrollments.filter(e => e.end_date === latest).map(e => e.batch_id);
  })();

  const assignment = selectedPlanId ? computeCycleAssignment(subPlans.find(p => p.id === Number(selectedPlanId))!, planCycles, startCycleIdx) : null;

  const breakdown = selectedBatchIds.length > 0 && assignment ? computeFeeBreakdown({
    batchCount: selectedBatchIds.length,
    regularCycles: assignment.regularCount,
    gridCycles: assignment.gridCount,
    detectedStatus,
    latestEndDate,
    dropInAmount: 0,
  }) : null;

  // Auto-select first valid plan
  useEffect(() => {
    if (mode === "renew" && validPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(String(validPlans[0].id));
    }
  }, [mode, validPlans, selectedPlanId]);

  // Pre-select previous batches for renewal
  useEffect(() => {
    if (mode === "renew" && previousBatchIds.length > 0 && selectedBatchIds.length === 0) {
      setSelectedBatchIds(previousBatchIds.map(String));
    }
  }, [mode, previousBatchIds]);

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleRenew = async () => {
    if (selectedBatchIds.length === 0 || !assignment || !breakdown) return;
    setSubmitting(true);
    try {
      const { data: payment, error: payError } = await supabase.from("payments").insert({
        organization_id: 1, student_id: student.id, amount: breakdown.subtotal,
        gst: breakdown.gst, final_amount: breakdown.total,
        payment_mode: paymentMode, status: "success",
      }).select().single();
      if (payError) throw payError;

      const records = selectedBatchIds.map(batchId => {
        let prevBatchId: number | null = null;
        if (detectedStatus === "REN" || detectedStatus === "REV") {
          const numBatchId = Number(batchId);
          prevBatchId = previousBatchIds.includes(numBatchId) ? numBatchId : (previousBatchIds[0] ?? null);
        }
        return {
          organization_id: 1, student_id: student.id, batch_id: Number(batchId),
          payment_id: payment.id, status_type: detectedStatus,
          registration_fee_applied: breakdown.applyRegFee, late_renewal: breakdown.isLateRenewal,
          start_date: assignment.startCycle.start_date, end_date: assignment.endCycle.end_date || assignment.startCycle.start_date,
          subscription_plan_id: Number(selectedPlanId),
          start_cycle_id: assignment.startCycle.id, end_cycle_id: assignment.endCycle.id,
          previous_batch_id: prevBatchId,
        };
      });

      const { data: insertedRecords, error } = await supabase.from("enrollments").insert(records).select();
      if (error) throw error;

      // Write enrollment_cycles
      if (insertedRecords && assignment) {
        const plan = subPlans.find(p => p.id === Number(selectedPlanId));
        if (plan) {
          const startIdx = planCycles.findIndex(c => c.id === assignment.startCycle.id);
          const allocated = allocateCyclesForPlan(plan, planCycles, startIdx !== -1 ? startIdx : 0);
          for (const enrollment of insertedRecords) {
            await insertEnrollmentCycles(enrollment.id, enrollment.student_id, enrollment.batch_id, allocated);
          }
        }
      }

      toast.success(`Enrolled successfully! Amount: ₹${breakdown.total.toLocaleString()}`);
      setMode("view");
      setSelectedBatchIds([]);
      setSelectedPlanId("");
      fetchData();
    } catch {
      toast.error("Enrollment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Add batch logic
  const existingBatchIds = activeEnrollments.map(e => e.batch_id);
  const refEnrollment = activeEnrollments[0];

  const addBatchBreakdown = (() => {
    if (mode !== "add" || !refEnrollment || selectedBatchIds.length === 0) return null;
    const refPlan = subPlans.find(p => p.id === refEnrollment.subscription_plan_id);
    const regularCycles = refPlan?.total_regular_cycles || 1;
    const gridCycles = refPlan?.total_grid_cycles || 0;
    const totalBatchCount = existingBatchIds.length + selectedBatchIds.length;
    const newBatchCount = selectedBatchIds.length;
    const perBatchFee = (regularCycles * 3767) + (gridCycles * 5300);
    const discountPct = getDiscount(totalBatchCount);
    const discountedPerBatch = Math.round(perBatchFee * (1 - discountPct));
    const totalNewFee = discountedPerBatch * newBatchCount;
    const subtotal = totalNewFee;
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst;
    return {
      batchCount: newBatchCount, perBatchFee, discountPct, discountAmount: (perBatchFee * newBatchCount) - totalNewFee,
      totalBatchFee: totalNewFee, regFee: 0, dropInAdj: 0, subtotal, gst, total, applyRegFee: false, isLateRenewal: false,
      regularCycles, gridCycles,
    };
  })();

  const handleAddBatch = async () => {
    if (!refEnrollment || selectedBatchIds.length === 0 || !addBatchBreakdown) return;
    setSubmitting(true);
    try {
      const { data: payment, error: payError } = await supabase.from("payments").insert({
        organization_id: 1, student_id: student.id, amount: addBatchBreakdown.subtotal,
        gst: addBatchBreakdown.gst, final_amount: addBatchBreakdown.total,
        payment_mode: paymentMode, status: "success",
      }).select().single();
      if (payError) throw payError;

      const records = selectedBatchIds.map(batchId => ({
        organization_id: 1, student_id: student.id, batch_id: Number(batchId),
        payment_id: payment.id, status_type: "REN",
        registration_fee_applied: false, late_renewal: false,
        start_date: refEnrollment.start_date, end_date: refEnrollment.end_date,
        subscription_plan_id: refEnrollment.subscription_plan_id,
        start_cycle_id: refEnrollment.start_cycle_id, end_cycle_id: refEnrollment.end_cycle_id,
        previous_batch_id: null,
      }));

      const { data: insertedAddRecords, error } = await supabase.from("enrollments").insert(records).select();
      if (error) throw error;

      // Write enrollment_cycles for add-batch
      if (insertedAddRecords && refEnrollment?.start_cycle_id && refEnrollment?.end_cycle_id) {
        const refPlan = subPlans.find(p => p.id === refEnrollment.subscription_plan_id);
        if (refPlan) {
          const startIdx = planCycles.findIndex(c => c.id === refEnrollment.start_cycle_id);
          if (startIdx !== -1) {
            const allocated = allocateCyclesForPlan(refPlan, planCycles, startIdx);
            for (const enrollment of insertedAddRecords) {
              await insertEnrollmentCycles(enrollment.id, enrollment.student_id, enrollment.batch_id, allocated);
            }
          }
        }
      }

      toast.success(`Added ${selectedBatchIds.length} batch(es)! Amount: ₹${addBatchBreakdown.total.toLocaleString()}`);
      setMode("view");
      setSelectedBatchIds([]);
      fetchData();
    } catch {
      toast.error("Failed to add batches. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  if (loading) return <p className="text-muted-foreground text-center py-8">Loading your profile...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">{student.name}</h2>
          <p className="text-sm text-muted-foreground">{user?.phone || student.phone}</p>
        </div>
        <Badge className={statusColors[detectedStatus] || ""} variant="secondary">{detectedStatus}</Badge>
      </div>

      {mode === "view" && (
        <>
          {activeEnrollments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Active Enrollments</h3>
              {activeEnrollments.map(e => (
                <Card key={e.id} className="glass-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{e.batches?.name}</p>
                        <p className="text-xs text-muted-foreground">{e.start_date} → {e.end_date}</p>
                        {e.subscription_plans?.name && <p className="text-xs text-muted-foreground">{e.subscription_plans.name}</p>}
                      </div>
                      <Badge variant="secondary" className="bg-success/20 text-success">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {expiredEnrollments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Past Enrollments</h3>
              {expiredEnrollments.slice(0, 3).map(e => (
                <Card key={e.id} className="border-border/30">
                  <CardContent className="p-3 opacity-60">
                    <p className="font-medium text-foreground">{e.batches?.name}</p>
                    <p className="text-xs text-muted-foreground">{e.start_date} → {e.end_date}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 gradient-primary" onClick={() => { setMode("renew"); setSelectedBatchIds([]); setSelectedPlanId(""); }}>
              {detectedStatus === "NEW" ? "Enroll" : detectedStatus === "REN" ? "Renew" : "Revive"}
            </Button>
            {activeEnrollments.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => { setMode("add"); setSelectedBatchIds([]); }}>
                Add Batch
              </Button>
            )}
          </div>
        </>
      )}

      {mode === "renew" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">{detectedStatus === "NEW" ? "New Enrollment" : detectedStatus === "REN" ? "Renew Enrollment" : "Revive Enrollment"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setMode("view")}>← Back</Button>
          </div>

          <div>
            <Label>Subscription Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {validPlans.map(p => {
                  const perBatchFee = (p.total_regular_cycles || 0) * 3767 + (p.total_grid_cycles || 0) * 5300;
                  return <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{perBatchFee.toLocaleString("en-IN")}/batch</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {assignment && (
              <div className="mt-2 p-2 rounded border border-border text-sm">
                <p className="text-muted-foreground">Validity: <span className="text-foreground font-medium">{assignment.startCycle.name}</span> → <span className="text-foreground font-medium">{assignment.endCycle.name}</span></p>
              </div>
            )}
          </div>

          <div>
            <Label>Select Batches</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {batches.map(b => (
                <Badge key={b.id} variant={selectedBatchIds.includes(String(b.id)) ? "default" : "outline"}
                  className={`cursor-pointer ${selectedBatchIds.includes(String(b.id)) ? "gradient-primary" : ""}`}
                  onClick={() => toggleBatch(String(b.id))}>{b.name}</Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {breakdown && <FeeBreakdownDisplay breakdown={breakdown} regularCycles={assignment!.regularCount} gridCycles={assignment!.gridCount} detectedStatus={detectedStatus} />}

          <Button className="w-full gradient-primary" onClick={handleRenew} disabled={submitting || selectedBatchIds.length === 0 || !assignment}>
            {submitting ? "Processing..." : "Confirm & Pay"}
          </Button>
        </div>
      )}

      {mode === "add" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Add Batch</h3>
            <Button variant="ghost" size="sm" onClick={() => setMode("view")}>← Back</Button>
          </div>

          <div>
            <Label>Current Batches</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {activeEnrollments.map(e => <Badge key={e.id} variant="secondary" className="opacity-60">{e.batches?.name}</Badge>)}
            </div>
          </div>

          <div>
            <Label>Select Additional Batches</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {batches.filter(b => !existingBatchIds.includes(b.id)).map(b => (
                <Badge key={b.id} variant={selectedBatchIds.includes(String(b.id)) ? "default" : "outline"}
                  className={`cursor-pointer ${selectedBatchIds.includes(String(b.id)) ? "gradient-primary" : ""}`}
                  onClick={() => toggleBatch(String(b.id))}>{b.name}</Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {addBatchBreakdown && (
            <FeeBreakdownDisplay breakdown={addBatchBreakdown} regularCycles={addBatchBreakdown.regularCycles} gridCycles={addBatchBreakdown.gridCycles} detectedStatus="REN" />
          )}

          <Button className="w-full gradient-primary" onClick={handleAddBatch} disabled={submitting || selectedBatchIds.length === 0}>
            {submitting ? "Processing..." : `Add Batch${selectedBatchIds.length > 1 ? "es" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
