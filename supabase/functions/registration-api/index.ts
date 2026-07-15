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

// ── IST helpers ──────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function nowIST(): Date {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_OFFSET_MS);
}
function todayIST(): string {
  const ist = nowIST();
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
}

// ── Fee / enrollment logic (ported from src/lib) ─────────────────────
const REGULAR_PRICE = 3200;
const GRID_PRICE = 7667;
const PLAN_FIXED_TOTALS: Record<string, number> = { "5R1G": 26500, "10R2G": 50000 };

// ── Settings loader (cached across warm invocations) ─────────────────
let CACHED_SETTINGS: { orgId: number; regFee: number; dropInFee: number; gstRate: number } | null = null;
async function loadSettings(supabase: any) {
  if (CACHED_SETTINGS) return CACHED_SETTINGS;
  const { data } = await supabase.from("system_settings").select("key, value");
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value; });
  CACHED_SETTINGS = {
    orgId: Number(map.default_organization_id ?? 1),
    regFee: Number(map.registration_fee ?? 424),
    dropInFee: Number(map.drop_in_fee ?? 500),
    gstRate: Number(map.gst_percent ?? 18) / 100,
  };
  return CACHED_SETTINGS;
}
const STYLE_HIERARCHY: Record<string, number> = { Jazz: 1, Ballet: 2, Modern: 3, "Hip Hop": 4, Heels: 5 };

function getStylePriority(s: string) { return STYLE_HIERARCHY[s] ?? 99; }
function sortBatchesByHierarchy<T extends { style_base?: string | null }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => getStylePriority(a.style_base || "") - getStylePriority(b.style_base || ""));
}
function getBatchDiscount(pos: number) {
  if (pos <= 1) return 0;
  const t: Record<number, number> = { 2: 0.12, 3: 0.13, 4: 0.14 };
  return t[pos] ?? 0.15;
}
function roundToNearest100(n: number) { return Math.round(n / 100) * 100; }
function getPlanKey(r: number, g: number) { return `${r}R${g}G`; }
function getCycleForDate(cycles: PlanCycle[], date: string): PlanCycle | null {
  return cycles.find(c => c.start_date <= date && (c.end_date || "2099-12-31") >= date) || null;
}
function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

interface PlanCycle { id: number; name: string; start_date: string; end_date: string | null; plan_type: string; is_active: boolean; grace_days: number; registration_deadline: string | null; }
interface SubPlan { id: number; name: string; total_cycles: number; total_regular_cycles: number; total_grid_cycles: number; is_active: boolean; }

function getStartCycleIndex(cycles: PlanCycle[]) {
  const today = todayIST();
  const openIdx = cycles.findIndex(c => {
    if (c.registration_deadline && today > c.registration_deadline) return false;
    return (c.end_date || "2099-12-31") >= today;
  });
  if (openIdx !== -1) return openIdx;
  const futureIdx = cycles.findIndex(c => c.start_date > today);
  return futureIdx !== -1 ? futureIdx : 0;
}

function isPlanValid(plan: SubPlan, cycles: PlanCycle[], startIdx: number) {
  let nr = plan.total_regular_cycles ?? 0, ng = plan.total_grid_cycles ?? 0;
  if (nr + ng === 0) return false;
  let i = startIdx;
  while ((nr > 0 || ng > 0) && i < cycles.length) {
    const c = cycles[i];
    if (c.plan_type === "regular" && nr > 0) nr--;
    else if (c.plan_type === "grid" && ng > 0) ng--;
    else { i++; continue; }
    i++;
  }
  return nr === 0 && ng === 0;
}

function computeCycleAssignment(plan: SubPlan, cycles: PlanCycle[], startIdx: number) {
  let nr = plan.total_regular_cycles ?? 0, ng = plan.total_grid_cycles ?? 0;
  const total = nr + ng;
  const matched: PlanCycle[] = [];
  let i = startIdx;
  while ((nr > 0 || ng > 0) && i < cycles.length) {
    const c = cycles[i];
    if (c.plan_type === "regular" && nr > 0) { matched.push(c); nr--; }
    else if (c.plan_type === "grid" && ng > 0) { matched.push(c); ng--; }
    else { i++; continue; }
    i++;
  }
  if (matched.length !== total) return null;
  return {
    startCycle: matched[0], endCycle: matched[matched.length - 1],
    regularCount: matched.filter(c => c.plan_type === "regular").length,
    gridCount: matched.filter(c => c.plan_type === "grid").length,
    matched,
  };
}

