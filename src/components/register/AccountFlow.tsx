import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import StudentDashboard from "./StudentDashboard";
import AccountSetup from "./AccountSetup";
import AccountOwnerChoice from "./AccountOwnerChoice";
import { needsAccountSetup, type AccountOwnerType } from "@/lib/accountOwner";
import { Check, Plus, X } from "lucide-react";
import { useSimulatedToday } from "@/contexts/TestDateContext";

type Step = "phone" | "signup" | "setup" | "hub" | "dashboard";
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};

export default function AccountFlow() {
  const [step, setStep] = useState<Step>("phone");
  const [user, setUser] = useState<UserRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentRow | null>(null);

  // First-time signup state
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [accountOwnerType, setAccountOwnerType] = useState<AccountOwnerType>("self");
  const [submitting, setSubmitting] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [addingStudentSubmit, setAddingStudentSubmit] = useState(false);
  const simulatedToday = useSimulatedToday();

  const continueAfterSetup = (list: StudentRow[]) => {
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

  const handleUserResolved = (u: UserRow, list: StudentRow[]) => {
    setUser(u);
    setStudents(list);
    if (needsAccountSetup(u)) {
      setStep("setup");
      return;
    }
    continueAfterSetup(list);
  };

  const handleSignup = async () => {
    if (!ownerName.trim()) { toast.error("Enter the account owner's name"); return; }
    const sName = accountOwnerType === "self" ? ownerName.trim() : studentName.trim();
    if (!sName) { toast.error("Enter the student's name"); return; }
    setSubmitting(true);
    try {
      const { data: newUser, error: userErr } = await supabase
        .from("users")
        .insert({
          organization_id: 1,
          name: ownerName.trim(),
          phone: newPhone,
          account_owner_type: accountOwnerType,
          account_setup_completed: true,
          account_setup_completed_at: new Date().toISOString(),
        })
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Failed to create account: " + message);
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
    setAccountOwnerType("self");
    setAddingStudent(false);
    setNewStudentName("");
    setStep("phone");
  };

  const handleAddStudent = async () => {
    if (!user) return;
    const name = newStudentName.trim();
    if (!name) {
      toast.error("Enter the student's name");
      return;
    }

    setAddingStudentSubmit(true);
    try {
      const { data: created, error } = await supabase
        .from("students")
        .insert({
          organization_id: user.organization_id || 1,
          user_id: user.id,
          name,
          phone: user.phone,
          email: user.email,
        })
        .select("*, users(*)")
        .single();
      if (error) throw error;

      setStudents((current) => current.some((student) => student.id === created.id) ? current : [...current, created]);
      setActiveStudent(created);
      setNewStudentName("");
      setAddingStudent(false);
      setStep("dashboard");
      toast.success(`${name} added under ${user.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not add student: " + message);
    } finally {
      setAddingStudentSubmit(false);
    }
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
          <div className="space-y-2">
            <Label>Who owns this account?</Label>
            <AccountOwnerChoice value={accountOwnerType} onChange={setAccountOwnerType} />
          </div>
          <div>
            <Label>Account owner name</Label>
            <Input
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder={accountOwnerType === "self" ? "Your name" : "Parent or guardian name"}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">This is who manages the account.</p>
          </div>
          {accountOwnerType === "parent_guardian" && (
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

  if (step === "setup" && user) {
    return (
      <AccountSetup
        user={user}
        students={students}
        onComplete={(updatedUser, updatedStudents) => {
          setUser(updatedUser);
          setStudents(updatedStudents);
          continueAfterSetup(updatedStudents);
        }}
      />
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
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Logged in as {user.name}</p>
            <h2 className="text-lg font-display font-semibold text-foreground truncate">
              Viewing {activeStudent.name} 👋
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddingStudent(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add student
            </Button>
            {students.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setStep("hub")}>
                Switch student
              </Button>
            )}
          </div>
        </div>

        {addingStudent && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <Input
              autoFocus
              value={newStudentName}
              onChange={(event) => setNewStudentName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleAddStudent()}
              placeholder="New student's name"
            />
            <div className="flex gap-2">
              <Button onClick={handleAddStudent} disabled={addingStudentSubmit} className="gradient-primary flex-1 sm:flex-none">
                <Check className="h-4 w-4 mr-1" /> {addingStudentSubmit ? "Adding..." : "Add"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setAddingStudent(false);
                  setNewStudentName("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <StudentDashboard
        student={activeStudent}
        user={user}
        onDone={reset}
        simulatedToday={simulatedToday}
      />
    </div>
  );
}
