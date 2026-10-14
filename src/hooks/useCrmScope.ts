import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { crm, CRM_ENABLED } from "@/lib/crm";

export function useCrmScope() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["crm", user?.id, "scope"],
    enabled: CRM_ENABLED && !!user,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await crm.rpc("crm_my_scope");
      if (error) throw error;
      return data || [];
    },
  });
}
