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
    const { phone } = await req.json();
    if (!phone || phone.length < 10) {
      return new Response(JSON.stringify({ error: "Valid phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabase.from("whatsapp_otp").insert({ phone, otp, expires_at: expiresAt });

    // Check test mode
    const { data: testSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("organization_id", 1)
      .eq("key", "test_mode")
      .single();

    const isTestMode = testSetting?.value === "true";

    if (isTestMode) {
      await supabase.from("notification_log").insert({
        organization_id: 1,
        channel: "whatsapp",
        recipient: phone,
        template_name: "otp",
        payload: { otp },
        status: "test_logged",
      });
      return new Response(JSON.stringify({ success: true, test_mode: true, test_otp: otp }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send via Interakt
    const interaktKey = Deno.env.get("INTERAKT_API_KEY");
    if (!interaktKey) {
      return new Response(JSON.stringify({ error: "INTERAKT_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const phoneNum = phone.startsWith("91") ? phone.replace(/^91/, "") : phone;
    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: { Authorization: `Basic ${interaktKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: "+91",
        phoneNumber: phoneNum,
        callbackData: "otp",
        type: "Template",
        template: {
          name: "login_otp",
          languageCode: "en",
          bodyValues: [otp],
        },
      }),
    });

    const resBody = await res.text();

    await supabase.from("notification_log").insert({
      organization_id: 1,
      channel: "whatsapp",
      recipient: phone,
      template_name: "otp",
      payload: { otp: "***" },
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? null : resBody,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: "Failed to send WhatsApp OTP. Enable test mode or check Interakt config." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
