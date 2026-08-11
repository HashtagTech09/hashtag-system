import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

function isOpenEntryLevel(level?: string | null) {
  const normalized = normalize(level);
  return !normalized || normalized === "kids" || normalized === "level 1" || normalized === "kids level 1";
}

function isBatchPromotionLocked(batch?: any | null) {
  if (!batch) return false;
  return Boolean(batch.promotion_required ?? !isOpenEntryLevel(batch.level));
}

function promotionUnlocksBatch(batch: any, promotion: any) {
  if (promotion.status !== "approved") return false;
  if (promotion.target_batch_id && promotion.target_batch_id === batch.id) return true;
  return normalize(promotion.style_base) === normalize(batch.style_base)
    && normalize(promotion.to_level) === normalize(batch.level);
}

function getCycleId(cycle: any) {
  return cycle?.cycle_id ?? cycle?.cycleId ?? null;
}

function getCycleType(cycle: any) {
  return cycle?.cycle_type ?? cycle?.cycleType ?? "regular";
}

async function fillMissingPreviousBatchIds(supabase: any, records: any[]) {
  const resolved: any[] = [];
  for (const record of records) {
    if (record.previous_batch_id || (record.status_type !== "REN" && record.status_type !== "REV")) {
      resolved.push(record);
      continue;
    }

    const { data: previousRows } = await supabase
      .from("enrollments")
      .select("batch_id, end_date")
      .eq("student_id", record.student_id)
      .lt("end_date", record.start_date)
      .order("end_date", { ascending: false });

    const latestEndDate = previousRows?.[0]?.end_date || null;
    const previousBatchIds = latestEndDate
      ? (previousRows || [])
          .filter((row: any) => row.end_date === latestEndDate)
          .map((row: any) => row.batch_id)
      : [];

    resolved.push({
      ...record,
      previous_batch_id: previousBatchIds.includes(record.batch_id)
        ? record.batch_id
        : previousBatchIds[0] ?? null,
    });
  }
  return resolved;
}

