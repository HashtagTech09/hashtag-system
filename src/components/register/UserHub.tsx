import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, User as UserIcon, Check, ArrowLeft } from "lucide-react";

interface UserHubProps {
  /** Verified account owner. */
  user: any;
  /** All students linked to this user. */
  students: any[];
  /** Called when the user picks (or creates) a student to act on. */
  onPickStudent: (student: any) => void;
  /** Optional verb shown in the heading: "Continue", "View account", "Book drop-in". */
  ctaVerb?: string;
  /** Allow adding a new student. Defaults to true. */
  allowAdd?: boolean;
  /** Optional back button (e.g. to phone screen). */
  onBack?: () => void;
}

export default function UserHub({
  user,
  students,
  onPickStudent,
  ctaVerb = "Continue",
  allowAdd = true,
  onBack,
}: UserHubProps) {
  const [adding, setAdding] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddStudent = async () => {
    const name = newStudentName.trim();
    if (!name) {
      toast.error("Enter the student's name");
      return;
    }
    setSubmitting(true);
    try {
      const { data: created, error } = await supabase
        .from("students")
        .insert({
          organization_id: 1,
          user_id: user.id,
          name,
          // student-specific phone left blank; falls back to user.phone via studentUtils
        })
        .select("*, users(*)")
        .single();
      if (error) throw error;
      toast.success(`${name} added to your account`);
      onPickStudent(created);
    } catch (e: any) {
      toast.error("Could not add student: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Logged in as</p>
            <h3 className="font-display font-semibold text-foreground text-lg">{user.name}</h3>
            <p className="text-xs text-muted-foreground">{user.phone}</p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
        </div>

        {!adding && (
          <>
            <div>
              <Label className="text-base">Who is this for?</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a student under your account{allowAdd ? " or add a new one." : "."}
              </p>
            </div>

            {students.length === 0 && !allowAdd && (
              <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
                No students are linked to this account yet.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {students.map(s => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => onPickStudent(s)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
                      <UserIcon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{ctaVerb} →</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {allowAdd && (
                <Card
                  className="cursor-pointer border-dashed hover:border-primary/50 transition-all"
                  onClick={() => setAdding(true)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Add another student</p>
                      <p className="text-xs text-muted-foreground">Sibling, child, or yourself</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {adding && (
          <div className="space-y-3">
            <div>
              <Label>New student's name</Label>
              <Input
                autoFocus
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                placeholder="e.g. Aanya Sharma"
                className="mt-1"
                onKeyDown={e => e.key === "Enter" && handleAddStudent()}
              />
              <p className="text-xs text-muted-foreground mt-2">
                This student will be added under <span className="text-foreground font-medium">{user.name}</span>'s account.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setAdding(false); setNewStudentName(""); }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddStudent} disabled={submitting} className="flex-1 gradient-primary">
                {submitting ? "Adding..." : (<><Check className="h-4 w-4 mr-1" /> Add &amp; {ctaVerb}</>)}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
