import { todayIST } from "@/lib/dateUtils";
import type { PlanCycle } from "@/lib/enrollmentUtils";
import { supabase } from "@/integrations/supabase/client";

export type CycleStatus = "ACTIVE" | "NOT_COVERED_BUT_FUTURE_EXISTS" | "EXPIRED";
export type CycleAction = "NONE" | "ADD_GRID" | "ADD_REGULAR" | "RENEW";

export interface EffectiveCycle {
  cycle_id: number;
  cycle_type: string;
  source: "enrollment" | "adjustment_in";
}

export interface StudentBatchSummary {
  studentId: number;
  batchId: number;
  coveredCycleIds: number[];
  firstCycle: PlanCycle | null;
  lastCycle: PlanCycle | null;
  currentCycleStatus: CycleStatus;
  nextUncoveredCycleId: number | null;
  hasFutureCoverage: boolean;
  nextAction: CycleAction;
}

/** Find the cycle where today falls between start_date and end_date */
export function getCurrentCycle(planCycles: PlanCycle[]): PlanCycle | null {
  const today = todayIST();
  return planCycles.find(c => c.start_date <= today && (c.end_date || "2099-12-31") >= today) || null;
}

/** Compute effective cycles after adjustments: enrollment_cycles - shifted_out + shifted_in */
export function getEffectiveCycles(
  enrollmentCycles: { cycle_id: number; cycle_type: string }[],
  adjustments: { original_cycle_id: number; new_cycle_id: number | null; status: string }[]
): EffectiveCycle[] {
  const appliedAdj = adjustments.filter(a => a.status === "APPLIED");
  const shiftedOut = new Set(appliedAdj.map(a => a.original_cycle_id));
  const shiftedIn = appliedAdj
    .filter(a => a.new_cycle_id != null)
    .map(a => ({ cycle_id: a.new_cycle_id!, cycle_type: "regular", source: "adjustment_in" as const }));

  const fromEnrollment: EffectiveCycle[] = enrollmentCycles
    .filter(ec => !shiftedOut.has(ec.cycle_id))
    .map(ec => ({ cycle_id: ec.cycle_id, cycle_type: ec.cycle_type, source: "enrollment" as const }));

  // Deduplicate by cycle_id
  const seen = new Set<number>();
  const result: EffectiveCycle[] = [];
  for (const ec of [...fromEnrollment, ...shiftedIn]) {
    if (!seen.has(ec.cycle_id)) {
      seen.add(ec.cycle_id);
      result.push(ec);
    }
  }
  return result;
}