function isRenewalAcrossGridGap(latestEndDate: string, cycles: PlanCycle[], today: string) {
  const latestCycle = getCycleForDate(cycles, latestEndDate);
  const targetCycle = getCycleForDate(cycles, today) || cycles[getStartCycleIndex(cycles)];
  if (!latestCycle || !targetCycle) return false;
  const latestIdx = cycles.findIndex(c => c.id === latestCycle.id);
  const targetIdx = cycles.findIndex(c => c.id === targetCycle.id);
  if (latestIdx === -1 || targetIdx === -1 || targetIdx <= latestIdx) return false;
  const skippedCycles = cycles.slice(latestIdx + 1, targetIdx);
  if (!skippedCycles.every(c => c.plan_type === "grid")) return false;
  if (targetCycle.plan_type === "grid") return true;
  if (targetCycle.plan_type !== "regular") return false;
  const renewalUntil = targetCycle.registration_deadline || targetCycle.end_date || addDays(targetCycle.start_date, targetCycle.grace_days || 14);
  return today <= renewalUntil;
}

function detectStudentStatus(enrollments: { end_date: string }[], cycles: PlanCycle[]) {
  if (!enrollments?.length) return { status: "NEW", latestEndDate: null };
  const latest = enrollments[0].end_date;
  const today = todayIST();
  if (latest >= today) return { status: "REN", latestEndDate: latest };
  if (isRenewalAcrossGridGap(latest, cycles, today)) return { status: "REN", latestEndDate: latest };
  const activeCycle = cycles.find(c => c.is_active);
  const graceDays = activeCycle?.grace_days || 14;
  const d = new Date(latest);
  d.setDate(d.getDate() + graceDays);
  if (today <= d.toISOString().split("T")[0]) return { status: "REN", latestEndDate: latest };
  return { status: "REV", latestEndDate: latest };
}

function computeFeeBreakdown(params: {
  batchCount: number; regularCycles: number; gridCycles: number;
  detectedStatus: string; latestEndDate: string | null; dropInAmount: number;
  sortedBatches?: { id: number; name: string; style_base?: string | null }[];
  regFee: number; gstRate: number;
}) {
  const { batchCount, regularCycles, gridCycles, detectedStatus, latestEndDate, dropInAmount, sortedBatches, regFee: regFeeVal, gstRate } = params;
  const planKey = getPlanKey(regularCycles, gridCycles);
  const fixedTotal = PLAN_FIXED_TOTALS[planKey];
  const isFixedPricePlan = fixedTotal !== undefined;
  const today = todayIST();
  let applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || (detectedStatus === "REN" && latestEndDate ? today > latestEndDate : false);
  if (isFixedPricePlan) applyRegFee = false;
  const regFee = applyRegFee ? regFeeVal : 0;
  let perBatchFee: number;
  if (isFixedPricePlan) { perBatchFee = Math.round(fixedTotal / (1 + gstRate)); }
  else { perBatchFee = (regularCycles * REGULAR_PRICE) + (gridCycles * GRID_PRICE); }
  const batchAllocations = (sortedBatches || []).map((b, idx) => {
    const disc = getBatchDiscount(idx + 1);
    const amount = idx === 0 ? perBatchFee : Math.round(perBatchFee * (1 - disc));
    return { batch_id: b.id, batch_name: b.name, style_base: b.style_base || "", is_primary: idx === 0, amount, discountPct: disc };
  });
  const totalBatchFee = batchAllocations.length > 0 ? batchAllocations.reduce((s, a) => s + a.amount, 0) : perBatchFee * batchCount;
  const discountAmount = (perBatchFee * batchCount) - totalBatchFee;
  const subtotal = Math.max(0, totalBatchFee + regFee - dropInAmount);
  const gst = Math.round(subtotal * gstRate);
  let total = subtotal + gst;
  if (!isFixedPricePlan) total = roundToNearest100(total);
  return { batchCount, perBatchFee, discountAmount, totalBatchFee, regFee, dropInAdj: dropInAmount, subtotal, gst, total, applyRegFee, isFixedPricePlan, planKey, batchAllocations };
}

