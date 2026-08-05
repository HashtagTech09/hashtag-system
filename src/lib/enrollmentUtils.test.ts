import { describe, expect, it } from "vitest";
import { computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getRenewalStartCycleIndex, getStartCycleIndex, isPlanValid, matchPlanCycles, roundToNearest100, type PlanCycle, type SubPlan } from "./enrollmentUtils";

const cycles: PlanCycle[] = [
  {
    id: 1,
    name: "September'26",
    start_date: "2026-09-01",
    end_date: "2026-09-30",
    plan_type: "regular",
    is_active: false,
    grace_days: 14,
    registration_deadline: "2026-09-14",
    organization_id: 1,
  },
  {
    id: 2,
    name: "October'26",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    plan_type: "regular",
    is_active: false,
    grace_days: 14,
    registration_deadline: "2026-10-14",
    organization_id: 1,
  },
  {
    id: 3,
    name: "Grid 2.0'26",
    start_date: "2026-11-01",
    end_date: "2026-12-31",
    plan_type: "grid",
    is_active: false,
    grace_days: 21,
    registration_deadline: "2026-10-31",
    organization_id: 1,
  },
  {
    id: 4,
    name: "January'27",
    start_date: "2027-01-01",
    end_date: "2027-01-31",
    plan_type: "regular",
    is_active: true,
    grace_days: 14,
    registration_deadline: "2027-01-14",
    organization_id: 1,
  },
];

const plan = (regular: number, grid: number): SubPlan => ({
  id: Number(`${regular}${grid}`),
  name: `${regular}R${grid}G`,
  total_cycles: regular + grid,
  total_regular_cycles: regular,
  total_grid_cycles: grid,
  is_active: true,
  organization_id: 1,
});

describe("grid-aware enrollment cycle matching", () => {
  it("skips Grid when assigning a regular-only plan", () => {
    const matched = matchPlanCycles(plan(3, 0), cycles, 0);

    expect(matched?.map(c => c.id)).toEqual([1, 2, 4]);
    expect(isPlanValid(plan(3, 0), cycles, 0)).toBe(true);
  });

  it("can assign a Grid-only plan separately before Grid starts", () => {
    const assignment = computeCycleAssignment(plan(0, 1), cycles, 0);

    expect(assignment?.matched.map(c => c.id)).toEqual([3]);
    expect(assignment?.startCycle.id).toBe(3);
    expect(assignment?.endCycle.id).toBe(3);
  });

  it("keeps students as renewals when they skipped only Grid between regular cycles", () => {
    expect(detectStudentStatus([{ end_date: "2026-10-31" }], cycles, "2026-11-15")).toEqual({
      status: "REN",
      latestEndDate: "2026-10-31",
    });
    expect(detectStudentStatus([{ end_date: "2026-10-31" }], cycles, "2027-01-10")).toEqual({
      status: "REN",
      latestEndDate: "2026-10-31",
    });
  });

  it("does not treat missed regular cycles as a Grid-gap renewal", () => {
    expect(detectStudentStatus([{ end_date: "2026-09-30" }], cycles, "2027-01-10").status).toBe("REV");
  });

  it("starts from the next cycle after the registration grace deadline", () => {
    expect(getStartCycleIndex(cycles, "2026-09-14")).toBe(0);
    expect(getStartCycleIndex(cycles, "2026-09-15")).toBe(1);
  });

  it("uses start date plus grace days when a cycle has no stored registration deadline", () => {
    const cyclesWithoutDeadline = cycles.map((cycle) => cycle.id === 1 ? { ...cycle, registration_deadline: null } : cycle);

    expect(getStartCycleIndex(cyclesWithoutDeadline, "2026-09-15")).toBe(0);
    expect(getStartCycleIndex(cyclesWithoutDeadline, "2026-09-16")).toBe(1);
  });

  it("starts an early renewal after the student's latest enrolled cycle", () => {
    expect(getRenewalStartCycleIndex(cycles, "2026-10-31", "2026-09-10")).toBe(2);
  });

  it("does not move renewal backward before the currently open cycle", () => {
    expect(getRenewalStartCycleIndex(cycles, "2026-09-30", "2027-01-10")).toBe(3);
  });
});

describe("registration fee and rounding", () => {
  it("waives registration fee for renewals on or before the latest end date", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 1,
      gridCycles: 0,
      detectedStatus: "REN",
      latestEndDate: "2026-09-30",
      dropInAmount: 0,
      today: "2026-09-30",
      regFee: 590,
    });

    expect(breakdown.regFee).toBe(0);
    expect(breakdown.applyRegFee).toBe(false);
    expect(breakdown.registrationFeeDiscounted).toBe(true);
    expect(breakdown.registrationFeeDiscountedAmount).toBe(590);
    expect(breakdown.roundedBatchTotal).toBe(3800);
    expect(breakdown.total).toBe(3800);
  });

  it("charges registration fee for late renewals inside grace days", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 1,
      gridCycles: 0,
      detectedStatus: "REN",
      latestEndDate: "2026-09-30",
      dropInAmount: 0,
      today: "2026-10-05",
      regFee: 590,
    });

    expect(breakdown.regFee).toBe(590);
    expect(breakdown.applyRegFee).toBe(true);
    expect(breakdown.isLateRenewal).toBe(true);
    expect(breakdown.registrationFeeDiscounted).toBe(false);
    expect(breakdown.roundedBatchTotal).toBe(3800);
    expect(breakdown.total).toBe(4390);
  });

  it("waives registration fee for late 6-month renewals", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 5,
      gridCycles: 1,
      detectedStatus: "REN",
      latestEndDate: "2026-09-30",
      dropInAmount: 0,
      today: "2026-10-05",
      regFee: 590,
    });

    expect(breakdown.regFee).toBe(0);
    expect(breakdown.applyRegFee).toBe(false);
    expect(breakdown.isLateRenewal).toBe(true);
    expect(breakdown.registrationFeeDiscounted).toBe(true);
    expect(breakdown.registrationFeeDiscountLabel).toBe("Registration fee discounted for 6-month/yearly renewal");
    expect(breakdown.roundedBatchTotal).toBe(26500);
    expect(breakdown.total).toBe(26500);
  });

  it("waives registration fee for late yearly renewals", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 10,
      gridCycles: 2,
      detectedStatus: "REN",
      latestEndDate: "2026-09-30",
      dropInAmount: 0,
      today: "2026-10-05",
      regFee: 590,
    });

    expect(breakdown.regFee).toBe(0);
    expect(breakdown.applyRegFee).toBe(false);
    expect(breakdown.registrationFeeDiscounted).toBe(true);
    expect(breakdown.roundedBatchTotal).toBe(50000);
    expect(breakdown.total).toBe(50000);
  });

  it("rounds class totals to the nearest 100 before adding registration fee", () => {
    expect(roundToNearest100(11328)).toBe(11300);
    expect(roundToNearest100(11351)).toBe(11400);

    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 3,
      gridCycles: 0,
      detectedStatus: "NEW",
      latestEndDate: null,
      dropInAmount: 0,
      today: "2026-09-01",
      regFee: 590,
    });

    expect(breakdown.subtotal).toBe(9600);
    expect(breakdown.gst).toBe(1728);
    expect(breakdown.batchTotalWithGst).toBe(11328);
    expect(breakdown.roundedBatchTotal).toBe(11300);
    expect(breakdown.regFee).toBe(590);
    expect(breakdown.total).toBe(11890);
  });
});
