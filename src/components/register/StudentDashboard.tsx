import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isPlanValid, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getRenewalStartCycleIndex, getStartCycleIndex, getBatchDiscount, getPlanKey, PLAN_FIXED_TOTALS, REGULAR_PRICE, GRID_PRICE, computeAddBatchBreakdown } from "@/lib/enrollmentUtils";
import type { PlanCycle, SubPlan, AddBatchBreakdown } from "@/lib/enrollmentUtils";
import { allocateCyclesForPlan } from "@/lib/cycleUtils";
import FeeBreakdownDisplay from "./FeeBreakdown";
import { initiateRazorpayPayment } from "@/lib/razorpayUtils";
import { sortBatchesByHierarchy, computePaymentAllocations, allocateCollectedAmount } from "@/lib/styleHierarchy";
import { MapPin, ChevronRight, ShoppingCart, X, Check, ArrowLeft, Trash2, Lock } from "lucide-react";
import { useSimulatedToday } from "@/contexts/TestDateContext";
import type { Database, Json } from "@/integrations/supabase/types";
import { canStudentSelectBatch, getLockedBatchNames, isBatchPromotionLocked, type ApprovedPromotionLike } from "@/lib/promotionUtils";
import ReceiptPreviewDialog from "./ReceiptPreviewDialog";
import type { ReceiptData } from "@/lib/receiptTemplate";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type CashRecipient = Pick<UserRow, "id" | "name" | "email">;

/** Format "2026-07-31" → "31 Jul'26" */
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}'${y.slice(2)}`;
}

/** Find gap cycles between start and end that are NOT in matched */
function findGapCycles(planCycles: PlanCycle[], matched: PlanCycle[], startCycleId: number, endCycleId: number): PlanCycle[] {
  const matchedIds = new Set(matched.map(c => c.id));
  const startIdx = planCycles.findIndex(c => c.id === startCycleId);
  const endIdx = planCycles.findIndex(c => c.id === endCycleId);
  if (startIdx === -1 || endIdx === -1) return [];
  return planCycles.slice(startIdx, endIdx + 1).filter(c => !matchedIds.has(c.id));
}

interface StudentDashboardProps {
  student: any;
  user: any;
  onDone: () => void;
  simulatedToday?: string;
}

