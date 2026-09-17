import { describe, expect, it } from "vitest";
import { computeAddBatchBreakdown, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getRenewalStartCycleIndex, getStartCycleIndex, isPlanValid, matchPlanCycles, roundToNearest100, type PlanCycle, type SubPlan } from "./enrollmentUtils";

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

  it("waives registration fee for an August renewal simulated on July 28 while the current cycle is still active", () => {
    const status = detectStudentStatus([{ end_date: "2026-08-02" }], cycles, "2026-07-28");
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 1,
      gridCycles: 0,
      detectedStatus: status.status,
      latestEndDate: status.latestEndDate,
      dropInAmount: 0,
      today: "2026-07-28",
      regFee: 590,
    });

    expect(status).toEqual({ status: "REN", latestEndDate: "2026-08-02" });
    expect(breakdown.regFee).toBe(0);
    expect(breakdown.applyRegFee).toBe(false);
    expect(breakdown.registrationFeeDiscounted).toBe(true);
    expect(breakdown.registrationFeeDiscountLabel).toBe("Registration fee discounted during renewal period");
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
    expect(breakdown.registrationFeeDiscountLabel).toBe("Registration fee discounted for 6-month/yearly plan");
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

  it("waives registration fee for new 6-month registrations", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 1,
      regularCycles: 5,
      gridCycles: 1,
      detectedStatus: "NEW",
      latestEndDate: null,
      dropInAmount: 0,
      today: "2026-10-05",
      regFee: 590,
    });

    expect(breakdown.regFee).toBe(0);
    expect(breakdown.applyRegFee).toBe(false);
    expect(breakdown.registrationFeeDiscounted).toBe(true);
    expect(breakdown.registrationFeeDiscountLabel).toBe("Registration fee discounted for 6-month/yearly plan");
    expect(breakdown.total).toBe(26500);
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

  it("rounds 6-month two-batch plans to the expected fixed class total", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 2,
      regularCycles: 5,
      gridCycles: 1,
      detectedStatus: "REN",
      latestEndDate: "2026-12-31",
      dropInAmount: 0,
      today: "2026-09-01",
      regFee: 590,
      sortedBatches: [
        { id: 1, name: "Jazz 1", style_base: "Jazz" },
        { id: 2, name: "Heels 1", style_base: "Heels" },
      ],
    });

    expect(breakdown.batchTotalWithGst).toBe(49821);
    expect(breakdown.roundedBatchTotal).toBe(49800);
    expect(breakdown.total).toBe(49800);
  });

  it("uses the expected two-batch total for 2 regular plus 1 grid plans", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 2,
      regularCycles: 2,
      gridCycles: 1,
      detectedStatus: "REN",
      latestEndDate: "2026-12-31",
      dropInAmount: 0,
      today: "2026-09-01",
      regFee: 590,
      sortedBatches: [
        { id: 1, name: "Jazz 1", style_base: "Jazz" },
        { id: 2, name: "Heels 1", style_base: "Heels" },
      ],
    });

    expect(breakdown.batchTotalWithGst).toBe(31206);
    expect(breakdown.roundedBatchTotal).toBe(30800);
    expect(breakdown.total).toBe(30800);
  });

  it("uses the expected three-batch total for 2 regular plus 1 grid plans", () => {
    const breakdown = computeFeeBreakdown({
      batchCount: 3,
      regularCycles: 2,
      gridCycles: 1,
      detectedStatus: "REN",
      latestEndDate: "2026-12-31",
      dropInAmount: 0,
      today: "2026-09-01",
      regFee: 590,
      sortedBatches: [
        { id: 1, name: "Jazz 1", style_base: "Jazz" },
        { id: 2, name: "Heels 1", style_base: "Heels" },
        { id: 3, name: "Hip Hop 1", style_base: "Hip Hop" },
      ],
    });

    expect(breakdown.batchTotalWithGst).toBe(45647);
    expect(breakdown.roundedBatchTotal).toBe(44700);
    expect(breakdown.total).toBe(44700);
  });
});

describe("add-batch pricing", () => {
  it("uses existing batches as the first pricing positions and discounts the new batch", () => {
    const breakdown = computeAddBatchBreakdown({
      existingBatches: [{
        batch_id: 10,
        batch_name: "Jazz 1.1",
        style_base: "Jazz",
        coveredCycleIds: [1, 2, 4],
      }],
      newBatches: [{ id: 20, name: "Heels 1", style_base: "Heels" }],
      plan: plan(3, 0),
      planCycles: cycles,
      startCycleIndex: 0,
    });

    expect(breakdown).not.toBeNull();
    expect(breakdown?.batchAllocations).toEqual([
      expect.objectContaining({
        batch_id: 10,
        is_existing: true,
        is_primary: true,
        amount: 0,
        discountPct: 0,
      }),
      expect.objectContaining({
        batch_id: 20,
        is_existing: false,
        is_primary: false,
        amount: 8448,
        discountPct: 0.12,
      }),
    ]);
    expect(breakdown?.subtotal).toBe(8448);
  });

  it("does not apply the add-batch discount to an existing batch validity extension", () => {
    const breakdown = computeAddBatchBreakdown({
      existingBatches: [{
        batch_id: 10,
        batch_name: "Jazz 1.1",
        style_base: "Jazz",
        coveredCycleIds: [1, 2],
      }],
      newBatches: [{ id: 20, name: "Heels 1", style_base: "Heels" }],
      plan: plan(3, 0),
      planCycles: cycles,
      startCycleIndex: 0,
    });

    expect(breakdown?.batchAllocations[0]).toEqual(expect.objectContaining({
      batch_id: 10,
      amount: 3200,
      discountPct: 0,
      missingCycleIds: [4],
    }));
    expect(breakdown?.batchAllocations[1]).toEqual(expect.objectContaining({
      batch_id: 20,
      amount: 8448,
      discountPct: 0.12,
    }));
  });
});
