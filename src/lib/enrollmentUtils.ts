import { todayIST } from "@/lib/dateUtils";

export const DISCOUNT_TIERS: Record<number, number> = { 1: 0, 2: 0.12, 3: 0.13, 4: 0.14 };
export const getDiscount = (count: number) => DISCOUNT_TIERS[count] ?? 0.15;

export const REGULAR_PRICE = 3200;
export const GRID_PRICE = 7667;
export const REG_FEE = 500;
export const GST_RATE = 0.18;

/** Fixed after-GST per-batch totals for specific plans (hidden discount) */
export const PLAN_FIXED_TOTALS: Record<string, number> = {
  "5R1G": 26500,
  "10R2G": 50000,
};

export function getPlanKey(regularCycles: number, gridCycles: number): string {
  return `${regularCycles}R${gridCycles}G`;
}

export function roundToNearest100(n: number): number {
  return Math.round(n / 100) * 100;
}

export interface PlanCycle {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  plan_type: string;
  is_active: boolean;
  grace_days: number;
  registration_deadline: string | null;
  organization_id: number;
}

export interface SubPlan {
  id: number;
  name: string;
  total_cycles: number;
  total_regular_cycles: number;
  total_grid_cycles: number;
  is_active: boolean;
  organization_id: number;
  description?: string | null;
}

/** Find the first cycle with open registration (or next upcoming) */
export function getStartCycleIndex(planCycles: PlanCycle[]): number {
  const todayStr = todayIST();
  const openIdx = planCycles.findIndex(c => {
    if (c.registration_deadline && todayStr > c.registration_deadline) return false;
    const endDate = c.end_date || "2099-12-31";
    return endDate >= todayStr;
  });
  if (openIdx !== -1) return openIdx;
  const futureIdx = planCycles.findIndex(c => c.start_date > todayStr);
  return futureIdx !== -1 ? futureIdx : 0;
}

/** Count-based greedy matching: walk calendar consuming cycles by type counts */
export function isPlanValid(plan: SubPlan, planCycles: PlanCycle[], startCycleIndex: number): boolean {
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
      // Skip cycles whose type isn't needed
      calIdx++;
      continue;
    }
    calIdx++;
  }
  return neededRegular === 0 && neededGrid === 0;
}

export interface CycleAssignment {
  startCycle: PlanCycle;
  endCycle: PlanCycle;
  regularCount: number;
  gridCount: number;
  matched: PlanCycle[];
}

/** Compute the cycle assignment for a plan starting from startCycleIndex */
export function computeCycleAssignment(plan: SubPlan, planCycles: PlanCycle[], startCycleIndex: number): CycleAssignment | null {
  let neededRegular = plan.total_regular_cycles ?? 0;
  let neededGrid = plan.total_grid_cycles ?? 0;
  const totalNeeded = neededRegular + neededGrid;
  const matched: PlanCycle[] = [];
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
      // Skip cycles whose type isn't needed
      calIdx++;
      continue;
    }
    calIdx++;
  }

  if (matched.length !== totalNeeded) return null;

  return {
    startCycle: matched[0],
    endCycle: matched[matched.length - 1],
    regularCount: matched.filter(c => c.plan_type === "regular").length,
    gridCount: matched.filter(c => c.plan_type === "grid").length,
    matched,
  };
}

export interface BatchAllocation {
  batch_id: number;
  batch_name: string;
  style_base: string;
  is_primary: boolean;
  amount: number;
}

export interface FeeBreakdown {
  batchCount: number;
  perBatchFee: number;
  discountPct: number;
  discountAmount: number;
  totalBatchFee: number;
  regFee: number;
  dropInAdj: number;
  subtotal: number;
  gst: number;
  total: number;
  applyRegFee: boolean;
  isLateRenewal: boolean;
  isFixedPricePlan: boolean;
  planKey: string;
  batchAllocations: BatchAllocation[];
}