/** Compute summary for a student+batch pair */
export function computeStudentBatchSummary(
  studentId: number,
  batchId: number,
  effectiveCycles: EffectiveCycle[],
  planCycles: PlanCycle[]
): StudentBatchSummary {
  const coveredCycleIds = effectiveCycles.map(ec => ec.cycle_id);
  const coveredSet = new Set(coveredCycleIds);

  const sortedCovered = planCycles.filter(pc => coveredSet.has(pc.id)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const firstCycle = sortedCovered[0] || null;
  const lastCycle = sortedCovered[sortedCovered.length - 1] || null;

  const currentCycle = getCurrentCycle(planCycles);
  let currentCycleStatus: CycleStatus = "EXPIRED";
  let hasFutureCoverage = false;
  let nextUncoveredCycleId: number | null = null;
  let nextAction: CycleAction = "RENEW";

  if (currentCycle) {
    if (coveredSet.has(currentCycle.id)) {
      currentCycleStatus = "ACTIVE";
      nextAction = "NONE";
    } else {
      // Check if any future cycle is covered
      const futureCycles = planCycles.filter(pc => pc.start_date > currentCycle.start_date);
      hasFutureCoverage = futureCycles.some(fc => coveredSet.has(fc.id));

      if (hasFutureCoverage) {
        currentCycleStatus = "NOT_COVERED_BUT_FUTURE_EXISTS";
        // Suggest adding the current cycle type
        nextAction = currentCycle.plan_type === "grid" ? "ADD_GRID" : "ADD_REGULAR";
      } else {
        currentCycleStatus = "EXPIRED";
        nextAction = "RENEW";
      }
    }

    // Find next uncovered cycle from current onwards
    const fromCurrent = planCycles.filter(pc => pc.start_date >= currentCycle.start_date);
    const uncovered = fromCurrent.find(pc => !coveredSet.has(pc.id));
    nextUncoveredCycleId = uncovered?.id || null;
  }

  // Check if active even if no current cycle (look at future)
  if (!currentCycle && coveredCycleIds.length > 0) {
    const today = todayIST();
    const futureCovered = sortedCovered.filter(pc => pc.start_date > today);
    if (futureCovered.length > 0) {
      currentCycleStatus = "NOT_COVERED_BUT_FUTURE_EXISTS";
      hasFutureCoverage = true;
      nextAction = "NONE";
    }
  }

  return {
    studentId, batchId, coveredCycleIds, firstCycle, lastCycle,
    currentCycleStatus, nextUncoveredCycleId, hasFutureCoverage, nextAction,
  };
}

/** Allocate cycles for a plan starting from startCycleIndex, returning cycle_ids to insert */
export function allocateCyclesForPlan(
  plan: { total_regular_cycles: number; total_grid_cycles: number },
  planCycles: PlanCycle[],
  startCycleIndex: number
): { cycleId: number; cycleType: string }[] {
  let neededRegular = plan.total_regular_cycles ?? 0;
  let neededGrid = plan.total_grid_cycles ?? 0;
  const allocated: { cycleId: number; cycleType: string }[] = [];
  let calIdx = startCycleIndex;

  while ((neededRegular > 0 || neededGrid > 0) && calIdx < planCycles.length) {
    const cycle = planCycles[calIdx];
    if (cycle.plan_type === "regular" && neededRegular > 0) {
      allocated.push({ cycleId: cycle.id, cycleType: cycle.plan_type });
      neededRegular--;
    } else if (cycle.plan_type === "grid" && neededGrid > 0) {
      allocated.push({ cycleId: cycle.id, cycleType: cycle.plan_type });
      neededGrid--;
    } else {
      break;
    }
    calIdx++;
  }

  return allocated;
}

/** Insert enrollment_cycles rows for a given enrollment */
export async function insertEnrollmentCycles(
  enrollmentId: number,
  studentId: number,
  batchId: number,
  allocatedCycles: { cycleId: number; cycleType: string }[]
): Promise<void> {
  if (allocatedCycles.length === 0) return;

  const rows = allocatedCycles.map(ac => ({
    enrollment_id: enrollmentId,
    student_id: studentId,
    batch_id: batchId,
    cycle_id: ac.cycleId,
    cycle_type: ac.cycleType,
  }));

  const { error } = await supabase.from("enrollment_cycles").insert(rows);
  if (error) {
    console.error("Failed to insert enrollment_cycles:", error);
  }
}

/** Check if a student has cycle ownership for a specific cycle+batch (after adjustments) */
export async function hasStudentCycleAccess(
  studentId: number,
  batchId: number,
  cycleId: number
): Promise<boolean> {
  // Get enrollment cycles
  const { data: ecData } = await supabase.from("enrollment_cycles")
    .select("cycle_id, cycle_type")
    .eq("student_id", studentId)
    .eq("batch_id", batchId);

  // Get adjustments
  const { data: adjData } = await supabase.from("cycle_adjustments")
    .select("original_cycle_id, new_cycle_id, status")
    .eq("student_id", studentId)
    .eq("batch_id", batchId)
    .eq("status", "APPLIED");

  const effective = getEffectiveCycles(ecData || [], adjData || []);
  return effective.some(ec => ec.cycle_id === cycleId);
}