function allocateCollectedAmount<T extends { allocated_amount: number; is_primary?: boolean }>(allocations: T[], collectedAmount?: number): T[] {
  if (!allocations.length || collectedAmount === undefined || collectedAmount === null) return allocations;
  const totalCollected = Math.round(Number(collectedAmount) || 0);
  if (totalCollected <= 0) return allocations;
  const baseTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount || 0), 0);
  if (baseTotal <= 0) {
    const equalShare = Math.floor(totalCollected / allocations.length);
    const remainder = totalCollected - (equalShare * allocations.length);
    return allocations.map((allocation, idx) => ({ ...allocation, allocated_amount: equalShare + (idx === 0 ? remainder : 0) }));
  }
  const scaled = allocations.map((allocation) => ({
    ...allocation,
    allocated_amount: Math.round((Number(allocation.allocated_amount || 0) / baseTotal) * totalCollected),
  }));
  const scaledTotal = scaled.reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
  const roundingDiff = totalCollected - scaledTotal;
  if (roundingDiff !== 0) {
    const primaryIndex = Math.max(0, scaled.findIndex((allocation) => allocation.is_primary));
    scaled[primaryIndex] = { ...scaled[primaryIndex], allocated_amount: scaled[primaryIndex].allocated_amount + roundingDiff };
  }
  return scaled;
}

