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

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getRazorpayCredentials(account: string | null): { keyId: string; keySecret: string } {
  if (account === "test") {
    return {
      keyId: getRequiredEnv("RZP_TEST_KEY_ID"),
      keySecret: getRequiredEnv("RZP_TEST_KEY_SECRET"),
    };
  }
  if (account === "pride") {
    return {
      keyId: getRequiredEnv("RZP_PRIDE_KEY_ID"),
      keySecret: getRequiredEnv("RZP_PRIDE_KEY_SECRET"),
    };
  }
  return {
    keyId: getRequiredEnv("RZP_PRUDENT_KEY_ID"),
    keySecret: getRequiredEnv("RZP_PRUDENT_KEY_SECRET"),
  };
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSha256Hex(`${orderId}|${paymentId}`, secret);
  return expected === signature;
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

async function insertMissingCycles(supabase: any, rows: any[]) {
  const validRows = rows.filter((row) => row.cycle_id);
  if (validRows.length === 0) return;

  const missingRows: any[] = [];
  for (const row of validRows) {
    const { data: existing } = await supabase
      .from("enrollment_cycles")
      .select("id")
      .eq("enrollment_id", row.enrollment_id)
      .eq("cycle_id", row.cycle_id)
      .maybeSingle();
    if (!existing) missingRows.push(row);
  }

  if (missingRows.length > 0) {
    const { error } = await supabase.from("enrollment_cycles").insert(missingRows);
    if (error) throw error;
  }
}

async function completePendingEnrollment(supabase: any, payment: any, rzpPayment: any) {
  const rzpFee = Number(rzpPayment.fee || 0) / 100;
  const rzpAmount = Number(rzpPayment.amount || 0) / 100;
  const netAmount = rzpAmount - rzpFee;

  const { error: paymentErr } = await supabase
    .from("payments")
    .update({
      status: "success",
      gateway_payment_id: rzpPayment.id,
      net_amount: netAmount,
    })
    .eq("id", payment.id);
  if (paymentErr) throw paymentErr;

  const { data: claimed, error: claimErr } = await supabase
    .from("pending_enrollments")
    .update({ status: "processing" })
    .eq("payment_id", payment.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (claimErr) throw claimErr;

    if (!claimed) {
      const { data: currentPending } = await supabase
        .from("pending_enrollments")
        .select("status")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (currentPending?.status === "completed") return { already_completed: true };
      return { pending: true, error: "Payment confirmation is already being processed" };
  }

  try {
    const data = claimed.enrollment_data || {};

    if (data.drop_in) {
      const { data: existingDropIn } = await supabase
        .from("drop_ins")
        .select("id")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (!existingDropIn) {
        const dropIn = data.drop_in;
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
    const { data: existingEnrollments } = await supabase
      .from("enrollments")
      .select("*")
      .eq("payment_id", payment.id);

    if (existingEnrollments?.length) {
      insertedEnrollments = existingEnrollments;
    } else if (data.enrollments?.length) {
      const enrollments = await fillMissingPreviousBatchIds(supabase, data.enrollments.map((enrollment: any) => ({
        ...enrollment,
        payment_id: payment.id,
      })));
      const { data: inserted, error: enrollmentErr } = await supabase.from("enrollments").insert(enrollments).select();
      if (enrollmentErr) throw enrollmentErr;
      insertedEnrollments = inserted || [];
    }

    if (insertedEnrollments.length > 0 && data.enrollment_cycles_template?.length) {
      for (const enrollment of insertedEnrollments) {
        const cycles = data.enrollment_cycles_template.map((cycle: any) => ({
          enrollment_id: enrollment.id,
          student_id: enrollment.student_id,
          batch_id: enrollment.batch_id,
          cycle_id: getCycleId(cycle),
          cycle_type: getCycleType(cycle),
        }));
        await insertMissingCycles(supabase, cycles);
      }
    }

    if (data.existing_extensions?.length) {
      for (const extension of data.existing_extensions) {
        if (extension.missing_cycles?.length) {
          const missingRows = extension.missing_cycles.map((cycle: any) => ({
            enrollment_id: extension.enrollment_id,
            student_id: payment.student_id,
            batch_id: extension.batch_id,
            cycle_id: getCycleId(cycle),
            cycle_type: getCycleType(cycle),
          }));
          await insertMissingCycles(supabase, missingRows);
        }

        const update: Record<string, unknown> = {};
        if (extension.end_date) update.end_date = extension.end_date;
        if (extension.end_cycle_id) update.end_cycle_id = extension.end_cycle_id;
        if (Object.keys(update).length > 0) {
          const { error: updateErr } = await supabase.from("enrollments").update(update).eq("id", extension.enrollment_id);
          if (updateErr) throw updateErr;
        }
      }
    }

    if (data.payment_allocations?.length) {
      const { data: existingAllocations } = await supabase
        .from("payment_allocations")
        .select("id")
        .eq("payment_id", payment.id)
        .limit(1);
      if (!existingAllocations?.length) {
        const { error: allocationErr } = await supabase.from("payment_allocations").insert(
          data.payment_allocations.map((allocation: any) => ({
            payment_id: payment.id,
            batch_id: allocation.batch_id,
            studio_id: allocation.studio_id || null,
            allocated_amount: allocation.allocated_amount,
            is_primary: allocation.is_primary || false,
          })),
        );
        if (allocationErr) throw allocationErr;
      }
    }

    const { error: completeErr } = await supabase
      .from("pending_enrollments")
      .update({ status: "completed" })
      .eq("id", claimed.id);
    if (completeErr) throw completeErr;

    return { completed: true };
  } catch (error) {
    await supabase
      .from("pending_enrollments")
      .update({ status: "pending" })
      .eq("id", claimed.id)
      .eq("status", "processing");
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json().catch(() => ({}));
    if (!payment_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ success: false, error: "Missing Razorpay confirmation fields" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return json({ success: false, error: "Supabase service credentials are not configured" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .single();
    if (paymentErr || !payment) return json({ success: false, error: "Payment record not found" }, 404);

    if (payment.gateway_order_id !== razorpay_order_id) {
      return json({ success: false, error: "Razorpay order does not match this payment" }, 403);
    }

    if (payment.status === "success" && payment.gateway_payment_id === razorpay_payment_id) {
      const { data: pending } = await supabase
        .from("pending_enrollments")
        .select("status")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (!pending || pending.status === "completed") return json({ success: true, payment_id: payment.id, already_completed: true });
    }

    const { keyId, keySecret } = getRazorpayCredentials(payment.rzp_account);
    const signatureValid = await verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
    if (!signatureValid) return json({ success: false, error: "Invalid Razorpay checkout signature" }, 401);

    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {
        Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
      },
    });

    if (!rzpRes.ok) {
      const text = await rzpRes.text();
      return json({ success: false, error: `Could not verify Razorpay payment: ${text}` }, 502);
    }

    const rzpPayment = await rzpRes.json();
    if (rzpPayment.order_id !== razorpay_order_id) {
      return json({ success: false, error: "Razorpay payment belongs to a different order" }, 403);
    }

    if (rzpPayment.status !== "captured" && rzpPayment.captured !== true) {
      return json({ success: false, pending: true, error: `Razorpay status is ${rzpPayment.status || "not captured"}` });
    }

    const result = await completePendingEnrollment(supabase, payment, rzpPayment);
    if (result.pending) {
      return json({ success: false, pending: true, error: result.error || "Payment confirmation is still processing" });
    }
    return json({ success: true, payment_id: payment.id, ...result });
  } catch (err: any) {
    return json({ success: false, error: err.message || "Could not confirm Razorpay payment" }, 500);
  }
});