async function assertPromotionAccess(supabase: any, request: any, enrollmentData: any) {
  const enrolledBatchIds = [
    ...(enrollmentData.enrollments || []).map((enrollment: any) => enrollment.batch_id),
    ...(enrollmentData.existing_extensions || []).map((extension: any) => extension.batch_id),
  ].filter(Boolean);

  if (enrolledBatchIds.length === 0) return;

  const [{ data: selectedBatches }, { data: promotions }, { data: existingEnrollments }] = await Promise.all([
    supabase.from("batches").select("id, name, style_base, level, promotion_required").in("id", enrolledBatchIds),
    supabase
      .from("student_promotions")
      .select("student_id, style_base, to_level, target_batch_id, status")
      .eq("student_id", request.student_id)
      .eq("status", "approved"),
    supabase
      .from("enrollments")
      .select("batch_id, batches(style_base, level)")
      .eq("student_id", request.student_id),
  ]);

  const hasExistingAccess = (batch: any) => (existingEnrollments || []).some((enrollment: any) => (
    enrollment.batch_id === batch.id
    || (normalize(enrollment.batches?.style_base) === normalize(batch.style_base)
      && normalize(enrollment.batches?.level) === normalize(batch.level))
  ));

  const lockedWithoutApproval = (selectedBatches || []).filter((batch: any) => (
    isBatchPromotionLocked(batch)
    && !hasExistingAccess(batch)
    && !(promotions || []).some((promotion: any) => promotionUnlocksBatch(batch, promotion))
  ));

  if (lockedWithoutApproval.length > 0) {
    throw new Error(`Promotion approval is required for: ${lockedWithoutApproval.map((batch: any) => batch.name).join(", ")}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let claimedRequest: any = null;

  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token) return json({ error: "Missing confirmation token" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Supabase service credentials are not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: request, error: requestErr } = await supabase
      .from("cash_payment_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (requestErr || !request) return json({ error: "Cash payment request not found or invalid link." }, 404);
    if (request.status === "confirmed") return json({ success: true, already_confirmed: true });
    if (request.status === "cancelled") return json({ error: "This request has been cancelled." }, 400);
    if (request.status === "rejected") return json({ error: "This request has been rejected." }, 400);
    if (request.status === "expired") return json({ error: "This confirmation link has expired." }, 400);
    if (request.status === "processing") return json({ error: "This request is already being processed." }, 409);

    const nowIso = new Date().toISOString();
    if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
      await supabase
        .from("cash_payment_requests")
        .update({ status: "expired" })
        .eq("id", request.id)
        .eq("status", "pending");
      return json({ error: "This confirmation link has expired." }, 400);
    }

    const { data: claimed, error: claimErr } = await supabase
      .from("cash_payment_requests")
      .update({ status: "processing", confirmed_at: nowIso })
      .eq("id", request.id)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .select()
      .single();

    if (claimErr || !claimed) {
      return json({ error: "This request has already been handled or has expired." }, 409);
    }
    claimedRequest = claimed;

    const enrollmentData = claimed.enrollment_data || {};
    await assertPromotionAccess(supabase, claimed, enrollmentData);

    const { data: payment, error: payErr } = await supabase.from("payments").insert({
      organization_id: claimed.organization_id,
      student_id: claimed.student_id,
      amount: claimed.amount,
      gst: claimed.gst,
      final_amount: claimed.final_amount,
      payment_mode: "cash",
      status: "success",
      confirmed_by_staff_id: claimed.staff_user_id,
    }).select().single();
    if (payErr) throw payErr;

    if (enrollmentData.drop_in) {
      const dropIn = enrollmentData.drop_in;
      const { data: existingDropIn } = await supabase
        .from("drop_ins")
        .select("id")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (!existingDropIn) {
        const { error: dropInErr } = await supabase.from("drop_ins").insert({
          organization_id: dropIn.organization_id || payment.organization_id,
          student_id: dropIn.student_id || payment.student_id,
          batch_session_id: dropIn.batch_session_id,
          amount: dropIn.amount ?? payment.amount,
          payment_id: payment.id,
        });
        if (dropInErr) throw dropInErr;
      }
    }

    let insertedEnrollments: any[] = [];
    if (enrollmentData.enrollments?.length) {
      const records = await fillMissingPreviousBatchIds(supabase, enrollmentData.enrollments.map((record: any) => ({
        ...record,
        payment_id: payment.id,
      })));
      const { data: inserted, error: enrollmentErr } = await supabase.from("enrollments").insert(records).select();
      if (enrollmentErr) throw enrollmentErr;
      insertedEnrollments = inserted || [];
    }

    const cyclesTemplate = enrollmentData.enrollment_cycles_template || [];
    if (insertedEnrollments.length > 0 && cyclesTemplate.length > 0) {
      const cycleRows = insertedEnrollments.flatMap((enrollment: any) =>
        cyclesTemplate.map((cycle: any) => ({
          enrollment_id: enrollment.id,
          student_id: enrollment.student_id,
          batch_id: enrollment.batch_id,
          cycle_id: getCycleId(cycle),
          cycle_type: getCycleType(cycle),
        }))
      ).filter((cycle: any) => cycle.cycle_id);
      const { error: cycleErr } = await supabase.from("enrollment_cycles").insert(cycleRows);
      if (cycleErr) throw cycleErr;
    }

    for (const extension of enrollmentData.existing_extensions || []) {
      if (extension.missing_cycles?.length) {
        const missingRows = extension.missing_cycles.map((cycle: any) => ({
          enrollment_id: extension.enrollment_id,
          student_id: claimed.student_id,
          batch_id: extension.batch_id,
          cycle_id: getCycleId(cycle),
          cycle_type: getCycleType(cycle),
        })).filter((cycle: any) => cycle.cycle_id);
        const { error: missingErr } = await supabase.from("enrollment_cycles").insert(missingRows);
        if (missingErr) throw missingErr;
      }

      const update: Record<string, unknown> = {};
      if (extension.end_date) update.end_date = extension.end_date;
      if (extension.end_cycle_id) update.end_cycle_id = extension.end_cycle_id;
      if (Object.keys(update).length > 0) {
        const { error: updateErr } = await supabase
          .from("enrollments")
          .update(update)
          .eq("id", extension.enrollment_id);
        if (updateErr) throw updateErr;
      }
    }

    if (enrollmentData.payment_allocations?.length) {
      const { error: allocationErr } = await supabase.from("payment_allocations").insert(
        enrollmentData.payment_allocations.map((allocation: any) => ({ ...allocation, payment_id: payment.id }))
      );
      if (allocationErr) throw allocationErr;
    }

    const { error: confirmErr } = await supabase
      .from("cash_payment_requests")
      .update({ status: "confirmed" })
      .eq("id", claimed.id);
    if (confirmErr) throw confirmErr;

    return json({ success: true, payment_id: payment.id });
  } catch (err: any) {
    try {
      if (claimedRequest) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from("cash_payment_requests")
            .update({ status: "pending", confirmed_at: null })
            .eq("id", claimedRequest.id)
            .eq("status", "processing");
        }
      }
    } catch (_) {
      // Keep the original failure visible to the caller.
    }

    return json({ error: err.message || "Could not confirm cash payment" }, 500);
  }
});
