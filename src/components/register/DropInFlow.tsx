import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Sparkles } from "lucide-react";
import SessionBrowser from "./SessionBrowser";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import AccountSetup from "./AccountSetup";
import AccountOwnerChoice from "./AccountOwnerChoice";
import ReceiptPreviewDialog from "./ReceiptPreviewDialog";
import { useSimulatedToday } from "@/contexts/TestDateContext";
import type { ReceiptData } from "@/lib/receiptTemplate";
import { needsAccountSetup, type AccountOwnerType } from "@/lib/accountOwner";

type Step = "browse" | "phone" | "setup" | "hub" | "details" | "confirm";
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};
type BatchSessionRow = Database["public"]["Tables"]["batch_sessions"]["Row"];

export default function DropInFlow() {
  const [step, setStep] = useState<Step>("browse");
  const [selectedSession, setSelectedSession] = useState<BatchSessionRow | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [accountOwnerType, setAccountOwnerType] = useState<AccountOwnerType>("self");
  const [dropInFee, setDropInFee] = useState(700);
  const [paymentMode, setPaymentMode] = useState("razorpay");
  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const simulatedToday = useSimulatedToday();
  const dropInTotal = dropInFee + Math.round(dropInFee * 0.18);
  const paymentActionLabel = paymentMode === "cash"
    ? `Record Cash Drop-in ₹${dropInTotal.toLocaleString("en-IN")}`
    : `Pay ₹${dropInTotal.toLocaleString("en-IN")} with Razorpay`;

  useEffect(() => {
    supabase.from("system_settings").select("*").eq("organization_id", 1).eq("key", "drop_in_fee").then(({ data }) => {
      if (data && data.length > 0) setDropInFee(Number(data[0].value));
    });
  }, []);

  const continueAfterAccountSetup = (list: StudentRow[]) => {
    if (list.length === 0) {
      setStep("hub");
    } else if (list.length === 1) {
      setStudent(list[0]);
      setStep("confirm");
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
    continueAfterAccountSetup(list);
  };

  const handleSignup = async () => {
    if (!ownerName.trim()) { toast.error("Enter the account owner's name"); return; }
    const sName = accountOwnerType === "self" ? ownerName.trim() : studentName.trim();
    if (!sName) { toast.error("Enter the student's name"); return; }
    setSubmitting(true);
    try {
      const { data: existingUsers } = await supabase.from("users").select("*").eq("organization_id", 1).ilike("phone", `%${newPhone}`);
      if (existingUsers && existingUsers.length > 0) {
        const ownerUser = existingUsers[0];
        const { data: existingStudents } = await supabase.from("students").select("*, users(*)").eq("user_id", ownerUser.id);
        toast.info("Account already exists! Continuing with your profile.");
        handleUserResolved(ownerUser, existingStudents || []);
        return;
      }
      const { data: newUser, error: userErr } = await supabase.from("users").insert({
        organization_id: 1,
        name: ownerName.trim(),
        phone: newPhone,
        account_owner_type: accountOwnerType,
        account_setup_completed: true,
        account_setup_completed_at: new Date().toISOString(),
      }).select().single();
      if (userErr) throw userErr;
      const { data: newStudent, error: studErr } = await supabase.from("students").insert({ organization_id: 1, name: sName, user_id: newUser.id }).select("*, users(*)").single();
      if (studErr) throw studErr;
      setUser(newUser);
      setStudents([newStudent]);
      setStudent(newStudent);
      setStep("confirm");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Failed to create account: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDropIn = async () => {
    if (!student || !selectedSession) return;
    setSubmitting(true);
    try {
      const gst = Math.round(dropInFee * 0.18);
      const total = dropInFee + gst;
      const { data: payment, error: payErr } = await supabase.from("payments").insert({
        organization_id: 1, student_id: student.id, amount: dropInFee,
        gst, final_amount: total, payment_mode: paymentMode, status: "success",
      }).select().single();
      if (payErr) throw payErr;

      const { error } = await supabase.from("drop_ins").insert({
        organization_id: 1, student_id: student.id, batch_session_id: selectedSession.id,
        amount: dropInFee, payment_id: payment.id,
      });
      if (error) throw error;

      toast.success(`Drop-in booked! Amount: ₹${total.toLocaleString()}`);
      setReceiptData({
        student_name: student.name,
        plan_name: "Drop-In",
        batches: `${selectedSession?.session_date} • ${selectedSession?.start_time}–${selectedSession?.end_time}`,
        amount: total.toLocaleString("en-IN"),
        payment_mode: paymentMode === "razorpay" ? "Razorpay" : "Cash",
        transaction_id: `DROP-${payment.id}`,
        date: simulatedToday,
      });
      setReceiptOpen(true);
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep("browse");
    setSelectedSession(null);
    setStudent(null);
    setUser(null);
    setStudents([]);
    setOwnerName("");
    setStudentName("");
    setAccountOwnerType("self");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Not ready to commit?</span> Try a drop-in class ✨
        </p>
      </div>

      {step === "browse" && (
        <SessionBrowser selectedSessionId={selectedSession?.id ?? null} onSelectSession={s => { setSelectedSession(s); setStep("phone"); }} />
      )}

      {step === "phone" && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-4">Selected: {selectedSession?.start_time} – {selectedSession?.end_time} on {selectedSession?.session_date}</p>
            <PhoneEntry
              onUserResolved={handleUserResolved}
              onNewUser={phone => { setNewPhone(phone); setStep("details"); }}
            />
          </CardContent>
        </Card>
      )}

      {step === "hub" && user && (
        <UserHub
          user={user}
          students={students}
          ctaVerb="Book drop-in"
          onBack={() => setStep("phone")}
          onPickStudent={(s) => {
            setStudent(s);
            setStudents(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
            setStep("confirm");
          }}
        />
      )}

      {step === "setup" && user && (
        <AccountSetup
          user={user}
          students={students}
          onComplete={(updatedUser, updatedStudents) => {
            setUser(updatedUser);
            setStudents(updatedStudents);
            continueAfterAccountSetup(updatedStudents);
          }}
        />
      )}

      {step === "details" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Create your account</h3>
            <p className="text-sm text-muted-foreground">Phone: {newPhone}</p>
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
            </div>
            {accountOwnerType === "parent_guardian" && (
              <div>
                <Label>Student name</Label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Child or member's name" className="mt-1" />
              </div>
            )}
            <Button className="w-full gradient-primary" onClick={handleSignup} disabled={submitting}>
              {submitting ? "Creating..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">Confirm Drop-in</h3>
              <Button variant="ghost" size="sm" onClick={reset}>← Start Over</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="text-foreground font-medium">{user?.name}</span> · Booking for <span className="text-foreground font-medium">{student?.name}</span>
              {students.length > 1 && (
                <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-xs" onClick={() => setStep("hub")}>Switch student</Button>
              )}
            </p>
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Session</span><span>{selectedSession?.session_date} • {selectedSession?.start_time}–{selectedSession?.end_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Drop-in fee</span><span>₹{dropInFee.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{Math.round(dropInFee * 0.18).toLocaleString()}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>₹{dropInTotal.toLocaleString()}</span></div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-primary" onClick={handleDropIn} disabled={submitting}>
              {submitting ? "Processing..." : paymentActionLabel}
            </Button>
          </CardContent>
        </Card>
      )}

      <ReceiptPreviewDialog
        open={receiptOpen}
        onClose={() => { setReceiptOpen(false); reset(); }}
        data={receiptData || {}}
        recipientEmail={student?.email || student?.users?.email}
        recipientPhone={student?.phone || student?.users?.phone}
      />
    </div>
  );
}
