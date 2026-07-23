import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Check, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};
type AccountOwnerType = "self" | "parent_guardian";

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
  const defaultOwnerType: AccountOwnerType = students.length > 1 ? "parent_guardian" : "self";
  const [ownerType, setOwnerType] = useState<AccountOwnerType>(
    students.length > 1 ? "parent_guardian" :
      user.account_owner_type === "parent_guardian" || user.account_owner_type === "self" ? user.account_owner_type : defaultOwnerType,
  );
  const [ownerName, setOwnerName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [studentDrafts, setStudentDrafts] = useState<StudentDraft[]>(() => initialDrafts(user, students));
  const [selfUsesOwnerName, setSelfUsesOwnerName] = useState(students.length <= 1);
  const [saving, setSaving] = useState(false);

  const effectiveDrafts = useMemo(() => {
    if (ownerType === "self" && selfUsesOwnerName && studentDrafts.length === 1) {
      return [{ ...studentDrafts[0], name: ownerName }];
    }
    return studentDrafts;
  }, [ownerName, ownerType, selfUsesOwnerName, studentDrafts]);

  const updateStudentName = (index: number, name: string) => {
    setStudentDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, name } : draft)));
  };

  const handleSave = async () => {
    const trimmedOwnerName = ownerName.trim();
    const validDrafts = effectiveDrafts.map((draft) => ({ ...draft, name: draft.name.trim() })).filter((draft) => draft.name);

    if (!trimmedOwnerName) {
      toast.error("Enter the account owner name");
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
          name: trimmedOwnerName,
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

        <RadioGroup
          value={ownerType}
          onValueChange={(value) => setOwnerType(value as AccountOwnerType)}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Label
            htmlFor="owner-self"
            className={`rounded-lg border p-4 cursor-pointer transition-all ${ownerType === "self" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem id="owner-self" value="self" className="mt-1" disabled={students.length > 1} />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <UserRound className="h-4 w-4" />
                  I manage my own classes
                </div>
                <p className="text-xs text-muted-foreground">The account owner and student are the same person.</p>
              </div>
            </div>
          </Label>
          <Label
            htmlFor="owner-parent"
            className={`rounded-lg border p-4 cursor-pointer transition-all ${ownerType === "parent_guardian" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem id="owner-parent" value="parent_guardian" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <UsersRound className="h-4 w-4" />
                  Parent or guardian
                </div>
                <p className="text-xs text-muted-foreground">This phone manages one or more student profiles.</p>
              </div>
            </div>
          </Label>
        </RadioGroup>

        {students.length > 1 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            Multiple students were found on this phone, so this account is being set up as the account owner.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Account owner name</Label>
            <Input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Parent, guardian, or your name"
              className="mt-1"
            />
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

        {ownerType === "self" && studentDrafts.length === 1 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selfUsesOwnerName}
              onChange={(event) => setSelfUsesOwnerName(event.target.checked)}
            />
            <span>Use the account owner name as the student name</span>
          </label>
        )}

        <div className="space-y-3">
          <Label className="text-base">Student profile{effectiveDrafts.length > 1 ? "s" : ""}</Label>
          {effectiveDrafts.map((draft, index) => (
            <div key={draft.id ?? `new-${index}`}>
              <Input
                value={draft.name}
                onChange={(event) => updateStudentName(index, event.target.value)}
                placeholder="Student name"
                disabled={ownerType === "self" && selfUsesOwnerName && studentDrafts.length === 1}
              />
            </div>
          ))}
        </div>

        <Button className="w-full gradient-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : (<><Check className="h-4 w-4 mr-1" /> Save and continue</>)}
        </Button>
      </CardContent>
    </Card>
  );
}
