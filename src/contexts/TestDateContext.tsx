import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { todayIST } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";

const TEST_DATE_STORAGE_KEY = "hashtag:test-date";

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
  const [simulatedDateState, setSimulatedDateState] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(TEST_DATE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setSimulatedDate = useCallback((date: string | null) => {
    setSimulatedDateState(date);
    try {
      if (date) {
        window.localStorage.setItem(TEST_DATE_STORAGE_KEY, date);
      } else {
        window.localStorage.removeItem(TEST_DATE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures; the in-memory date still works.
    }
  }, []);

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

    const onCustom = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === TEST_DATE_STORAGE_KEY) {
        setSimulatedDateState(event.newValue);
      }
    };

    window.addEventListener("test-mode-changed", onCustom);
    window.addEventListener("storage", onStorage);

    const channel = supabase
      .channel("system_settings:test_mode")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.removeEventListener("test-mode-changed", onCustom);
      window.removeEventListener("storage", onStorage);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <TestDateContext.Provider value={{ isTestMode, simulatedDate: simulatedDateState, setSimulatedDate, refresh }}>
      {children}
    </TestDateContext.Provider>
  );
}

export function useTestDate() {
  return useContext(TestDateContext);
}

/** Returns the simulated date (if set) or actual today in IST. */
export function useSimulatedToday(): string {
  const { isTestMode, simulatedDate } = useContext(TestDateContext);
  return isTestMode && simulatedDate ? simulatedDate : todayIST();
}
