import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonBody = Record<string, any>;

const json = (body: JsonBody, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

let CACHED_ORG_ID: number | null = null;
async function getDefaultOrgId(supabase: any): Promise<number> {
  if (CACHED_ORG_ID !== null) return CACHED_ORG_ID;
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "default_organization_id")
    .limit(1)
    .maybeSingle();
  CACHED_ORG_ID = Number(data?.value ?? 1);
  return CACHED_ORG_ID;
}

function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

function pickRandom<T>(rows: T[]): T {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return rows[array[0] % rows.length];
}

function siteUrl(req: Request): string {
  const configured = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL");
  const origin = req.headers.get("origin");
  return (configured || origin || "https://hashtag-system.vercel.app").replace(/\/$/, "");
}

async function getStaffUser(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user?.id) return null;

  const { data: staff } = await supabase
    .from("users")
    .select("id, name, email, auth_id")
    .eq("auth_id", authData.user.id)
    .maybeSingle();

  return staff || { id: null, name: authData.user.email || "Staff", email: authData.user.email };
}

async function sendFeedbackLink(supabase: any, orgId: number, request: any, student: any, feedbackUrl: string) {
  const phone = normalizePhone(student?.phone || student?.users?.phone);
  const email = String(student?.email || student?.users?.email || "").trim();
  const message = [
    "Hi!",
    "",
    `Please share quick feedback for your Hashtag class on ${request.attendance_date}.`,
    "This helps us improve the class experience.",
    "",
    feedbackUrl,
  ].join("\n");

  if (!phone && !email) {
    await supabase.from("notification_log").insert({
      organization_id: orgId,
      channel: "feedback",
      recipient: `student:${student.id}`,
      template_name: "class-feedback",
      payload: { request_id: request.id, feedback_url: feedbackUrl, reason: "no student phone or email" },
      status: "failed",
      error_message: "No student phone or email available",
    });
    return { channel: null, recipient: null, status: "no_recipient", error: "No student phone or email available" };
  }

  const channel = phone ? "whatsapp" : "email";
  const recipient = phone || email;

  await supabase.from("notification_log").insert({
    organization_id: orgId,
    channel,
    recipient,
    template_name: "class-feedback",
    payload: {
      request_id: request.id,
      feedback_url: feedbackUrl,
      message,
      delivery_mode: "internal_log_only",
    },
    status: "logged",
  });
  return { channel, recipient, status: "logged", error: null };
}

