import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useApplicationCasesCount() {
  const [pendingCount, setPendingCount] = useState(0);

  const refetch = async () => {
    const { count } = await supabase
      .from("application_cases")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", 1)
      .eq("status", "pending");
    setPendingCount(count || 0);
  };

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("application_cases_count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_cases" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { pendingCount, refetch };
}
