import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function assertCanManageStaffAuth(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Unauthorized");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) throw new Error("Unauthorized");

  const { data: caller } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authData.user.id)
    .single();
  if (!caller) throw new Error("Unauthorized");

  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("id, roles!inner(name)")
    .eq("user_id", caller.id)
    .eq("roles.name", "admin")
    .maybeSingle();
  if (!adminRole) throw new Error("Admin access required");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await assertCanManageStaffAuth(supabase, req);

    const { user_id, email, password } = await req.json();

    if (!user_id || !email || !password) {
      return new Response(JSON.stringify({ error: "user_id, email, and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user_id already has auth_id
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, auth_id, name")
      .eq("id", user_id)
      .single();

    if (!existingUser) {
      return new Response(JSON.stringify({ error: "Staff user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingUser.auth_id) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(existingUser.auth_id, {
        email,
        password,
        email_confirm: true,
        user_metadata: { staff_user_id: user_id, name: existingUser.name },
      });

      if (updateAuthError) {
        return new Response(JSON.stringify({ error: updateAuthError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("users").update({ email }).eq("id", user_id);

      return new Response(JSON.stringify({ success: true, auth_id: existingUser.auth_id, updated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { staff_user_id: user_id, name: existingUser.name },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update users table with auth_id
    const { error: updateError } = await supabase
      .from("users")
      .update({ auth_id: authData.user.id })
      .eq("id", user_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Auth account created but failed to link: " + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also update email on users table if not set
    await supabase.from("users").update({ email }).eq("id", user_id).is("email", null);

    return new Response(JSON.stringify({ success: true, auth_id: authData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
