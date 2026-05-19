import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ScopedAccess {
  unrestricted: boolean;
  loading: boolean;
  studentIds: number[];
  batchIds: number[];
  studioIds: number[];
}

const EMPTY: ScopedAccess = { unrestricted: false, loading: false, studentIds: [], batchIds: [], studioIds: [] };

/**
 * Computes the set of students/batches/studios a manager can access.
 * - Admins (or anyone without a staff record) → unrestricted.
 * - Managers without scope_restricted → unrestricted.
 * - Scoped managers: union of
 *   • students enrolled in batches at studios where they are dreamcatcher/wingperson
 *   • students enrolled in batches where they are instructor_1/2
 *   • students explicitly granted via manager_student_access
 */
export function useScopedStudents(): ScopedAccess {
  const { staffUser, isAdmin, isManager } = useAuth();
  const scopeRestricted = (staffUser as any)?.scope_restricted === true;
  const shouldScope = !isAdmin && isManager && scopeRestricted && !!staffUser;

  const { data, isLoading } = useQuery({
    queryKey: ["scoped-students", staffUser?.id, shouldScope],
    enabled: shouldScope,
    queryFn: async (): Promise<ScopedAccess> => {
      if (!staffUser) return EMPTY;
      const uid = staffUser.id;

      // Studios where this manager is dreamcatcher or wingperson
      const { data: studios } = await supabase
        .from("studios")
        .select("id")
        .or(`dreamcatcher_id.eq.${uid},wingperson_id.eq.${uid}`);
      const studioIds = (studios || []).map((s: any) => s.id as number);

      // Batches at those studios OR where manager is instructor
      const orParts: string[] = [`instructor_id.eq.${uid}`, `instructor_2_id.eq.${uid}`];
      if (studioIds.length) orParts.push(`studio_id.in.(${studioIds.join(",")})`);
      const { data: batches } = await supabase
        .from("batches")
        .select("id")
        .or(orParts.join(","));
      const batchIds = (batches || []).map((b: any) => b.id as number);

      // Students enrolled in those batches
      const studentSet = new Set<number>();
      if (batchIds.length) {
        const { data: enr } = await supabase
          .from("enrollments")
          .select("student_id")
          .in("batch_id", batchIds);
        (enr || []).forEach((e: any) => e?.student_id && studentSet.add(e.student_id));
      }

      // Extra granted students
      const { data: extra } = await supabase
        .from("manager_student_access" as any)
        .select("student_id")
        .eq("manager_user_id", uid);
      (extra || []).forEach((e: any) => e?.student_id && studentSet.add(e.student_id));

      return {
        unrestricted: false,
        loading: false,
        studentIds: Array.from(studentSet),
        batchIds,
        studioIds,
      };
    },
  });

  if (!shouldScope) return { ...EMPTY, unrestricted: true };
  if (isLoading || !data) return { ...EMPTY, loading: true };
  return data;
}
