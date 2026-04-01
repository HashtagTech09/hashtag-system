import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import PhoneEntry from "./PhoneEntry";
import StudentDashboard from "./StudentDashboard";

export default function AccountFlow() {
  const [student, setStudent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  if (!student) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-display font-bold text-foreground">My Account</h2>
          <p className="text-sm text-muted-foreground">Enter your phone number to view your profile</p>
        </div>
        <Card className="glass-card">
          <CardContent className="p-6">
            <PhoneEntry
              onStudentFound={(s, u) => { setStudent(s); setUser(u); }}
              onNewUser={() => toast.error("No account found with this number. Please use 'Join a Batch' to register.")}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
        <h2 className="text-lg font-display font-semibold text-foreground">Welcome back, {student.name} 👋</h2>
      </div>
      <StudentDashboard student={student} user={user} onDone={() => { setStudent(null); setUser(null); }} />
    </div>
  );
}
