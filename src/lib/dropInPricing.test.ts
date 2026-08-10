import { describe, expect, it } from "vitest";
import { getDropInPricingForSession } from "./dropInPricing";

describe("drop-in pricing", () => {
  it("treats regular drop-in fee as GST-inclusive", () => {
    const pricing = getDropInPricingForSession({ start_time: "17:30", end_time: "18:30" });

    expect(pricing.inclusiveTotal).toBe(760);
    expect(pricing.baseAmount).toBe(644);
    expect(pricing.gst).toBe(116);
    expect(pricing.isLongSlot).toBe(false);
  });

  it("uses the long-slot GST-inclusive fee for 2.5-hour sessions", () => {
    const pricing = getDropInPricingForSession({ start_time: "17:30", end_time: "20:00" });

    expect(pricing.inclusiveTotal).toBe(1540);
    expect(pricing.baseAmount).toBe(1305);
    expect(pricing.gst).toBe(235);
    expect(pricing.isLongSlot).toBe(true);
  });
});
