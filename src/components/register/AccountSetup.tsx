import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Check } from "lucide-react";
import { toast } from "sonner";
import AccountOwnerChoice from "./AccountOwnerChoice";
import { isAccountOwnerType, type AccountOwnerType } from "@/lib/accountOwner";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};

interface AccountSetupProps {
  user: UserRow;
  students: StudentRow[];
  onComplete: (user: UserRow, students: StudentRow[]) => void;
}

interface StudentDraft {
  id: number | null;
  name: string;
}

function initialDrafts(user: UserRow, students: StudentRow[]): StudentDraft[] {
  if (students.length > 0) {
    return students.map((student) => ({ id: student.id, name: student.name || "" }));
  }
  return [{ id: null, name: user.name || "" }];
}

export default function AccountSetup({ user, students, onComplete }: AccountSetupProps) {
  const hasSingleStudent = students.length <= 1;
  const defaultOwnerType: AccountOwnerType = students.length > 1 ? "parent_guardian" : "self";
  const [ownerType, setOwnerType] = useState<AccountOwnerType>(
    students.length > 1 ? "parent_guardian" :
      isAccountOwnerType(user.account_owner_type) ? user.account_owner_type : defaultOwnerType,
  );
  const [ownerName, setOwnerName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [studentDrafts, setStudentDrafts] = useState<StudentDraft[]>(() => initialDrafts(user, students));
  const [parentUsesStudentName, setParentUsesStudentName] = useState(() => {
    if (students.length !== 1) return false;
    return (user.name || "").trim().toLowerCase() === (students[0]?.name || "").trim().toLowerCase();
  });
  const [saving, setSaving] = useState(false);

  const effectiveDrafts = useMemo(() => {
    if (ownerType === "self" && studentDrafts.length === 1) {
      return [{ ...studentDrafts[0], name: ownerName }];
    }
    return studentDrafts;
  }, [ownerName, ownerType, studentDrafts]);

  const updateStudentName = (index: number, name: string) => {
    setStudentDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, name } : draft)));
  };

  const handleSave = async () => {
    const validDrafts = effectiveDrafts.map((draft) => ({ ...draft, name: draft.name.trim() })).filter((draft) => draft.name);
    const firstStudentName = validDrafts[0]?.name || "";
    const effectiveOwnerName = ownerType === "parent_guardian" && hasSingleStudent && parentUsesStudentName
      ? firstStudentName
      : ownerName.trim();

    if (!effectiveOwnerName) {
      toast.error(ownerType === "self" ? "Enter the student's name" : "Enter the account owner name");
      return;
    }
    if (ownerType === "self" && validDrafts.length !== 1) {
      toast.error("Self-managed accounts should have one student profile");
      return;
    }
    if (validDrafts.length === 0) {
      toast.error("Enter at least one student name");
      return;
    }

    setSaving(true);
    try {
      const { data: updatedUser, error: userError } = await supabase
        .from("users")
        .update({
          name: effectiveOwnerName,
          email: email.trim() || null,
          account_owner_type: ownerType,
          account_setup_completed: true,
          account_setup_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();
      if (userError) throw userError;

      for (const draft of validDrafts) {
        if (draft.id) {
          const { error } = await supabase
            .from("students")
            .update({ name: draft.name })
            .eq("id", draft.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("students")
            .insert({
              organization_id: user.organization_id,
              user_id: user.id,
              name: draft.name,
              phone: user.phone,
              email: email.trim() || null,
            });
          if (error) throw error;
        }
      }

      const { data: updatedStudents, error: studentsError } = await supabase
        .from("students")
        .select("*, users(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (studentsError) throw studentsError;

      toast.success("Account setup saved");
      onComplete(updatedUser, updatedStudents || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not save account setup: " + message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified phone</p>
          <h3 className="font-display font-semibold text-foreground text-lg">Finish account setup</h3>
          <p className="text-sm text-muted-foreground">{user.phone}</p>
        </div>

        <AccountOwnerChoice
          value={ownerType}
          onChange={setOwnerType}
          disableSelf={students.length > 1}
          selfDescription="I am the student signing in."
          parentDescription="I am a parent or guardian managing a student."
        />

        {students.length > 1 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            Multiple students were found on this phone, so this account is being set up as the account owner.
          </div>
        )}

        {ownerType === "parent_guardian" && hasSingleStudent && (
          <div className="space-y-2">
            <Label>Is the parent/guardian name the same as the student name?</Label>
            <RadioGroup
              value={parentUsesStudentName ? "same" : "different"}
              onValueChange={(value) => setParentUsesStudentName(value === "same")}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <Label htmlFor="parent-name-same" className="rounded-lg border border-border p-3 cursor-pointer hover:border-primary/50">
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="parent-name-same" value="same" className="mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Same name</p>
                    <p className="text-xs text-muted-foreground">Use the student name for this account too.</p>
                  </div>
                </div>
              </Label>
              <Label htmlFor="parent-name-different" className="rounded-lg border border-border p-3 cursor-pointer hover:border-primary/50">
                <div className="flex items-start gap-2">
                  <RadioGroupItem id="parent-name-different" value="different" className="mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Different name</p>
                    <p className="text-xs text-muted-foreground">Enter the parent/guardian name separately.</p>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>{ownerType === "self" ? "Student name" : "Account owner name"}</Label>
            <Input
              value={ownerType === "parent_guardian" && hasSingleStudent && parentUsesStudentName ? (effectiveDrafts[0]?.name || "") : ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder={ownerType === "self" ? "Your name" : "Parent or guardian name"}
              disabled={ownerType === "parent_guardian" && hasSingleStudent && parentUsesStudentName}
              className="mt-1"
            />
            {ownerType === "parent_guardian" && hasSingleStudent && parentUsesStudentName && (
              <p className="text-xs text-muted-foreground mt-1">This will be copied from the student name below.</p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
        </div>

        {ownerType === "self" && studentDrafts.length === 1 ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            This phone number will open the student account for <span className="text-foreground font-medium">{ownerName || "this student"}</span>.
          </div>
        ) : (
          <div className="space-y-3">
            <Label className="text-base">Student profile{effectiveDrafts.length > 1 ? "s" : ""}</Label>
            {effectiveDrafts.map((draft, index) => (
              <div key={draft.id ?? `new-${index}`}>
                <Input
                  value={draft.name}
                  onChange={(event) => updateStudentName(index, event.target.value)}
                  placeholder="Student name"
                />
              </div>
            ))}
          </div>
        )}

        <Button className="w-full gradient-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : (<><Check className="h-4 w-4 mr-1" /> Save and continue</>)}
        </Button>
      </CardContent>
    </Card>
  );
}
