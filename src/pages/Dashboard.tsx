import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { nowIST, todayIST, toISTDateString } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, ChevronDown, CalendarIcon, ClipboardCopy, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useScopedStudents } from "@/hooks/useScopedStudents";
import BatchDetailsPopup from "@/components/dashboard/BatchDetailsPopup";
import { useLongPress } from "@/hooks/useLongPress";
import { filterEnrollmentsByCycle } from "@/lib/cycleUtils";
import { getDisplayPhone } from "@/lib/studentUtils";
import { toast } from "sonner";
import { useTestDate } from "@/contexts/TestDateContext";

interface Studio { id: number; name: string; code: string | null; }
interface Batch { id: number; name: string; batch_code: string | null; studio_id: number | null; capacity: number | null; style_base: string | null; level: string | null; }

const STYLE_RANK: Record<string, number> = { Jazz: 1, Ballet: 2, Modern: 3, "Hip Hop": 4, Heels: 5 };
const LEVEL_RANK: Record<string, number> = { Kids: 0, "Level 1": 1, "Level 2": 2, "Level 3": 3, "Level 4": 4, "Level 5": 5, "Kids Level 2": 6 };
function batchSortRank(b: { style_base?: string | null; level?: string | null }) {
  const lvl = b.level || "";
  const isKids = lvl.startsWith("Kids");
  return {
    group: isKids ? 0 : 1,
    style: STYLE_RANK[b.style_base || ""] ?? 99,
    level: LEVEL_RANK[lvl] ?? 99,
  };
}
function compareBatches(a: { style_base?: string | null; level?: string | null; name: string }, b: { style_base?: string | null; level?: string | null; name: string }) {
  const ra = batchSortRank(a), rb = batchSortRank(b);
  return ra.group - rb.group || ra.style - rb.style || ra.level - rb.level || a.name.localeCompare(b.name);
}