export default function StudentDashboard({ student, user, onDone, simulatedToday: simulatedTodayProp }: StudentDashboardProps) {
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
  const [paymentMode, setPaymentMode] = useState("razorpay");
  const [submitting, setSubmitting] = useState(false);
  const [renewAddExpanded, setRenewAddExpanded] = useState(false);
  const [testConfirmationUrl, setTestConfirmationUrl] = useState<string | null>(null);
  const [promotionAccess, setPromotionAccess] = useState<ApprovedPromotionLike[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState<any[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const contextToday = useSimulatedToday();
  const simulatedToday = simulatedTodayProp || contextToday;

  useEffect(() => {
    fetchData();
  }, [student.id]);

  const fetchData = async () => {
    const [enrollRes, batchRes, planRes, cycleRes, studioRes] = await Promise.all([
      supabase.from("enrollments").select("*, batches(name, batch_code, studio_id, style_base), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)").eq("student_id", student.id).eq("organization_id", 1).order("end_date", { ascending: false }),
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

    const { data: promotionRows } = await supabase
      .from("student_promotions")
      .select("id, student_id, style_base, to_level, target_batch_id, status")
      .eq("student_id", student.id)
      .in("status", ["approved", "pending"]);
    setPromotionAccess(((promotionRows || []) as ApprovedPromotionLike[]).filter(p => p.status === "approved"));
    setPendingPromotions((promotionRows || []).filter((p: any) => p.status === "pending"));

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

  const todayStr = simulatedToday;
  const activeEnrollments = enrollments.filter(e => e.end_date >= todayStr);
  const expiredEnrollments = enrollments.filter(e => e.end_date < todayStr);

  const { status: detectedStatus, latestEndDate } = detectStudentStatus(
    enrollments.map(e => ({ end_date: e.end_date })),
    planCycles,
    simulatedToday
  );
  const baseStartCycleIdx = planCycles.length > 0 ? getStartCycleIndex(planCycles, simulatedToday) : 0;
  const renewalStartCycleIdx = planCycles.length > 0 && detectedStatus === "REN"
    ? getRenewalStartCycleIndex(planCycles, latestEndDate, simulatedToday)
    : baseStartCycleIdx;
  const startCycleIdx = mode === "renew" ? renewalStartCycleIdx : baseStartCycleIdx;
  const validPlans = subPlans.filter(p => isPlanValid(p, planCycles, startCycleIdx));

  const previousBatchIds = (() => {
    if (enrollments.length === 0) return [];
    const latest = enrollments[0].end_date;
    return enrollments.filter(e => e.end_date === latest).map(e => e.batch_id);
  })();
  const defaultStudioId =
    enrollments.find(e => previousBatchIds.includes(e.batch_id))?.batches?.studio_id
    || activeEnrollments[0]?.batches?.studio_id
    || enrollments[0]?.batches?.studio_id
    || null;
  const previousBatchNames = previousBatchIds
    .map(id => batches.find(b => b.id === id)?.name || enrollments.find(e => e.batch_id === id)?.batches?.name)
    .filter(Boolean);
  const renewAddedBatchCount = mode === "renew"
    ? selectedBatchIds.filter(id => !previousBatchIds.includes(Number(id))).length
    : 0;

  const assignment = selectedPlanId ? computeCycleAssignment(subPlans.find(p => p.id === Number(selectedPlanId))!, planCycles, startCycleIdx) : null;

  const selectedBatchObjects = selectedBatchIds.map(id => batches.find(b => b.id === Number(id))).filter(Boolean);
  const sortedSelectedBatches = sortBatchesByHierarchy(selectedBatchObjects);

  const hasExistingAccessToBatch = (batch: any) => {
    return enrollments.some((enrollment) => {
      const enrolledBatch = enrollment.batches;
      return enrollment.batch_id === batch.id
        || (enrolledBatch?.style_base === batch.style_base && enrolledBatch?.level === batch.level);
    });
  };

  const canSelectBatch = (batch: any) => {
    return canStudentSelectBatch(batch, promotionAccess) || hasExistingAccessToBatch(batch);
  };

  const getUnauthorizedLockedSelectionNames = () => {
    return getLockedBatchNames(
      sortedSelectedBatches.filter((batch: any) => !hasExistingAccessToBatch(batch)),
      promotionAccess,
    );
  };

  const getCashApprovalRecipients = async (batchIds: number[]): Promise<CashRecipient[]> => {
    if (batchIds.length === 0) return [];

    const { data: batchRows } = await supabase
      .from("batches")
      .select("id, instructor_id, instructor_2_id, studios(dreamcatcher_id, wingperson_id)")
      .in("id", batchIds);

    const recipientIds = new Set<number>();
    (batchRows || []).forEach((batch: any) => {
      [batch.instructor_id, batch.instructor_2_id, batch.studios?.dreamcatcher_id, batch.studios?.wingperson_id]
        .filter(Boolean)
        .forEach((id: number) => recipientIds.add(id));
    });

    if (recipientIds.size === 0) {
      const { data: managerRoles } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name)")
        .eq("organization_id", 1)
        .eq("roles.name", "manager");
      (managerRoles || []).forEach((row: any) => recipientIds.add(row.user_id));
    }

    if (recipientIds.size === 0) return [];
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", Array.from(recipientIds));

    const byEmail = new Map<string, CashRecipient>();
    (users || []).forEach((recipient) => {
      if (recipient.email) byEmail.set(recipient.email.toLowerCase(), recipient);
    });
    return Array.from(byEmail.values());
  };

  const createCashApprovalRequest = async (params: {
    batchIds: number[];
    amount: number;
    gst: number;
    total: number;
    enrollmentData: Json;
  }) => {
    const cashRecipients = await getCashApprovalRecipients(params.batchIds);
    if (cashRecipients.length === 0) {
      throw new Error("No manager or instructor email is assigned to this batch.");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const primaryApprover = cashRecipients[0];
    const { data: cashReq, error: cashErr } = await supabase.from("cash_payment_requests").insert({
      organization_id: 1,
      student_id: student.id,
      staff_user_id: primaryApprover.id,
      amount: params.amount,
      gst: params.gst,
      final_amount: params.total,
      enrollment_data: params.enrollmentData,
      batch_ids: params.batchIds as unknown as Json,
      expires_at: expiresAt,
      recipient_user_ids: cashRecipients.map((r) => r.id) as unknown as Json,
    }).select().single();
    if (cashErr) throw cashErr;

    const batchNames = params.batchIds.map(id => batches.find(b => b.id === id)?.name).filter(Boolean).join(", ");
    const confirmUrl = `${window.location.origin}/confirm-cash?token=${cashReq.token}`;
    const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-cash-confirmation", {
      body: {
        recipients: cashRecipients.map((r) => ({ email: r.email, name: r.name })),
        student_name: student.name,
        amount: params.total.toLocaleString("en-IN"),
        confirmation_url: confirmUrl,
        expires_in_minutes: 10,
        batch_names: batchNames,
      },
    });
    if (emailErr) throw emailErr;

    return { cashReq, confirmUrl, testMode: Boolean(emailData?.test_mode) };
  };

  const breakdown = selectedBatchIds.length > 0 && assignment ? computeFeeBreakdown({
    batchCount: selectedBatchIds.length,
    regularCycles: assignment.regularCount,
    gridCycles: assignment.gridCount,
    detectedStatus,
    latestEndDate,
    dropInAmount: 0,
    sortedBatches: sortedSelectedBatches.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
    today: simulatedToday,
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

  useEffect(() => {
    if ((mode === "renew" || mode === "add") && !selectedStudioId && defaultStudioId) {
      setSelectedStudioId(defaultStudioId);
    }
  }, [mode, selectedStudioId, defaultStudioId]);

  const toggleBatch = (id: string) => {
    const batch = batches.find(b => b.id === Number(id));
    if (batch && !selectedBatchIds.includes(id) && !canSelectBatch(batch)) {
      toast.error("This batch requires an approved promotion first.");
      return;
    }
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
    setRenewAddExpanded(false);
  };

  const buildEnrollmentRecords = (paymentId?: number) => {
    return selectedBatchIds.map(batchId => {
      let prevBatchId: number | null = null;
      const numBatchId = Number(batchId);
      const isPreviousBatch = previousBatchIds.includes(numBatchId);
      const statusType = mode === "renew" && !isPreviousBatch ? "NEW" : detectedStatus;
      if ((detectedStatus === "REN" || detectedStatus === "REV") && isPreviousBatch) {
        prevBatchId = numBatchId;
      }
      return {
        organization_id: 1, student_id: student.id, batch_id: Number(batchId),
        ...(paymentId ? { payment_id: paymentId } : {}),
        status_type: statusType,
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

  const showReceipt = (params: {
    planName: string;
    batchNames: string;
    amount: number;
    paymentMode: string;
    transactionId: string;
  }) => {
    setReceiptData({
      student_name: student.name,
      plan_name: params.planName,
      batches: params.batchNames,
      amount: params.amount.toLocaleString("en-IN"),
      payment_mode: params.paymentMode,
      transaction_id: params.transactionId,
      date: simulatedToday,
    });
    setReceiptOpen(true);
  };

  const onRenewSuccess = async () => {
    await markCartConverted();
    toast.success(`Payment initiated! Enrollment will be confirmed once payment is captured.`);
    setMode("view");
    setSubStep("studio");
    setSelectedBatchIds([]);
    setSelectedPlanId("");
    setRenewAddExpanded(false);
    fetchData();
  };

  const handleRenew = async () => {
    if (selectedBatchIds.length === 0 || !assignment || !breakdown) return;
    const lockedNames = getUnauthorizedLockedSelectionNames();
    if (lockedNames.length > 0) {
      toast.error(`Promotion approval is required for: ${lockedNames.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const allocations = computePaymentAllocations(
        sortedSelectedBatches.map(b => ({ id: b.id, studio_id: b.studio_id })),
        breakdown.perBatchFee, breakdown.discountPct, breakdown.total
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
            date: simulatedToday,
          },
          onSuccess: () => {
            showReceipt({
              planName,
              batchNames,
              amount: breakdown.total,
              paymentMode: "Razorpay",
              transactionId: "Pending capture",
            });
            onRenewSuccess();
          },
          onFailure: (err) => toast.error(err),
        });
        setSubmitting(false);
        return;
      }

      // Cash flow
      const enrollmentRecords = buildEnrollmentRecords();
      const cyclesTemplate = buildCyclesTemplate();
      const cashApproval = await createCashApprovalRequest({
        batchIds: selectedBatchIds.map(Number),
        amount: breakdown.subtotal,
        gst: breakdown.gst,
        total: breakdown.total,
        enrollmentData: {
          enrollments: enrollmentRecords,
          enrollment_cycles_template: cyclesTemplate,
          payment_allocations: allocations,
        } as unknown as Json,
      });
      setTestConfirmationUrl(cashApproval.testMode ? cashApproval.confirmUrl : null);
      await markCartConverted();
      toast.success("Cash approval request sent to the batch manager and instructor. Enrollment will happen after confirmation.");
      showReceipt({
        planName: subPlans.find(p => p.id === Number(selectedPlanId))?.name || "",
        batchNames: selectedBatchIds.map(id => batches.find(b => b.id === Number(id))?.name).filter(Boolean).join(", "),
        amount: breakdown.total,
        paymentMode: "Cash",
        transactionId: `CASH-${cashApproval.cashReq?.id || "pending"} pending approval`,
      });
      setMode("view");
      setSubStep("studio");
      setSelectedBatchIds([]);
      setSelectedPlanId("");
      setRenewAddExpanded(false);
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Enrollment failed: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  // Add batch logic
  const existingBatchIds = activeEnrollments.map(e => e.batch_id);
  const refEnrollment = activeEnrollments[0];
  const [addSelectedPlanId, setAddSelectedPlanId] = useState("");
  const [existingBatchCycles, setExistingBatchCycles] = useState<Record<number, number[]>>({});

  // Fetch enrollment_cycles for existing batches when entering add mode
  useEffect(() => {
    if (mode !== "add" || activeEnrollments.length === 0) return;
    const fetchCycles = async () => {
      const { data } = await supabase
        .from("enrollment_cycles")
        .select("batch_id, cycle_id")
        .eq("student_id", student.id)
        .in("batch_id", existingBatchIds);
      const map: Record<number, number[]> = {};
      (data || []).forEach(row => {
        if (!map[row.batch_id]) map[row.batch_id] = [];
        map[row.batch_id].push(row.cycle_id);
      });
      setExistingBatchCycles(map);
    };
    fetchCycles();
  }, [mode, student.id, activeEnrollments.length]);

  // Auto-select first valid plan for add mode
  useEffect(() => {
    if (mode === "add" && validPlans.length > 0 && !addSelectedPlanId) {
      setAddSelectedPlanId(String(validPlans[0].id));
    }
  }, [mode, validPlans, addSelectedPlanId]);

  const addPlan = addSelectedPlanId ? subPlans.find(p => p.id === Number(addSelectedPlanId)) : null;
  const addAssignment = addPlan ? computeCycleAssignment(addPlan, planCycles, startCycleIdx) : null;

  const addBatchBreakdown: AddBatchBreakdown | null = (() => {
    if (mode !== "add" || !addPlan || selectedBatchIds.length === 0) return null;
    const existingBatchData = activeEnrollments.map((e, idx) => ({
      batch_id: e.batch_id,
      batch_name: e.batches?.name || `Batch ${e.batch_id}`,
      style_base: e.batches?.style_base || "",
      coveredCycleIds: existingBatchCycles[e.batch_id] || [],
    }));
    const newBatchObjs = selectedBatchIds.map(id => batches.find(b => b.id === Number(id))).filter(Boolean);
    const sortedNew = sortBatchesByHierarchy(newBatchObjs);
    return computeAddBatchBreakdown({
      existingBatches: existingBatchData,
      newBatches: sortedNew.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
      plan: addPlan,
      planCycles,
      startCycleIndex: startCycleIdx,
    });
  })();
  const renewPaymentActionLabel = breakdown
    ? paymentMode === "cash"
      ? `Send ₹${breakdown.total.toLocaleString("en-IN")} for Cash Approval`
      : `Pay ₹${breakdown.total.toLocaleString("en-IN")} with Razorpay`
    : "Review payment";
  const addPaymentActionLabel = addBatchBreakdown
    ? paymentMode === "cash"
      ? `Send ₹${addBatchBreakdown.total.toLocaleString("en-IN")} for Cash Approval`
      : `Pay ₹${addBatchBreakdown.total.toLocaleString("en-IN")} with Razorpay`
    : "Review payment";

  const handleAddBatch = async () => {
    if (!addPlan || selectedBatchIds.length === 0 || !addBatchBreakdown || !addAssignment) return;
    const lockedNames = getUnauthorizedLockedSelectionNames();
    if (lockedNames.length > 0) {
      toast.error(`Promotion approval is required for: ${lockedNames.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const newAllocations = addBatchBreakdown.batchAllocations.filter(a => !a.is_existing);
      const startIdx = planCycles.findIndex(c => c.id === addAssignment.startCycle.id);
      const allocatedCycles = allocateCyclesForPlan(addPlan, planCycles, startIdx !== -1 ? startIdx : 0);
      const newEnrollmentRecords = newAllocations.map(a => ({
        organization_id: 1, student_id: student.id, batch_id: a.batch_id,
        status_type: "ADD",
        registration_fee_applied: false, late_renewal: false,
        start_date: addAssignment.startCycle.start_date,
        end_date: addAssignment.endCycle.end_date || addAssignment.startCycle.start_date,
        subscription_plan_id: Number(addSelectedPlanId),
        start_cycle_id: addAssignment.startCycle.id, end_cycle_id: addAssignment.endCycle.id,
        previous_batch_id: null,
      }));

      const existingExtensions = addBatchBreakdown.batchAllocations
        .filter(a => a.is_existing && a.missingCycleIds.length > 0)
        .map((alloc) => {
          const enrollment = activeEnrollments.find(e => e.batch_id === alloc.batch_id);
          if (!enrollment) return null;
          const newEndDate = addAssignment.endCycle.end_date || addAssignment.startCycle.start_date;
          return {
            enrollment_id: enrollment.id,
            batch_id: alloc.batch_id,
            end_date: newEndDate > enrollment.end_date ? newEndDate : enrollment.end_date,
            end_cycle_id: newEndDate > enrollment.end_date ? addAssignment.endCycle.id : enrollment.end_cycle_id,
            missing_cycles: alloc.missingCycleIds.map(cid => {
              const cycle = planCycles.find(c => c.id === cid);
              return { cycle_id: cid, cycle_type: cycle?.plan_type || "regular" };
            }),
          };
        })
        .filter(Boolean);

      const chargedAllocations = addBatchBreakdown.batchAllocations.filter(a => a.amount > 0);
      const batchStudioMap = batches.reduce((m: Record<number, number | null>, b: any) => { m[b.id] = b.studio_id; return m; }, {});
      const collectedAllocations = allocateCollectedAmount(
        chargedAllocations.map((a, idx) => ({
          batch_id: a.batch_id,
          studio_id: batchStudioMap[a.batch_id] || null,
          allocated_amount: a.amount,
          is_primary: idx === 0,
        })),
        addBatchBreakdown.total,
      );

      if (paymentMode === "razorpay") {
        const batchNames = selectedBatchIds.map(id => batches.find(b => b.id === Number(id))?.name).filter(Boolean).join(", ");
        await initiateRazorpayPayment({
          orderParams: {
            student_id: student.id,
            organization_id: 1,
            batch_ids: selectedBatchIds.map(Number),
            amount: addBatchBreakdown.subtotal,
            gst: addBatchBreakdown.gst,
            final_amount: addBatchBreakdown.total,
            enrollment_data: {
              enrollments: newEnrollmentRecords,
              enrollment_cycles_template: allocatedCycles,
              existing_extensions: existingExtensions,
              payment_allocations: collectedAllocations,
            },
            student_name: student.name,
            student_phone: user?.phone || student.phone || "",
            batch_names: batchNames,
            plan_name: addPlan.name,
            date: simulatedToday,
          },
          onSuccess: () => {
            showReceipt({
              planName: addPlan.name,
              batchNames,
              amount: addBatchBreakdown.total,
              paymentMode: "Razorpay",
              transactionId: "Pending capture",
            });
            onRenewSuccess();
          },
          onFailure: (err) => toast.error(err),
        });
        setSubmitting(false);
        return;
      }

      // Cash flow
      const cashApproval = await createCashApprovalRequest({
        batchIds: selectedBatchIds.map(Number),
        amount: addBatchBreakdown.subtotal,
        gst: addBatchBreakdown.gst,
        total: addBatchBreakdown.total,
        enrollmentData: {
          enrollments: newEnrollmentRecords,
          enrollment_cycles_template: allocatedCycles,
          existing_extensions: existingExtensions,
          payment_allocations: collectedAllocations,
        } as unknown as Json,
      });
      setTestConfirmationUrl(cashApproval.testMode ? cashApproval.confirmUrl : null);

      await markCartConverted();
      toast.success("Cash approval request sent to the batch manager and instructor. Batch changes will happen after confirmation.");
      showReceipt({
        planName: addPlan.name,
        batchNames: selectedBatchIds.map(id => batches.find(b => b.id === Number(id))?.name).filter(Boolean).join(", "),
        amount: addBatchBreakdown.total,
        paymentMode: "Cash",
        transactionId: `CASH-${cashApproval.cashReq?.id || "pending"} pending approval`,
      });
      setMode("view");
      setSubStep("studio");
      setSelectedBatchIds([]);
      setAddSelectedPlanId("");
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to request cash approval: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  const startRenewFlow = () => {
    setTestConfirmationUrl(null);
    const defaultBatchIds = previousBatchIds.map(String);
    setMode("renew");
    setSubStep(defaultBatchIds.length > 0 ? "checkout" : "studio");
    setSelectedBatchIds(defaultBatchIds);
    setSelectedPlanId("");
    setSelectedStudioId(defaultStudioId);
    setRenewAddExpanded(false);
  };

  const startAddFlow = () => {
    setTestConfirmationUrl(null);
    setMode("add");
    setSubStep("studio");
    setSelectedBatchIds([]);
    setSelectedStudioId(defaultStudioId);
    setRenewAddExpanded(false);
  };

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
          {testConfirmationUrl && (
            <Card className="border-warning/30 bg-warning/10">
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label>Test mode confirmation link</Label>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{testConfirmationUrl}</p>
                </div>
                <Button className="w-full gradient-primary" onClick={() => window.open(testConfirmationUrl, "_blank", "noopener,noreferrer")}>
                  Open confirmation link
                </Button>
              </CardContent>
            </Card>
          )}

          {activeEnrollments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Active Enrollments</h3>
              {activeEnrollments.map(e => (
                <Card key={e.id} className="glass-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{e.batches?.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(e.start_date)} → {formatDate(e.end_date)}</p>
                        {e.subscription_plans?.name && <p className="text-xs text-muted-foreground">{e.subscription_plans.name}</p>}
                      </div>
                      <Badge variant="secondary" className="bg-success/20 text-success">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {pendingPromotions.length > 0 && (
            <Card className="border-warning/30 bg-warning/10">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-foreground">Promotion under review</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingPromotions.map((p: any) => `${p.style_base} ${p.to_level}`).join(", ")}
                </p>
              </CardContent>
            </Card>
          )}

          {expiredEnrollments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Past Enrollments</h3>
              {expiredEnrollments.slice(0, 3).map(e => (
                <Card key={e.id} className="border-border/30">
                  <CardContent className="p-3 opacity-60">
                    <p className="font-medium text-foreground">{e.batches?.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.start_date)} → {formatDate(e.end_date)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 gradient-primary" onClick={startRenewFlow}>
              {detectedStatus === "NEW" ? "Enroll" : detectedStatus === "REN" ? "Renew" : "Revive"}
            </Button>
            {activeEnrollments.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={startAddFlow}>
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

          {mode === "renew" && previousBatchIds.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Renew your current batch{previousBatchIds.length > 1 ? "es" : ""}?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {previousBatchNames.length > 0 ? previousBatchNames.join(", ") : "Same batch"} selected by default.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gradient-primary"
                    onClick={() => {
                      setSelectedBatchIds(previousBatchIds.map(String));
                      setSelectedStudioId(defaultStudioId);
                      setSubStep("checkout");
                      setRenewAddExpanded(false);
                    }}
                  >
                    Same batch
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedStudioId(defaultStudioId);
                      setSubStep("studio");
                      setRenewAddExpanded(true);
                    }}
                  >
                    Change / add
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background/40 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Want to add another batch too?</p>
                  <p className="text-xs text-muted-foreground">
                    Same studio is selected first. Extra batches in this renewal will be marked NEW.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={renewAddExpanded || renewAddedBatchCount > 0 ? "default" : "outline"}
                  className={renewAddExpanded || renewAddedBatchCount > 0 ? "gradient-primary" : ""}
                  onClick={() => {
                    setRenewAddExpanded(true);
                    setSelectedStudioId(defaultStudioId);
                    setSubStep("studio");
                  }}
                >
                  {renewAddedBatchCount > 0 ? `${renewAddedBatchCount} added` : "Quick add batch"}
                </Button>
              </div>
            </div>
          )}

          {/* Current batches for add mode */}
          {mode === "add" && subStep !== "checkout" && (
            <div>
              <Label className="text-xs text-muted-foreground">Current Batches</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {activeEnrollments.map(e => {
                  const studio = studios.find(s => s.id === e.batches?.studio_id);
                  return <Badge key={e.id} variant="secondary" className="opacity-60">{e.batches?.name}{e.batches?.batch_code ? ` (${e.batches.batch_code})` : ""}{studio ? ` · ${studio.name}` : ""}</Badge>;
                })}
              </div>
            </div>
          )}

          {/* Sub-step: STUDIO + BATCHES (merged) */}
          {(subStep === "studio" || subStep === "batches") && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Select Studio</Label>
                <Select value={selectedStudioId ? String(selectedStudioId) : ""} onValueChange={(v) => setSelectedStudioId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a studio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStudios.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}{s.location ? ` · ${s.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudioId && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {mode === "renew"
                      ? "Same studio is selected by default. Tap another batch to add it to this renewal."
                      : "Same studio is selected by default. Tap batches to add them to your cart."}
                  </p>

                  {Object.entries(batchesByStyle).sort(([a], [b]) => a.localeCompare(b)).map(([style, styleBatches]) => (
                    <div key={style} className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">{style}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {styleBatches.map((b: any) => {
                          const isInCart = selectedBatchIds.includes(String(b.id));
                          const existingEnrollment = enrollments.find(e => e.batch_id === b.id && e.end_date >= todayStr);
                          const locked = isBatchPromotionLocked(b);
                          const selectable = canSelectBatch(b);
                          const schedule = b.schedule as any;
                          const timings: string[] = [];
                          if (schedule && Array.isArray(schedule)) {
                            schedule.forEach((s: any) => {
                              if (s.day && s.start_time) timings.push(`${s.day} ${s.start_time}–${s.end_time || ""}`);
                            });
                          } else if (schedule && typeof schedule === "object") {
                            Object.entries(schedule).forEach(([day, val]: [string, any]) => {
                              if (val?.start_time) timings.push(`${day} ${val.start_time}–${val.end_time || ""}`);
                            });
                          }
                          return (
                            <Card
                              key={b.id}
                              className={`transition-all duration-200 ${!selectable ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"} ${isInCart ? "border-primary ring-1 ring-primary" : selectable ? "hover:border-primary/40" : ""}`}
                              onClick={() => selectable && toggleBatch(String(b.id))}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-display font-semibold text-foreground">{b.name}</h4>
                                      {isInCart && <Check className="h-4 w-4 text-primary" />}
                                      {locked && selectable && !existingEnrollment && (
                                        <Badge variant="secondary" className="bg-success/20 text-success text-[10px]">Promotion approved</Badge>
                                      )}
                                      {locked && !selectable && (
                                        <Badge variant="secondary" className="bg-warning/20 text-warning text-[10px] gap-1">
                                          <Lock className="h-3 w-3" /> Locked
                                        </Badge>
                                      )}
                                      {!isInCart && b.studio_id === defaultStudioId && !previousBatchIds.includes(b.id) && (
                                        <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px]">Suggested</Badge>
                                      )}
                                    </div>
                                    {b.batch_code && <p className="text-xs text-muted-foreground">Code: {b.batch_code}</p>}
                                    {timings.length > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        {timings.map((t, i) => <p key={i}>{t}</p>)}
                                      </div>
                                    )}
                                    {existingEnrollment && (
                                      <Badge variant="secondary" className="bg-success/20 text-success text-[10px] mt-1">
                                        Active till {formatDate(existingEnrollment.end_date)}
                                      </Badge>
                                    )}
                                    {locked && !selectable && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Ask your instructor to recommend promotion for this level.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {Object.keys(batchesByStyle).length === 0 && (
                    <p className="text-sm text-muted-foreground">No batches available at this studio</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Sub-step: CHECKOUT */}
          {subStep === "checkout" && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSubStep("studio")} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Add more batches
              </Button>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Action</span>
                  <span className="font-medium text-foreground">{mode === "add" ? "Add new batch" : detectedStatus === "REN" ? "Renew current batch" : detectedStatus === "REV" ? "Revive enrollment" : "New enrollment"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Student</span>
                  <span className="text-right font-medium text-foreground">{student.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Selected</span>
                  <span className="font-medium text-foreground">{selectedBatchIds.length} batch{selectedBatchIds.length !== 1 ? "es" : ""}</span>
                </div>
              </div>

              {/* Cart items */}
              <div className="space-y-2">
                <Label>{mode === "add" ? "New Batch Selection" : "Renewal Selection"} ({selectedBatchIds.length} batch{selectedBatchIds.length !== 1 ? "es" : ""})</Label>
                {selectedBatchIds.map(id => {
                  const batch = batches.find(b => b.id === Number(id));
                  const studio = batch ? studios.find(s => s.id === batch.studio_id) : null;
                  const isPreviousBatch = previousBatchIds.includes(Number(id));
                  return (
                    <Card key={id} className="glass-card">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground text-sm">{batch?.name || `Batch #${id}`}</p>
                            {mode === "renew" && (
                              <Badge variant="secondary" className={isPreviousBatch ? "bg-primary/20 text-primary text-[10px]" : "bg-success/20 text-success text-[10px]"}>
                                {isPreviousBatch ? "REN" : "NEW"}
                              </Badge>
                            )}
                          </div>
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
                        <p className="text-muted-foreground">Validity: <span className="text-foreground font-medium">{formatDate(assignment.startCycle.start_date)}</span> → <span className="text-foreground font-medium">{formatDate(assignment.endCycle.end_date || assignment.endCycle.start_date)}</span></p>
                        {(() => {
                          const gaps = findGapCycles(planCycles, assignment.matched, assignment.startCycle.id, assignment.endCycle.id);
                          return gaps.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {gaps.map(g => (
                                <p key={g.id} className="text-xs text-warning">Not valid: {g.name} ({formatDate(g.start_date)} → {formatDate(g.end_date || g.start_date)})</p>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="razorpay">Razorpay</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentMode === "cash" && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                      <Label>Manager/Instructor Approval</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cash does not enroll immediately. The studio manager or instructor must confirm cash received within 10 minutes.
                      </p>
                    </div>
                  )}

                  {breakdown && <FeeBreakdownDisplay breakdown={breakdown} regularCycles={assignment!.regularCount} gridCycles={assignment!.gridCount} detectedStatus={detectedStatus} />}

                  <Button className="w-full gradient-primary" onClick={handleRenew} disabled={submitting || selectedBatchIds.length === 0 || !assignment}>
                    {submitting ? "Processing..." : renewPaymentActionLabel}
                  </Button>
                </>
              )}

              {/* ADD: Plan Selection + Payment + Breakdown */}
              {mode === "add" && (
                <>
                  {/* Existing batches info */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Existing Batches ({activeEnrollments.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {activeEnrollments.map(e => {
                        const studio = studios.find(s => s.id === e.batches?.studio_id);
                        return (
                          <Badge key={e.id} variant="secondary" className="opacity-60">
                            {e.batches?.name}{e.batches?.batch_code ? ` (${e.batches.batch_code})` : ""}{studio ? ` · ${studio.name}` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plan selection */}
                  <div>
                    <Label>Subscription Plan</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {validPlans.map(p => {
                        const pk = getPlanKey(p.total_regular_cycles || 0, p.total_grid_cycles || 0);
                        const ft = PLAN_FIXED_TOTALS[pk];
                        const perBatchFee = ft !== undefined ? Math.round(ft / 1.18) : (p.total_regular_cycles || 0) * REGULAR_PRICE + (p.total_grid_cycles || 0) * GRID_PRICE;
                        const isSelected = addSelectedPlanId === String(p.id);
                        return (
                          <Card
                            key={p.id}
                            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
                            onClick={() => setAddSelectedPlanId(String(p.id))}
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
                    {addAssignment && (
                      <div className="mt-2 p-2 rounded border border-border text-sm">
                        <p className="text-muted-foreground">Validity: <span className="text-foreground font-medium">{formatDate(addAssignment.startCycle.start_date)}</span> → <span className="text-foreground font-medium">{formatDate(addAssignment.endCycle.end_date || addAssignment.endCycle.start_date)}</span></p>
                        {(() => {
                          const gaps = findGapCycles(planCycles, addAssignment.matched, addAssignment.startCycle.id, addAssignment.endCycle.id);
                          return gaps.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {gaps.map(g => (
                                <p key={g.id} className="text-xs text-warning">Not valid: {g.name} ({formatDate(g.start_date)} → {formatDate(g.end_date || g.start_date)})</p>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="razorpay">Razorpay</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentMode === "cash" && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                      <Label>Manager/Instructor Approval</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cash does not add batches immediately. The studio manager or instructor must confirm cash received within 10 minutes.
                      </p>
                    </div>
                  )}

                  {addBatchBreakdown && (
                    <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
                      <p className="font-medium text-foreground mb-2">Fee Breakdown</p>

                      {/* Per-batch line items */}
                      <div className="pl-2 border-l-2 border-primary/20 ml-1 space-y-0.5">
                        {addBatchBreakdown.batchAllocations.map((alloc, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className={alloc.amount === 0 ? "text-muted-foreground line-through" : alloc.is_existing ? "text-foreground" : "text-foreground font-medium"}>
                              {alloc.batch_name}{(() => { const b = batches.find(b => b.id === alloc.batch_id); return b?.batch_code ? ` (${b.batch_code})` : ""; })()}
                              {alloc.is_existing
                                ? alloc.amount === 0 ? " (Covered)" : ` (+${alloc.missingCycleIds.length} cycle${alloc.missingCycleIds.length > 1 ? "s" : ""}${alloc.discountPct > 0 ? `, ${Math.round(alloc.discountPct * 100)}% off` : ""})`
                                : alloc.discountPct > 0 ? ` (New, ${Math.round(alloc.discountPct * 100)}% off)` : " (New)"
                              }
                            </span>
                            <span className={alloc.amount === 0 ? "text-muted-foreground" : alloc.discountPct > 0 ? "text-success" : ""}>
                              ₹{alloc.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between border-t border-border pt-1 mt-1">
                        <span className="text-muted-foreground">Class subtotal</span>
                        <span>₹{addBatchBreakdown.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GST (18%)</span>
                        <span>₹{addBatchBreakdown.gst.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Class fee after rounding</span>
                        <span>₹{addBatchBreakdown.roundedBatchTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                        <span>Total</span>
                        <span>₹{addBatchBreakdown.total.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <Button className="w-full gradient-primary" onClick={handleAddBatch} disabled={submitting || selectedBatchIds.length === 0 || !addAssignment || !addBatchBreakdown}>
                    {submitting ? "Processing..." : addPaymentActionLabel}
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

      <ReceiptPreviewDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receiptData || {}}
        recipientEmail={student?.email || user?.email}
        recipientPhone={student?.phone || user?.phone}
      />
    </div>
  );
}
