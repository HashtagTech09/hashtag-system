export type DropInLike = {
  id: number;
  amount?: number | string | null;
  payments?: { final_amount?: number | string | null; gst?: number | string | null } | null;
  payment?: { final_amount?: number | string | null; gst?: number | string | null } | null;
  batch_sessions?: {
    session_date?: string | null;
    style?: string | null;
    batches?: {
      name?: string | null;
      style?: string | null;
      style_base?: string | null;
    } | null;
  } | null;
};

type BatchLike = {
  id?: number;
  name?: string | null;
  style?: string | null;
  style_base?: string | null;
};

function normalizeStyle(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function styleMatchesDropIn(dropIn: DropInLike, batch: BatchLike): boolean {
  const sessionStyle = normalizeStyle(dropIn.batch_sessions?.style || dropIn.batch_sessions?.batches?.style);
  if (!sessionStyle) return false;

  const exactStyle = normalizeStyle(batch.style);
  if (exactStyle && exactStyle === sessionStyle) return true;

  const baseStyle = normalizeStyle(batch.style_base);
  return Boolean(baseStyle && (sessionStyle === baseStyle || sessionStyle.startsWith(`${baseStyle} level`)));
}

export function getDropInAdjustmentAmount(dropIn: DropInLike | null | undefined): number {
  const payment = dropIn?.payment || dropIn?.payments;
  const finalAmount = Number(payment?.final_amount);
  if (Number.isFinite(finalAmount) && finalAmount > 0) return finalAmount;

  const amount = Number(dropIn?.amount) || 0;
  const gst = Number(payment?.gst);
  if (Number.isFinite(gst) && gst > 0) return amount + gst;

  return amount;
}

export function findEligibleDropInForRegistration(
  dropIns: DropInLike[],
  selectedBatches: BatchLike[],
  registrationDate: string | string[],
): DropInLike | null {
  const registrationDates = Array.isArray(registrationDate)
    ? registrationDate.filter(Boolean)
    : [registrationDate].filter(Boolean);
  if (registrationDates.length === 0 || selectedBatches.length === 0) return null;
  const dateSet = new Set(registrationDates);

  return dropIns.find((dropIn) => {
    const session = dropIn.batch_sessions;
    if (!session?.session_date || !dateSet.has(session.session_date)) return false;
    return selectedBatches.some((batch) => styleMatchesDropIn(dropIn, batch));
  }) || null;
}

export function buildDropInAdjustmentPayload(dropIn: DropInLike | null | undefined) {
  if (!dropIn) return null;
  const adjustedAmount = getDropInAdjustmentAmount(dropIn);
  if (!adjustedAmount) return null;
  return {
    drop_in_id: dropIn.id,
    adjusted_amount: adjustedAmount,
  };
}
