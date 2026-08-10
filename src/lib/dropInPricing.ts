export const DEFAULT_DROP_IN_TOTAL = 760;
export const DEFAULT_LONG_DROP_IN_TOTAL = 1540;
export const DROP_IN_LONG_SLOT_MINUTES = 150;
export const DEFAULT_GST_RATE = 0.18;

type SessionTime = {
  start_time?: string | null;
  end_time?: string | null;
};

export type DropInPricing = {
  inclusiveTotal: number;
  baseAmount: number;
  gst: number;
  durationMinutes: number;
  isLongSlot: boolean;
};

export function minutesBetweenTimes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;

  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;
  if (endTotal < startTotal) endTotal += 24 * 60;
  return endTotal - startTotal;
}

export function splitInclusiveGst(total: number, gstRate = DEFAULT_GST_RATE) {
  const finalTotal = Math.round(Number(total) || 0);
  const baseAmount = Math.round(finalTotal / (1 + gstRate));
  return {
    baseAmount,
    gst: finalTotal - baseAmount,
    finalTotal,
  };
}

export function getDropInPricingForSession(
  session: SessionTime | null | undefined,
  options: { regularTotal?: number; longTotal?: number; gstRate?: number } = {}
): DropInPricing {
  const durationMinutes = minutesBetweenTimes(session?.start_time, session?.end_time);
  const isLongSlot = durationMinutes >= DROP_IN_LONG_SLOT_MINUTES;
  const inclusiveTotal = isLongSlot
    ? options.longTotal ?? DEFAULT_LONG_DROP_IN_TOTAL
    : options.regularTotal ?? DEFAULT_DROP_IN_TOTAL;
  const { baseAmount, gst, finalTotal } = splitInclusiveGst(inclusiveTotal, options.gstRate ?? DEFAULT_GST_RATE);

  return {
    inclusiveTotal: finalTotal,
    baseAmount,
    gst,
    durationMinutes,
    isLongSlot,
  };
}
