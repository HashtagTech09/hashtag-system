import { getBatchDiscount } from "@/lib/enrollmentUtils";

/** Style hierarchy: lower number = higher priority = charged full price first */
export const STYLE_HIERARCHY: Record<string, number> = {
  Jazz: 1,
  Ballet: 2,
  Modern: 3,
  "Hip Hop": 4,
  Heels: 5,
};

export const STYLE_OPTIONS = ["Jazz", "Ballet", "Modern", "Hip Hop", "Heels"] as const;

export const LEVEL_OPTIONS = [
  "Kids",
  "Level 1",
  "Level 2",
  "Level 3",
  "Level 4",
  "Level 5",
  "Kids Level 2",
] as const;

/**
 * Parse a combined style string like "Jazz Level 1", "Kids Jazz Level 2", "Hip Hop Level 3"
 * into { styleBase, level }.
 */
export function parseStyle(combined: string): { styleBase: string; level: string } {
  if (!combined) return { styleBase: "", level: "" };

  const normalized = combined.trim();

  // Try matching known styles from longest to shortest to handle "Hip Hop" before "Hip"
  const sortedStyles = [...STYLE_OPTIONS].sort((a, b) => b.length - a.length);

  for (const style of sortedStyles) {
    // Check patterns like "Kids Jazz Level 2" → style=Jazz, level=Kids Level 2
    const kidsPrefix = `Kids ${style}`;
    if (normalized.startsWith(kidsPrefix)) {
      const remainder = normalized.slice(kidsPrefix.length).trim();
      if (remainder) {
        return { styleBase: style, level: `Kids ${remainder}` };
      }
      return { styleBase: style, level: "Kids" };
    }

    // Check direct match like "Jazz Level 1"
    if (normalized.startsWith(style)) {
      const remainder = normalized.slice(style.length).trim();
      return { styleBase: style, level: remainder || "Level 1" };
    }
  }

  return { styleBase: combined, level: "" };
}

/** Build eligibility key from style_base and level, e.g. "JAZZ-LEVEL 1" */
export function buildEligibilityKey(styleBase: string, level: string): string {
  if (!styleBase || !level) return "";
  return `${styleBase.toUpperCase()}-${level.toUpperCase()}`;
}

/** Build display style from style_base and level, e.g. "Jazz Level 1", "Kids Jazz" */
export function buildDisplayStyle(styleBase: string, level: string): string {
  if (!styleBase) return "";
  if (!level) return styleBase;

  // If level starts with "Kids", prefix the style
  if (level.startsWith("Kids")) {
    const subLevel = level.replace("Kids", "").trim();
    if (subLevel) return `Kids ${styleBase} ${subLevel}`;
    return `Kids ${styleBase}`;
  }

  return `${styleBase} ${level}`;
}

/** Get hierarchy priority for a style (lower = higher priority). Returns 99 for unknown. */
export function getStylePriority(styleBase: string): number {
  return STYLE_HIERARCHY[styleBase] ?? 99;
}

/** Sort batches by style hierarchy (highest priority first = lowest number) */
export function sortBatchesByHierarchy<T extends { style_base?: string | null }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    return getStylePriority(a.style_base || "") - getStylePriority(b.style_base || "");
  });
}

export interface PaymentAllocation {
  batch_id: number;
  studio_id: number | null;
  allocated_amount: number;
  is_primary: boolean;
}

export function allocateCollectedAmount<T extends { allocated_amount: number; is_primary?: boolean }>(
  allocations: T[],
  collectedAmount?: number,
): T[] {
  if (!allocations.length || collectedAmount === undefined || collectedAmount === null) return allocations;

  const totalCollected = Math.round(Number(collectedAmount) || 0);
  if (totalCollected <= 0) return allocations;

  const baseTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount || 0), 0);
  if (baseTotal <= 0) {
    const equalShare = Math.floor(totalCollected / allocations.length);
    let remainder = totalCollected - (equalShare * allocations.length);
    return allocations.map((allocation, idx) => {
      const extra = idx === 0 ? remainder : 0;
      if (idx === 0) remainder = 0;
      return { ...allocation, allocated_amount: equalShare + extra };
    });
  }

  const scaled = allocations.map((allocation) => ({
    ...allocation,
    allocated_amount: Math.round((Number(allocation.allocated_amount || 0) / baseTotal) * totalCollected),
  }));
  const scaledTotal = scaled.reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
  const roundingDiff = totalCollected - scaledTotal;
  if (roundingDiff !== 0) {
    const primaryIndex = Math.max(0, scaled.findIndex((allocation) => allocation.is_primary));
    scaled[primaryIndex] = {
      ...scaled[primaryIndex],
      allocated_amount: scaled[primaryIndex].allocated_amount + roundingDiff,
    };
  }

  return scaled;
}

/**
 * Compute per-batch payment allocations.
 * Primary batch (highest hierarchy) gets full price, others get discounted price.
 * When collectedAmount is provided, the allocations are scaled so their total
 * matches the actual amount collected, including GST and registration fee.
 */
export function computePaymentAllocations(
  sortedBatches: { id: number; studio_id: number | null; style_base?: string | null }[],
  perBatchFee: number,
  discountPct: number,
  collectedAmount?: number,
): PaymentAllocation[] {
  if (sortedBatches.length === 0) return [];

  const baseAllocations = sortedBatches.map((batch, idx) => {
    const effectiveDiscount = idx === 0 ? 0 : (discountPct > 0 ? discountPct : getBatchDiscount(idx + 1));
    return {
      batch_id: batch.id,
      studio_id: batch.studio_id,
      allocated_amount: Math.round(perBatchFee * (1 - effectiveDiscount)),
      is_primary: idx === 0,
    };
  });

  return allocateCollectedAmount(baseAllocations, collectedAmount);
}
