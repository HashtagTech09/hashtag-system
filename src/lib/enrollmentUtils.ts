import { todayIST } from "@/lib/dateUtils";

/** Per-position discount: 1st=0%, 2nd=12%, 3rd=13%, 4th=14%, 5th+=15% */
export function getBatchDiscount(position: number): number {
  if (position <= 1) return 0;
  const tiers: Record<number, number> = { 2: 0.12, 3: 0.13, 4: 0.14 };
  return tiers[position] ?? 0.15;
}

export const REGULAR_PRICE = 3200;
export const GRID_PRICE = 7667;
/** @deprecated Use the value from system_settings.registration_fee (loaded at runtime). Kept as a fallback only. */
export const REG_FEE = 590;
/** @deprecated Use system_settings.gst_percent / 100. Kept as a fallback only. */
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

export function getRegistrationDeadline(cycle: Pick<PlanCycle, "registration_deadline" | "start_date" | "grace_days">): string {
  return cycle.registration_deadline || addDays(cycle.start_date, cycle.grace_days || 14);
}

/** Find the first cycle with open registration (or next upcoming) */
export function getStartCycleIndex(planCycles: PlanCycle[], today?: string): number {
  const todayStr = today || todayIST();
  const openIdx = planCycles.findIndex(c => {
    if (todayStr > getRegistrationDeadline(c)) return false;
    const endDate = c.end_date || "2099-12-31";
    return endDate >= todayStr;
  });
  if (openIdx !== -1) return openIdx;
  const futureIdx = planCycles.findIndex(c => c.start_date > todayStr);
  return futureIdx !== -1 ? futureIdx : 0;
}

export function getRenewalStartCycleIndex(planCycles: PlanCycle[], latestEndDate: string | null, today?: string): number {
  const openStartIdx = getStartCycleIndex(planCycles, today);
  if (!latestEndDate) return openStartIdx;

  const latestCycleIdx = planCycles.findIndex(c => c.start_date <= latestEndDate && (c.end_date || "2099-12-31") >= latestEndDate);
  if (latestCycleIdx === -1) return openStartIdx;

  const nextAfterLatestIdx = latestCycleIdx + 1;
  if (nextAfterLatestIdx >= planCycles.length) return planCycles.length;
  return Math.max(openStartIdx, nextAfterLatestIdx);
}

/** Count-based greedy matching: walk calendar consuming cycles by type counts. */
export function matchPlanCycles(
  plan: Pick<SubPlan, "total_regular_cycles" | "total_grid_cycles">,
  planCycles: PlanCycle[],
  startCycleIndex: number
): PlanCycle[] | null {
  let neededRegular = plan.total_regular_cycles ?? 0;
  let neededGrid = plan.total_grid_cycles ?? 0;
  const totalNeeded = neededRegular + neededGrid;
  if (totalNeeded === 0) return null;

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

  return matched.length === totalNeeded ? matched : null;
}

/** Count-based greedy matching: walk calendar consuming cycles by type counts */
export function isPlanValid(plan: SubPlan, planCycles: PlanCycle[], startCycleIndex: number): boolean {
  return matchPlanCycles(plan, planCycles, startCycleIndex) !== null;
}

export interface CycleAssignment {
  startCycle: PlanCycle;
  endCycle: PlanCycle;
  regularCount: number;
  gridCount: number;
  matched: PlanCycle[];
}

