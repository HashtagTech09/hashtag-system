import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channel, recipient, template_name, template_data, student_id, payment_id } = await req.json();

    if (!channel || !recipient) {
      return new Response(JSON.stringify({ error: "channel and recipient required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check test mode
    const { data: testSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("organization_id", 1)
      .eq("key", "test_mode")
      .single();

    const isTestMode = testSetting?.value === "true";

    const payload = { channel, recipient, template_name, template_data, student_id, payment_id };

    if (isTestMode) {
      await supabase.from("notification_log").insert({
        organization_id: 1,
        channel,
        recipient,
        template_name: template_name || "payment-receipt",
        payload,
        status: "test_logged",
      });
      return new Response(JSON.stringify({ success: true, test_mode: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Real send
    let sendResult = { success: false, error: "" };

    if (channel === "email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        sendResult = { success: false, error: "RESEND_API_KEY not configured" };
      } else {
        const htmlContent = buildReceiptHtml(template_data);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Hashtag Dance <receipts@hashtagdance.in>",
            to: [recipient],
            subject: `Payment Receipt - ₹${template_data?.amount || ""}`,
            html: htmlContent,
          }),
        });
        const resBody = await res.text();
        sendResult = res.ok ? { success: true, error: "" } : { success: false, error: resBody };
      }
    } else if (channel === "whatsapp") {
      const interaktKey = Deno.env.get("INTERAKT_API_KEY");
      if (!interaktKey) {
        sendResult = { success: false, error: "INTERAKT_API_KEY not configured" };
      } else {
        const phone = recipient.startsWith("91") ? recipient : `91${recipient}`;
        const res = await fetch("https://api.interakt.ai/v1/public/message/", {
          method: "POST",
          headers: { Authorization: `Basic ${interaktKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            countryCode: "+91",
            phoneNumber: phone.replace(/^91/, ""),
            callbackData: "receipt",
            type: "Template",
            template: {
              name: template_data?.whatsapp_template || "payment_receipt",
              languageCode: "en",
              bodyValues: [
                template_data?.student_name || "",
                `₹${template_data?.amount || "0"}`,
                template_data?.payment_mode || "cash",
                template_data?.transaction_id || "N/A",
              ],
            },
          }),
        });
        const resBody = await res.text();
        sendResult = res.ok ? { success: true, error: "" } : { success: false, error: resBody };
      }
    }

    await supabase.from("notification_log").insert({
      organization_id: 1,
      channel,
      recipient,
      template_name: template_name || "payment-receipt",
      payload,
      status: sendResult.success ? "sent" : "failed",
      error_message: sendResult.error || null,
    });

    return new Response(JSON.stringify({ success: sendResult.success, error: sendResult.error }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

function buildReceiptHtml(data: any) {
  const d = data || {};
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="color:#7c3aed;margin:0;font-size:24px">Hashtag Dance</h1>
    <p style="color:#888;font-size:13px;margin:4px 0">Payment Receipt</p>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <table style="width:100%;font-size:14px;color:#333">
    <tr><td style="padding:8px 0;color:#888">Student</td><td style="padding:8px 0;text-align:right;font-weight:600">${d.student_name || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Batches</td><td style="padding:8px 0;text-align:right">${d.batches || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#7c3aed">₹${d.amount || "0"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Payment Mode</td><td style="padding:8px 0;text-align:right">${d.payment_mode || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Transaction ID</td><td style="padding:8px 0;text-align:right;font-size:12px">${d.transaction_id || "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;text-align:right">${d.date || new Date().toLocaleDateString("en-IN")}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="text-align:center;color:#aaa;font-size:11px;margin:0">Thank you for dancing with us! 💃</p>
</div>
</body></html>`;
}
