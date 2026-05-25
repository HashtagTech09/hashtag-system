import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { todayIST } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";

interface TestDateContextValue {
  isTestMode: boolean;
  simulatedDate: string | null; // YYYY-MM-DD or null = use real today
  setSimulatedDate: (d: string | null) => void;
  refresh: () => void;
}

const TestDateContext = createContext<TestDateContextValue>({
  isTestMode: false,
  simulatedDate: null,
  setSimulatedDate: () => {},
  refresh: () => {},
});

export function TestDateProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState<string | null>(null);

  const refresh = useCallback(() => {
    supabase
      .from("system_settings")
      .select("value")
      .eq("organization_id", 1)
      .eq("key", "test_mode")
      .maybeSingle()
      .then(({ data }) => {
        setIsTestMode(data?.value === "true");
      });
  }, []);

  useEffect(() => {
    refresh();

    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onCustom = () => refresh();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("test-mode-changed", onCustom);

    const channel = supabase
      .channel("system_settings:test_mode")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("test-mode-changed", onCustom);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <TestDateContext.Provider value={{ isTestMode, simulatedDate, setSimulatedDate, refresh }}>
      {children}
    </TestDateContext.Provider>
  );
}

export function useTestDate() {
  return useContext(TestDateContext);
}

/** Returns the simulated date (if set) or actual today in IST. */
export function useSimulatedToday(): string {
  const { simulatedDate } = useContext(TestDateContext);
  return simulatedDate || todayIST();
}
