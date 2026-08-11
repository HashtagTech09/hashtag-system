import { describe, expect, it } from "vitest";
import { findEligibleDropInForRegistration } from "./dropInAdjustment";

describe("drop-in adjustment eligibility", () => {
  it("matches only the registration date passed by the caller", () => {
    const dropIn = {
      id: 1,
      amount: 644,
      payment: { final_amount: 760, gst: 116 },
      batch_sessions: {
        session_date: "2026-08-03",
        style: "Jazz Level 1",
        batches: { name: "Jazz 1.1", style: "Jazz Level 1", style_base: "Jazz" },
      },
    };

    const selectedBatches = [{ id: 10, name: "Jazz 1.1", style: "Jazz Level 1", style_base: "Jazz" }];

    expect(findEligibleDropInForRegistration([dropIn], selectedBatches, "2026-08-03")).toBe(dropIn);
    expect(findEligibleDropInForRegistration([dropIn], selectedBatches, "2026-08-04")).toBeNull();
  });
});
