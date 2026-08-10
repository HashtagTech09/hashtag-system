import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

function getWebhookSecret(account: string | null): string {
  const envName = account === "test"
    ? "RZP_TEST_WEBHOOK_SECRET"
    : account === "pride"
      ? "RZP_PRIDE_WEBHOOK_SECRET"
      : "RZP_PRUDENT_WEBHOOK_SECRET";
  const secret = Deno.env.get(envName);
  if (!secret) throw new Error(`${envName} is not configured`);
  return secret;
}

function getCycleId(cycle: any) {
  return cycle?.cycle_id ?? cycle?.cycleId ?? null;
}

function getCycleType(cycle: any) {
  return cycle?.cycle_type ?? cycle?.cycleType ?? "regular";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const event = JSON.parse(rawBody);

    if (event.event !== "payment.captured") {
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpPayment = event.payload?.payment?.entity;
    if (!rzpPayment) {
      return new Response(JSON.stringify({ error: "No payment entity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = rzpPayment.order_id;
    const rzpPaymentId = rzpPayment.id;
    const rzpFee = (rzpPayment.fee || 0) / 100; // fee in paise → rupees
    const rzpAmount = (rzpPayment.amount || 0) / 100;
    const netAmount = rzpAmount - rzpFee;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find payment by order ID
    const { data: payment, error: findErr } = await supabase
      .from("payments")
      .select("*")
      .eq("gateway_order_id", orderId)
      .single();

    if (findErr || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found for order: " + orderId }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature with correct account secret
    const webhookSecret = getWebhookSecret(payment.rzp_account);

    const valid = await verifySignature(rawBody, signature, webhookSecret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment to success
    await supabase.from("payments").update({
      status: "success",
      gateway_payment_id: rzpPaymentId,
      net_amount: netAmount,
    }).eq("id", payment.id);

    // Get pending enrollment data
    const { data: pending } = await supabase
      .from("pending_enrollments")
      .select("*")
      .eq("payment_id", payment.id)
      .eq("status", "pending")
      .single();

    if (pending?.enrollment_data) {
      const data = pending.enrollment_data as any;

      if (data.drop_in) {
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

      // Insert enrollments
      if (data.enrollments?.length) {
        const enrollments = data.enrollments.map((e: any) => ({
          ...e,
          payment_id: payment.id,
        }));
        const { data: inserted } = await supabase.from("enrollments").insert(enrollments).select();

        // Insert enrollment_cycles
        if (inserted && data.enrollment_cycles_template?.length) {
          for (const enrollment of inserted) {
            const cycles = data.enrollment_cycles_template.map((c: any) => ({
              enrollment_id: enrollment.id,
              student_id: enrollment.student_id,
              batch_id: enrollment.batch_id,
              cycle_id: getCycleId(c),
              cycle_type: getCycleType(c),
            })).filter((cycle: any) => cycle.cycle_id);
            if (cycles.length > 0) await supabase.from("enrollment_cycles").insert(cycles);
          }
        }
      }

      // Apply existing-enrollment extensions for Add Batch payments.
      if (data.existing_extensions?.length) {
        for (const extension of data.existing_extensions) {
          if (extension.missing_cycles?.length) {
            const missingRows = extension.missing_cycles.map((cycle: any) => ({
              enrollment_id: extension.enrollment_id,
              student_id: payment.student_id,
              batch_id: extension.batch_id,
              cycle_id: getCycleId(cycle),
              cycle_type: getCycleType(cycle),
            })).filter((cycle: any) => cycle.cycle_id);
            if (missingRows.length > 0) await supabase.from("enrollment_cycles").insert(missingRows);
          }

          const update: Record<string, unknown> = {};
          if (extension.end_date) update.end_date = extension.end_date;
          if (extension.end_cycle_id) update.end_cycle_id = extension.end_cycle_id;
          if (Object.keys(update).length > 0) {
            await supabase.from("enrollments").update(update).eq("id", extension.enrollment_id);
          }
        }
      }

      // Insert payment allocations
      if (data.payment_allocations?.length) {
        const allocs = data.payment_allocations.map((a: any) => ({
          payment_id: payment.id,
          batch_id: a.batch_id,
          studio_id: a.studio_id || null,
          allocated_amount: a.allocated_amount,
          is_primary: a.is_primary || false,
        }));
        await supabase.from("payment_allocations").insert(allocs);
      }

      // Mark pending as completed
      await supabase.from("pending_enrollments").update({ status: "completed" }).eq("id", pending.id);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