export function computeFeeBreakdown(params: {
  batchCount: number;
  regularCycles: number;
  gridCycles: number;
  detectedStatus: string;
  latestEndDate: string | null;
  dropInAmount: number;
  /** Sorted batches by hierarchy (highest priority first) */
  sortedBatches?: { id: number; name: string; style_base?: string | null }[];
}): FeeBreakdown {
  const { batchCount, regularCycles, gridCycles, detectedStatus, latestEndDate, dropInAmount, sortedBatches } = params;
  const planKey = getPlanKey(regularCycles, gridCycles);
  const fixedTotal = PLAN_FIXED_TOTALS[planKey];
  const isFixedPricePlan = fixedTotal !== undefined;

  const todayStr = new Date().toISOString().split("T")[0];
  const applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || (detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false);
  const regFee = applyRegFee ? REG_FEE : 0;
  const isLateRenewal = detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false;

  let perBatchFee: number;
  let discountPct: number;
  let discountAmount: number;
  let totalBatchFee: number;
  let primaryFee: number;
  let discountedPerBatch: number;

  if (isFixedPricePlan) {
    // Back-calculate subtotal from fixed after-GST total
    perBatchFee = Math.round(fixedTotal / (1 + GST_RATE));
    primaryFee = perBatchFee;
    discountPct = getDiscount(batchCount);
    discountedPerBatch = Math.round(perBatchFee * (1 - discountPct));
    totalBatchFee = batchCount === 1 ? primaryFee : primaryFee + discountedPerBatch * (batchCount - 1);
    discountAmount = batchCount > 1 ? (perBatchFee * batchCount) - totalBatchFee : 0;
  } else {
    perBatchFee = (regularCycles * REGULAR_PRICE) + (gridCycles * GRID_PRICE);
    discountPct = getDiscount(batchCount);
    discountedPerBatch = Math.round(perBatchFee * (1 - discountPct));
    primaryFee = perBatchFee;
    totalBatchFee = batchCount === 1 ? primaryFee : primaryFee + discountedPerBatch * (batchCount - 1);
    discountAmount = (perBatchFee * batchCount) - totalBatchFee;
  }

  const subtotal = Math.max(0, totalBatchFee + regFee - dropInAmount);
  const gst = Math.round(subtotal * GST_RATE);
  let total = subtotal + gst;

  // For non-fixed plans, round to nearest 100
  if (!isFixedPricePlan) {
    total = roundToNearest100(total);
  }

  // Build per-batch allocations
  const batchAllocations: BatchAllocation[] = (sortedBatches || []).map((b, idx) => ({
    batch_id: b.id,
    batch_name: b.name,
    style_base: b.style_base || "",
    is_primary: idx === 0,
    amount: idx === 0 ? primaryFee : discountedPerBatch,
  }));

  return { batchCount, perBatchFee, discountPct, discountAmount, totalBatchFee, regFee, dropInAdj: dropInAmount, subtotal, gst, total, applyRegFee, isLateRenewal, isFixedPricePlan, planKey, batchAllocations };
}

/** Detect student enrollment status: NEW, REN, or REV */
export function detectStudentStatus(
  enrollments: { end_date: string }[],
  planCycles: PlanCycle[]
): { status: string; latestEndDate: string | null } {
  if (!enrollments || enrollments.length === 0) return { status: "NEW", latestEndDate: null };
  
  const latest = enrollments[0].end_date;
  const todayStr = new Date().toISOString().split("T")[0];
  
  if (latest >= todayStr) return { status: "REN", latestEndDate: latest };
  
  const activeCycle = planCycles.find(c => c.is_active);
  const graceDays = activeCycle?.grace_days || 14;
  const latestDate = new Date(latest);
  const graceEnd = new Date(latestDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  const graceEndStr = graceEnd.toISOString().split("T")[0];
  
  if (todayStr <= graceEndStr) return { status: "REN", latestEndDate: latest };
  return { status: "REV", latestEndDate: latest };
}
