import { describe, expect, it } from "vitest";
import { computeCycleAssignment, detectStudentStatus, isPlanValid, matchPlanCycles, type PlanCycle, type SubPlan } from "./enrollmentUtils";

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
});
