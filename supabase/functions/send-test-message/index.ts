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
    const { channel, recipient, message } = await req.json();

    if (!channel || !recipient || !message) {
      return new Response(JSON.stringify({ error: "channel, recipient, and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel !== "whatsapp" && channel !== "email") {
      return new Response(JSON.stringify({ error: "channel must be 'whatsapp' or 'email'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const orgId = await getDefaultOrgId(supabase);

    // Check test mode
    const { data: testSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("organization_id", orgId)
      .eq("key", "test_mode")
      .single();

    const isTestMode = testSetting?.value === "true";

    if (isTestMode) {
      await supabase.from("notification_log").insert({
        organization_id: orgId,
        channel,
        recipient,
        template_name: "test_message",
        payload: { message },
        status: "test_logged",
      });
      return new Response(
        JSON.stringify({ success: true, test_mode: true, info: "Message logged (test mode)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sendResult = { success: false, error: "" };

    if (channel === "email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        sendResult = { success: false, error: "RESEND_API_KEY not configured" };
      } else {
        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="color:#7c3aed;margin:0;font-size:24px">Hashtag</h1>
    <p style="color:#888;font-size:13px;margin:4px 0">Test Message</p>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${message}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="text-align:center;color:#aaa;font-size:11px;margin:0">This is a test message from Hashtag admin panel.</p>
</div>
</body></html>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Hashtag <receipts@hashtagdance.in>",
            to: [recipient],
            subject: "Test Message from Hashtag",
            html,
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
        const phoneNum = recipient.replace(/^91/, "").replace(/^\+91/, "");
        const res = await fetch("https://api.interakt.ai/v1/public/message/", {
          method: "POST",
          headers: { Authorization: `Basic ${interaktKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            countryCode: "+91",
            phoneNumber: phoneNum,
            callbackData: "test_message",
            type: "Text",
            data: {
              message,
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
      template_name: "test_message",
      payload: { message },
      status: sendResult.success ? "sent" : "failed",
      error_message: sendResult.error || null,
    });

    return new Response(
      JSON.stringify({ success: sendResult.success, error: sendResult.error || undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
