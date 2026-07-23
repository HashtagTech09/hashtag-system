import { describe, expect, it } from "vitest";
import {
  buildSafeCsvHeaders,
  buildBatchCodeCandidates,
  cleanImportValue,
  findBatchForSmartEnrollment,
  matchSmartEnrollmentCycles,
  normalizePhone,
  type SmartCycle,
} from "./smartEnrollmentImport";

const cycles: SmartCycle[] = [
  { id: 16, name: "April'26", start_date: "2026-03-30", end_date: "2026-04-26", plan_type: "regular" },
  { id: 17, name: "May'26", start_date: "2026-04-27", end_date: "2026-05-24", plan_type: "regular" },
  { id: 18, name: "Grid'26", start_date: "2026-05-25", end_date: "2026-07-05", plan_type: "grid" },
  { id: 19, name: "July'26", start_date: "2026-07-06", end_date: "2026-08-02", plan_type: "regular" },
  { id: 23, name: "Grid'2.0'26", start_date: "2026-10-26", end_date: "2026-12-13", plan_type: "grid" },
];

describe("smart enrollment import helpers", () => {
  it("cleans CSV BOMs and invisible characters", () => {
    expect(cleanImportValue("\uFEFFstudent_name\u200B ")).toBe("student_name");
  });

  it("turns blank and duplicate CSV headers into safe Select values", () => {
    expect(buildSafeCsvHeaders(["\uFEFFstudent_name", "", "cycles", "cycles"])).toEqual([
      "student_name",
      "Column 2",
      "cycles",
      "cycles (2)",
    ]);
  });

  it("normalizes common Indian phone number formats", () => {
    expect(normalizePhone("+91 98114 01934")).toBe("9811401934");
    expect(normalizePhone("09811401934")).toBe("9811401934");
  });

  it("builds batch candidates from level wording", () => {
    expect(buildBatchCodeCandidates("Jazz Level 3", "nda")).toContain("Jazz3-NDA");
    expect(buildBatchCodeCandidates("Hip Hop lvl 2", "RG")).toContain("HipHop2-RG");
  });

  it("matches batches after normalizing punctuation and casing", () => {
    const { batch } = findBatchForSmartEnrollment(
      [{ id: 1, batch_code: "HipHop2-RG" }],
      "Hip Hop Level 2",
      "rg"
    );

    expect(batch?.id).toBe(1);
  });

  it("matches bare month, first grid, and Grid 2 shorthand tokens", () => {
    const result = matchSmartEnrollmentCycles("April; May; Grid; Grid 2", cycles);

    expect(result.unmatchedTokens).toEqual([]);
    expect(result.matchedCycles.map(c => c.id)).toEqual([16, 17, 18, 23]);
  });

  it("reports only tokens that could not be matched", () => {
    const result = matchSmartEnrollmentCycles("April, Mystery", cycles);

    expect(result.matchedCycles.map(c => c.id)).toEqual([16]);
    expect(result.unmatchedTokens).toEqual(["Mystery"]);
  });
});
