import { createClient } from "@supabase/supabase-js";
import { createDispatchHandler } from "./handler.ts";

Deno.serve(createDispatchHandler({
  get: (key) => Deno.env.get(key),
  queue: () => {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      claim: async () => {
        const { data, error } = await supabase.rpc("crm_claim_events", { p_limit: 5 });
        if (error) throw new Error("QUEUE_UNAVAILABLE");
        return data || [];
      },
      finish: async (event, outcome) => {
        const { data, error } = await supabase.rpc("crm_finish_event", {
          p_event: event.event_id, p_lease: event.lease_id, p_status: outcome.status,
          p_code: outcome.code, p_delay_seconds: outcome.delay,
        });
        return !error && data === true;
      },
    };
  },
}));
