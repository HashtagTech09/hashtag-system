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
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: "phone and otp required" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: otpRecords } = await supabase
      .from("whatsapp_otp")
      .select("*")
      .eq("phone", phone)
      .eq("otp", otp)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!otpRecords || otpRecords.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid OTP" }), { headers: corsHeaders });
    }

    const record = otpRecords[0];
    if (new Date(record.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "OTP expired" }), { headers: corsHeaders });
    }

    await supabase.from("whatsapp_otp").update({ verified: true }).eq("id", record.id);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
