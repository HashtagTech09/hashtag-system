import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import SessionBrowser from "./SessionBrowser";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import ReceiptPreviewDialog from "./ReceiptPreviewDialog";
import { useSimulatedToday } from "@/contexts/TestDateContext";

type Step = "browse" | "phone" | "hub" | "details" | "confirm";

export default function DropInFlow() {
  const [step, setStep] = useState<Step>("browse");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentSameAsOwner, setStudentSameAsOwner] = useState(true);
  const [dropInFee, setDropInFee] = useState(700);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const simulatedToday = useSimulatedToday();

  useEffect(() => {
    supabase.from("system_settings").select("*").eq("organization_id", 1).eq("key", "drop_in_fee").then(({ data }) => {
      if (data && data.length > 0) setDropInFee(Number(data[0].value));
    });
  }, []);

  const handleUserResolved = (u: any, list: any[]) => {
    setUser(u);
    setStudents(list);
    if (list.length === 0) {
      setStep("hub");
    } else if (list.length === 1) {
      setStudent(list[0]);
      setStep("confirm");
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
      const { data: existingUsers } = await supabase.from("users").select("*").eq("organization_id", 1).ilike("phone", `%${newPhone}`);
      if (existingUsers && existingUsers.length > 0) {
        const ownerUser = existingUsers[0];
        const { data: existingStudents } = await supabase.from("students").select("*, users(*)").eq("user_id", ownerUser.id);
        setUser(ownerUser);
        setStudents(existingStudents || []);
        toast.info("Account already exists! Continuing with your profile.");
        if ((existingStudents || []).length === 1) {
          setStudent(existingStudents![0]);
          setStep("confirm");
        } else {
          setStep("hub");
        }
        return;
      }
      const { data: newUser, error: userErr } = await supabase.from("users").insert({ organization_id: 1, name: ownerName.trim(), phone: newPhone }).select().single();
      if (userErr) throw userErr;
      const { data: newStudent, error: studErr } = await supabase.from("students").insert({ organization_id: 1, name: sName, user_id: newUser.id }).select("*, users(*)").single();
      if (studErr) throw studErr;
      setUser(newUser);
      setStudents([newStudent]);
      setStudent(newStudent);
      setStep("confirm");
    } catch (e: any) {
      toast.error("Failed to create account: " + e.message);
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
    setStudentSameAsOwner(true);
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

      {step === "details" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Create your account</h3>
            <p className="text-sm text-muted-foreground">Phone: {newPhone}</p>
            <div>
              <Label>Account owner name</Label>
              <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Parent or your own name" className="mt-1" />
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
              <h3 className="font-display font-semibold text-foreground">Confirm Drop-In</h3>
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
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>₹{(dropInFee + Math.round(dropInFee * 0.18)).toLocaleString()}</span></div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-primary" onClick={handleDropIn} disabled={submitting}>
              {submitting ? "Processing..." : `Confirm & Pay ₹${(dropInFee + Math.round(dropInFee * 0.18)).toLocaleString()}`}
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
