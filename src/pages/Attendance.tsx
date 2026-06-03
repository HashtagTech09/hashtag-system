import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { todayIST } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentCycle } from "@/lib/cycleUtils";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { getDisplayPhone } from "@/lib/studentUtils";
import { useScopedStudents } from "@/hooks/useScopedStudents";

const AttendancePage = () => {
  const { staffUser, isInstructor, isAdminOrManager } = useAuth();
  const scope = useScopedStudents();
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<number, string>>({});
  const [date] = useState(todayIST());
  const [planCycles, setPlanCycles] = useState<any[]>([]);

  useEffect(() => {
    const param = searchParams.get("batch");
    if (param && batches.some((b) => String(b.id) === param)) {
      setSelectedBatch(param);
    }
  }, [searchParams, batches]);

  useEffect(() => {
    if (scope.loading) return;
    const fetchBatches = async () => {
      let batchQuery: any = supabase.from("batches").select("*").eq("organization_id", 1).order("name");
      // If instructor, only show their batches
      if (isInstructor && !isAdminOrManager && staffUser) {
        batchQuery = batchQuery.or(`instructor_id.eq.${staffUser.id},instructor_2_id.eq.${staffUser.id}`);
      } else if (!scope.unrestricted) {
        if (scope.batchIds.length === 0) { setBatches([]); setPlanCycles([]); return; }
        batchQuery = batchQuery.in("id", scope.batchIds);
      }
      const [batchRes, cycleRes] = await Promise.all([
        batchQuery,
        supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
      ]);
      setBatches(batchRes.data || []);
      setPlanCycles(cycleRes.data || []);
    };
    fetchBatches();
  }, [staffUser, isInstructor, isAdminOrManager, scope.loading, scope.unrestricted, scope.batchIds.join(",")]);

  // Helper to get schedule days from batch
  const getBatchDays = (batch: any): string[] => {
    if (!batch.schedule || !Array.isArray(batch.schedule)) return [];
    return batch.schedule.map((s: any) => s.day);
  };

  useEffect(() => {
    if (!selectedBatch) return;
    const fetchStudents = async () => {
      // Find the cycle for the current date
      const currentCycle = getCurrentCycle(planCycles);

      let eligibleStudentIds: number[] = [];

      if (currentCycle) {
        // Cycle-based: query enrollment_cycles for students who own this cycle+batch
        const { data: ecData } = await supabase
          .from("enrollment_cycles")
          .select("student_id")
          .eq("batch_id", Number(selectedBatch))
          .eq("cycle_id", currentCycle.id);

        eligibleStudentIds = [...new Set((ecData || []).map(ec => ec.student_id))];
      } else {
        // Fallback to date-based for backward compatibility
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("student_id")
          .eq("organization_id", 1)
          .eq("batch_id", Number(selectedBatch))
          .lte("start_date", date)
          .gte("end_date", date);

        eligibleStudentIds = [...new Set((enrollments || []).map(e => e.student_id))];
      }

      // Fetch student details
      if (eligibleStudentIds.length > 0) {
        const { data: studentData } = await supabase
          .from("students")
          .select("id, name, phone, users(phone)")
          .in("id", eligibleStudentIds);
        setStudents((studentData || []) as any[]);
      } else {
        setStudents([]);
      }

      const { data: existingAtt } = await supabase
        .from("attendance")
        .select("*")
        .eq("batch_id", Number(selectedBatch))
        .eq("date", date);

      const attMap: Record<number, string> = {};
      (existingAtt || []).forEach((a) => { attMap[a.student_id] = a.status; });
      setAttendance(attMap);
    };
    fetchStudents();
  }, [selectedBatch, date, planCycles]);

  const markAttendance = async (studentId: number, status: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
    const { error } = await supabase.from("attendance").upsert({
      organization_id: 1, student_id: studentId, batch_id: Number(selectedBatch), date, status,
    }, { onConflict: "student_id,batch_id,date" });
    if (error) toast.error("Failed to save");
  };

  // Format batch label with schedule info
  const getBatchLabel = (b: any) => {
    const days = getBatchDays(b);
    return days.length > 0 ? `${b.name} (${days.join(", ")})` : b.name;
  };

  return (
    <AdminLayout title="Attendance">
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select batch" /></SelectTrigger>
          <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{getBatchLabel(b)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-muted-foreground flex items-center text-sm">Date: {date}</div>
      </div>

      {selectedBatch && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Students ({students.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active students in this batch for today.</p>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground">{getDisplayPhone(student)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant={attendance[student.id] === "present" ? "default" : "outline"} className={attendance[student.id] === "present" ? "bg-success hover:bg-success/90" : ""} onClick={() => markAttendance(student.id, "present")}>
                        <Check className="h-4 w-4 mr-1" />P
                      </Button>
                      <Button size="sm" variant={attendance[student.id] === "absent" ? "default" : "outline"} className={attendance[student.id] === "absent" ? "bg-destructive hover:bg-destructive/90" : ""} onClick={() => markAttendance(student.id, "absent")}>
                        <X className="h-4 w-4 mr-1" />A
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedBatch && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a batch to start marking attendance
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
};

export default AttendancePage;