function getIstDayBounds(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getIstRangeBounds(startDate: string, endDate: string): { start: string; end: string } {
  const start = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T00:00:00+05:30`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function cleanSheetCell(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function formatSheetDate(date: string | null | undefined): string {
  if (!date) return "";
  const dateOnly = date.includes("T") ? toISTDateString(date) : date;
  const [year, month, day] = dateOnly.split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateOnly;
}

function getBusinessDate(row?: { business_date?: string | null; created_at?: string | null } | null): string {
  if (row?.business_date) return row.business_date;
  return row?.created_at ? toISTDateString(row.created_at) : "";
}

function dateStringToPickerDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function pickerDateToDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSheetValidity(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate && !endDate) return "";
  if (!endDate) return formatSheetDate(startDate);
  if (!startDate) return formatSheetDate(endDate);
  return `${formatSheetDate(startDate)} - ${formatSheetDate(endDate)}`;
}

function getModeLabel(mode: string | null | undefined): string {
  const normalized = (mode || "").toLowerCase();
  if (normalized === "razorpay") return "Razorpay";
  if (normalized === "cash") return "Cash";
  return mode || "";
}

function getOnlineOffline(mode: string | null | undefined): string {
  const normalized = (mode || "").toLowerCase();
  if (normalized === "razorpay") return "Online";
  if (normalized === "cash") return "Offline";
  return "";
}

type PagedQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Error | { message: string } | null }>;
};

async function fetchAll<T>(queryFactory: () => PagedQuery<T>): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFactory().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
interface Enrollment {
  id: number; student_id: number; batch_id: number; status_type: string;
  start_date: string; end_date: string; payment_id: number | null;
  created_at: string; start_cycle_id: number | null; end_cycle_id: number | null;
  previous_batch_id: number | null;
}
interface ClassifiedEnrollment extends Enrollment {
  displayStatus: string;
  isShiftedRenewal: boolean;
  renewalBatchId: number;
}
interface Payment {
  id: number; amount: number; gst: number | null; final_amount: number | null;
  payment_mode: string | null; created_at: string; business_date: string | null;
}
interface PaymentAllocation {
  payment_id: number; batch_id: number; studio_id: number | null;
  allocated_amount: number; is_primary: boolean;
}
interface DropIn {
  id: number; amount: number; is_adjusted: boolean; payment_id: number | null; created_at: string;
  adjusted_payment_id: number | null; adjusted_amount: number | null;
}
interface PlanCycle {
  id: number; name: string; start_date: string; end_date: string | null;
  is_active: boolean; grace_days: number; plan_type: string;
}
interface RenewableEnrollment {
  student_id: number;
  batch_id: number;
}
type BatchDetailFilter = "total" | "C/F" | "NEW" | "REV" | "REN" | "RENEWABLE";

const ACCENT = "#ff007f";

const Dashboard = () => {
  const scope = useScopedStudents();
  const { isTestMode, simulatedDate, setSimulatedDate } = useTestDate();
  const { loading: scopeLoading, unrestricted: scopeUnrestricted, batchIds: scopeBatchIds, studioIds: scopeStudioIds } = scope;
  const [studios, setStudios] = useState<Studio[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<string>("all");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>([]);
  const [dropIns, setDropIns] = useState<DropIn[]>([]);
  const [dropInPayments, setDropInPayments] = useState<Payment[]>([]);
  const [allCycles, setAllCycles] = useState<PlanCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [renewableCount, setRenewableCount] = useState(0);
  const [renewableRows, setRenewableRows] = useState<RenewableEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  // Expandable states
  const [totalOpen, setTotalOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [renOpen, setRenOpen] = useState(false);
  const [cfOpen, setCfOpen] = useState(false);
  const [renDreamsOpen, setRenDreamsOpen] = useState(false);
  const [headCountOpen, setHeadCountOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(nowIST());
  const [copyStartDate, setCopyStartDate] = useState(format(nowIST(), "yyyy-MM-dd"));
  const [copyEndDate, setCopyEndDate] = useState(format(nowIST(), "yyyy-MM-dd"));
  const [missedThreshold, setMissedThreshold] = useState(3);
  const [attendanceRecords, setAttendanceRecords] = useState<{ student_id: number; batch_id: number }[]>([]);
  const [studentNames, setStudentNames] = useState<Map<number, { name: string; phone: string | null }>>(new Map());
  const [selectedBatch, setSelectedBatch] = useState<{ id: number; name: string; filter: BatchDetailFilter } | null>(null);
  const [copyingSheet, setCopyingSheet] = useState<"registrations" | "dropIns" | "dateWise" | null>(null);
  const simulatedPickerDate = simulatedDate ? dateStringToPickerDate(simulatedDate) : undefined;

  const selectCycleForDate = (date: string) => {
    const matchingCycle = allCycles.find((cycle) =>
      cycle.start_date <= date && (cycle.end_date || "2099-12-31") >= date
    );
    if (matchingCycle) setSelectedCycleId(String(matchingCycle.id));
  };

  useEffect(() => {
    if (scopeLoading) return;
    const init = async () => {
      const [studioRes, cycleRes] = await Promise.all([
        supabase.from("studios").select("id, name, code").eq("organization_id", 1).order("name"),
        supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date", { ascending: false }),
      ]);
      const studioList = (studioRes.data || []) as Studio[];
      const visibleStudios = scopeUnrestricted
        ? studioList
        : studioList.filter(s => scopeStudioIds.includes(s.id));
      setStudios(visibleStudios);
      setSelectedStudio(prev => {
        if (prev === "all") return prev;
        return visibleStudios.some(s => String(s.id) === prev) ? prev : "all";
      });
      const cycles = (cycleRes.data || []) as PlanCycle[];
      setAllCycles(cycles);
      const active = cycles.find(c => c.is_active);
      setSelectedCycleId(prev => prev || (active ? String(active.id) : cycles.length > 0 ? String(cycles[0].id) : ""));
    };
    init();
  }, [scopeLoading, scopeUnrestricted, scopeStudioIds]);

  const selectedCycle = useMemo(() => allCycles.find(c => String(c.id) === selectedCycleId) || null, [allCycles, selectedCycleId]);
  const visibleBatchIds = useMemo(() => new Set(batches.map(b => b.id)), [batches]);

  useEffect(() => {
    if (!isTestMode || !simulatedDate) return;
    setSelectedDate(dateStringToPickerDate(simulatedDate));
    selectCycleForDate(simulatedDate);
  }, [isTestMode, simulatedDate, allCycles]);

  useEffect(() => {
    if (!selectedCycle) return;
    setCopyStartDate(selectedCycle.start_date);
    setCopyEndDate(selectedCycle.end_date || selectedCycle.start_date);
  }, [selectedCycle?.id]);

  useEffect(() => {
    if (!selectedCycle || scopeLoading) return;
    const fetchData = async () => {
      setLoading(true);
      let batchQuery = supabase.from("batches").select("id, name, batch_code, studio_id, capacity, style_base, level").eq("organization_id", 1);
      if (selectedStudio !== "all") {
        batchQuery = batchQuery.eq("studio_id", parseInt(selectedStudio));
      }
      if (!scopeUnrestricted) {
        if (scopeBatchIds.length === 0) {
          setBatches([]); setEnrollments([]); setPayments([]); setPaymentAllocations([]); setDropIns([]); setDropInPayments([]);
          setRenewableRows([]); setRenewableCount(0); setLoading(false); return;
        }
        batchQuery = batchQuery.in("id", scopeBatchIds);
      }
      const batchRes = await batchQuery;
      const batchList = (batchRes.data || []) as Batch[];
      setBatches(batchList);
      const batchIds = batchList.map(b => b.id);

      if (batchIds.length === 0) {
        setEnrollments([]); setPayments([]); setPaymentAllocations([]); setDropIns([]); setDropInPayments([]);
        setRenewableRows([]); setRenewableCount(0); setLoading(false);
        return;
      }

      const batchIdList = batchIds.join(",");
      const enrollRaw = await fetchAll<Enrollment>(() =>
        supabase.from("enrollments")
          .select("id, student_id, batch_id, status_type, start_date, end_date, payment_id, created_at, start_cycle_id, end_cycle_id, previous_batch_id")
          .eq("organization_id", 1)
          .eq("is_active", true)
          .or(`batch_id.in.(${batchIdList}),previous_batch_id.in.(${batchIdList})`)
          .gte("end_date", selectedCycle.start_date)
          .lte("start_date", selectedCycle.end_date || "2099-12-31")
      );

      // Filter to enrollments that actually own selectedCycle (via enrollment_cycles + cycle_adjustments).
      // Date-window overlap incorrectly includes e.g. Regular-only plans spanning a Grid cycle.
      let enrollList: Enrollment[] = enrollRaw;
      if (enrollRaw.length > 0) {
        const validIds = await filterEnrollmentsByCycle(enrollRaw, selectedCycle.id);
        enrollList = enrollRaw.filter(e => validIds.has(e.id));
      }

      setEnrollments(enrollList);

      const paymentIds = [...new Set(enrollList.map(e => e.payment_id).filter(Boolean) as number[])];
      const enrolledBatchIds = [...new Set(enrollList.map(e => e.batch_id))];
      if (paymentIds.length > 0) {
        const payRes = await supabase.from("payments").select("id, amount, gst, final_amount, payment_mode, created_at, business_date").in("id", paymentIds);
        setPayments((payRes.data || []) as Payment[]);
        const allocationRes = await supabase
          .from("payment_allocations")
          .select("payment_id, batch_id, studio_id, allocated_amount, is_primary")
          .in("payment_id", paymentIds)
          .in("batch_id", enrolledBatchIds);
        setPaymentAllocations((allocationRes.data || []) as PaymentAllocation[]);
      } else {
        setPayments([]);
        setPaymentAllocations([]);
      }

      const sessionRes = await supabase
        .from("batch_sessions").select("id").eq("organization_id", 1)
        .in("batch_id", batchIds)
        .gte("session_date", selectedCycle.start_date)
        .lte("session_date", selectedCycle.end_date || "2099-12-31");
      const sessionIds = (sessionRes.data || []).map(s => s.id);

      if (sessionIds.length > 0) {
        const diRes = await supabase.from("drop_ins")
          .select("id, amount, is_adjusted, payment_id, adjusted_payment_id, adjusted_amount, created_at")
          .eq("organization_id", 1).in("batch_session_id", sessionIds);
        const diList = (diRes.data || []) as DropIn[];
        setDropIns(diList);
        const diPayIds = diList.map(d => d.payment_id).filter(Boolean) as number[];
        if (diPayIds.length > 0) {
          const diPayRes = await supabase.from("payments").select("id, amount, gst, final_amount, payment_mode, created_at, business_date").in("id", diPayIds);
          setDropInPayments((diPayRes.data || []) as Payment[]);
        } else { setDropInPayments([]); }
      } else {
        setDropIns([]); setDropInPayments([]);
      }

      const graceDate = new Date(selectedCycle.start_date);
      graceDate.setDate(graceDate.getDate() - 1);
      const graceLookback = new Date(graceDate);
      graceLookback.setDate(graceLookback.getDate() - (selectedCycle.grace_days || 14));

      let renewableQuery = supabase.from("enrollments").select("student_id, batch_id")
        .eq("organization_id", 1)
        .gte("end_date", graceLookback.toISOString().split("T")[0])
        .lt("end_date", selectedCycle.start_date);
      if (batchIds.length > 0) {
        renewableQuery = renewableQuery.in("batch_id", batchIds);
      }
      const renewableRes = await renewableQuery;
      const renewableMap = new Map<string, RenewableEnrollment>();
      (renewableRes.data || []).forEach((r) => {
        if (!r.student_id || !r.batch_id) return;
        renewableMap.set(`${r.student_id}-${r.batch_id}`, { student_id: r.student_id, batch_id: r.batch_id });
      });
      const dedupedRenewables = Array.from(renewableMap.values());
      setRenewableRows(dedupedRenewables);
      setRenewableCount(dedupedRenewables.length);

      // Fetch attendance absences within selected cycle
      const absences = await fetchAll<{ student_id: number; batch_id: number }>(() =>
        supabase.from("attendance")
          .select("student_id, batch_id")
          .eq("organization_id", 1)
          .eq("status", "absent")
          .gte("date", selectedCycle.start_date)
          .lte("date", selectedCycle.end_date || "2099-12-31")
      );
      
      const filteredAbsences = absences.filter(a => batchIds.includes(a.batch_id));
      setAttendanceRecords(filteredAbsences);

      // Fetch student names for absent students
      const absentStudentIds = [...new Set(filteredAbsences.map(a => a.student_id))];
      if (absentStudentIds.length > 0) {
        const studRes = await supabase.from("students").select("id, name, phone").in("id", absentStudentIds);
        const nameMap = new Map<number, { name: string; phone: string | null }>();
        (studRes.data || []).forEach((s) => nameMap.set(s.id, { name: s.name, phone: s.phone }));
        setStudentNames(nameMap);
      } else {
        setStudentNames(new Map());
      }

      setLoading(false);
    };
    fetchData();
  }, [selectedCycle, selectedStudio, scopeLoading, scopeUnrestricted, scopeBatchIds]);

  // Classify enrollments: C/F (carry forward from prior cycle) vs current-cycle
  const classifiedEnrollments = useMemo<ClassifiedEnrollment[]>(() => {
    if (!selectedCycle) {
      return enrollments.map(e => ({
        ...e,
        displayStatus: e.status_type,
        isShiftedRenewal: e.status_type === "REN" && !!e.previous_batch_id && e.previous_batch_id !== e.batch_id,
        renewalBatchId: e.status_type === "REN" ? (e.previous_batch_id || e.batch_id) : e.batch_id,
      }));
    }
    return enrollments.map(e => {
      const isCarryForward = e.start_cycle_id
        ? e.start_cycle_id < selectedCycle.id
        : e.created_at < selectedCycle.start_date;
      return {
        ...e,
        displayStatus: isCarryForward ? "C/F" : e.status_type,
        isShiftedRenewal: e.status_type === "REN" && !!e.previous_batch_id && e.previous_batch_id !== e.batch_id,
        renewalBatchId: e.status_type === "REN" ? (e.previous_batch_id || e.batch_id) : e.batch_id,
      };
    });
  }, [enrollments, selectedCycle]);

  const totalDreams = classifiedEnrollments.length;
  const headCount = new Set(classifiedEnrollments.map(e => e.student_id)).size;
  const cfDreams = classifiedEnrollments.filter(e => e.displayStatus === "C/F").length;
  const newDreams = classifiedEnrollments.filter(e => e.displayStatus === "NEW").length;
  const revDreams = classifiedEnrollments.filter(e => e.displayStatus === "REV").length;
  const renDreams = classifiedEnrollments.filter(e => e.displayStatus === "REN").length;
  const renRate = renewableCount > 0 ? Math.round((renDreams / renewableCount) * 100) : 0;

  // Batch-wise data (total + per status)
  const batchData = useMemo(() => {
    const totalMap = new Map<number, number>();
    const cfMap = new Map<number, number>();
    const newMap = new Map<number, number>();
    const revMap = new Map<number, number>();
    const renMap = new Map<number, number>();
    classifiedEnrollments.forEach(e => {
      totalMap.set(e.batch_id, (totalMap.get(e.batch_id) || 0) + 1);
      if (e.displayStatus === "C/F") cfMap.set(e.batch_id, (cfMap.get(e.batch_id) || 0) + 1);
      if (e.displayStatus === "NEW") newMap.set(e.batch_id, (newMap.get(e.batch_id) || 0) + 1);
      if (e.displayStatus === "REV") revMap.set(e.batch_id, (revMap.get(e.batch_id) || 0) + 1);
      if (e.displayStatus === "REN") {
        renMap.set(e.renewalBatchId, (renMap.get(e.renewalBatchId) || 0) + 1);
      }
    });
    return batches
      .map(b => ({
        id: b.id, name: b.batch_code || b.name, capacity: b.capacity || 35,
        style_base: b.style_base, level: b.level,
        total: totalMap.get(b.id) || 0,
        "C/F": cfMap.get(b.id) || 0,
        NEW: newMap.get(b.id) || 0,
        REV: revMap.get(b.id) || 0,
        REN: renMap.get(b.id) || 0,
      }))
      .filter(b => b.total > 0 || b["C/F"] > 0 || b.NEW > 0 || b.REV > 0 || b.REN > 0)
      .sort(compareBatches);
  }, [classifiedEnrollments, batches]);

  const renewableBatchData = useMemo(() => {
    const batchStudents = new Map<number, Set<number>>();
    renewableRows.forEach(r => {
      if (!batchStudents.has(r.batch_id)) batchStudents.set(r.batch_id, new Set());
      batchStudents.get(r.batch_id)!.add(r.student_id);
    });
    return batches
      .map(b => ({
        id: b.id,
        name: b.batch_code || b.name,
        capacity: b.capacity || 35,
        style_base: b.style_base,
        level: b.level,
        renewable: batchStudents.get(b.id)?.size || 0,
      }))
      .filter(b => b.renewable > 0)
      .sort(compareBatches);
  }, [renewableRows, batches]);

  // Head count: unique students per batch
  const headCountData = useMemo(() => {
    const batchStudents = new Map<number, Set<number>>();
    classifiedEnrollments.forEach(e => {
      if (!batchStudents.has(e.batch_id)) batchStudents.set(e.batch_id, new Set());
      batchStudents.get(e.batch_id)!.add(e.student_id);
    });
    return batches
      .map(b => ({
        id: b.id,
        name: b.batch_code || b.name,
        style_base: b.style_base, level: b.level,
        count: batchStudents.get(b.id)?.size || 0,
      }))
      .filter(b => b.count > 0)
      .sort(compareBatches);
  }, [classifiedEnrollments, batches]);

  const paymentMap = useMemo(() => {
    const m = new Map<number, Payment>();
    payments.forEach(p => m.set(p.id, p));
    dropInPayments.forEach(p => m.set(p.id, p));
    return m;
  }, [payments, dropInPayments]);

  const adjustedDropInByPayment = useMemo(() => {
    const m = new Map<number, { total: number; gst: number }>();
    dropIns.forEach(d => {
      if (!d.is_adjusted || !d.adjusted_payment_id) return;
      const dropInPayment = d.payment_id ? paymentMap.get(d.payment_id) : null;
      const total = Number(d.adjusted_amount || dropInPayment?.final_amount || d.amount || 0);
      if (total <= 0) return;
      const gst = Number(dropInPayment?.gst || Math.round(total - (total / 1.18)));
      const current = m.get(d.adjusted_payment_id) || { total: 0, gst: 0 };
      m.set(d.adjusted_payment_id, { total: current.total + total, gst: current.gst + gst });
    });
    return m;
  }, [dropIns, paymentMap]);

  // Date-wise breakdown
  const dateWise = useMemo(() => {
    const map = new Map<string, {
      date: string; NEW: number; REN: number; REV: number; dropIn: number; diAdjusted: number;
      gross: number; gst: number; total: number; cash: number; razorpay: number;
    }>();
    const getOrCreate = (date: string) => {
      if (!map.has(date)) map.set(date, { date, NEW: 0, REN: 0, REV: 0, dropIn: 0, diAdjusted: 0, gross: 0, gst: 0, total: 0, cash: 0, razorpay: 0 });
      return map.get(date)!;
    };
    classifiedEnrollments.forEach(e => {
      if (e.displayStatus === "C/F") return; // C/F enrollments don't appear in date-wise
      const date = getBusinessDate(paymentMap.get(e.payment_id || 0)) || toISTDateString(e.created_at);
      const row = getOrCreate(date);
      if (e.displayStatus === "NEW") row.NEW++;
      else if (e.displayStatus === "REN") row.REN++;
      else if (e.displayStatus === "REV") row.REV++;
    });
    const revenueEnrollments = classifiedEnrollments.filter(e => visibleBatchIds.has(e.batch_id));
    const countedPaymentIds = new Set(
      revenueEnrollments
        .filter(e => e.displayStatus !== "C/F" && e.payment_id)
        .map(e => e.payment_id as number)
    );
    const allocatedPaymentIds = new Set<number>();
    paymentAllocations.forEach(allocation => {
      if (!countedPaymentIds.has(allocation.payment_id)) return;
      const payment = paymentMap.get(allocation.payment_id);
      if (!payment) return;
      const allocatedTotal = Number(allocation.allocated_amount || 0);
      if (allocatedTotal <= 0) return;
      const adjustment = adjustedDropInByPayment.get(allocation.payment_id);
      const collectedAmount = Number(payment.final_amount || payment.amount || 0);
      const reportedFinalAmount = collectedAmount + Number(adjustment?.total || 0);
      const reportedGst = Number(payment.gst || 0) + Number(adjustment?.gst || 0);
      const reportedAllocatedTotal = collectedAmount > 0 && reportedFinalAmount > collectedAmount
        ? Math.round((allocatedTotal / collectedAmount) * reportedFinalAmount)
        : allocatedTotal;
      const allocatedGst = reportedFinalAmount > 0 ? Math.round((reportedGst / reportedFinalAmount) * reportedAllocatedTotal) : 0;
      const date = getBusinessDate(payment);
      const row = getOrCreate(date);
      row.gross += reportedAllocatedTotal - allocatedGst;
      row.gst += allocatedGst;
      row.total += reportedAllocatedTotal;
      const mode = (payment.payment_mode || "").toLowerCase();
      if (mode === "cash") row.cash += reportedAllocatedTotal;
      else if (mode === "razorpay") row.razorpay += reportedAllocatedTotal;
      allocatedPaymentIds.add(allocation.payment_id);
    });
    countedPaymentIds.forEach(paymentId => {
      if (allocatedPaymentIds.has(paymentId)) return;
      const payment = paymentMap.get(paymentId);
      if (!payment) return;
      const date = getBusinessDate(payment);
      const row = getOrCreate(date);
      const adjustment = adjustedDropInByPayment.get(paymentId);
      const total = Number(payment.final_amount || payment.amount || 0) + Number(adjustment?.total || 0);
      const gst = Number(payment.gst || 0) + Number(adjustment?.gst || 0);
      row.gross += Math.max(0, total - gst);
      row.gst += gst;
      row.total += total;
      const mode = (payment.payment_mode || "").toLowerCase();
      if (mode === "cash") row.cash += total;
      else if (mode === "razorpay") row.razorpay += total;
    });
    dropIns.forEach(d => {
      const p = d.payment_id ? paymentMap.get(d.payment_id) : null;
      const date = getBusinessDate(p) || toISTDateString(d.created_at);
      const row = getOrCreate(date);
      row.dropIn++;
      if (d.is_adjusted) row.diAdjusted++;
      if ((!d.is_adjusted || !d.adjusted_payment_id) && d.payment_id) {
        if (p) {
          row.gross += Number(p.amount) || 0;
          row.gst += Number(p.gst) || 0;
          row.total += Number(p.final_amount) || 0;
          const mode = (p.payment_mode || "").toLowerCase();
          if (mode === "cash") row.cash += Number(p.final_amount) || 0;
          else if (mode === "razorpay") row.razorpay += Number(p.final_amount) || 0;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [adjustedDropInByPayment, classifiedEnrollments, dropIns, paymentAllocations, paymentMap, visibleBatchIds]);

  const dateTotals = useMemo(() => {
    return dateWise.reduce((acc, r) => ({
      NEW: acc.NEW + r.NEW, REN: acc.REN + r.REN, REV: acc.REV + r.REV,
      dropIn: acc.dropIn + r.dropIn, diAdjusted: acc.diAdjusted + r.diAdjusted,
      gross: acc.gross + r.gross, gst: acc.gst + r.gst, total: acc.total + r.total,
      cash: acc.cash + r.cash, razorpay: acc.razorpay + r.razorpay,
    }), { NEW: 0, REN: 0, REV: 0, dropIn: 0, diAdjusted: 0, gross: 0, gst: 0, total: 0, cash: 0, razorpay: 0 });
  }, [dateWise]);

  // Attendance report: group by student+batch, count absences
  const attendanceReport = useMemo(() => {
    const map = new Map<string, { student_id: number; batch_id: number; count: number }>();
    attendanceRecords.forEach(a => {
      const key = `${a.student_id}-${a.batch_id}`;
      if (!map.has(key)) map.set(key, { student_id: a.student_id, batch_id: a.batch_id, count: 0 });
      map.get(key)!.count++;
    });
    return Array.from(map.values())
      .filter(r => r.count >= missedThreshold)
      .sort((a, b) => b.count - a.count);
  }, [attendanceRecords, missedThreshold]);

  const totalDropIns = dropIns.length;
  const totalDiAdjusted = dropIns.filter(d => d.is_adjusted).length;

  const fmt = (n: number) => n.toLocaleString("en-IN");

  const ClickableBatchRow = ({
    children, batchId, batchName, filter,
  }: { children: React.ReactNode; batchId: number; batchName: string; filter: BatchDetailFilter }) => {
    const handlers = useLongPress({
      onLongPress: () => setSelectedBatch({ id: batchId, name: batchName, filter }),
      onClick: () => setSelectedBatch({ id: batchId, name: batchName, filter }),
    });
    return (
      <TableRow
        {...handlers}
        className="cursor-pointer select-none hover:bg-accent/40 transition-colors"
      >
        {children}
      </TableRow>
    );
  };

  const BatchTable = ({ data, valueKey }: { data: typeof batchData; valueKey: "total" | "C/F" | "NEW" | "REV" | "REN" }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
          <TableHead className="w-[160px]">Fill</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.filter(b => b[valueKey] > 0).map(b => {
          const pct = Math.min(Math.round((b[valueKey] / b.capacity) * 100), 100);
          return (
            <ClickableBatchRow key={b.id} batchId={b.id} batchName={b.name} filter={valueKey}>
              <TableCell className="font-medium text-xs">{b.name}</TableCell>
              <TableCell className="text-right text-xs">{b[valueKey]}</TableCell>
              <TableCell className="text-right text-xs">{b.capacity}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              </TableCell>
            </ClickableBatchRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const RenewableBatchTable = ({ data }: { data: typeof renewableBatchData }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead className="text-right">Renewable</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
          <TableHead className="w-[160px]">Pool</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">
              No renewable students for this cycle and studio.
            </TableCell>
          </TableRow>
        ) : data.map(b => {
          const pct = Math.min(Math.round((b.renewable / b.capacity) * 100), 100);
          return (
            <ClickableBatchRow key={b.id} batchId={b.id} batchName={b.name} filter="RENEWABLE">
              <TableCell className="font-medium text-xs">{b.name}</TableCell>
              <TableCell className="text-right text-xs">{b.renewable}</TableCell>
              <TableCell className="text-right text-xs">{b.capacity}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              </TableCell>
            </ClickableBatchRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const ExpandableCard = ({
    title, value, subtitle, open, onOpenChange, children, highlight = false,
  }: {
    title: string; value: string | number; subtitle?: string;
    open: boolean; onOpenChange: (v: boolean) => void;
    children: React.ReactNode; highlight?: boolean;
  }) => (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="glass-card">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-bold" style={highlight ? { color: ACCENT } : undefined}>{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 border-t border-border">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  const SimpleCard = ({ title, value, subtitle, highlight = false }: {
    title: string; value: string | number; subtitle?: string; highlight?: boolean;
  }) => (
    <Card className="glass-card">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold" style={highlight ? { color: ACCENT } : undefined}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  const popupEnrollments = useMemo(() => {
    if (!selectedBatch) return [];
    if (selectedBatch.filter === "RENEWABLE") {
      return renewableRows
        .filter(r => r.batch_id === selectedBatch.id)
        .map(r => ({ student_id: r.student_id, displayStatus: "RENEWABLE" }));
    }
    return classifiedEnrollments
      .filter(e => {
        if (selectedBatch.filter === "REN") {
          return e.renewalBatchId === selectedBatch.id;
        }
        return e.batch_id === selectedBatch.id;
      })
      .filter(e => selectedBatch.filter === "total" || e.displayStatus === selectedBatch.filter)
      .map(e => ({
        student_id: e.student_id,
        displayStatus: e.displayStatus,
        isShiftedRenewal: e.isShiftedRenewal,
      }));
  }, [classifiedEnrollments, renewableRows, selectedBatch]);

  const fetchPaidToNames = async (paymentsForCopy: any[]) => {
    const staffIds = [...new Set(
      paymentsForCopy
        .map((p: any) => p?.confirmed_by_staff_id)
        .filter((id: any) => id !== null && id !== undefined)
    )] as number[];
    if (staffIds.length === 0) return new Map<number, string>();
    const { data } = await supabase.from("users").select("id, name").in("id", staffIds);
    const nameMap = new Map<number, string>();
    (data || []).forEach((u: any) => nameMap.set(u.id, u.name));
    return nameMap;
  };

  const getPaidTo = (payment: any, paidToNames: Map<number, string>) => {
    if (!payment) return "";
    const staffName = payment.confirmed_by_staff_id ? paidToNames.get(payment.confirmed_by_staff_id) : "";
    if (staffName) return staffName;
    return payment.rzp_account || "";
  };

  const copyRowsToClipboard = async (rows: any[][], label: string) => {
    const text = rows.map(row => row.map(cleanSheetCell).join("\t")).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${rows.length} ${label}${rows.length === 1 ? "" : "s"} for Google Sheets`);
  };

  const copyRegistrationsForSheets = async (range?: { startDate: string; endDate: string; cycleOnly?: boolean }) => {
    const targetBatchIds = batches.map(b => b.id);
    if (targetBatchIds.length === 0) {
      toast.info("No scoped batches available for this selection");
      return;
    }
    if (range && !range.cycleOnly && range.endDate < range.startDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    setCopyingSheet("registrations");
    try {
      const businessStartDate = range ? range.startDate : format(selectedDate, "yyyy-MM-dd");
      const businessEndDate = range ? range.endDate : businessStartDate;
      const cycleEnrollmentIds = range?.cycleOnly
        ? classifiedEnrollments
          .filter(row => row.displayStatus !== "C/F" && row.payment_id && visibleBatchIds.has(row.batch_id))
          .map(row => row.id)
        : [];

      if (range?.cycleOnly && cycleEnrollmentIds.length === 0) {
        toast.info("No registrations found for the selected cycle and studio");
        return;
      }

      let query: any = supabase
        .from("enrollments")
        .select(`
          id, created_at, status_type, start_date, end_date, payment_id, batch_id, student_id,
          students(name, phone, email, users(phone, email)),
          batches(name, batch_code, studio_id, studios(name, code)),
          payments!inner(id, amount, gst, final_amount, payment_mode, status, created_at, business_date, rzp_account, gateway_payment_id, confirmed_by_staff_id)
        `)
        .eq("organization_id", 1)
        .in("batch_id", targetBatchIds)
        .order("created_at", { ascending: true });

      if (range?.cycleOnly) {
        query = query.in("id", cycleEnrollmentIds);
      } else {
        query = query
          .gte("payments.business_date", businessStartDate)
          .lte("payments.business_date", businessEndDate);
      }
      if (!scopeUnrestricted) query = query.in("student_id", scope.studentIds);

      const { data, error } = await query;
      if (error) throw error;
      const registrationRows = ((data || []) as any[]).filter(row => row.payment_id && row.payments);
      if (registrationRows.length === 0) {
        toast.info("No registrations found for the selected date and studio");
        return;
      }

      const paymentIds = [...new Set(registrationRows.map(row => row.payment_id))] as number[];
      const [allocationRes, adjustedDropInRes] = await Promise.all([
        supabase
          .from("payment_allocations")
          .select("payment_id, batch_id, allocated_amount")
          .in("payment_id", paymentIds)
          .in("batch_id", targetBatchIds),
        supabase
          .from("drop_ins")
          .select("adjusted_payment_id, adjusted_amount, amount, payment:payments!drop_ins_payment_id_fkey(gst, final_amount)")
          .eq("organization_id", 1)
          .eq("is_adjusted", true)
          .in("adjusted_payment_id", paymentIds),
      ]);
      if (allocationRes.error) throw allocationRes.error;
      if (adjustedDropInRes.error) throw adjustedDropInRes.error;

      const allocationsByPayment = new Map<number, number>();
      ((allocationRes.data || []) as any[]).forEach(allocation => {
        allocationsByPayment.set(
          allocation.payment_id,
          (allocationsByPayment.get(allocation.payment_id) || 0) + Number(allocation.allocated_amount || 0)
        );
      });

      const adjustmentsByPayment = new Map<number, { total: number; gst: number }>();
      ((adjustedDropInRes.data || []) as any[]).forEach(dropIn => {
        const payment = dropIn.payment || {};
        const total = Number(dropIn.adjusted_amount || payment.final_amount || 0);
        const fallbackBase = Number(dropIn.amount || 0);
        const finalTotal = total > 0 ? total : Math.round(fallbackBase * 1.18);
        if (finalTotal <= 0 || !dropIn.adjusted_payment_id) return;
        const gst = Number(payment.gst || Math.round(finalTotal - finalTotal / 1.18));
        const current = adjustmentsByPayment.get(dropIn.adjusted_payment_id) || { total: 0, gst: 0 };
        adjustmentsByPayment.set(dropIn.adjusted_payment_id, { total: current.total + finalTotal, gst: current.gst + gst });
      });

      const grouped = new Map<number, any[]>();
      registrationRows.forEach(row => {
        if (!grouped.has(row.payment_id)) grouped.set(row.payment_id, []);
        grouped.get(row.payment_id)!.push(row);
      });

      const paidToNames = await fetchPaidToNames(Array.from(grouped.values()).map(rows => rows[0]?.payments).filter(Boolean));
      const sheetRows = Array.from(grouped.entries())
        .sort((a, b) => getBusinessDate(a[1][0]?.payments).localeCompare(getBusinessDate(b[1][0]?.payments)))
        .map(([paymentId, rows], index) => {
          const payment = rows[0]?.payments || {};
          const student = rows[0]?.students || {};
          const startDates = rows.map(r => r.start_date).filter(Boolean).sort();
          const endDates = rows.map(r => r.end_date).filter(Boolean).sort();
          const batchNames = [...new Set(rows.map(r => r.batches?.batch_code || r.batches?.name).filter(Boolean))].join(", ");
          const statuses = [...new Set(rows.map(r => r.status_type).filter(Boolean))].join(" + ");
          const paymentBase = Number(payment.amount || 0);
          const paymentTotal = Number(payment.final_amount ?? (paymentBase + Number(payment.gst || 0)));
          const paymentGst = payment.gst != null
            ? Number(payment.gst)
            : paymentTotal > paymentBase
              ? paymentTotal - paymentBase
              : Math.round(paymentBase * 0.18);
          const adjustment = adjustmentsByPayment.get(paymentId);
          const reportedTotal = paymentTotal + Number(adjustment?.total || 0);
          const reportedGst = paymentGst + Number(adjustment?.gst || 0);
          const allocatedTotal = allocationsByPayment.get(paymentId);
          const amountPaid = allocatedTotal && paymentTotal > 0 && reportedTotal > paymentTotal
            ? Math.round((allocatedTotal / paymentTotal) * reportedTotal)
            : allocatedTotal || reportedTotal;
          const gst = reportedTotal > 0 ? Math.round((reportedGst / reportedTotal) * amountPaid) : 0;
          const gross = Math.max(0, amountPaid - gst);

          return [
            "",
            index + 1,
            formatSheetDate(getBusinessDate(payment) || rows[0]?.created_at),
            student.name || "",
            student ? getDisplayPhone(student) || "" : "",
            student.email || student.users?.email || "",
            "",
            statuses,
            formatSheetValidity(startDates[0], endDates[endDates.length - 1]),
            getOnlineOffline(payment.payment_mode),
            batchNames,
            rows.length,
            gross,
            gst,
            amountPaid,
            getModeLabel(payment.payment_mode),
            getPaidTo(payment, paidToNames),
          ];
        });

      await copyRowsToClipboard(sheetRows, "registration row");
    } catch (err: any) {
      console.error("copyRegistrationsForSheets failed", err);
      toast.error(`Could not copy registrations: ${err?.message || "unknown error"}`);
    } finally {
      setCopyingSheet(null);
    }
  };

  const copyDropInsForSheets = async (range?: { startDate: string; endDate: string }) => {
    const targetBatchIds = batches.map(b => b.id);
    if (targetBatchIds.length === 0) {
      toast.info("No scoped batches available for this selection");
      return;
    }
    if (range && range.endDate < range.startDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    setCopyingSheet("dropIns");
    try {
      const sessionStartDate = range ? range.startDate : format(selectedDate, "yyyy-MM-dd");
      const sessionEndDate = range ? range.endDate : sessionStartDate;
      let query: any = supabase
        .from("drop_ins")
        .select(`
          id, amount, is_adjusted, adjusted_payment_id, adjusted_amount, created_at, student_id,
          students(name, phone, email, users(phone, email)),
          payment:payments!drop_ins_payment_id_fkey(id, amount, gst, final_amount, payment_mode, status, created_at, business_date, rzp_account, confirmed_by_staff_id),
          batch_sessions!inner(session_date, batches(id, name, batch_code, studio_id, studios(name, code)))
        `)
        .eq("organization_id", 1)
        .gte("batch_sessions.session_date", sessionStartDate)
        .lte("batch_sessions.session_date", sessionEndDate)
        .order("created_at", { ascending: true });
      if (!scopeUnrestricted) query = query.in("student_id", scope.studentIds);

      const { data, error } = await query;
      if (error) throw error;
      const dropInRows = ((data || []) as any[]).filter(row => targetBatchIds.includes(row.batch_sessions?.batches?.id));
      if (dropInRows.length === 0) {
        toast.info("No drop-ins found for the selected date and studio");
        return;
      }

      const paidToNames = await fetchPaidToNames(dropInRows.map(row => row.payment).filter(Boolean));
      const sheetRows = dropInRows.map(row => {
        const student = row.students || {};
        const payment = row.payment || {};
        const batch = row.batch_sessions?.batches || {};
        const isAdjusted = !!row.is_adjusted;
        const base = isAdjusted ? 0 : Number(payment.amount ?? row.amount ?? 0);
        const gst = isAdjusted ? 0 : Number(payment.gst ?? Math.round(base * 0.18));
        const paid = isAdjusted ? 0 : Number(payment.final_amount ?? base + gst);
        return [
          formatSheetDate(row.batch_sessions?.session_date || row.created_at),
          student.name || "",
          student ? getDisplayPhone(student) || "" : "",
          student.email || student.users?.email || "",
          batch.batch_code || batch.name || "",
          batch.studios?.name || "",
          base,
          gst,
          paid,
          getModeLabel(payment.payment_mode),
          getPaidTo(payment, paidToNames),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          isAdjusted ? `Adjusted to registration${row.adjusted_payment_id ? ` #${row.adjusted_payment_id}` : ""}` : "",
        ];
      });

      await copyRowsToClipboard(sheetRows, "drop-in row");
    } catch (err: any) {
      console.error("copyDropInsForSheets failed", err);
      toast.error(`Could not copy drop-ins: ${err?.message || "unknown error"}`);
    } finally {
      setCopyingSheet(null);
    }
  };

  const copyDateWiseForSheets = async () => {
    if (copyEndDate < copyStartDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    setCopyingSheet("dateWise");
    try {
      const rows = dateWise
        .filter(row => row.date >= copyStartDate && row.date <= copyEndDate)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(row => [
          formatSheetDate(row.date),
          row.NEW,
          row.REN,
          row.REV,
          row.dropIn,
          row.diAdjusted,
          row.gross,
          row.gst,
          row.total,
          row.cash,
          row.razorpay,
        ]);
      if (rows.length === 0) {
        toast.info("No date-wise rows found for the selected range");
        return;
      }
      await copyRowsToClipboard([
        ["Date", "NEW", "REN", "REV", "Drop-ins", "Adjusted Drop-ins", "Gross", "GST", "Total", "Cash", "Razorpay"],
        ...rows,
      ], "date-wise row");
    } catch (err: any) {
      console.error("copyDateWiseForSheets failed", err);
      toast.error(`Could not copy date-wise summary: ${err?.message || "unknown error"}`);
    } finally {
      setCopyingSheet(null);
    }
  };

  return (
    <AdminLayout title="Dashboard">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select Cycle" />
          </SelectTrigger>
          <SelectContent>
            {allCycles.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}{c.is_active ? " (Active)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStudio} onValueChange={setSelectedStudio}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select Studio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Studios</SelectItem>
            {studios.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.code ? `(${s.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCycle && (
          <span className="text-sm text-muted-foreground">
            {selectedCycle.start_date} → {selectedCycle.end_date || "ongoing"}
          </span>
        )}
        {isTestMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-xs font-medium text-warning">TEST MODE current date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 justify-start text-left font-normal", !simulatedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {simulatedPickerDate ? format(simulatedPickerDate, "PPP") : `Real today (${format(dateStringToPickerDate(todayIST()), "PPP")})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={simulatedPickerDate}
                  onSelect={(date) => {
                    if (!date) return;
                    const dateString = pickerDateToDateString(date);
                    setSimulatedDate(dateString);
                    setSelectedDate(date);
                    selectCycleForDate(dateString);
                    toast.success(`System date simulated as ${format(date, "PPP")}`);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {simulatedDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setSimulatedDate(null);
                  setSelectedDate(nowIST());
                  toast.success("System date reset to real today");
                }}
                title="Reset to real today"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-20">Loading dashboard…</div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: Total Dreams (expandable) | Head Count */}
          <div className="grid grid-cols-2 gap-4">
            <ExpandableCard
              title="Total Dreams" value={totalDreams}
              subtitle={`Cycle: ${selectedCycle?.name || "—"}`}
              open={totalOpen} onOpenChange={setTotalOpen} highlight
            >
              <BatchTable data={batchData} valueKey="total" />
            </ExpandableCard>
            <ExpandableCard
              title="Head Count" value={headCount}
              subtitle="Unique students"
              open={headCountOpen} onOpenChange={setHeadCountOpen}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headCountData.map(b => (
                    <ClickableBatchRow key={b.id} batchId={b.id} batchName={b.name} filter="total">
                      <TableCell className="font-medium text-xs">{b.name}</TableCell>
                      <TableCell className="text-right text-xs">{b.count}</TableCell>
                    </ClickableBatchRow>
                  ))}
                </TableBody>
              </Table>
            </ExpandableCard>
          </div>

          {/* Row 2: New Dreams (expandable) | REV Dreams (expandable) */}
          <div className="grid grid-cols-2 gap-4">
            <ExpandableCard
              title="New Dreams" value={newDreams}
              subtitle="First-time enrollments"
              open={newOpen} onOpenChange={setNewOpen}
            >
              <BatchTable data={batchData} valueKey="NEW" />
            </ExpandableCard>
            <ExpandableCard
              title="REV Dreams" value={revDreams}
              subtitle="Revival enrollments"
              open={revOpen} onOpenChange={setRevOpen}
            >
              <BatchTable data={batchData} valueKey="REV" />
            </ExpandableCard>
          </div>

          {/* Row 3: REN Rate (expandable) | REN Dreams */}
          <div className="grid grid-cols-2 gap-4">
            <ExpandableCard
              title="REN Rate" value={renewableCount > 0 ? `${renRate}%` : "—"}
              subtitle={`${renDreams} / ${renewableCount} renewable`}
              open={renOpen} onOpenChange={setRenOpen} highlight
            >
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Renewable pool by previous batch. Click a batch to view students due for renewal.
                </p>
                <RenewableBatchTable data={renewableBatchData} />
              </div>
            </ExpandableCard>
            <ExpandableCard
              title="REN Dreams" value={renDreams}
              subtitle={`${renewableCount} renewable`}
              open={renDreamsOpen} onOpenChange={setRenDreamsOpen} highlight
            >
              <BatchTable data={batchData} valueKey="REN" />
            </ExpandableCard>
          </div>

          {/* Row 4: C/F (Carry Forward) */}
          <div className="grid grid-cols-2 gap-4">
            <ExpandableCard
              title="C/F (Carry Forward)" value={cfDreams}
              subtitle="From previous cycles"
              open={cfOpen} onOpenChange={setCfOpen}
            >
              <BatchTable data={batchData} valueKey="C/F" />
            </ExpandableCard>
          </div>

          {/* Row 4: Date-wise Breakdown with date picker */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-foreground">Date-wise Breakdown</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyRegistrationsForSheets()}
                disabled={copyingSheet !== null || batches.length === 0}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy Day Reg
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyDropInsForSheets()}
                disabled={copyingSheet !== null || batches.length === 0}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy Day Drop-ins
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={copyStartDate}
                  onChange={(e) => setCopyStartDate(e.target.value)}
                  className="h-9 w-[150px]"
                />
                <Input
                  type="date"
                  value={copyEndDate}
                  onChange={(e) => setCopyEndDate(e.target.value)}
                  className="h-9 w-[150px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyRegistrationsForSheets({ startDate: copyStartDate, endDate: copyEndDate, cycleOnly: true })}
                  disabled={copyingSheet !== null || batches.length === 0 || !selectedCycle}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Copy Cycle Reg
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyDropInsForSheets({ startDate: copyStartDate, endDate: copyEndDate })}
                  disabled={copyingSheet !== null || batches.length === 0}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Copy All Drop-ins
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDateWiseForSheets}
                  disabled={copyingSheet !== null || batches.length === 0}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Copy Date-wise
                </Button>
              </div>
            </div>
            {(() => {
              const dateStr = format(selectedDate, "yyyy-MM-dd");
              const row = dateWise.find(r => r.date === dateStr);
              return (
                <Card className="glass-card">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{format(selectedDate, "dd MMM yyyy")}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{row?.NEW || 0}</div>
                      <div className="text-xs text-muted-foreground">NEW</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{row?.REN || 0}</div>
                      <div className="text-xs text-muted-foreground">REN</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{row?.REV || 0}</div>
                      <div className="text-xs text-muted-foreground">REV</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: ACCENT }}>{row?.dropIn || 0}</div>
                      <div className="text-xs text-muted-foreground">Drop-In</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Row 5: Drop-In card */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Drop-Ins</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-2xl font-bold">{totalDropIns}</span>
                    <span className="text-xs text-muted-foreground ml-1">total</span>
                  </div>
                  <span className="text-muted-foreground">vs</span>
                  <div>
                    <span className="text-2xl font-bold" style={{ color: ACCENT }}>{totalDiAdjusted}</span>
                    <span className="text-xs text-muted-foreground ml-1">adjusted</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 6: Revenue */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Revenue</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross</span>
                    <span className="font-medium">₹{fmt(dateTotals.gross)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST</span>
                    <span className="font-medium">₹{fmt(dateTotals.gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border pt-1">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold" style={{ color: ACCENT }}>₹{fmt(dateTotals.total)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Payment Mode</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash</span>
                    <span className="font-medium">₹{fmt(dateTotals.cash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Razorpay</span>
                    <span className="font-medium">₹{fmt(dateTotals.razorpay)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Row 7: Attendance Report */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-foreground">Attendance Report</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Missed</span>
                <Input
                  type="number"
                  min={1}
                  value={missedThreshold}
                  onChange={e => setMissedThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">+ classes</span>
              </div>
            </div>
            <Card className="glass-card">
              <CardContent className="px-4 py-3">
                {attendanceReport.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No students with {missedThreshold}+ absences</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-right">Absences</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceReport.map(r => {
                        const student = studentNames.get(r.student_id);
                        const batch = batches.find(b => b.id === r.batch_id);
                        return (
                          <TableRow key={`${r.student_id}-${r.batch_id}`}>
                            <TableCell className="font-medium text-sm">{student?.name || `#${r.student_id}`}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{student?.phone || "—"}</TableCell>
                            <TableCell className="text-sm">{batch?.batch_code || batch?.name || `#${r.batch_id}`}</TableCell>
                            <TableCell className="text-right font-bold text-sm" style={{ color: ACCENT }}>{r.count}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <BatchDetailsPopup
        batch={selectedBatch}
        enrollments={popupEnrollments}
        open={!!selectedBatch}
        onOpenChange={(v) => { if (!v) setSelectedBatch(null); }}
      />
    </AdminLayout>
  );
};

export default Dashboard;
