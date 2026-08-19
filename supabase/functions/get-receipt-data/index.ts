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

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value || "").trim()).filter(Boolean))];
}

function formatMoney(value: unknown) {
  const n = Number(value || 0);
  return Math.round(n).toLocaleString("en-IN");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function paymentModeLabel(mode?: string | null) {
  const normalized = (mode || "").toLowerCase();
  if (normalized === "razorpay") return "Razorpay";
  if (normalized === "cash") return "Cash";
  if (normalized === "upi") return "UPI";
  return mode || "—";
}

function statusLabel(statuses: string[], lateRenewal: boolean) {
  const labels = statuses.map((status) => {
    if (status === "REN") return lateRenewal ? "Renewal - Late" : "Renewal";
    if (status === "REV") return "Revisit";
    if (status === "ADD") return "Add Batch";
    if (status === "NEW") return "New";
    return status;
  });
  return unique(labels).join(", ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, student_id, gateway_payment_id, order_id, cash_token } = await req.json().catch(() => ({}));
    const paymentId = Number(payment_id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) return json({ error: "Missing payment id" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase service credentials are not configured" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentErr || !payment) return json({ error: "Payment not found" }, 404);
    if (student_id && Number(student_id) !== Number(payment.student_id)) return json({ error: "Receipt does not match this student" }, 403);
    if (payment.status !== "success") return json({ error: "Receipt is available only after payment is confirmed" }, 409);

    const razorpayProofMatches = Boolean(
      (gateway_payment_id && payment.gateway_payment_id === gateway_payment_id)
      || (order_id && payment.gateway_order_id === order_id)
    );
    let cashProofMatches = false;
    if (cash_token && payment.payment_mode === "cash") {
      const { data: cashRequest } = await supabase
        .from("cash_payment_requests")
        .select("student_id, amount, gst, final_amount, status")
        .eq("token", cash_token)
        .eq("status", "confirmed")
        .maybeSingle();
      cashProofMatches = Boolean(
        cashRequest
        && Number(cashRequest.student_id) === Number(payment.student_id)
        && Number(cashRequest.amount) === Number(payment.amount)
        && Number(cashRequest.gst) === Number(payment.gst)
        && Number(cashRequest.final_amount) === Number(payment.final_amount)
      );
    }

    if (!razorpayProofMatches && !cashProofMatches) {
      return json({ error: "Receipt proof is missing or invalid" }, 403);
    }

    const [
      studentRes,
      enrollmentRes,
      dropInRes,
      adjustedDropInRes,
      registrationFeeRes,
    ] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, phone, email, users(name, phone, email)")
        .eq("id", payment.student_id)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, status_type, late_renewal, registration_fee_applied, start_date, end_date, batches(name, batch_code, style_base, studios(name, code)), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)")
        .eq("payment_id", paymentId),
      supabase
        .from("drop_ins")
        .select("id, amount, batch_sessions(session_date, start_time, end_time, style, batches(name, batch_code, style_base, studios(name, code)))")
        .eq("payment_id", paymentId),
      supabase
        .from("drop_ins")
        .select("adjusted_amount")
        .eq("adjusted_payment_id", paymentId),
      supabase
        .from("system_settings")
        .select("value")
        .eq("organization_id", payment.organization_id)
        .eq("key", "registration_fee")
        .maybeSingle(),
    ]);

    if (studentRes.error) throw studentRes.error;
    if (enrollmentRes.error) throw enrollmentRes.error;
    if (dropInRes.error) throw dropInRes.error;
    if (adjustedDropInRes.error) throw adjustedDropInRes.error;

    const student = studentRes.data as any;
    const enrollments = (enrollmentRes.data || []) as any[];
    const dropIns = (dropInRes.data || []) as any[];
    const isDropInReceipt = dropIns.length > 0 && enrollments.length === 0;

    const enrollmentBatches = enrollments.map((enrollment) => enrollment.batches).filter(Boolean);
    const dropInSessions = dropIns.map((dropIn) => dropIn.batch_sessions).filter(Boolean);
    const dropInBatches = dropInSessions.map((session) => session.batches).filter(Boolean);
    const allBatches = [...enrollmentBatches, ...dropInBatches];
    const planNames = unique(enrollments.map((enrollment) => enrollment.subscription_plans?.name));
    const statuses = unique(enrollments.map((enrollment) => enrollment.status_type));
    const lateRenewal = enrollments.some((enrollment) => Boolean(enrollment.late_renewal));
    const startDates = unique(enrollments.map((enrollment) => enrollment.start_date)).sort();
    const endDates = unique(enrollments.map((enrollment) => enrollment.end_date)).sort();
    const cycleNames = unique([
      ...enrollments.map((enrollment) => enrollment.start_cycle?.name),
      ...enrollments.map((enrollment) => enrollment.end_cycle?.name),
    ]);
    const dropInLabels = dropInSessions.map((session) => {
      const batchName = session.batches?.name || session.style || "Drop-in";
      return `${formatDate(session.session_date)} ${session.start_time || ""}-${session.end_time || ""} (${batchName})`;
    });
    const registrationApplied = enrollments.some((enrollment) => Boolean(enrollment.registration_fee_applied));
    const registrationFee = registrationApplied ? Number(registrationFeeRes.data?.value || 590) : 0;
    const dropInAdjustment = (adjustedDropInRes.data || []).reduce((sum: number, dropIn: any) => sum + Number(dropIn.adjusted_amount || 0), 0);

    const receipt = {
      receipt_title: isDropInReceipt ? "Drop-in Receipt" : "Registration Receipt",
      student_name: student?.name || "—",
      student_phone: student?.phone || student?.users?.phone || "",
      student_email: student?.email || student?.users?.email || "",
      account_owner_name: student?.users?.name || "",
      account_owner_phone: student?.users?.phone || "",
      plan_name: isDropInReceipt ? "Drop-In" : planNames.join(", "),
      status_type: isDropInReceipt ? "Drop-In" : statusLabel(statuses, lateRenewal),
      studio_names: unique(allBatches.map((batch) => batch.studios?.name || batch.studios?.code)).join(", "),
      batches: isDropInReceipt ? dropInLabels.join(", ") : unique(allBatches.map((batch) => batch.name)).join(", "),
      batch_codes: unique(allBatches.map((batch) => batch.batch_code)).join(", "),
      cycles: cycleNames.join(" → "),
      validity: isDropInReceipt
        ? dropInLabels.join(", ")
        : startDates.length && endDates.length
          ? `${formatDate(startDates[0])} → ${formatDate(endDates[endDates.length - 1])}`
          : "",
      start_date: startDates[0] ? formatDate(startDates[0]) : "",
      end_date: endDates.length ? formatDate(endDates[endDates.length - 1]) : "",
      subtotal: formatMoney(payment.amount),
      gst: formatMoney(payment.gst),
      registration_fee: registrationFee ? formatMoney(registrationFee) : "",
      drop_in_adjustment: dropInAdjustment ? formatMoney(dropInAdjustment) : "",
      amount: formatMoney(payment.final_amount),
      total: formatMoney(payment.final_amount),
      payment_mode: paymentModeLabel(payment.payment_mode),
      payment_status: "Confirmed",
      payment_id: `PAY-${payment.id}`,
      transaction_id: payment.gateway_payment_id || payment.gateway_order_id || `PAY-${payment.id}`,
      date: payment.business_date ? formatDate(payment.business_date) : formatDateTime(payment.created_at),
      confirmed_at: formatDateTime(payment.created_at),
    };

    return json({ receipt });
  } catch (err: any) {
    return json({ error: err.message || "Could not build receipt" }, 500);
  }
});