function computePaymentAllocations(sortedBatches: { id: number; studio_id: number | null }[], perBatchFee: number, discountPct: number, collectedAmount?: number) {
  if (!sortedBatches.length) return [];
  const baseAllocations = sortedBatches.map((b, idx) => {
    const effectiveDiscount = idx === 0 ? 0 : (discountPct > 0 ? discountPct : getBatchDiscount(idx + 1));
    return {
      batch_id: b.id,
      studio_id: b.studio_id,
      allocated_amount: Math.round(perBatchFee * (1 - effectiveDiscount)),
      is_primary: idx === 0,
    };
  });
  return allocateCollectedAmount(baseAllocations, collectedAmount);
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const settings = await loadSettings(supabase);
    const orgId = settings.orgId;

    // ── GET-CATALOG ──────────────────────────────────────────────
    if (action === "get-catalog") {
      const [studios, batches, cycles, plans, planCycleLinks, allSettings] = await Promise.all([
        supabase.from("studios").select("*").eq("organization_id", orgId),
        supabase.from("batches").select("*").eq("organization_id", orgId),
        supabase.from("plan_cycles").select("*").eq("organization_id", orgId).order("start_date"),
        supabase.from("subscription_plans").select("*").eq("organization_id", orgId).eq("is_active", true).order("id"),
        supabase.from("subscription_plan_cycles").select("*"),
        supabase.from("system_settings").select("key, value").eq("organization_id", orgId),
      ]);
      return json({
        studios: studios.data, batches: batches.data,
        plan_cycles: cycles.data, subscription_plans: plans.data,
        subscription_plan_cycles: planCycleLinks.data,
        settings: allSettings.data,
      });
    }

    // ── SEND-OTP ─────────────────────────────────────────────────
    if (action === "send-otp") {
      const phone = payload?.phone;
      if (!phone || phone.length < 10) return json({ error: "Valid phone required" }, 400);

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase.from("whatsapp_otp").insert({ phone, otp, expires_at: expiresAt });

      const { data: testSetting } = await supabase.from("system_settings").select("value").eq("organization_id", orgId).eq("key", "test_mode").single();
      if (testSetting?.value === "true") {
        await supabase.from("notification_log").insert({ organization_id: orgId, channel: "whatsapp", recipient: phone, template_name: "otp", payload: { otp }, status: "test_logged" });
        return json({ success: true, test_mode: true, test_otp: otp });
      }

      const interaktKey = Deno.env.get("INTERAKT_API_KEY");
      if (!interaktKey) return json({ error: "INTERAKT_API_KEY not configured" }, 500);

      const phoneNum = phone.startsWith("91") ? phone.replace(/^91/, "") : phone;
      const res = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: { Authorization: `Basic ${interaktKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: "+91", phoneNumber: phoneNum, callbackData: "otp", type: "Template", template: { name: "login_otp", languageCode: "en", bodyValues: [otp] } }),
      });
      const resBody = await res.text();
      await supabase.from("notification_log").insert({ organization_id: orgId, channel: "whatsapp", recipient: phone, template_name: "otp", payload: { otp: "***" }, status: res.ok ? "sent" : "failed", error_message: res.ok ? null : resBody });
      if (!res.ok) return json({ success: false, error: "Failed to send OTP" });
      return json({ success: true });
    }

    // ── VERIFY-OTP ───────────────────────────────────────────────
    if (action === "verify-otp") {
      const { phone, otp } = payload || {};
      if (!phone || !otp) return json({ error: "phone and otp required" }, 400);

      const { data: otpRecords } = await supabase.from("whatsapp_otp").select("*").eq("phone", phone).eq("otp", otp).eq("verified", false).order("created_at", { ascending: false }).limit(1);
      if (!otpRecords?.length) return json({ success: false, error: "Invalid OTP" });
      const record = otpRecords[0];
      if (new Date(record.expires_at) < new Date()) return json({ success: false, error: "OTP expired" });
      await supabase.from("whatsapp_otp").update({ verified: true }).eq("id", record.id);

      // Look up existing student
      const { data: users } = await supabase.from("users").select("id").eq("organization_id", orgId).ilike("phone", `%${phone.slice(-10)}`);
      let student = null;
      let user = null;
      if (users?.length) {
        const { data: students } = await supabase.from("students").select("*, users(*)").eq("user_id", users[0].id);
        if (students?.length) { student = students[0]; user = students[0].users; }
      }
      return json({ success: true, student, user });
    }

    // ── CREATE-STUDENT ───────────────────────────────────────────
    if (action === "create-student") {
      const { phone, name } = payload || {};
      if (!name?.trim()) return json({ error: "Name required" }, 400);
      if (!phone) return json({ error: "Phone required" }, 400);

      // Check existing
      const { data: existing } = await supabase.from("users").select("id").eq("organization_id", orgId).ilike("phone", `%${phone.slice(-10)}`);
      if (existing?.length) {
        const { data: students } = await supabase.from("students").select("*, users(*)").eq("user_id", existing[0].id);
        if (students?.length) return json({ student: students[0], user: students[0].users, existing: true });
      }

      const { data: newUser, error: ue } = await supabase.from("users").insert({ organization_id: orgId, name: name.trim(), phone }).select().single();
      if (ue) return json({ error: ue.message }, 500);
      const { data: newStudent, error: se } = await supabase.from("students").insert({ organization_id: orgId, name: name.trim(), phone, user_id: newUser.id }).select().single();
      if (se) return json({ error: se.message }, 500);
      return json({ student: newStudent, user: newUser, existing: false });
    }

    // ── COMPUTE-FEES ─────────────────────────────────────────────
    if (action === "compute-fees") {
      const { student_id, batch_ids, plan_id } = payload || {};
      if (!batch_ids?.length || !plan_id) return json({ error: "batch_ids and plan_id required" }, 400);

      const [cycleRes, planRes, batchRes] = await Promise.all([
        supabase.from("plan_cycles").select("*").eq("organization_id", orgId).order("start_date"),
        supabase.from("subscription_plans").select("*").eq("id", plan_id).single(),
        supabase.from("batches").select("*").eq("organization_id", orgId).in("id", batch_ids),
      ]);
      const cycles = (cycleRes.data || []) as PlanCycle[];
      const plan = planRes.data as SubPlan;
      const batches = batchRes.data || [];
      if (!plan) return json({ error: "Plan not found" }, 404);

      const startIdx = getStartCycleIndex(cycles);
      if (!isPlanValid(plan, cycles, startIdx)) return json({ error: "Plan not valid for current cycles" }, 400);
      const assignment = computeCycleAssignment(plan, cycles, startIdx);
      if (!assignment) return json({ error: "Could not assign cycles" }, 400);

      let detectedStatus = "NEW";
      let latestEndDate: string | null = null;
      if (student_id) {
        const { data: enrollments } = await supabase.from("enrollments").select("end_date").eq("student_id", student_id).order("end_date", { ascending: false });
        const result = detectStudentStatus(enrollments || [], cycles);
        detectedStatus = result.status;
        latestEndDate = result.latestEndDate;
      }

      const sortedBatches = sortBatchesByHierarchy(batches);
      const breakdown = computeFeeBreakdown({
        batchCount: batch_ids.length,
        regularCycles: assignment.regularCount,
        gridCycles: assignment.gridCount,
        detectedStatus, latestEndDate, dropInAmount: 0,
        sortedBatches: sortedBatches.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
        regFee: settings.regFee, gstRate: settings.gstRate,
      });

      return json({ breakdown, assignment: { startCycle: assignment.startCycle, endCycle: assignment.endCycle, regularCount: assignment.regularCount, gridCount: assignment.gridCount }, detectedStatus });
    }

    // ── ENROLL (cash flow) ───────────────────────────────────────
    if (action === "enroll") {
      const { student_id, batch_ids, plan_id, payment_mode, staff_id } = payload || {};
      if (!student_id || !batch_ids?.length || !plan_id) return json({ error: "student_id, batch_ids, plan_id required" }, 400);

      const [cycleRes, planRes, batchRes] = await Promise.all([
        supabase.from("plan_cycles").select("*").eq("organization_id", orgId).order("start_date"),
        supabase.from("subscription_plans").select("*").eq("id", plan_id).single(),
        supabase.from("batches").select("*").eq("organization_id", orgId).in("id", batch_ids),
      ]);
      const cycles = (cycleRes.data || []) as PlanCycle[];
      const plan = planRes.data as SubPlan;
      const batches = batchRes.data || [];
      if (!plan) return json({ error: "Plan not found" }, 404);

      const startIdx = getStartCycleIndex(cycles);
      const assignment = computeCycleAssignment(plan, cycles, startIdx);
      if (!assignment) return json({ error: "Could not assign cycles" }, 400);

      const { data: enrollments } = await supabase.from("enrollments").select("end_date").eq("student_id", student_id).order("end_date", { ascending: false });
      const { status: detectedStatus, latestEndDate } = detectStudentStatus(enrollments || [], cycles);

      const sortedBatches = sortBatchesByHierarchy(batches);
      const breakdown = computeFeeBreakdown({
        batchCount: batch_ids.length, regularCycles: assignment.regularCount, gridCycles: assignment.gridCount,
        detectedStatus, latestEndDate, dropInAmount: 0,
        sortedBatches: sortedBatches.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
        regFee: settings.regFee, gstRate: settings.gstRate,
      });

      const enrollmentRecords = sortedBatches.map((batch: any) => ({
        organization_id: orgId, student_id, batch_id: batch.id,
        status_type: detectedStatus, registration_fee_applied: breakdown.applyRegFee, late_renewal: false,
        start_date: assignment.startCycle.start_date, end_date: assignment.endCycle.end_date || assignment.startCycle.start_date,
        subscription_plan_id: plan_id, start_cycle_id: assignment.startCycle.id, end_cycle_id: assignment.endCycle.id,
        previous_batch_id: null,
      }));

      const allocations = computePaymentAllocations(
        sortedBatches.map((b: any) => ({ id: b.id, studio_id: b.studio_id })),
        breakdown.perBatchFee, 0, breakdown.total,
      );

      if (payment_mode === "razorpay") {
        // Return data needed for client-side Razorpay checkout
        const { data: student } = await supabase.from("students").select("name, phone").eq("id", student_id).single();
        return json({
          enrollment_data: { enrollments: enrollmentRecords, payment_allocations: allocations },
          breakdown,
          student_name: student?.name || "",
          student_phone: student?.phone || "",
          batch_names: sortedBatches.map((b: any) => b.name).join(", "),
          plan_name: plan.name,
        });
      }

      // Cash flow
      if (!staff_id) return json({ error: "staff_id required for cash payments" }, 400);
      const { data: student } = await supabase.from("students").select("name, phone").eq("id", student_id).single();
      const { data: staff } = await supabase.from("users").select("name, email").eq("id", staff_id).single();

      const { data: cashReq, error: cashErr } = await supabase.from("cash_payment_requests").insert({
        organization_id: orgId, student_id, staff_user_id: staff_id,
        amount: breakdown.subtotal, gst: breakdown.gst, final_amount: breakdown.total,
        enrollment_data: { enrollments: enrollmentRecords, payment_allocations: allocations },
        batch_ids,
      }).select().single();
      if (cashErr) return json({ error: cashErr.message }, 500);

      // Send confirmation email to staff
      const confirmUrl = `https://hashtag-system.lovable.app/confirm-cash?token=${cashReq.token}`;
      await supabase.functions.invoke("send-cash-confirmation", {
        body: {
          staff_email: staff?.email, staff_name: staff?.name || "Staff",
          student_name: student?.name || "Student", amount: breakdown.total.toLocaleString("en-IN"),
          confirmation_url: confirmUrl,
        },
      });

      return json({ success: true, token: cashReq.token, breakdown });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
