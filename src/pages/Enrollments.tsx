import { useState, useEffect } from "react";
import { todayIST } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, PackagePlus, Download, FileWarning, MoreVertical, CalendarCog, Trash2, ArrowRightLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getDisplayPhone } from "@/lib/studentUtils";
import { parseISO } from "date-fns";
import { allocateCyclesForPlan, insertEnrollmentCycles, filterEnrollmentsByCycle } from "@/lib/cycleUtils";
import { useAuth } from "@/hooks/useAuth";
import { useScopedStudents } from "@/hooks/useScopedStudents";
import { useTestDate } from "@/contexts/TestDateContext";
import { Textarea } from "@/components/ui/textarea";

const EnrollmentsPage = () => {
  const { staffUser, isAdminOrManager } = useAuth();
  const { isTestMode } = useTestDate();
  const scope = useScopedStudents();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [editValidityFor, setEditValidityFor] = useState<any>(null);
  const [editValidityDate, setEditValidityDate] = useState("");
  const [validityMode, setValidityMode] = useState<"cycle" | "date">("cycle");
  const [editValidityCycleId, setEditValidityCycleId] = useState<string>("");
  const [deleteFor, setDeleteFor] = useState<any>(null);
  const [changeBatchFor, setChangeBatchFor] = useState<any>(null);
  const [changeBatchToId, setChangeBatchToId] = useState<string>("");
  const [overlapWarning, setOverlapWarning] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [enrollOverlap, setEnrollOverlap] = useState<{
    studentName: string;
    conflicts: { id: number; batch_name: string; start_date: string; end_date: string }[];
  } | null>(null);
  const [pendingCases, setPendingCases] = useState<Record<number, boolean>>({});
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [caseEnrollment, setCaseEnrollment] = useState<any>(null);
  const [caseReason, setCaseReason] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [subPlans, setSubPlans] = useState<any[]>([]);
  const [subPlanCycles, setSubPlanCycles] = useState<any[]>([]);
  const [planCycles, setPlanCycles] = useState<any[]>([]);
  const [eligibleDropIn, setEligibleDropIn] = useState<any>(null);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStudioId, setFilterStudioId] = useState<string>("all");
  const [filterBatchId, setFilterBatchId] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [validMonth, setValidMonth] = useState<string>("");
  const [validNow, setValidNow] = useState<boolean>(false);
  const [validCycleId, setValidCycleId] = useState<number | null>(null);
  const [validEnrollmentIds, setValidEnrollmentIds] = useState<Set<number> | null>(null);
  const [validLoading, setValidLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [addBatchForm, setAddBatchForm] = useState({ student_id: "", new_batch_ids: [] as string[], payment_mode: "cash" });
  const [existingBatches, setExistingBatches] = useState<any[]>([]);
  const [existingEnrollment, setExistingEnrollment] = useState<any>(null);
  const [addBatchDropIn, setAddBatchDropIn] = useState<any>(null);
  const [detectedStatus, setDetectedStatus] = useState<string>("NEW");
  const [latestEndDate, setLatestEndDate] = useState<string | null>(null);
  const [previousBatchIds, setPreviousBatchIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    student_id: "", batch_ids: [] as string[], payment_mode: "cash",
    subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "",
    start_cycle_id: null as number | null, end_cycle_id: null as number | null,
    regular_cycles: 1, grid_cycles: 0,
  });

  const fetchData = async () => {
    let enrollQ: any = supabase.from("enrollments").select("*, students(name, phone, users(phone)), batches(name, batch_code, studio_id, studios(name, code)), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)").eq("organization_id", 1).eq("is_active", true).order("created_at", { ascending: false });
    let studentQ: any = supabase.from("students").select("*").eq("organization_id", 1).order("name");
    if (!scope.unrestricted) {
      if (scope.studentIds.length === 0) {
        setEnrollments([]); setStudents([]); setBatches([]); setStudios([]);
        setSubPlans([]); setSubPlanCycles([]); setPlanCycles([]); setPricingPlans([]);
        setPendingCases({});
        return;
      }
      enrollQ = enrollQ.in("student_id", scope.studentIds);
      studentQ = studentQ.in("id", scope.studentIds);
    }
    const [enrollRes, studentRes, batchRes, studioRes, planRes, seqRes, cycleRes, pricingRes] = await Promise.all([
      enrollQ,
      studentQ,
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
      supabase.from("studios").select("id, name, code").eq("organization_id", 1).order("name"),
      supabase.from("subscription_plans").select("*").eq("organization_id", 1).eq("is_active", true).order("id"),
      supabase.from("subscription_plan_cycles").select("*").order("sequence_order"),
      supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
      supabase.from("pricing_plans").select("*").eq("organization_id", 1).order("batch_count"),
    ]);
    setEnrollments(enrollRes.data || []);
    setStudents(studentRes.data || []);
    setBatches(batchRes.data || []);
    setStudios(studioRes.data || []);
    setSubPlans(planRes.data || []);
    setSubPlanCycles(seqRes.data || []);
    setPlanCycles(cycleRes.data || []);
    setPricingPlans(pricingRes.data || []);

    // Fetch pending application cases keyed by enrollment_id
    const { data: caseData } = await supabase
      .from("application_cases")
      .select("enrollment_id")
      .eq("organization_id", 1)
      .eq("status", "pending");
    const map: Record<number, boolean> = {};
    (caseData || []).forEach(c => { map[c.enrollment_id] = true; });
    setPendingCases(map);
  };

  useEffect(() => {
    if (scope.loading) return;
    fetchData();
    const channel = supabase
      .channel("enrollments_app_cases")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_cases" },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scope.loading, scope.unrestricted, scope.studentIds.join(",")]);

  const requestApplicationCase = async () => {
    if (!caseEnrollment) return;
    const { error } = await supabase.from("application_cases").insert({
      organization_id: 1,
      enrollment_id: caseEnrollment.id,
      student_id: caseEnrollment.student_id,
      batch_id: caseEnrollment.batch_id,
      requested_by_user_id: staffUser?.id ?? null,
      reason: caseReason || null,
      status: "pending",
    });
    if (error) { toast.error("Failed to raise application case"); return; }
    toast.success("Application case raised — awaiting admin approval");
    setCaseDialogOpen(false);
    setCaseEnrollment(null);
    setCaseReason("");
    fetchData();
  };

  const handleSaveValidity = async () => {
    if (!editValidityFor) return;
    let update: { end_date: string; end_cycle_id: number | null };
    let resolvedEndCycle: any = null;
    if (validityMode === "cycle") {
      const c = planCycles.find(pc => String(pc.id) === editValidityCycleId);
      if (!c) { toast.error("Pick a cycle"); return; }
      update = { end_date: c.end_date, end_cycle_id: c.id };
      resolvedEndCycle = c;
    } else {
      if (!editValidityDate) return;
      update = { end_date: editValidityDate, end_cycle_id: null };
      const eligible = planCycles
        .filter(pc => pc.start_date <= editValidityDate)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
      resolvedEndCycle = eligible[eligible.length - 1] || null;
    }

    const e = editValidityFor;

    // Pre-save overlap check: another active enrollment for same (student, batch) covers part of the new window
    if (resolvedEndCycle && e.start_cycle_id) {
      const sorted = [...planCycles].sort((a, b) => a.start_date.localeCompare(b.start_date));
      const newStartIdx = sorted.findIndex(pc => pc.id === e.start_cycle_id);
      const newEndIdx = sorted.findIndex(pc => pc.id === resolvedEndCycle.id);
      if (newStartIdx >= 0 && newEndIdx >= newStartIdx) {
        const { data: others } = await supabase.from("enrollments")
          .select("id, start_cycle_id, end_cycle_id, start_date, end_date")
          .eq("student_id", e.student_id)
          .eq("batch_id", e.batch_id)
          .eq("is_active", true)
          .neq("id", e.id);
        const overlaps: string[] = [];
        (others || []).forEach((o: any) => {
          if (!o.start_cycle_id || !o.end_cycle_id) return;
          const oStart = sorted.findIndex(pc => pc.id === o.start_cycle_id);
          const oEnd = sorted.findIndex(pc => pc.id === o.end_cycle_id);
          if (oStart < 0 || oEnd < oStart) return;
          if (oStart <= newEndIdx && oEnd >= newStartIdx) {
            const overlapStart = sorted[Math.max(oStart, newStartIdx)];
            const overlapEnd = sorted[Math.min(oEnd, newEndIdx)];
            overlaps.push(`#${o.id} (${overlapStart.name} → ${overlapEnd.name})`);
          }
        });
        if (overlaps.length > 0) {
          setOverlapWarning({
            message: `This validity overlaps with another active enrollment for the same batch: ${overlaps.join(", ")}. Months already covered by that enrollment will stay attributed to it. Continue?`,
            onConfirm: () => { setOverlapWarning(null); performSaveValidity(update, resolvedEndCycle); },
          });
          return;
        }
      }
    }

    performSaveValidity(update, resolvedEndCycle);
  };

  const performSaveValidity = async (
    update: { end_date: string; end_cycle_id: number | null },
    resolvedEndCycle: any,
  ) => {
    if (!editValidityFor) return;
    const e = editValidityFor;
    const { error } = await supabase.from("enrollments").update(update).eq("id", e.id);
    if (error) { toast.error("Failed to update validity"); return; }

    const startCycleId: number | null = e.start_cycle_id ?? null;
    let skipMsg = "";
    if (startCycleId && resolvedEndCycle) {
      const sorted = [...planCycles].sort((a, b) => a.start_date.localeCompare(b.start_date));
      const startIdx = sorted.findIndex(pc => pc.id === startCycleId);
      const endIdx = sorted.findIndex(pc => pc.id === resolvedEndCycle.id);
      if (startIdx >= 0 && endIdx >= startIdx) {
        const targetCycles = sorted.slice(startIdx, endIdx + 1);
        const targetIds = new Set(targetCycles.map(pc => pc.id));

        const { data: adjData } = await supabase.from("cycle_adjustments")
          .select("new_cycle_id")
          .eq("student_id", e.student_id)
          .eq("batch_id", e.batch_id)
          .eq("status", "APPLIED");
        const keepShiftedIn = new Set<number>((adjData || []).map((a: any) => a.new_cycle_id).filter(Boolean));

        const { data: currentRows } = await supabase.from("enrollment_cycles")
          .select("cycle_id")
          .eq("enrollment_id", e.id);
        const currentIds = new Set<number>((currentRows || []).map((r: any) => r.cycle_id));

        const toDelete = [...currentIds].filter(id => !targetIds.has(id) && !keepShiftedIn.has(id));
        let toInsert = targetCycles.filter(pc => !currentIds.has(pc.id));

        // Skip-on-conflict: drop any cycle id already owned by another enrollment for same (student, batch)
        if (toInsert.length > 0) {
          const { data: ownedElsewhere } = await supabase.from("enrollment_cycles")
            .select("cycle_id")
            .eq("student_id", e.student_id)
            .eq("batch_id", e.batch_id)
            .in("cycle_id", toInsert.map(pc => pc.id));
          const ownedIds = new Set<number>((ownedElsewhere || []).map((r: any) => r.cycle_id));
          const before = toInsert.length;
          toInsert = toInsert.filter(pc => !ownedIds.has(pc.id));
          const skipped = before - toInsert.length;
          if (skipped > 0) skipMsg = ` (${skipped} cycle${skipped !== 1 ? "s" : ""} already covered by another enrollment, left as-is)`;
        }

        let syncErr = false;
        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.from("enrollment_cycles")
            .delete()
            .eq("enrollment_id", e.id)
            .in("cycle_id", toDelete);
          if (delErr) syncErr = true;
        }
        if (toInsert.length > 0) {
          const rows = toInsert.map(pc => ({
            enrollment_id: e.id,
            student_id: e.student_id,
            batch_id: e.batch_id,
            cycle_id: pc.id,
            cycle_type: pc.plan_type,
          }));
          const { error: insErr } = await supabase.from("enrollment_cycles").insert(rows);
          if (insErr) syncErr = true;
        }
        if (syncErr) {
          toast.error("Validity saved, but cycle coverage failed to update");
        } else {
          toast.success(`Validity updated${skipMsg}`);
        }
      } else {
        toast.warning("Validity saved, cycle coverage not adjusted");
      }
    } else {
      toast.warning("Validity saved, cycle coverage not adjusted");
    }

    setEditValidityFor(null);
    setEditValidityDate("");
    setEditValidityCycleId("");
    setValidityMode("cycle");
    fetchData();
  };




  const handleChangeBatch = async () => {
    if (!changeBatchFor || !changeBatchToId) return;
    const newBatchId = Number(changeBatchToId);
    if (newBatchId === changeBatchFor.batch_id) { toast.error("Pick a different batch"); return; }
    const { error: eErr } = await supabase.from("enrollments").update({ batch_id: newBatchId }).eq("id", changeBatchFor.id);
    if (eErr) { toast.error("Failed to change batch"); return; }
    const { error: ecErr } = await supabase.from("enrollment_cycles").update({ batch_id: newBatchId }).eq("enrollment_id", changeBatchFor.id);
    if (ecErr) { toast.error("Batch changed, but cycle records failed to update"); }
    else { toast.success("Batch changed"); }
    setChangeBatchFor(null);
    setChangeBatchToId("");
    fetchData();
  };

  const handleDeleteEnrollment = async () => {
    if (!deleteFor) return;
    const e = deleteFor;
    const { error: ecErr } = await supabase.from("enrollment_cycles").delete().eq("enrollment_id", e.id);
    if (ecErr) { toast.error("Failed to delete enrollment cycles"); return; }
    if (e.payment_id) {
      await supabase.from("payment_allocations").delete().eq("payment_id", e.payment_id).eq("batch_id", e.batch_id);
    }
    const { error: enErr } = await supabase.from("enrollments").delete().eq("id", e.id);
    if (enErr) { toast.error("Failed to delete enrollment"); return; }
    toast.success("Enrollment deleted");
    setDeleteFor(null);
    fetchData();
  };



  // Auto-detect student status based on enrollment history
  useEffect(() => {
    const detectStatus = async () => {
      if (!form.student_id) { setDetectedStatus("NEW"); setLatestEndDate(null); setPreviousBatchIds([]); return; }
      const { data } = await supabase.from("enrollments")
        .select("end_date")
        .eq("student_id", Number(form.student_id))
        .eq("organization_id", 1)
        .order("end_date", { ascending: false })
        .limit(1);
      if (!data || data.length === 0) { setDetectedStatus("NEW"); setLatestEndDate(null); setPreviousBatchIds([]); return; }
      const latest = data[0].end_date;
      setLatestEndDate(latest);

      // Fetch all batch_ids from the most recent enrollment set (same end_date)
      const { data: prevEnrollments } = await supabase.from("enrollments")
        .select("batch_id")
        .eq("student_id", Number(form.student_id))
        .eq("organization_id", 1)
        .eq("end_date", latest);
      setPreviousBatchIds(prevEnrollments?.map(e => e.batch_id) || []);
      const todayStr = new Date().toISOString().split("T")[0];
      if (latest >= todayStr) { setDetectedStatus("REN"); }
      else {
        // Check grace: if within grace_days of the active cycle, still REN (late)
        const activeCycle = planCycles.find(c => c.is_active);
        const graceDays = activeCycle?.grace_days || 14;
        const latestDate = new Date(latest);
        const graceEnd = new Date(latestDate);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        const graceEndStr = graceEnd.toISOString().split("T")[0];
        if (todayStr <= graceEndStr) { setDetectedStatus("REN"); }
        else { setDetectedStatus("REV"); }
      }
    };
    detectStatus();
  }, [form.student_id, planCycles]);

  // Check for eligible drop-ins when student + batches change
  useEffect(() => {
    const checkDropIns = async () => {
      if (!form.student_id || form.batch_ids.length === 0) { setEligibleDropIn(null); return; }
      const todayStr = new Date().toISOString().split("T")[0];
      const selectedStyles = batches.filter(b => form.batch_ids.includes(String(b.id))).map(b => b.style).filter(Boolean);
      if (selectedStyles.length === 0) { setEligibleDropIn(null); return; }

      const { data } = await supabase.from("drop_ins")
        .select("*, batch_sessions(session_date, style, start_time, end_time, batches(name))")
        .eq("student_id", Number(form.student_id))
        .eq("is_adjusted", false)
        .eq("organization_id", 1)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) { setEligibleDropIn(null); return; }

      // Find most recent eligible: session_date >= today AND style matches
      const eligible = data.find(d => {
        const sess = d.batch_sessions;
        if (!sess) return false;
        return sess.session_date >= todayStr && selectedStyles.includes(sess.style);
      });
      setEligibleDropIn(eligible || null);
    };
    checkDropIns();
  }, [form.student_id, form.batch_ids, batches]);
  // Find the first cycle with open registration (or next upcoming)
  const getStartCycleIndex = (): number => {
    const todayStr = todayIST();
    // First: find a cycle whose registration is still open
    const openIdx = planCycles.findIndex(c => {
      if (c.registration_deadline && todayStr > c.registration_deadline) return false;
      // Must not be fully in the past
      const endDate = c.end_date || "2099-12-31";
      return endDate >= todayStr;
    });
    if (openIdx !== -1) return openIdx;
    // Fallback: next upcoming cycle by start_date
    const futureIdx = planCycles.findIndex(c => c.start_date > todayStr);
    return futureIdx !== -1 ? futureIdx : 0;
  };

  const startCycleIndex = planCycles.length > 0 ? getStartCycleIndex() : 0;
  const startCycle = planCycles[startCycleIndex];
  const currentCycleClosed = (() => {
    const todayStr = todayIST();
    const activeCycle = planCycles.find(c => c.is_active);
    if (!activeCycle) return false;
    return activeCycle.registration_deadline && todayStr > activeCycle.registration_deadline;
  })();

  // Count-based greedy matching: walk calendar consuming cycles by type counts
  // Every calendar cycle in the span must be consumed — no skipping allowed
  const isPlanValid = (plan: any): boolean => {
    let neededRegular = plan.total_regular_cycles ?? 0;
    let neededGrid = plan.total_grid_cycles ?? 0;
    if (neededRegular + neededGrid === 0) return false;

    let calIdx = startCycleIndex;
    while ((neededRegular > 0 || neededGrid > 0) && calIdx < planCycles.length) {
      const cycle = planCycles[calIdx];
      if (cycle.plan_type === "regular" && neededRegular > 0) {
        neededRegular--;
      } else if (cycle.plan_type === "grid" && neededGrid > 0) {
        neededGrid--;
      } else {
        return false; // cycle type not needed — plan can't span past it
      }
      calIdx++;
    }
    return neededRegular === 0 && neededGrid === 0;
  };

  const validPlans = subPlans.filter(p => isPlanValid(p));

  // Auto-select first valid plan when dialog opens
  useEffect(() => {
    if (dialogOpen && validPlans.length > 0 && (!form.subscription_plan_id || form.subscription_plan_id === "none")) {
      computeCycleAssignment(String(validPlans[0].id));
    }
  }, [dialogOpen, validPlans, form.subscription_plan_id, subPlans, subPlanCycles, planCycles]);

  // Compute cycle assignment when subscription plan changes
  const computeCycleAssignment = (planId: string) => {
    if (!planId || planId === "none") {
      setForm(f => ({ ...f, subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null, regular_cycles: 1, grid_cycles: 0 }));
      return;
    }

    const plan = subPlans.find(p => p.id === Number(planId));
    if (!plan) return;

    // Count-based greedy matching — walk calendar consuming by type counts
    let neededRegular = plan.total_regular_cycles ?? 0;
    let neededGrid = plan.total_grid_cycles ?? 0;
    const totalNeeded = neededRegular + neededGrid;
    const matched: any[] = [];
    let calIdx = startCycleIndex;

    while ((neededRegular > 0 || neededGrid > 0) && calIdx < planCycles.length) {
      const cycle = planCycles[calIdx];
      if (cycle.plan_type === "regular" && neededRegular > 0) {
        matched.push(cycle);
        neededRegular--;
      } else if (cycle.plan_type === "grid" && neededGrid > 0) {
        matched.push(cycle);
        neededGrid--;
      } else {
        break; // cycle type not needed — plan can't span past it
      }
      calIdx++;
    }

    if (matched.length === totalNeeded) {
      const startCycle = matched[0];
      const endCycle = matched[matched.length - 1];
      const regularCount = matched.filter(c => c.plan_type === "regular").length;
      const gridCount = matched.filter(c => c.plan_type === "grid").length;
      setForm(f => ({
        ...f,
        subscription_plan_id: planId,
        computed_start: startCycle.start_date,
        computed_end: endCycle.end_date || "",
        start_cycle_name: startCycle.name,
        end_cycle_name: endCycle.name,
        start_cycle_id: startCycle.id,
        end_cycle_id: endCycle.id,
        regular_cycles: regularCount,
        grid_cycles: gridCount,
      }));
    } else {
      toast.error("Not enough matching cycles in calendar for this plan");
      setForm(f => ({ ...f, subscription_plan_id: planId, computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null, regular_cycles: 1, grid_cycles: 0 }));
    }
  };

  const computeFeeBreakdown = () => {
    const batchCount = form.batch_ids.length;
    const perBatchFee = (form.regular_cycles * 3200) + (form.grid_cycles * 7667);
    let totalBatchFee = 0;
    for (let i = 0; i < batchCount; i++) {
      const position = i + 1;
      const disc = position <= 1 ? 0 : ({ 2: 0.12, 3: 0.13, 4: 0.14 } as Record<number, number>)[position] ?? 0.15;
      totalBatchFee += position === 1 ? perBatchFee : Math.round(perBatchFee * (1 - disc));
    }
    const discountAmount = (perBatchFee * batchCount) - totalBatchFee;

    const todayStr = new Date().toISOString().split("T")[0];
    const applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || (detectedStatus === "REN" && latestEndDate && todayStr > latestEndDate);
    const regFee = applyRegFee ? 500 : 0;
    const dropInAdj = eligibleDropIn ? Number(eligibleDropIn.amount) : 0;
    const isLateRenewal = detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false;

    const subtotal = Math.max(0, totalBatchFee + regFee - dropInAdj);
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst;

    return { batchCount, perBatchFee, discountPct: 0, discountAmount, totalBatchFee, regFee, dropInAdj, subtotal, gst, total, applyRegFee: !!applyRegFee, isLateRenewal };
  };

  const feeBreakdown = computeFeeBreakdown();

  const handleEnroll = async () => {
    if (!form.student_id || form.batch_ids.length === 0) { toast.error("Select a student and at least one batch"); return; }

    const breakdown = computeFeeBreakdown();
    const todayStr = new Date().toISOString().split("T")[0];
    const totalAmount = breakdown.total;

    const { data: payment, error: payError } = await supabase.from("payments").insert({
      organization_id: 1, student_id: Number(form.student_id), amount: breakdown.subtotal,
      gst: breakdown.gst, final_amount: totalAmount,
      payment_mode: form.payment_mode, status: "success",
    }).select().single();

    if (payError) { toast.error("Payment failed"); return; }

    const today = new Date();
    const startDate = form.computed_start || today.toISOString().split("T")[0];
    const endDate = form.computed_end || (() => { const d = new Date(today); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })();

    const enrollmentRecords = form.batch_ids.map((batchId) => {
      let prevBatchId: number | null = null;
      if (detectedStatus === "REN" || detectedStatus === "REV") {
        // If the same batch exists in previous enrollments, use it; otherwise use the first previous batch
        const numBatchId = Number(batchId);
        prevBatchId = previousBatchIds.includes(numBatchId) ? numBatchId : (previousBatchIds[0] ?? null);
      }
      return {
        organization_id: 1, student_id: Number(form.student_id), batch_id: Number(batchId),
        payment_id: payment.id, status_type: detectedStatus,
        registration_fee_applied: breakdown.applyRegFee, late_renewal: breakdown.isLateRenewal,
        start_date: startDate, end_date: endDate,
        subscription_plan_id: form.subscription_plan_id ? Number(form.subscription_plan_id) : null,
        start_cycle_id: form.start_cycle_id,
        end_cycle_id: form.end_cycle_id,
        previous_batch_id: prevBatchId,
      };
    });

    const { data: insertedEnrollments, error } = await supabase.from("enrollments").insert(enrollmentRecords).select();
    if (error) { toast.error("Enrollment failed"); return; }

    // Write enrollment_cycles for each inserted enrollment
    if (insertedEnrollments && form.start_cycle_id && form.end_cycle_id) {
      const plan = subPlans.find(p => p.id === Number(form.subscription_plan_id));
      if (plan) {
        const allocated = allocateCyclesForPlan(plan, planCycles, startCycleIndex);
        for (const enrollment of insertedEnrollments) {
          await insertEnrollmentCycles(enrollment.id, enrollment.student_id, enrollment.batch_id, allocated);
        }
      }
    }

    // Mark drop-in as adjusted
    if (eligibleDropIn) {
      await supabase.from("drop_ins").update({ is_adjusted: true, adjusted_at: new Date().toISOString() }).eq("id", eligibleDropIn.id);
    }

    toast.success(`Enrolled successfully! Amount: ₹${totalAmount.toLocaleString()}${breakdown.dropInAdj > 0 ? ` (Drop-in adjusted: -₹${breakdown.dropInAdj})` : ""}`);
    setEligibleDropIn(null);
    setDetectedStatus("NEW");
    setLatestEndDate(null);
    setForm({ student_id: "", batch_ids: [], payment_mode: "cash", subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null, regular_cycles: 1, grid_cycles: 0 });
    setDialogOpen(false);
    fetchData();
  };

  const toggleBatch = (id: string) => {
    setForm((f) => ({ ...f, batch_ids: f.batch_ids.includes(id) ? f.batch_ids.filter((b) => b !== id) : [...f.batch_ids, id] }));
  };

  // --- Add Batch Logic ---
  const fetchExistingEnrollments = async (studentId: string) => {
    if (!studentId) { setExistingBatches([]); setExistingEnrollment(null); return; }
    const todayStr = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("enrollments")
      .select("*, batches(name, id)")
      .eq("student_id", Number(studentId))
      .eq("organization_id", 1)
      .order("end_date", { ascending: false });

    if (!data || data.length === 0) { setExistingBatches([]); setExistingEnrollment(null); return; }

    // Find enrollments that are active or within grace
    const activeCycle = planCycles.find(c => c.is_active);
    const graceDays = activeCycle?.grace_days || 14;

    const activeEnrollments = data.filter(e => {
      if (e.end_date >= todayStr) return true;
      const endD = new Date(e.end_date);
      endD.setDate(endD.getDate() + graceDays);
      return todayStr <= endD.toISOString().split("T")[0];
    });

    if (activeEnrollments.length === 0) { setExistingBatches([]); setExistingEnrollment(null); return; }

    const uniqueBatchIds = [...new Set(activeEnrollments.map(e => e.batch_id))];
    const existingBatchList = uniqueBatchIds.map(bid => {
      const enrollment = activeEnrollments.find(e => e.batch_id === bid);
      return { batch_id: bid, batch_name: enrollment?.batches?.name || `Batch ${bid}` };
    });
    setExistingBatches(existingBatchList);
    setExistingEnrollment(activeEnrollments[0]); // reference enrollment for dates/plan
  };

  // Check drop-ins for add-batch
  useEffect(() => {
    const checkAddBatchDropIns = async () => {
      if (!addBatchForm.student_id || addBatchForm.new_batch_ids.length === 0) { setAddBatchDropIn(null); return; }
      const todayStr = new Date().toISOString().split("T")[0];
      const selectedStyles = batches.filter(b => addBatchForm.new_batch_ids.includes(String(b.id))).map(b => b.style).filter(Boolean);
      if (selectedStyles.length === 0) { setAddBatchDropIn(null); return; }
      const { data } = await supabase.from("drop_ins")
        .select("*, batch_sessions(session_date, style, start_time, end_time, batches(name))")
        .eq("student_id", Number(addBatchForm.student_id))
        .eq("is_adjusted", false)
        .eq("organization_id", 1)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) { setAddBatchDropIn(null); return; }
      const eligible = data.find(d => {
        const sess = d.batch_sessions;
        if (!sess) return false;
        return sess.session_date >= todayStr && selectedStyles.includes(sess.style);
      });
      setAddBatchDropIn(eligible || null);
    };
    checkAddBatchDropIns();
  }, [addBatchForm.student_id, addBatchForm.new_batch_ids, batches]);

  const computeAddBatchFee = () => {
    if (!existingEnrollment || addBatchForm.new_batch_ids.length === 0) return null;

    // Determine cycle composition from existing enrollment
    const refEnrollment = existingEnrollment;
    let regularCycles = 1, gridCycles = 0;
    if (refEnrollment.subscription_plan_id) {
      const plan = subPlans.find(p => p.id === refEnrollment.subscription_plan_id);
      if (plan) {
        const sequence = subPlanCycles.filter(s => s.subscription_plan_id === plan.id);
        regularCycles = sequence.filter(s => s.plan_type === "regular").length || 1;
        gridCycles = sequence.filter(s => s.plan_type === "grid").length;
      }
    }

    const totalBatchCount = existingBatches.length + addBatchForm.new_batch_ids.length;
    const newBatchCount = addBatchForm.new_batch_ids.length;
    const perBatchFee = (regularCycles * 3200) + (gridCycles * 7667);
    let totalNewFee = 0;
    for (let i = 0; i < newBatchCount; i++) {
      const position = existingBatches.length + 1 + i;
      const disc = position <= 1 ? 0 : ({ 2: 0.12, 3: 0.13, 4: 0.14 } as Record<number, number>)[position] ?? 0.15;
      totalNewFee += Math.round(perBatchFee * (1 - disc));
    }
    const discountAmount = (perBatchFee * newBatchCount) - totalNewFee;

    const dropInAdj = addBatchDropIn ? Number(addBatchDropIn.amount) : 0;
    const subtotal = Math.max(0, totalNewFee - dropInAdj);
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst;

    return { totalBatchCount, newBatchCount, perBatchFee, discountPct: 0, discountAmount, totalNewFee, dropInAdj, subtotal, gst, total, regularCycles, gridCycles };
  };

  const addBatchFee = computeAddBatchFee();

  const handleAddBatch = async () => {
    if (!addBatchForm.student_id || addBatchForm.new_batch_ids.length === 0 || !existingEnrollment || !addBatchFee) {
      toast.error("Select a student and at least one new batch"); return;
    }

    const { data: payment, error: payError } = await supabase.from("payments").insert({
      organization_id: 1, student_id: Number(addBatchForm.student_id),
      amount: addBatchFee.subtotal, gst: addBatchFee.gst, final_amount: addBatchFee.total,
      payment_mode: addBatchForm.payment_mode, status: "success",
    }).select().single();

    if (payError) { toast.error("Payment failed"); return; }

    const enrollmentRecords = addBatchForm.new_batch_ids.map(batchId => ({
      organization_id: 1, student_id: Number(addBatchForm.student_id), batch_id: Number(batchId),
      payment_id: payment.id, status_type: "REN",
      registration_fee_applied: false, late_renewal: false,
      start_date: existingEnrollment.start_date, end_date: existingEnrollment.end_date,
      subscription_plan_id: existingEnrollment.subscription_plan_id,
      start_cycle_id: existingEnrollment.start_cycle_id,
      end_cycle_id: existingEnrollment.end_cycle_id,
      previous_batch_id: null,
    }));

    const { data: insertedAddBatch, error } = await supabase.from("enrollments").insert(enrollmentRecords).select();
    if (error) { toast.error("Enrollment failed"); return; }

    // Write enrollment_cycles for add-batch enrollments
    if (insertedAddBatch && existingEnrollment?.start_cycle_id && existingEnrollment?.end_cycle_id) {
      const plan = subPlans.find(p => p.id === existingEnrollment.subscription_plan_id);
      if (plan) {
        const startIdx = planCycles.findIndex(c => c.id === existingEnrollment.start_cycle_id);
        if (startIdx !== -1) {
          const allocated = allocateCyclesForPlan(plan, planCycles, startIdx);
          for (const enrollment of insertedAddBatch) {
            await insertEnrollmentCycles(enrollment.id, enrollment.student_id, enrollment.batch_id, allocated);
          }
        }
      }
    }

    if (addBatchDropIn) {
      await supabase.from("drop_ins").update({ is_adjusted: true, adjusted_at: new Date().toISOString() }).eq("id", addBatchDropIn.id);
    }

    toast.success(`Added ${addBatchForm.new_batch_ids.length} batch(es)! Amount: ₹${addBatchFee.total.toLocaleString()}${addBatchFee.dropInAdj > 0 ? ` (Drop-in adjusted: -₹${addBatchFee.dropInAdj})` : ""}`);
    setAddBatchForm({ student_id: "", new_batch_ids: [], payment_mode: "cash" });
    setExistingBatches([]);
    setExistingEnrollment(null);
    setAddBatchDropIn(null);
    setAddBatchOpen(false);
    fetchData();
  };

  const toggleAddBatch = (id: string) => {
    setAddBatchForm(f => ({ ...f, new_batch_ids: f.new_batch_ids.includes(id) ? f.new_batch_ids.filter(b => b !== id) : [...f.new_batch_ids, id] }));
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  // Filter batches shown in batch dropdown based on selected studio
  const filteredBatchOptions = filterStudioId === "all" ? batches : batches.filter(b => String(b.studio_id) === filterStudioId);

  // Resolve picked month → matching plan_cycles candidates
  const monthCycleCandidates = (() => {
    if (!validMonth || planCycles.length === 0) return [] as any[];
    const monthStart = `${validMonth}-01`;
    const [y, m] = validMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${validMonth}-${String(lastDay).padStart(2, "0")}`;
    return planCycles.filter(c => c.start_date <= monthEnd && (c.end_date || "2099-12-31") >= monthStart);
  })();

  // When month changes, auto-pick a cycle (regular preferred); clear when month cleared
  useEffect(() => {
    if (!validMonth) { setValidCycleId(null); return; }
    if (monthCycleCandidates.length === 0) { setValidCycleId(null); return; }
    const exists = validCycleId && monthCycleCandidates.some(c => c.id === validCycleId);
    if (exists) return;
    const regular = monthCycleCandidates.find(c => c.plan_type === "regular");
    setValidCycleId((regular || monthCycleCandidates[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validMonth, planCycles]);

  // Recompute valid enrollment-id set when filter changes
  useEffect(() => {
    let cancelled = false;
    if (!validCycleId || enrollments.length === 0) { setValidEnrollmentIds(null); return; }
    setValidLoading(true);
    filterEnrollmentsByCycle(enrollments, validCycleId)
      .then(ids => { if (!cancelled) setValidEnrollmentIds(ids); })
      .catch(err => { console.error("filterEnrollmentsByCycle failed", err); if (!cancelled) setValidEnrollmentIds(new Set()); })
      .finally(() => { if (!cancelled) setValidLoading(false); });
    return () => { cancelled = true; };
  }, [validCycleId, enrollments]);

  const filtered = enrollments.filter((e) => {
    const matchesSearch = e.students?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStudio = filterStudioId === "all" || String(e.batches?.studio_id) === filterStudioId;
    const matchesBatch = filterBatchId === "all" || String(e.batch_id) === filterBatchId;
    const matchesType = filterType === "all" || e.status_type === filterType;
    let matchesMonth = true;
    if (validCycleId) {
      matchesMonth = validEnrollmentIds ? validEnrollmentIds.has(e.id) : false;
    }
    let matchesValidNow = true;
    if (validNow) {
      const t = todayIST();
      matchesValidNow = e.start_date <= t && e.end_date >= t;
    }
    return matchesSearch && matchesStudio && matchesBatch && matchesType && matchesMonth && matchesValidNow;
  });


  const displayed = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "oldest": return (a.created_at || "").localeCompare(b.created_at || "");
      case "name_asc": return (a.students?.name || "").localeCompare(b.students?.name || "");
      case "name_desc": return (b.students?.name || "").localeCompare(a.students?.name || "");
      case "end_asc": return (a.end_date || "").localeCompare(b.end_date || "");
      case "end_desc": return (b.end_date || "").localeCompare(a.end_date || "");
      case "newest":
      default: return (b.created_at || "").localeCompare(a.created_at || "");
    }
  });

  const monthLabel = validMonth ? new Date(`${validMonth}-01`).toLocaleString("en-US", { month: "long", year: "numeric" }) : "";

  return (
    <AdminLayout title="Enrollments">
      {isTestMode && isAdminOrManager && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-warning/40 bg-warning/10 text-warning text-xs font-medium">
          Test mode — destructive enrollment actions enabled
        </div>
      )}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) {
            setForm({
              student_id: "", batch_ids: [], payment_mode: "cash",
              subscription_plan_id: "", computed_start: "", computed_end: "",
              start_cycle_name: "", end_cycle_name: "",
              start_cycle_id: null, end_cycle_id: null,
              regular_cycles: 1, grid_cycles: 0,
            });
            setEligibleDropIn(null);
            setDetectedStatus("NEW");
            setLatestEndDate(null);
            setPreviousBatchIds([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />New Enrollment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Enrollment</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {currentCycleClosed && startCycle && (
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm">
                  <p className="text-warning font-medium">Registrations for the current cycle are closed.</p>
                  <p className="text-muted-foreground mt-1">You are being enrolled starting from <span className="font-medium text-foreground">{startCycle.name}</span>.</p>
                </div>
              )}
              <div><Label>Student</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Enrollment Type</Label>
                <div className="mt-1.5">
                  <Badge className={`${statusColors[detectedStatus] || ""} text-sm px-3 py-1`} variant="secondary">
                    {detectedStatus === "NEW" ? "New Enrollment" : detectedStatus === "REN" ? (feeBreakdown.isLateRenewal ? "Renewal (Late)" : "Renewal") : "Revival"}
                  </Badge>
                  {form.student_id && <span className="text-xs text-muted-foreground ml-2">Auto-detected</span>}
                </div>
              </div>
              <div>
                <Label>Subscription Plan (optional)</Label>
                <Select value={form.subscription_plan_id} onValueChange={computeCycleAssignment}>
                  <SelectTrigger><SelectValue placeholder="No plan (manual dates)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No plan</SelectItem>
                    {validPlans.map(p => {
                      const perBatchFee = (p.total_regular_cycles || 0) * 3767 + (p.total_grid_cycles || 0) * 5300;
                      return <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{perBatchFee.toLocaleString("en-IN")}/batch</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {form.computed_start && (
                  <div className="mt-2 p-2 rounded border border-border text-sm">
                    <p className="text-muted-foreground">
                      Validity: <span className="text-foreground font-medium">{form.start_cycle_name}</span> → <span className="text-foreground font-medium">{form.end_cycle_name}</span>
                    </p>
                    <p className="text-muted-foreground">{form.computed_start} to {form.computed_end || "Open"}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Select Batches</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {batches.map((b) => (
                    <Badge key={b.id} variant={form.batch_ids.includes(String(b.id)) ? "default" : "outline"} className={`cursor-pointer ${form.batch_ids.includes(String(b.id)) ? "gradient-primary" : ""}`} onClick={() => toggleBatch(String(b.id))}>{b.name}</Badge>
                  ))}
                </div>
              </div>
              {eligibleDropIn && (
                <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm">
                  <p className="text-success font-medium">Drop-in available for adjustment</p>
                  <p className="text-muted-foreground mt-1">
                    Session: {eligibleDropIn.batch_sessions?.session_date} • Style: {eligibleDropIn.batch_sessions?.style} • Amount: <span className="font-medium text-foreground">₹{Number(eligibleDropIn.amount).toLocaleString()}</span>
                  </p>
                  <p className="text-muted-foreground mt-1">This amount will be deducted from the enrollment fee.</p>
                </div>
              )}
              <div><Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.batch_ids.length > 0 && (
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
                  <p className="font-medium text-foreground mb-2">Fee Breakdown</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Per batch ({form.regular_cycles}R × ₹3,767 + {form.grid_cycles}G × ₹5,300)</span><span>₹{feeBreakdown.perBatchFee.toLocaleString()}</span></div>
                  {feeBreakdown.discountPct > 0 && <div className="flex justify-between text-success"><span>Discount ({Math.round(feeBreakdown.discountPct * 100)}% for {feeBreakdown.batchCount} batches)</span><span>-₹{feeBreakdown.discountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Batch total ({feeBreakdown.batchCount} batch{feeBreakdown.batchCount > 1 ? "es" : ""})</span><span>₹{feeBreakdown.totalBatchFee.toLocaleString()}</span></div>
                  {feeBreakdown.regFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Registration fee ({detectedStatus}{feeBreakdown.isLateRenewal ? " - Late" : ""})</span><span>₹{feeBreakdown.regFee}</span></div>}
                  {feeBreakdown.dropInAdj > 0 && <div className="flex justify-between text-success"><span>Drop-in adjustment</span><span>-₹{feeBreakdown.dropInAdj.toLocaleString()}</span></div>}
                  <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Subtotal</span><span>₹{feeBreakdown.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{feeBreakdown.gst.toLocaleString()}</span></div>
                  <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>₹{feeBreakdown.total.toLocaleString()}</span></div>
                </div>
              )}
              <Button className="w-full gradient-primary" onClick={handleEnroll}>Confirm Enrollment</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={addBatchOpen} onOpenChange={(open) => {
          setAddBatchOpen(open);
          if (!open) { setAddBatchForm({ student_id: "", new_batch_ids: [], payment_mode: "cash" }); setExistingBatches([]); setExistingEnrollment(null); setAddBatchDropIn(null); }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline"><PackagePlus className="h-4 w-4 mr-2" />Add Batch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Batch to Existing Enrollment</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div><Label>Student</Label>
                <Select value={addBatchForm.student_id} onValueChange={(v) => { setAddBatchForm(f => ({ ...f, student_id: v, new_batch_ids: [] })); fetchExistingEnrollments(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {addBatchForm.student_id && existingBatches.length === 0 && (
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm">
                  <p className="text-warning font-medium">No active enrollment found for this student.</p>
                  <p className="text-muted-foreground mt-1">The student must have an active enrollment (or within grace period) to add batches.</p>
                </div>
              )}

              {existingBatches.length > 0 && (
                <>
                  <div>
                    <Label>Current Batches</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {existingBatches.map(eb => (
                        <Badge key={eb.batch_id} variant="secondary" className="opacity-60 cursor-not-allowed">{eb.batch_name}</Badge>
                      ))}
                    </div>
                  </div>

                  {existingEnrollment && (
                    <div className="p-2 rounded border border-border text-sm text-muted-foreground">
                      Enrollment: {existingEnrollment.start_date} → {existingEnrollment.end_date}
                      {existingEnrollment.subscription_plans?.name && ` • ${existingEnrollment.subscription_plans.name}`}
                    </div>
                  )}

                  <div>
                    <Label>Select Additional Batches</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {batches.filter(b => !existingBatches.some(eb => eb.batch_id === b.id)).map(b => (
                        <Badge key={b.id} variant={addBatchForm.new_batch_ids.includes(String(b.id)) ? "default" : "outline"} className={`cursor-pointer ${addBatchForm.new_batch_ids.includes(String(b.id)) ? "gradient-primary" : ""}`} onClick={() => toggleAddBatch(String(b.id))}>{b.name}</Badge>
                      ))}
                    </div>
                  </div>

                  {addBatchDropIn && (
                    <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm">
                      <p className="text-success font-medium">Drop-in available for adjustment</p>
                      <p className="text-muted-foreground mt-1">
                        Session: {addBatchDropIn.batch_sessions?.session_date} • Style: {addBatchDropIn.batch_sessions?.style} • Amount: <span className="font-medium text-foreground">₹{Number(addBatchDropIn.amount).toLocaleString()}</span>
                      </p>
                      <p className="text-muted-foreground mt-1">This amount will be deducted from the fee.</p>
                    </div>
                  )}

                  <div><Label>Payment Mode</Label>
                    <Select value={addBatchForm.payment_mode} onValueChange={(v) => setAddBatchForm(f => ({ ...f, payment_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {addBatchFee && addBatchForm.new_batch_ids.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
                      <p className="font-medium text-foreground mb-2">Fee Breakdown</p>
                      <div className="flex justify-between"><span className="text-muted-foreground">Per batch ({addBatchFee.regularCycles}R × ₹3,220 + {addBatchFee.gridCycles}G × ₹7,000)</span><span>₹{addBatchFee.perBatchFee.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Existing batches</span><span>{existingBatches.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">New batches</span><span>{addBatchFee.newBatchCount}</span></div>
                      {addBatchFee.discountPct > 0 && <div className="flex justify-between text-success"><span>Discount ({Math.round(addBatchFee.discountPct * 100)}% for {addBatchFee.totalBatchCount} total batches)</span><span>-₹{addBatchFee.discountAmount.toLocaleString()}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">New batch total</span><span>₹{addBatchFee.totalNewFee.toLocaleString()}</span></div>
                      {addBatchFee.dropInAdj > 0 && <div className="flex justify-between text-success"><span>Drop-in adjustment</span><span>-₹{addBatchFee.dropInAdj.toLocaleString()}</span></div>}
                      <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Subtotal</span><span>₹{addBatchFee.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{addBatchFee.gst.toLocaleString()}</span></div>
                      <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>₹{addBatchFee.total.toLocaleString()}</span></div>
                    </div>
                  )}

                  <Button className="w-full gradient-primary" onClick={handleAddBatch} disabled={addBatchForm.new_batch_ids.length === 0}>Add Batch{addBatchForm.new_batch_ids.length > 1 ? "es" : ""}</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterStudioId} onValueChange={(v) => { setFilterStudioId(v); setFilterBatchId("all"); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Studios" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Studios</SelectItem>
              {studios.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBatchId} onValueChange={setFilterBatchId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {filteredBatchOptions.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="NEW">NEW</SelectItem>
              <SelectItem value="REN">REN</SelectItem>
              <SelectItem value="REV">REV</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name A–Z</SelectItem>
              <SelectItem value="name_desc">Name Z–A</SelectItem>
              <SelectItem value="end_asc">End date (soonest)</SelectItem>
              <SelectItem value="end_desc">End date (latest)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={validNow ? "default" : "outline"}
            size="sm"
            onClick={() => { setValidNow(v => !v); if (!validNow) setValidMonth(""); }}
          >
            Valid now
          </Button>
          <div className="flex items-center gap-2">
            <Input type="month" value={validMonth} onChange={(e) => { setValidMonth(e.target.value); if (e.target.value) setValidNow(false); }} className="w-[160px]" placeholder="Valid in month" />
            {validMonth && monthCycleCandidates.length > 1 && (
              <Select value={validCycleId ? String(validCycleId) : ""} onValueChange={(v) => setValidCycleId(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Cycle" /></SelectTrigger>
                <SelectContent>
                  {monthCycleCandidates.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {validMonth && <Button variant="ghost" size="sm" onClick={() => setValidMonth("")}>Clear</Button>}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={displayed.length === 0}
            onClick={() => {
              const esc = (v: any) => {
                const s = v === null || v === undefined ? "" : String(v);
                return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
              };
              const headers = ["S.No","Student Name","Phone","Studio","Batch","Batch Code","Type","Plan","Cycles","Start Date","End Date"];
              const lines = [headers.join(",")];
              displayed.forEach((e, i) => {
                lines.push([
                  i + 1,
                  e.students?.name || "",
                  e.students ? getDisplayPhone(e.students) : "",
                  e.batches?.studios?.name || "",
                  e.batches?.name || "",
                  e.batches?.batch_code || "",
                  `${e.status_type || ""}${e.late_renewal ? " (Late)" : ""}`,
                  e.subscription_plans?.name || "",
                  e.start_cycle && e.end_cycle ? `${e.start_cycle.name} → ${e.end_cycle.name}` : "",
                  e.start_date || "",
                  e.end_date || "",
                ].map(esc).join(","));
              });
              const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `enrollments-${todayIST()}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
        {validNow && (
          <p className="text-sm text-muted-foreground">Currently valid — {displayed.length} enrollment{displayed.length !== 1 ? "s" : ""}</p>
        )}
        {validMonth && (
          <p className="text-sm text-muted-foreground">
            Valid students for {monthLabel}
            {validCycleId && monthCycleCandidates.length > 0 && (
              <> · {monthCycleCandidates.find(c => c.id === validCycleId)?.name}</>
            )}
            {" — "}
            {validLoading ? "loading…" : `${displayed.length} enrollment${displayed.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="hidden sm:table-cell">Batch Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <TableHead className="hidden md:table-cell">Cycles</TableHead>
                <TableHead className="hidden md:table-cell">Studio</TableHead>
                <TableHead className="hidden md:table-cell">Start</TableHead>
                <TableHead className="hidden md:table-cell">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((e, idx) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{idx + 1}</span>
                      {isAdminOrManager && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Row actions (Application Case)" aria-label="Row actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {pendingCases[e.id] ? (
                              <DropdownMenuItem disabled>
                                <FileWarning className="h-4 w-4 mr-2" />
                                Pending Case (awaiting approval)
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => { setCaseEnrollment(e); setCaseReason(""); setCaseDialogOpen(true); }}
                              >
                                <FileWarning className="h-4 w-4 mr-2" />
                                Request Application Case
                              </DropdownMenuItem>
                            )}
                            {isTestMode && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => { setEditValidityFor(e); setEditValidityDate(e.end_date || ""); setEditValidityCycleId(e.end_cycle_id ? String(e.end_cycle_id) : ""); setValidityMode(e.end_cycle_id ? "cycle" : "date"); }}
                                >
                                  <CalendarCog className="h-4 w-4 mr-2" />
                                  Edit Validity
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => { setChangeBatchFor(e); setChangeBatchToId(""); }}
                                >
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  Change Batch
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteFor(e)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Enrollment
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{e.students?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.students ? getDisplayPhone(e.students) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.batches?.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground font-mono text-xs">{e.batches?.batch_code || "—"}</TableCell>
                  <TableCell><Badge className={statusColors[e.status_type] || ""} variant="secondary">{e.status_type}{e.late_renewal ? " (Late)" : ""}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.subscription_plans?.name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {e.start_cycle && e.end_cycle ? `${e.start_cycle.name} → ${e.end_cycle.name}` : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {e.batches?.studios?.name || "—"}
                    {e.batches?.studios?.code && <span className="text-xs ml-1 opacity-60">({e.batches.studios.code})</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.start_date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.end_date}</TableCell>
                </TableRow>
              ))}
              {displayed.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No enrollments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Application Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {caseEnrollment && (
              <div className="p-3 rounded border border-border text-sm space-y-1">
                <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{caseEnrollment.students?.name}</span></p>
                <p><span className="text-muted-foreground">Batch:</span> {caseEnrollment.batches?.name}</p>
                <p><span className="text-muted-foreground">Validity:</span> {caseEnrollment.start_date} → {caseEnrollment.end_date}</p>
              </div>
            )}
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={caseReason}
                onChange={(e) => setCaseReason(e.target.value)}
                placeholder="e.g. Validity shifted to next month due to studio closure"
                rows={3}
                className="mt-1.5"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              An admin will review and approve. Once approved, this enrollment will be removed from the active list.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCaseDialogOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={requestApplicationCase}>Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editValidityFor} onOpenChange={(o) => { if (!o) { setEditValidityFor(null); setEditValidityDate(""); setEditValidityCycleId(""); setValidityMode("cycle"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Validity</DialogTitle></DialogHeader>
          {editValidityFor && (
            <div className="space-y-3">
              <div className="p-3 rounded border border-border text-sm space-y-1">
                <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{editValidityFor.students?.name}</span></p>
                <p><span className="text-muted-foreground">Batch:</span> {editValidityFor.batches?.name}</p>
                <p>
                  <span className="text-muted-foreground">Current end:</span> {editValidityFor.end_date}
                  {editValidityFor.end_cycle?.name && <span className="text-muted-foreground"> · {editValidityFor.end_cycle.name}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={validityMode === "cycle" ? "default" : "outline"} onClick={() => setValidityMode("cycle")}>By Cycle</Button>
                <Button type="button" size="sm" variant={validityMode === "date" ? "default" : "outline"} onClick={() => setValidityMode("date")}>By Date</Button>
              </div>
              {validityMode === "cycle" ? (
                <div>
                  <Label>End cycle</Label>
                  <Select value={editValidityCycleId} onValueChange={setEditValidityCycleId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a cycle" /></SelectTrigger>
                    <SelectContent>
                      {planCycles.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} — {c.start_date} → {c.end_date}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>New end date</Label>
                  <Input type="date" value={editValidityDate} onChange={(e) => setEditValidityDate(e.target.value)} className="mt-1.5" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditValidityFor(null); setEditValidityDate(""); setEditValidityCycleId(""); setValidityMode("cycle"); }}>Cancel</Button>
            <Button className="gradient-primary" onClick={handleSaveValidity} disabled={validityMode === "cycle" ? !editValidityCycleId : !editValidityDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFor} onOpenChange={(o) => { if (!o) setDeleteFor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFor && (
                <>This will permanently delete the enrollment for <span className="font-medium">{deleteFor.students?.name}</span> in <span className="font-medium">{deleteFor.batches?.name}</span>, along with its cycle records and payment allocation. The payment record itself is kept. This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteEnrollment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!overlapWarning} onOpenChange={(o) => { if (!o) setOverlapWarning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overlapping enrollment</AlertDialogTitle>
            <AlertDialogDescription>{overlapWarning?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => overlapWarning?.onConfirm()}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={!!changeBatchFor} onOpenChange={(o) => { if (!o) { setChangeBatchFor(null); setChangeBatchToId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change Batch</DialogTitle></DialogHeader>
          {changeBatchFor && (
            <div className="space-y-3">
              <div className="p-3 rounded border border-border text-sm space-y-1">
                <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{changeBatchFor.students?.name}</span></p>
                <p>
                  <span className="text-muted-foreground">From:</span>{" "}
                  {changeBatchFor.batches?.name}
                  {changeBatchFor.batches?.batch_code && <span className="font-mono text-xs ml-1 opacity-60">({changeBatchFor.batches.batch_code})</span>}
                </p>
                <p><span className="text-muted-foreground">Validity:</span> {changeBatchFor.start_date} → {changeBatchFor.end_date}</p>
              </div>
              <div>
                <Label>Move to batch</Label>
                <Select value={changeBatchToId} onValueChange={setChangeBatchToId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a batch" /></SelectTrigger>
                  <SelectContent>
                    {batches
                      .filter(b => b.id !== changeBatchFor.batch_id)
                      .map(b => {
                        const studio = studios.find(s => s.id === b.studio_id);
                        return (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                            {b.batch_code && ` · ${b.batch_code}`}
                            {studio?.name && ` — ${studio.name}`}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Validity dates, payment, and payment allocations are kept as-is. Only the enrollment's batch and its cycle records are updated.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeBatchFor(null); setChangeBatchToId(""); }}>Cancel</Button>
            <Button className="gradient-primary" onClick={handleChangeBatch} disabled={!changeBatchToId}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default EnrollmentsPage;
