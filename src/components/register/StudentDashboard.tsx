import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isPlanValid, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getStartCycleIndex, getBatchDiscount, getPlanKey, PLAN_FIXED_TOTALS, REGULAR_PRICE, GRID_PRICE, computeAddBatchBreakdown } from "@/lib/enrollmentUtils";
import type { PlanCycle, SubPlan, AddBatchBreakdown } from "@/lib/enrollmentUtils";
import { allocateCyclesForPlan, insertEnrollmentCycles } from "@/lib/cycleUtils";
import FeeBreakdownDisplay from "./FeeBreakdown";
import { initiateRazorpayPayment } from "@/lib/razorpayUtils";
import { sortBatchesByHierarchy, computePaymentAllocations } from "@/lib/styleHierarchy";
import { MapPin, ChevronRight, ShoppingCart, X, Check, ArrowLeft, Trash2 } from "lucide-react";

interface StudentDashboardProps {
  student: any;
  user: any;
  onDone: () => void;
}

export default function StudentDashboard({ student, user, onDone }: StudentDashboardProps) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [subPlans, setSubPlans] = useState<SubPlan[]>([]);
  const [planCycles, setPlanCycles] = useState<PlanCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "renew" | "add">("view");

  // Sub-step for renew/add modes
  const [subStep, setSubStep] = useState<"studio" | "batches" | "checkout">("studio");
  const [selectedStudioId, setSelectedStudioId] = useState<number | null>(null);

  // Cart state
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [student.id]);

  const fetchData = async () => {
    const [enrollRes, batchRes, planRes, cycleRes, studioRes] = await Promise.all([
      supabase.from("enrollments").select("*, batches(name, studio_id, style_base), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)").eq("student_id", student.id).eq("organization_id", 1).order("end_date", { ascending: false }),
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
      supabase.from("subscription_plans").select("*").eq("organization_id", 1).eq("is_active", true).order("id"),
      supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
      supabase.from("studios").select("id, name, location").eq("organization_id", 1).order("name"),
    ]);
    setEnrollments(enrollRes.data || []);
    setBatches(batchRes.data || []);
    setSubPlans(planRes.data || []);
    setPlanCycles(cycleRes.data || []);
    setStudios(studioRes.data || []);
    setLoading(false);

    // Check for abandoned cart
    const { data: cartData } = await supabase
      .from("abandoned_carts")
      .select("*")
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (cartData && cartData.length > 0) {
      const cart = cartData[0];
      const ids = (cart.batch_ids as number[]).map(String);
      if (ids.length > 0) {
        setSelectedBatchIds(ids);
        setMode(cart.cart_type === "renew" ? "renew" : "add");
        setSubStep("checkout");
        toast.info("You have items in your cart from last time");
      }
    }
  };

  // Save abandoned cart
  const saveAbandonedCart = useCallback(async () => {
    if (selectedBatchIds.length === 0) return;
    try {
      // Expire old active carts for this student
      await supabase
        .from("abandoned_carts")
        .update({ status: "expired" })
        .eq("student_id", student.id)
        .eq("status", "active");

      await supabase.from("abandoned_carts").insert({
        student_id: student.id,
        organization_id: 1,
        batch_ids: selectedBatchIds.map(Number),
        cart_type: mode === "add" ? "add" : "renew",
        status: "active",
      });
    } catch {
      // silent
    }
  }, [selectedBatchIds, student.id, mode]);

  // beforeunload handler
  useEffect(() => {
    const handler = () => {
      if (selectedBatchIds.length > 0 && (mode === "renew" || mode === "add")) {
        // Use sendBeacon for reliability
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const url = `https://${projectId}.supabase.co/rest/v1/abandoned_carts`;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const body = JSON.stringify({
          student_id: student.id,
          organization_id: 1,
          batch_ids: selectedBatchIds.map(Number),
          cart_type: mode === "add" ? "add" : "renew",
          status: "active",
        });
        navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [selectedBatchIds, mode, student.id]);

  const todayStr = new Date().toISOString().split("T")[0];
  const activeEnrollments = enrollments.filter(e => e.end_date >= todayStr);
  const expiredEnrollments = enrollments.filter(e => e.end_date < todayStr);

  const startCycleIdx = planCycles.length > 0 ? getStartCycleIndex(planCycles) : 0;
  const validPlans = subPlans.filter(p => isPlanValid(p, planCycles, startCycleIdx));

  const { status: detectedStatus, latestEndDate } = detectStudentStatus(
    enrollments.map(e => ({ end_date: e.end_date })),
    planCycles
  );

  const previousBatchIds = (() => {
    if (enrollments.length === 0) return [];
    const latest = enrollments[0].end_date;
    return enrollments.filter(e => e.end_date === latest).map(e => e.batch_id);
  })();

  const assignment = selectedPlanId ? computeCycleAssignment(subPlans.find(p => p.id === Number(selectedPlanId))!, planCycles, startCycleIdx) : null;

  const selectedBatchObjects = selectedBatchIds.map(id => batches.find(b => b.id === Number(id))).filter(Boolean);
  const sortedSelectedBatches = sortBatchesByHierarchy(selectedBatchObjects);

  const breakdown = selectedBatchIds.length > 0 && assignment ? computeFeeBreakdown({
    batchCount: selectedBatchIds.length,
    regularCycles: assignment.regularCount,
    gridCycles: assignment.gridCount,
    detectedStatus,
    latestEndDate,
    dropInAmount: 0,
    sortedBatches: sortedSelectedBatches.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
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

  const removeBatch = (id: string) => {
    setSelectedBatchIds(prev => prev.filter(b => b !== id));
  };

  // Mark abandoned cart as converted
  const markCartConverted = async () => {
    await supabase
      .from("abandoned_carts")
      .update({ status: "converted" })
      .eq("student_id", student.id)
      .eq("status", "active");
  };

  const goBackToView = async () => {
    if (selectedBatchIds.length > 0) {
      await saveAbandonedCart();
    }
    setMode("view");
    setSubStep("studio");
    setSelectedStudioId(null);
    setSelectedBatchIds([]);
    setSelectedPlanId("");
  };

  const buildEnrollmentRecords = (paymentId?: number) => {
    return selectedBatchIds.map(batchId => {
      let prevBatchId: number | null = null;
      if (detectedStatus === "REN" || detectedStatus === "REV") {
        const numBatchId = Number(batchId);
        prevBatchId = previousBatchIds.includes(numBatchId) ? numBatchId : (previousBatchIds[0] ?? null);
      }
      return {
        organization_id: 1, student_id: student.id, batch_id: Number(batchId),
        ...(paymentId ? { payment_id: paymentId } : {}),
        status_type: detectedStatus,
        registration_fee_applied: breakdown!.applyRegFee, late_renewal: breakdown!.isLateRenewal,
        start_date: assignment!.startCycle.start_date, end_date: assignment!.endCycle.end_date || assignment!.startCycle.start_date,
        subscription_plan_id: Number(selectedPlanId),
        start_cycle_id: assignment!.startCycle.id, end_cycle_id: assignment!.endCycle.id,
        previous_batch_id: prevBatchId,
      };
    });
  };

  const buildCyclesTemplate = () => {
    const plan = subPlans.find(p => p.id === Number(selectedPlanId));
    if (!plan || !assignment) return [];
    const startIdx = planCycles.findIndex(c => c.id === assignment.startCycle.id);
    return allocateCyclesForPlan(plan, planCycles, startIdx !== -1 ? startIdx : 0);
  };

  const onRenewSuccess = async () => {
    await markCartConverted();
    toast.success(`Payment initiated! Enrollment will be confirmed once payment is captured.`);
    setMode("view");
    setSubStep("studio");
    setSelectedBatchIds([]);
    setSelectedPlanId("");
    fetchData();
  };

  const handleRenew = async () => {
    if (selectedBatchIds.length === 0 || !assignment || !breakdown) return;
    setSubmitting(true);
    try {
      const allocations = computePaymentAllocations(
        sortedSelectedBatches.map(b => ({ id: b.id, studio_id: b.studio_id })),
        breakdown.perBatchFee, breakdown.discountPct
      );

      if (paymentMode === "razorpay") {
        const enrollmentRecords = buildEnrollmentRecords();
        const cyclesTemplate = buildCyclesTemplate();
        const batchNames = selectedBatchIds.map(id => batches.find(b => b.id === Number(id))?.name).filter(Boolean).join(", ");
        const planName = subPlans.find(p => p.id === Number(selectedPlanId))?.name || "";

        await initiateRazorpayPayment({
          orderParams: {
            student_id: student.id,
            organization_id: 1,
            batch_ids: selectedBatchIds.map(Number),
            amount: breakdown.subtotal,
            gst: breakdown.gst,
            final_amount: breakdown.total,
            enrollment_data: {
              enrollments: enrollmentRecords,
              enrollment_cycles_template: cyclesTemplate,
              payment_allocations: allocations,
            },
            student_name: student.name,
            student_phone: user?.phone || student.phone || "",
            batch_names: batchNames,
            plan_name: planName,
          },
          onSuccess: onRenewSuccess,
          onFailure: (err) => toast.error(err),
        });
        setSubmitting(false);
        return;
      }

      // Cash flow
      const { data: payment, error: payError } = await supabase.from("payments").insert({
        organization_id: 1, student_id: student.id, amount: breakdown.subtotal,
        gst: breakdown.gst, final_amount: breakdown.total,
        payment_mode: paymentMode, status: "success",
      }).select().single();
      if (payError) throw payError;

      const records = buildEnrollmentRecords(payment.id);
      const { data: insertedRecords, error } = await supabase.from("enrollments").insert(records).select();
      if (error) throw error;

      if (allocations.length > 0) {
        await supabase.from("payment_allocations").insert(
          allocations.map(a => ({ ...a, payment_id: payment.id }))
        );
      }

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

      await markCartConverted();
      toast.success(`Enrolled successfully! Amount: ₹${breakdown.total.toLocaleString()}`);
      setMode("view");
      setSubStep("studio");
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
    const newBatchCount = selectedBatchIds.length;
    const planKey = getPlanKey(regularCycles, gridCycles);
    const fixedTotal = PLAN_FIXED_TOTALS[planKey];
    const isFixedPricePlan = fixedTotal !== undefined;
    const perBatchFee = isFixedPricePlan ? Math.round(fixedTotal / 1.18) : (regularCycles * REGULAR_PRICE) + (gridCycles * GRID_PRICE);
    let totalNewFee = 0;
    const batchAllocations: any[] = [];
    for (let i = 0; i < newBatchCount; i++) {
      const position = existingBatchIds.length + 1 + i;
      const disc = getBatchDiscount(position);
      const amount = Math.round(perBatchFee * (1 - disc));
      totalNewFee += amount;
      batchAllocations.push({ batch_id: 0, batch_name: `Batch ${i + 1}`, style_base: "", is_primary: false, amount, discountPct: disc });
    }
    const subtotal = totalNewFee;
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst;
    return {
      batchCount: newBatchCount, perBatchFee, discountPct: 0, discountAmount: (perBatchFee * newBatchCount) - totalNewFee,
      totalBatchFee: totalNewFee, regFee: 0, dropInAdj: 0, subtotal, gst, total, applyRegFee: false, isLateRenewal: false,
      isFixedPricePlan, planKey,
      regularCycles, gridCycles, batchAllocations,
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

      await markCartConverted();
      toast.success(`Added ${selectedBatchIds.length} batch(es)! Amount: ₹${addBatchBreakdown.total.toLocaleString()}`);
      setMode("view");
      setSubStep("studio");
      setSelectedBatchIds([]);
      fetchData();
    } catch {
      toast.error("Failed to add batches. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  // Studios that have batches
  const studioIdsWithBatches = [...new Set(batches.map(b => b.studio_id).filter(Boolean))];
  const availableStudios = studios.filter(s => studioIdsWithBatches.includes(s.id));

  // Batches for selected studio, grouped by style
  const batchesForStudio = selectedStudioId
    ? batches.filter(b => b.studio_id === selectedStudioId && (mode !== "add" || !existingBatchIds.includes(b.id)))
    : [];

  const batchesByStyle: Record<string, any[]> = {};
  batchesForStudio.forEach(b => {
    const style = b.style_base || "Other";
    if (!batchesByStyle[style]) batchesByStyle[style] = [];
    batchesByStyle[style].push(b);
  });

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

      {/* VIEW MODE */}
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
            <Button className="flex-1 gradient-primary" onClick={() => { setMode("renew"); setSubStep("studio"); setSelectedBatchIds([]); setSelectedPlanId(""); setSelectedStudioId(null); }}>
              {detectedStatus === "NEW" ? "Enroll" : detectedStatus === "REN" ? "Renew" : "Revive"}
            </Button>
            {activeEnrollments.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => { setMode("add"); setSubStep("studio"); setSelectedBatchIds([]); setSelectedStudioId(null); }}>
                Add Batch
              </Button>
            )}
          </div>
        </>
      )}

      {/* RENEW / ADD MODE */}
      {(mode === "renew" || mode === "add") && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">
              {mode === "add" ? "Add Batch" : detectedStatus === "NEW" ? "New Enrollment" : detectedStatus === "REN" ? "Renew Enrollment" : "Revive Enrollment"}
            </h3>
            <Button variant="ghost" size="sm" onClick={goBackToView}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          {/* Current batches for add mode */}
          {mode === "add" && subStep !== "checkout" && (
            <div>
              <Label className="text-xs text-muted-foreground">Current Batches</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {activeEnrollments.map(e => <Badge key={e.id} variant="secondary" className="opacity-60">{e.batches?.name}</Badge>)}
              </div>
            </div>
          )}

          {/* Sub-step: STUDIO SELECTION */}
          {subStep === "studio" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select a studio to browse batches</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableStudios.map(s => (
                  <Card
                    key={s.id}
                    className="cursor-pointer group hover:border-primary/60 transition-all duration-300 hover:scale-[1.02]"
                    onClick={() => { setSelectedStudioId(s.id); setSubStep("batches"); }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-display font-semibold text-foreground">{s.name}</h4>
                        {s.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{s.location}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Sub-step: BATCH SELECTION */}
          {subStep === "batches" && selectedStudioId && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSubStep("studio")} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> {studios.find(s => s.id === selectedStudioId)?.name || "Studios"}
              </Button>

              <p className="text-sm text-muted-foreground">Tap batches to add them to your cart</p>

              {Object.entries(batchesByStyle).sort(([a], [b]) => a.localeCompare(b)).map(([style, styleBatches]) => (
                <div key={style} className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">{style}</h4>
                  <div className="flex flex-wrap gap-2">
                    {styleBatches.map((b: any) => {
                      const isInCart = selectedBatchIds.includes(String(b.id));
                      return (
                        <Badge
                          key={b.id}
                          variant={isInCart ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${isInCart ? "gradient-primary" : "hover:border-primary/60"}`}
                          onClick={() => toggleBatch(String(b.id))}
                        >
                          {isInCart && <Check className="h-3 w-3 mr-1" />}
                          {b.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}

              {Object.keys(batchesByStyle).length === 0 && (
                <p className="text-sm text-muted-foreground">No batches available at this studio</p>
              )}
            </div>
          )}

          {/* Sub-step: CHECKOUT */}
          {subStep === "checkout" && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSubStep("studio")} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Add more batches
              </Button>

              {/* Cart items */}
              <div className="space-y-2">
                <Label>Your Cart ({selectedBatchIds.length} batch{selectedBatchIds.length !== 1 ? "es" : ""})</Label>
                {selectedBatchIds.map(id => {
                  const batch = batches.find(b => b.id === Number(id));
                  const studio = batch ? studios.find(s => s.id === batch.studio_id) : null;
                  return (
                    <Card key={id} className="glass-card">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm">{batch?.name || `Batch #${id}`}</p>
                          <p className="text-xs text-muted-foreground">{studio?.name} · {batch?.style_base}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeBatch(id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* RENEW: Plan + Payment + Breakdown */}
              {mode === "renew" && (
                <>
                  <div>
                    <Label>Subscription Plan</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {validPlans.map(p => {
                        const pk = getPlanKey(p.total_regular_cycles || 0, p.total_grid_cycles || 0);
                        const ft = PLAN_FIXED_TOTALS[pk];
                        const perBatchFee = ft !== undefined ? Math.round(ft / 1.18) : (p.total_regular_cycles || 0) * REGULAR_PRICE + (p.total_grid_cycles || 0) * GRID_PRICE;
                        const isSelected = selectedPlanId === String(p.id);
                        return (
                          <Card
                            key={p.id}
                            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
                            onClick={() => setSelectedPlanId(String(p.id))}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-display font-semibold text-foreground">{p.name}</h4>
                                {isSelected && <Check className="h-5 w-5 text-primary" />}
                              </div>
                              <p className="text-sm text-muted-foreground">₹{perBatchFee.toLocaleString("en-IN")}/batch</p>
                              <p className="text-xs text-muted-foreground">{p.total_cycles} cycle{p.total_cycles > 1 ? "s" : ""}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    {assignment && (
                      <div className="mt-2 p-2 rounded border border-border text-sm">
                        <p className="text-muted-foreground">Validity: <span className="text-foreground font-medium">{assignment.startCycle.name}</span> → <span className="text-foreground font-medium">{assignment.endCycle.name}</span></p>
                      </div>
                    )}
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
                </>
              )}

              {/* ADD: Payment + Breakdown */}
              {mode === "add" && (
                <>
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

                  {addBatchBreakdown && (
                    <FeeBreakdownDisplay breakdown={addBatchBreakdown} regularCycles={addBatchBreakdown.regularCycles} gridCycles={addBatchBreakdown.gridCycles} detectedStatus="REN" />
                  )}

                  <Button className="w-full gradient-primary" onClick={handleAddBatch} disabled={submitting || selectedBatchIds.length === 0}>
                    {submitting ? "Processing..." : `Add Batch${selectedBatchIds.length > 1 ? "es" : ""}`}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Floating cart bar (visible on studio/batches steps when cart has items) */}
          {(subStep === "studio" || subStep === "batches") && selectedBatchIds.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card/95 backdrop-blur-xl border-t border-border">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{selectedBatchIds.length} batch{selectedBatchIds.length !== 1 ? "es" : ""}</span>
                </div>
                <Button className="gradient-primary" onClick={() => setSubStep("checkout")}>
                  View Cart <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
