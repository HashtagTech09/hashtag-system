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
        batches: { id: 10, name: "Jazz 1.1", batch_code: "Jazz1.1-ED", style: "Jazz Level 1", style_base: "Jazz" },
      },
    };

    const selectedBatches = [{ id: 10, name: "Jazz 1.1", batch_code: "Jazz1.1-ED", style: "Jazz Level 1", style_base: "Jazz" }];

    expect(findEligibleDropInForRegistration([dropIn], selectedBatches, "2026-08-03")).toBe(dropIn);
    expect(findEligibleDropInForRegistration([dropIn], selectedBatches, "2026-08-04")).toBeNull();
  });

  it("matches by batch identity on the same date even when style labels differ", () => {
    const dropIn = {
      id: 2,
      amount: 644,
      payment: { final_amount: 760, gst: 116 },
      batch_sessions: {
        session_date: "2026-08-03",
        style: "Jazz Beginners",
        batches: { id: 15, name: "Jazz 1.1", batch_code: "Jazz1.1-ED", style: "Jazz Beginners", style_base: "Jazz" },
      },
    };

    const selectedBatches = [{ id: 15, name: "Jazz 1.1", batch_code: "Jazz1.1-ED", style: "Jazz Level 1", style_base: "Jazz" }];

    expect(findEligibleDropInForRegistration([dropIn], selectedBatches, "2026-08-03")).toBe(dropIn);
  });
});
