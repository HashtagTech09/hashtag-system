import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccountOwnerType = "self" | "parent_guardian";

interface StudentDraft {
  id: number | null;
  name: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      user_id,
      organization_id,
      phone,
      owner_name,
      email,
      account_owner_type,
      students,
    } = body as {
      user_id?: number;
      organization_id?: number;
      phone?: string;
      owner_name?: string;
      email?: string;
      account_owner_type?: AccountOwnerType;
      students?: StudentDraft[];
    };

    const orgId = organization_id || 1;
    const cleanPhone = normalizePhone(phone);
    const ownerName = String(owner_name ?? "").trim();
    const emailValue = String(email ?? "").trim() || null;
    const studentDrafts = (students || [])
      .map((student) => ({ id: student.id ?? null, name: String(student.name ?? "").trim() }))
      .filter((student) => student.name);

    if (!user_id || !cleanPhone) return json({ success: false, error: "Valid user and phone are required" });
    if (account_owner_type !== "self" && account_owner_type !== "parent_guardian") {
      return json({ success: false, error: "Choose whether this is a student or parent-owned account" });
    }
    if (!ownerName) return json({ success: false, error: "Account owner name is required" });
    if (studentDrafts.length === 0) return json({ success: false, error: "At least one student profile is required" });
    if (account_owner_type === "self" && studentDrafts.length !== 1) {
      return json({ success: false, error: "A student account can only have one student profile" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: user, error: userLookupError } = await supabase
      .from("users")
      .select("id, organization_id, phone")
      .eq("id", user_id)
      .eq("organization_id", orgId)
      .single();
    if (userLookupError || !user) return json({ success: false, error: "Account not found" });
    if (normalizePhone(user.phone) !== cleanPhone) return json({ success: false, error: "Phone does not match this account" });

    const { data: otpRecords, error: otpError } = await supabase
      .from("whatsapp_otp")
      .select("id")
      .eq("phone", cleanPhone)
      .eq("verified", true)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (otpError) throw otpError;
    if (!otpRecords || otpRecords.length === 0) {
      return json({ success: false, error: "Your OTP session expired. Please verify your phone again." });
    }

    const { data: updatedUser, error: updateUserError } = await supabase
      .from("users")
      .update({
        name: ownerName,
        email: emailValue,
        account_owner_type,
        account_setup_completed: true,
        account_setup_completed_at: new Date().toISOString(),
      })
      .eq("id", user_id)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (updateUserError) throw updateUserError;

    for (const draft of studentDrafts) {
      if (draft.id) {
        const { data: existingStudent, error: existingStudentError } = await supabase
          .from("students")
          .select("id, user_id")
          .eq("id", draft.id)
          .eq("organization_id", orgId)
          .single();
        if (existingStudentError || !existingStudent) throw existingStudentError || new Error("Student profile not found");
        if (existingStudent.user_id && existingStudent.user_id !== user_id) {
          return json({ success: false, error: "This student profile is linked to another account" });
        }

        const { error } = await supabase
          .from("students")
          .update({ name: draft.name, user_id })
          .eq("id", draft.id)
          .eq("organization_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("students")
          .insert({
            organization_id: orgId,
            user_id,
            name: draft.name,
            phone: cleanPhone,
            email: emailValue,
          });
        if (error) throw error;
      }
    }

    const { data: updatedStudents, error: studentsError } = await supabase
      .from("students")
      .select("*, users(*)")
      .eq("user_id", user_id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (studentsError) throw studentsError;

    return json({ success: true, user: updatedUser, students: updatedStudents || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not complete account setup";
    return json({ success: false, error: message });
  }
});
