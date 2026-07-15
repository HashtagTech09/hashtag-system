import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIDE_STUDIOS = ["NDA", "RMG", "IPM", "SD", "GGN"];
const PRUDENT_STUDIOS = ["ED", "RG", "PP", "AV", "DWK"];

let CACHED_ORG_ID: number | null = null;
async function getDefaultOrgId(supabase: any): Promise<number> {
  if (CACHED_ORG_ID !== null) return CACHED_ORG_ID;
  const { data } = await supabase.from("system_settings").select("value").eq("key", "default_organization_id").limit(1).maybeSingle();
  CACHED_ORG_ID = Number(data?.value ?? 1);
  return CACHED_ORG_ID;
}

function getAccount(studioCode: string): "pride" | "prudent" | null {
  const code = studioCode?.toUpperCase();
  if (PRIDE_STUDIOS.includes(code)) return "pride";
  if (PRUDENT_STUDIOS.includes(code)) return "prudent";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      student_id,
      organization_id,
      batch_ids,
      amount,
      gst,
      final_amount,
      enrollment_data,
      student_name,
      student_phone,
      batch_names,
      plan_name,
    } = body;

    if (!student_id || !batch_ids?.length || !final_amount || !enrollment_data) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up studio code from first batch
    const { data: batch } = await supabase
      .from("batches")
      .select("studio_id, studios(code)")
      .eq("id", batch_ids[0])
      .single();

    const studioCode = (batch as any)?.studios?.code || "";
    const account = getAccount(studioCode);

    if (!account) {
      return new Response(JSON.stringify({ error: `Unknown studio code: ${studioCode}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyId = account === "pride"
      ? Deno.env.get("RZP_PRIDE_KEY_ID")!
      : Deno.env.get("RZP_PRUDENT_KEY_ID")!;
    const keySecret = account === "pride"
      ? Deno.env.get("RZP_PRIDE_KEY_SECRET")!
      : Deno.env.get("RZP_PRUDENT_KEY_SECRET")!;

    // Create pending payment
    const { data: payment, error: payErr } = await supabase.from("payments").insert({
      organization_id: organization_id || 1,
      student_id,
      amount: amount || 0,
      gst: gst || 0,
      final_amount,
      payment_mode: "razorpay",
      status: "pending",
      rzp_account: account,
    }).select().single();

    if (payErr) throw payErr;

    // Create pending enrollment
    const { error: pendErr } = await supabase.from("pending_enrollments").insert({
      payment_id: payment.id,
      enrollment_data,
      status: "pending",
    });
    if (pendErr) throw pendErr;

    // Create Razorpay order
    const amountPaise = Math.round(final_amount * 100);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `pay_${payment.id}`,
        notes: {
          student_name: student_name || "",
          student_phone: student_phone || "",
          batches: batch_names || "",
          plan: plan_name || "",
          payment_id: String(payment.id),
        },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      throw new Error(`Razorpay API error: ${errText}`);
    }

    const order = await rzpRes.json();

    // Update payment with order ID
    await supabase.from("payments").update({
      gateway_order_id: order.id,
    }).eq("id", payment.id);

    return new Response(JSON.stringify({
      order_id: order.id,
      razorpay_key_id: keyId,
      payment_id: payment.id,
      amount: amountPaise,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