async function createFeedbackRequest(req: Request, supabase: any, body: JsonBody) {
  const staff = await getStaffUser(supabase, req);
  if (!staff) return json({ error: "Authentication required" }, 401);

  const orgId = await getDefaultOrgId(supabase);
  const batchId = Number(body.batch_id);
  const date = String(body.date || "");
  if (!batchId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "batch_id and date are required" }, 400);
  }

  const { data: existing } = await supabase
    .from("class_feedback_requests")
    .select("id, token, status, feedback_url, student_id, notification_status")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("attendance_date", date)
    .maybeSingle();

  if (existing) {
    return json({ created: false, existing: true, request: existing });
  }

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("student_id")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("date", date)
    .eq("status", "present");

  if (attendanceError) return json({ error: attendanceError.message }, 500);
  const studentIds = Array.from(new Set((attendanceRows || []).map((row: any) => row.student_id).filter(Boolean)));
  if (studentIds.length === 0) return json({ created: false, reason: "no_present_students" });

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name, phone, email, users(phone, email)")
    .in("id", studentIds);

  if (studentsError) return json({ error: studentsError.message }, 500);
  const contactable = (students || []).filter((student: any) =>
    normalizePhone(student?.phone || student?.users?.phone) || String(student?.email || student?.users?.email || "").trim()
  );
  if (contactable.length === 0) return json({ created: false, reason: "no_contactable_present_students" });

  const selected = pickRandom(contactable);
  const { data: session } = await supabase
    .from("batch_sessions")
    .select("id")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("session_date", date)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error: insertError } = await supabase
    .from("class_feedback_requests")
    .insert({
      organization_id: orgId,
      batch_id: batchId,
      batch_session_id: session?.id || null,
      student_id: selected.id,
      attendance_date: date,
      status: "created",
      created_by: staff.id,
    })
    .select("id, token, attendance_date")
    .single();

  if (insertError) {
    const { data: raceExisting } = await supabase
      .from("class_feedback_requests")
      .select("id, token, status, feedback_url, student_id, notification_status")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .eq("attendance_date", date)
      .maybeSingle();
    if (raceExisting) return json({ created: false, existing: true, request: raceExisting });
    return json({ error: insertError.message }, 500);
  }

  const feedbackUrl = `${siteUrl(req)}/feedback/${inserted.token}`;
  const sendResult = await sendFeedbackLink(supabase, orgId, inserted, selected, feedbackUrl);
  const finalStatus = sendResult.status === "no_recipient" ? "no_recipient" : sendResult.status === "failed" ? "failed" : "created";

  await supabase
    .from("class_feedback_requests")
    .update({
      status: finalStatus,
      contact_channel: sendResult.channel,
      recipient: sendResult.recipient,
      feedback_url: feedbackUrl,
      notification_status: sendResult.status,
      notification_error: sendResult.error,
      sent_at: finalStatus === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", inserted.id);

  return json({
    created: true,
    request: {
      id: inserted.id,
      token: inserted.token,
      feedback_url: feedbackUrl,
      notification_status: sendResult.status,
      selected_student_name: selected.name,
    },
  });
}

async function loadFeedback(supabase: any, body: JsonBody) {
  const token = String(body.token || "");
  if (!token) return json({ error: "token is required" }, 400);

  const { data: request, error } = await supabase
    .from("class_feedback_requests")
    .select(`
      id,
      status,
      attendance_date,
      submitted_at,
      expires_at,
      batches(name, batch_code, studios(name, code)),
      batch_sessions(session_date, start_time, end_time, style)
    `)
    .eq("token", token)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!request) return json({ error: "Feedback link not found" }, 404);

  const expired = request.expires_at && new Date(request.expires_at).getTime() < Date.now();
  if (expired && request.status !== "submitted") {
    await supabase.from("class_feedback_requests").update({ status: "expired" }).eq("id", request.id);
  }

  return json({
    request: {
      id: request.id,
      status: expired && request.status !== "submitted" ? "expired" : request.status,
      attendance_date: request.attendance_date,
      submitted_at: request.submitted_at,
      expires_at: request.expires_at,
      batch: request.batches,
      session: request.batch_sessions,
    },
  });
}

async function submitFeedback(supabase: any, body: JsonBody) {
  const token = String(body.token || "");
  const rating = Number(body.rating);
  if (!token || !rating || rating < 1 || rating > 5) return json({ error: "token and rating are required" }, 400);

  const { data: request, error } = await supabase
    .from("class_feedback_requests")
    .select("id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!request) return json({ error: "Feedback link not found" }, 404);
  if (request.status === "submitted") return json({ success: true, already_submitted: true });
  if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) {
    await supabase.from("class_feedback_requests").update({ status: "expired" }).eq("id", request.id);
    return json({ error: "This feedback link has expired" }, 410);
  }

  const responsePayload = {
    request_id: request.id,
    rating,
    energy_rating: body.energy_rating ? Number(body.energy_rating) : null,
    clarity_rating: body.clarity_rating ? Number(body.clarity_rating) : null,
    liked: String(body.liked || "").trim() || null,
    improve: String(body.improve || "").trim() || null,
    wants_follow_up: Boolean(body.wants_follow_up),
  };

  const { error: insertError } = await supabase
    .from("class_feedback_responses")
    .insert(responsePayload);

  if (insertError) return json({ error: insertError.message }, 500);

  await supabase
    .from("class_feedback_requests")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", request.id);

  return json({ success: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create") return createFeedbackRequest(req, supabase, body);
    if (action === "load") return loadFeedback(supabase, body);
    if (action === "submit") return submitFeedback(supabase, body);

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