function getCycleForDate(planCycles: PlanCycle[], date: string): PlanCycle | null {
  return planCycles.find(c => c.start_date <= date && (c.end_date || "2099-12-31") >= date) || null;
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function isRenewalAcrossGridGap(latestEndDate: string, planCycles: PlanCycle[], today: string): boolean {
  const latestCycle = getCycleForDate(planCycles, latestEndDate);
  const targetCycle = getCycleForDate(planCycles, today) || planCycles[getStartCycleIndex(planCycles, today)];
  if (!latestCycle || !targetCycle) return false;

  const latestIdx = planCycles.findIndex(c => c.id === latestCycle.id);
  const targetIdx = planCycles.findIndex(c => c.id === targetCycle.id);
  if (latestIdx === -1 || targetIdx === -1 || targetIdx <= latestIdx) return false;

  const skippedCycles = planCycles.slice(latestIdx + 1, targetIdx);
  if (!skippedCycles.every(c => c.plan_type === "grid")) return false;

  if (targetCycle.plan_type === "grid") return true;
  if (targetCycle.plan_type !== "regular") return false;

  const renewalUntil = getRegistrationDeadline(targetCycle);
  return today <= renewalUntil;
}

/** Compute the cycle assignment for a plan starting from startCycleIndex */
export function computeCycleAssignment(plan: SubPlan, planCycles: PlanCycle[], startCycleIndex: number): CycleAssignment | null {
  const matched = matchPlanCycles(plan, planCycles, startCycleIndex);
  if (!matched) return null;

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
  discountPct: number;
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
  batchTotalWithGst: number;
  roundedBatchTotal: number;
  roundingAdjustment: number;
  total: number;
  applyRegFee: boolean;
  registrationFeeDiscounted: boolean;
  registrationFeeDiscountedAmount: number;
  registrationFeeDiscountLabel: string | null;
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
  today?: string;
  /** Registration fee from system_settings. Defaults to REG_FEE constant. */
  regFee?: number;
  /** GST rate (0-1). Defaults to GST_RATE constant. */
  gstRate?: number;
}): FeeBreakdown {
  const { batchCount, regularCycles, gridCycles, detectedStatus, latestEndDate, dropInAmount, sortedBatches, today, regFee: regFeeParam, gstRate: gstRateParam } = params;
  const effRegFee = regFeeParam ?? REG_FEE;
  const effGstRate = gstRateParam ?? GST_RATE;
  const planKey = getPlanKey(regularCycles, gridCycles);
  const fixedTotal = PLAN_FIXED_TOTALS[planKey];
  const isFixedPricePlan = fixedTotal !== undefined;
  const isLongTermPlan = regularCycles + gridCycles >= 6;

  const todayStr = today || todayIST();
  const isLateRenewal = detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false;
  const waiveRenewalFeeForLongTermPlan = detectedStatus === "REN" && isLongTermPlan;
  let applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || isLateRenewal;
  if (waiveRenewalFeeForLongTermPlan) applyRegFee = false;
  const regFee = applyRegFee ? effRegFee : 0;
  const registrationFeeDiscounted = detectedStatus === "REN" && (!!latestEndDate && todayStr <= latestEndDate || waiveRenewalFeeForLongTermPlan);
  const registrationFeeDiscountLabel = registrationFeeDiscounted
    ? waiveRenewalFeeForLongTermPlan
      ? "Registration fee discounted for 6-month/yearly renewal"
      : "Registration fee discounted during renewal period"
    : null;

  let perBatchFee: number;
  let discountAmount: number;
  let totalBatchFee: number;

  if (isFixedPricePlan) {
    perBatchFee = Math.round(fixedTotal / (1 + effGstRate));
  } else {
    perBatchFee = (regularCycles * REGULAR_PRICE) + (gridCycles * GRID_PRICE);
  }

  // Build per-batch allocations with incremental discounts
  const batchAllocations: BatchAllocation[] = (sortedBatches || []).map((b, idx) => {
    const position = idx + 1;
    const disc = getBatchDiscount(position);
    const amount = position === 1 ? perBatchFee : Math.round(perBatchFee * (1 - disc));
    return {
      batch_id: b.id,
      batch_name: b.name,
      style_base: b.style_base || "",
      is_primary: idx === 0,
      amount,
      discountPct: disc,
    };
  });

  totalBatchFee = batchAllocations.length > 0
    ? batchAllocations.reduce((sum, a) => sum + a.amount, 0)
    : perBatchFee * batchCount;
  discountAmount = (perBatchFee * batchCount) - totalBatchFee;

  const subtotal = totalBatchFee;
  const gst = Math.round(subtotal * effGstRate);
  const batchTotalWithGst = subtotal + gst;
  const roundedBatchTotal = isFixedPricePlan ? batchTotalWithGst : roundToNearest100(batchTotalWithGst);
  const roundingAdjustment = roundedBatchTotal - batchTotalWithGst;
  const total = Math.max(0, roundedBatchTotal + regFee - dropInAmount);

  return {
    batchCount,
    perBatchFee,
    discountPct: 0,
    discountAmount,
    totalBatchFee,
    regFee,
    dropInAdj: dropInAmount,
    subtotal,
    gst,
    batchTotalWithGst,
    roundedBatchTotal,
    roundingAdjustment,
    total,
    applyRegFee,
    registrationFeeDiscounted,
    registrationFeeDiscountedAmount: registrationFeeDiscounted ? effRegFee : 0,
    registrationFeeDiscountLabel,
    isLateRenewal,
    isFixedPricePlan,
    planKey,
    batchAllocations,
  };
}

