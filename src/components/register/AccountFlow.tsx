import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import StudentDashboard from "./StudentDashboard";

type Step = "phone" | "signup" | "hub" | "dashboard";

export default function AccountFlow() {
  const [step, setStep] = useState<Step>("phone");
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [activeStudent, setActiveStudent] = useState<any>(null);

  // First-time signup state
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentSameAsOwner, setStudentSameAsOwner] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleUserResolved = (u: any, list: any[]) => {
    setUser(u);
    setStudents(list);
    if (list.length === 0) {
      // Verified user with no students yet — go straight to hub so they can add one
      setStep("hub");
    } else if (list.length === 1) {
      setActiveStudent(list[0]);
      setStep("dashboard");
    } else {
      setStep("hub");
    }
  };

  const handleSignup = async () => {
    if (!ownerName.trim()) { toast.error("Enter the account owner's name"); return; }
    const sName = studentSameAsOwner ? ownerName.trim() : studentName.trim();
    if (!sName) { toast.error("Enter the student's name"); return; }
    setSubmitting(true);
    try {
      const { data: newUser, error: userErr } = await supabase
        .from("users")
        .insert({ organization_id: 1, name: ownerName.trim(), phone: newPhone })
        .select()
        .single();
      if (userErr) throw userErr;
      const { data: newStudent, error: studErr } = await supabase
        .from("students")
        .insert({ organization_id: 1, name: sName, user_id: newUser.id })
        .select("*, users(*)")
        .single();
      if (studErr) throw studErr;
      setUser(newUser);
      setStudents([newStudent]);
      setActiveStudent(newStudent);
      setStep("dashboard");
    } catch (e: any) {
      toast.error("Failed to create account: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setUser(null);
    setStudents([]);
    setActiveStudent(null);
    setOwnerName("");
    setStudentName("");
    setStudentSameAsOwner(true);
    setStep("phone");
  };

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-display font-bold text-foreground">My Account</h2>
          <p className="text-sm text-muted-foreground">Log in with your phone to view your students &amp; plans</p>
        </div>
        <Card className="glass-card">
          <CardContent className="p-6">
            <PhoneEntry
              onUserResolved={handleUserResolved}
              onNewUser={(phone) => { setNewPhone(phone); setStep("signup"); }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "signup") {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">Create your account</h3>
            <p className="text-sm text-muted-foreground">Phone: {newPhone}</p>
          </div>
          <div>
            <Label>Account owner name</Label>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Parent or your own name" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">This is who manages the account.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={studentSameAsOwner} onChange={e => setStudentSameAsOwner(e.target.checked)} />
            <span>I am the student</span>
          </label>
          {!studentSameAsOwner && (
            <div>
              <Label>Student name</Label>
              <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Child or member's name" className="mt-1" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("phone")} className="flex-1">Back</Button>
            <Button onClick={handleSignup} disabled={submitting} className="flex-1 gradient-primary">
              {submitting ? "Creating..." : "Create account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "hub") {
    return (
      <UserHub
        user={user}
        students={students}
        ctaVerb="View account"
        onPickStudent={(s) => {
          setActiveStudent(s);
          // Refresh student list in case a new one was just added
          setStudents(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
          setStep("dashboard");
        }}
      />
    );
  }

  // dashboard
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Logged in as {user.name}</p>
          <h2 className="text-lg font-display font-semibold text-foreground truncate">
            Viewing {activeStudent.name} 👋
          </h2>
        </div>
        {students.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setStep("hub")}>
            Switch student
          </Button>
        )}
      </div>
      <StudentDashboard
        student={activeStudent}
        user={user}
        onDone={reset}
      />
    </div>
  );
}
