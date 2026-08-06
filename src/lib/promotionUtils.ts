export type PromotionStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface PromotionBatchLike {
  id: number;
  style_base?: string | null;
  level?: string | null;
  promotion_required?: boolean | null;
}

export interface ApprovedPromotionLike {
  student_id?: number | null;
  style_base?: string | null;
  to_level?: string | null;
  target_batch_id?: number | null;
  status?: string | null;
}

const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

export function isOpenEntryLevel(level?: string | null) {
  const normalized = normalize(level);
  return !normalized || normalized === "kids" || normalized === "level 1" || normalized === "kids level 1";
}

export function shouldRequirePromotionForLevel(level?: string | null) {
  return !isOpenEntryLevel(level);
}

export function isBatchPromotionLocked(batch?: PromotionBatchLike | null) {
  if (!batch) return false;
  return Boolean(batch.promotion_required ?? shouldRequirePromotionForLevel(batch.level));
}

export function promotionUnlocksBatch(batch: PromotionBatchLike, promotion: ApprovedPromotionLike) {
  if (promotion.status !== "approved") return false;
  if (promotion.target_batch_id && promotion.target_batch_id === batch.id) return true;
  return normalize(promotion.style_base) === normalize(batch.style_base)
    && normalize(promotion.to_level) === normalize(batch.level);
}

export function canStudentSelectBatch(batch: PromotionBatchLike, promotions: ApprovedPromotionLike[]) {
  if (!isBatchPromotionLocked(batch)) return true;
  return promotions.some((promotion) => promotionUnlocksBatch(batch, promotion));
}

export function getLockedBatchNames(batches: PromotionBatchLike[], promotions: ApprovedPromotionLike[]) {
  return batches
    .filter((batch) => !canStudentSelectBatch(batch, promotions))
    .map((batch) => batch.level ? `${batch.style_base || batch.id} ${batch.level}` : String(batch.id));
}
