import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { todayIST } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";

interface TestDateContextValue {
  isTestMode: boolean;
  simulatedDate: string | null; // YYYY-MM-DD or null = use real today
  setSimulatedDate: (d: string | null) => void;
}

const TestDateContext = createContext<TestDateContextValue>({
  isTestMode: false,
  simulatedDate: null,
  setSimulatedDate: () => {},
});

export function TestDateProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <TestDateContext.Provider value={{ isTestMode, simulatedDate, setSimulatedDate }}>
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
