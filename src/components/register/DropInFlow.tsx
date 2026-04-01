import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import SessionBrowser from "./SessionBrowser";
import PhoneEntry from "./PhoneEntry";

export default function DropInFlow() {
  const [step, setStep] = useState<"browse" | "phone" | "details" | "confirm">("browse");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [dropInFee, setDropInFee] = useState(700);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("system_settings").select("*").eq("organization_id", 1).eq("key", "drop_in_fee").then(({ data }) => {
      if (data && data.length > 0) setDropInFee(Number(data[0].value));
    });
  }, []);

  const handleCreateAndProceed = async () => {
    if (!newName.trim()) { toast.error("Please enter your name"); return; }
    setSubmitting(true);
    try {
      const { data: existingUsers } = await supabase.from("users").select("id").eq("organization_id", 1).ilike("phone", `%${newPhone}`);
      if (existingUsers && existingUsers.length > 0) {
        const { data: existingStudents } = await supabase.from("students").select("*, users(*)").eq("user_id", existingUsers[0].id);
        if (existingStudents && existingStudents.length > 0) {
          setUser(existingStudents[0].users);
          setStudent(existingStudents[0]);
          toast.info("Account already exists! Proceeding with your profile.");
          setStep("confirm");
          return;
        }
      }
      const { data: newUser, error: userErr } = await supabase.from("users").insert({ organization_id: 1, name: newName.trim(), phone: newPhone }).select().single();
      if (userErr) throw userErr;
      const { data: newStudent, error: studErr } = await supabase.from("students").insert({ organization_id: 1, name: newName.trim(), phone: newPhone, user_id: newUser.id }).select().single();
      if (studErr) throw studErr;
      setUser(newUser);
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
      setStep("browse");
      setSelectedSession(null);
      setStudent(null);
      setUser(null);
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
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
              onStudentFound={(s, u) => { setStudent(s); setUser(u); setStep("confirm"); }}
              onNewUser={phone => { setNewPhone(phone); setStep("details"); }}
            />
          </CardContent>
        </Card>
      )}

      {step === "details" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Create Your Account</h3>
            <p className="text-sm text-muted-foreground">Phone: {newPhone}</p>
            <div>
              <Label>Your Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter your full name" className="mt-1" />
            </div>
            <Button className="w-full gradient-primary" onClick={handleCreateAndProceed} disabled={submitting}>
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
              <Button variant="ghost" size="sm" onClick={() => setStep("browse")}>← Start Over</Button>
            </div>
            <p className="text-sm text-muted-foreground">Welcome, <span className="text-foreground font-medium">{student?.name}</span></p>
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
    </div>
  );
}