/** Detect student enrollment status: NEW, REN, or REV */
export function detectStudentStatus(
  enrollments: { end_date: string }[],
  planCycles: PlanCycle[],
  today?: string
): { status: string; latestEndDate: string | null } {
  if (!enrollments || enrollments.length === 0) return { status: "NEW", latestEndDate: null };
  
  const latest = enrollments[0].end_date;
  const todayStr = today || todayIST();
  
  if (latest >= todayStr) return { status: "REN", latestEndDate: latest };
  if (isRenewalAcrossGridGap(latest, planCycles, todayStr)) return { status: "REN", latestEndDate: latest };
  
  const activeCycle = planCycles.find(c => c.is_active);
  const graceDays = activeCycle?.grace_days || 14;
  const latestDate = new Date(latest);
  const graceEnd = new Date(latestDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  const graceEndStr = graceEnd.toISOString().split("T")[0];
  
  if (todayStr <= graceEndStr) return { status: "REN", latestEndDate: latest };
  return { status: "REV", latestEndDate: latest };
}

export interface AddBatchAllocation {
  batch_id: number;
  batch_name: string;
  style_base: string;
  is_primary: boolean;
  is_existing: boolean;
  amount: number;
  discountPct: number;
  missingCycleIds: number[];
  fullCycleIds: number[];
}

export interface AddBatchBreakdown {
  batchCount: number;
  perBatchFee: number;
  discountPct: number;
  discountAmount: number;
  totalBatchFee: number;
  regFee: number;
  dropInAdj: number;
  subtotal: number;
  gst: number;
  batchTotalWithGst: number;
  roundedBatchTotal: number;
  roundingAdjustment: number;
  total: number;
  applyRegFee: boolean;
  registrationFeeDiscounted: boolean;
  registrationFeeDiscountedAmount: number;
  registrationFeeDiscountLabel: string | null;
  isLateRenewal: boolean;
  isFixedPricePlan: boolean;
  planKey: string;
  regularCycles: number;
  gridCycles: number;
  batchAllocations: AddBatchAllocation[];
}

/**
 * Compute fee breakdown for "Add Batch" with validity matching.
 * Existing batches are charged only for missing cycles at their positional discount.
 * New batches are charged the full plan fee at their incremental positional discount.
 */
export function computeAddBatchBreakdown(params: {
  existingBatches: { batch_id: number; batch_name: string; style_base: string; coveredCycleIds: number[] }[];
  newBatches: { id: number; name: string; style_base?: string | null }[];
  plan: SubPlan;
  planCycles: PlanCycle[];
  startCycleIndex: number;
}): AddBatchBreakdown | null {
  const { existingBatches, newBatches, plan, planCycles: cycles, startCycleIndex } = params;
  const regularCycles = plan.total_regular_cycles ?? 0;
  const gridCycles = plan.total_grid_cycles ?? 0;
  const planKey = getPlanKey(regularCycles, gridCycles);
  const fixedTotal = PLAN_FIXED_TOTALS[planKey];
  const isFixedPricePlan = fixedTotal !== undefined;

  // Compute per-batch fee (full plan price)
  const fullPerBatch = isFixedPricePlan
    ? Math.round(fixedTotal / (1 + GST_RATE))
    : (regularCycles * REGULAR_PRICE) + (gridCycles * GRID_PRICE);

  // Get matched cycle IDs from the plan assignment
  const assignment = computeCycleAssignment(plan, cycles, startCycleIndex);
  if (!assignment) return null;
  const planCycleIds = assignment.matched.map(c => c.id);

  // Per-cycle price for partial charging of existing batches
  const totalCycleCount = regularCycles + gridCycles;
  const regularRate = REGULAR_PRICE;
  const gridRate = GRID_PRICE;

  const allocations: AddBatchAllocation[] = [];
  let totalFee = 0;

  // Existing batches are SECONDARY — positioned after new batches
  // They are only charged for missing cycles at their positional discount
  existingBatches.forEach((eb, idx) => {
    const position = newBatches.length + 1 + idx;
    const disc = getBatchDiscount(position);
    const coveredSet = new Set(eb.coveredCycleIds);
    const missingCycleIds = planCycleIds.filter(cid => !coveredSet.has(cid));

    if (missingCycleIds.length === 0) {
      allocations.push({
        batch_id: eb.batch_id, batch_name: eb.batch_name, style_base: eb.style_base,
        is_primary: false, is_existing: true, amount: 0, discountPct: disc,
        missingCycleIds: [], fullCycleIds: [],
      });
      return;
    }

    let missingFee = 0;
    for (const cid of missingCycleIds) {
      const cycle = cycles.find(c => c.id === cid);
      if (cycle) {
        missingFee += cycle.plan_type === "grid" ? gridRate : regularRate;
      }
    }
    const discountedFee = Math.round(missingFee * (1 - disc));
    totalFee += discountedFee;

    allocations.push({
      batch_id: eb.batch_id, batch_name: eb.batch_name, style_base: eb.style_base,
      is_primary: false, is_existing: true, amount: discountedFee, discountPct: disc,
      missingCycleIds, fullCycleIds: [],
    });
  });

  // New batches become PRIMARY (position 1, 2, ...) — full price for first, then discounts
  newBatches.forEach((nb, idx) => {
    const position = idx + 1;
    const disc = getBatchDiscount(position);
    const amount = position === 1 ? fullPerBatch : Math.round(fullPerBatch * (1 - disc));
    totalFee += amount;

    allocations.push({
      batch_id: nb.id, batch_name: nb.name, style_base: nb.style_base || "",
      is_primary: idx === 0, is_existing: false, amount, discountPct: disc,
      missingCycleIds: [], fullCycleIds: planCycleIds,
    });
  });

  const subtotal = totalFee;
  const gst = Math.round(subtotal * GST_RATE);
  const batchTotalWithGst = subtotal + gst;
  const roundedBatchTotal = isFixedPricePlan ? batchTotalWithGst : roundToNearest100(batchTotalWithGst);
  const roundingAdjustment = roundedBatchTotal - batchTotalWithGst;
  const total = roundedBatchTotal;

  return {
    batchCount: existingBatches.length + newBatches.length,
    perBatchFee: fullPerBatch,
    discountPct: 0,
    discountAmount: 0,
    totalBatchFee: totalFee,
    regFee: 0,
    dropInAdj: 0,
    subtotal,
    gst,
    batchTotalWithGst,
    roundedBatchTotal,
    roundingAdjustment,
    total,
    applyRegFee: false,
    registrationFeeDiscounted: false,
    registrationFeeDiscountedAmount: 0,
    registrationFeeDiscountLabel: null,
    isLateRenewal: false,
    isFixedPricePlan,
    planKey,
    regularCycles,
    gridCycles,
    batchAllocations: allocations,
  };
}
