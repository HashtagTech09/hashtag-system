import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let CACHED_ORG_ID: number | null = null;
async function getDefaultOrgId(supabase: any): Promise<number> {
  if (CACHED_ORG_ID !== null) return CACHED_ORG_ID;
  const { data } = await supabase.from("system_settings").select("value").eq("key", "default_organization_id").limit(1).maybeSingle();
  CACHED_ORG_ID = Number(data?.value ?? 1);
  return CACHED_ORG_ID;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staff_email, staff_name, recipients, student_name, amount, confirmation_url, expires_in_minutes } = await req.json();
    const recipientList = Array.isArray(recipients)
      ? recipients
          .map((r: any) => ({
            email: String(r?.email || "").trim(),
            name: String(r?.name || "").trim(),
          }))
          .filter((r: any) => r.email)
      : [];
    if (staff_email && !recipientList.some((r: any) => r.email === staff_email)) {
      recipientList.push({ email: staff_email, name: staff_name || "Staff" });
    }

    if (recipientList.length === 0 || !confirmation_url) {
      return new Response(
        JSON.stringify({ error: "at least one recipient and confirmation_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="color:#7c3aed;margin:0;font-size:24px">Hashtag</h1>
    <p style="color:#888;font-size:13px;margin:4px 0">Cash Payment Confirmation</p>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="font-size:14px;color:#333">Hi team,</p>
  <p style="font-size:14px;color:#333">A student has requested a cash payment confirmation:</p>
  <table style="width:100%;font-size:14px;color:#333;margin:16px 0">
    <tr><td style="padding:8px 0;color:#888">Student</td><td style="padding:8px 0;text-align:right;font-weight:600">${student_name || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#7c3aed">₹${amount || "0"}</td></tr>
  </table>
  <div style="text-align:center;margin:24px 0">
    <a href="${confirmation_url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Confirm Payment</a>
  </div>
  <p style="font-size:12px;color:#aaa;text-align:center">Click the button above to review and confirm the cash payment. This link expires in ${expires_in_minutes || 10} minutes.</p>
</div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Hashtag <receipts@hashtagdance.in>",
        to: recipientList.map((r: any) => r.email),
        subject: `Cash Payment Confirmation - ${student_name} - ₹${amount}`,
        html: htmlContent,
      }),
    });

    const resBody = await res.text();
    const success = res.ok;

    const orgId = await getDefaultOrgId(supabase);
    await supabase.from("notification_log").insert({
      organization_id: orgId,
      channel: "email",
      recipient: recipientList.map((r: any) => r.email).join(","),
      template_name: "cash-confirmation",
      payload: { recipients: recipientList, student_name, amount, confirmation_url, expires_in_minutes: expires_in_minutes || 10 },
      status: success ? "sent" : "failed",
      error_message: success ? null : resBody,
    });

    return new Response(
      JSON.stringify({ success, error: success ? "" : resBody }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
