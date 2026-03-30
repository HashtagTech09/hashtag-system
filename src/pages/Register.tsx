import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initiateRazorpayPayment } from "@/lib/razorpayUtils";
import { useEffect } from "react";
import BatchBrowser from "@/components/register/BatchBrowser";
import SessionBrowser from "@/components/register/SessionBrowser";
import PhoneEntry from "@/components/register/PhoneEntry";
import FeeBreakdownDisplay from "@/components/register/FeeBreakdown";
import StudentDashboard from "@/components/register/StudentDashboard";
import { isPlanValid, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getStartCycleIndex } from "@/lib/enrollmentUtils";
import type { PlanCycle, SubPlan } from "@/lib/enrollmentUtils";
import { sortBatchesByHierarchy, computePaymentAllocations } from "@/lib/styleHierarchy";
import { Music } from "lucide-react";

const RegisterPage = () => {
  const [tab, setTab] = useState("join");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Music className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-lg">Hashtag Dance</h1>
            <p className="text-xs text-muted-foreground">Student Registration Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="join">Join a Batch</TabsTrigger>
            <TabsTrigger value="dropin">Drop-In</TabsTrigger>
            <TabsTrigger value="account">My Account</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="mt-6">
            <JoinBatchFlow />
          </TabsContent>
          <TabsContent value="dropin" className="mt-6">
            <DropInFlow />
          </TabsContent>
          <TabsContent value="account" className="mt-6">
            <AccountFlow />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// ─── Flow 1: Join a Batch ────────────────────────────────
function JoinBatchFlow() {
  const [step, setStep] = useState<"browse" | "phone" | "details" | "pay">("browse");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [planCycles, setPlanCycles] = useState<PlanCycle[]>([]);
  const [subPlans, setSubPlans] = useState<SubPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [allBatches, setAllBatches] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("batches").select("*").eq("organization_id", 1).then(({ data }) => setAllBatches(data || []));
  }, []);
    const fetch = async () => {
      const [planRes, cycleRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("organization_id", 1).eq("is_active", true).order("id"),
        supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
      ]);
      setSubPlans(planRes.data || []);
      setPlanCycles(cycleRes.data || []);
    };
    fetch();
  }, []);

  const startCycleIdx = planCycles.length > 0 ? getStartCycleIndex(planCycles) : 0;
  const validPlans = subPlans.filter(p => isPlanValid(p, planCycles, startCycleIdx));

  // Auto-select first valid plan
  useEffect(() => {
    if (step === "pay" && validPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(String(validPlans[0].id));
    }
  }, [step, validPlans, selectedPlanId]);

  const assignment = selectedPlanId ? computeCycleAssignment(subPlans.find(p => p.id === Number(selectedPlanId))!, planCycles, startCycleIdx) : null;

  const detectedStatus = student ? "REN" : "NEW"; // simplified — full detection happens for returning students
  const breakdown = selectedBatchIds.length > 0 && assignment ? computeFeeBreakdown({
    batchCount: selectedBatchIds.length,
    regularCycles: assignment.regularCount,
    gridCycles: assignment.gridCount,
    detectedStatus,
    latestEndDate: null,
    dropInAmount: 0,
  }) : null;

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const handleCreateAndProceed = async () => {
    if (!newName.trim()) { toast.error("Please enter your name"); return; }
    setSubmitting(true);
    try {
      // Create user
      const { data: newUser, error: userErr } = await supabase.from("users").insert({
        organization_id: 1, name: newName.trim(), phone: newPhone,
      }).select().single();
      if (userErr) throw userErr;

      // Create student
      const { data: newStudent, error: studErr } = await supabase.from("students").insert({
        organization_id: 1, name: newName.trim(), phone: newPhone, user_id: newUser.id,
      }).select().single();
      if (studErr) throw studErr;

      setUser(newUser);
      setStudent(newStudent);
      setStep("pay");
    } catch (e: any) {
      toast.error("Failed to create account: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!student || selectedBatchIds.length === 0 || !assignment || !breakdown) return;
    setSubmitting(true);
    try {
      const enrollmentRecords = selectedBatchIds.map(batchId => ({
        organization_id: 1, student_id: student.id, batch_id: Number(batchId),
        status_type: detectedStatus,
        registration_fee_applied: breakdown.applyRegFee, late_renewal: false,
        start_date: assignment.startCycle.start_date,
        end_date: assignment.endCycle.end_date || assignment.startCycle.start_date,
        subscription_plan_id: Number(selectedPlanId),
        start_cycle_id: assignment.startCycle.id, end_cycle_id: assignment.endCycle.id,
        previous_batch_id: null,
      }));

      if (paymentMode === "razorpay") {
        const batchNames = selectedBatchIds.map(id => "Batch#" + id).join(", ");
        const planName = subPlans.find(p => p.id === Number(selectedPlanId))?.name || "";

        await initiateRazorpayPayment({
          orderParams: {
            student_id: student.id,
            organization_id: 1,
            batch_ids: selectedBatchIds.map(Number),
            amount: breakdown.subtotal,
            gst: breakdown.gst,
            final_amount: breakdown.total,
            enrollment_data: { enrollments: enrollmentRecords, enrollment_cycles_template: [] },
            student_name: student.name,
            student_phone: student.phone || "",
            batch_names: batchNames,
            plan_name: planName,
          },
          onSuccess: () => {
            toast.success("Payment initiated! Enrollment will be confirmed once payment is captured.");
            setStep("browse");
            setSelectedBatchIds([]);
            setStudent(null);
            setUser(null);
            setSelectedPlanId("");
          },
          onFailure: (err) => toast.error(err),
        });
        setSubmitting(false);
        return;
      }

      // Cash flow
      const { data: payment, error: payError } = await supabase.from("payments").insert({
        organization_id: 1, student_id: student.id, amount: breakdown.subtotal,
        gst: breakdown.gst, final_amount: breakdown.total,
        payment_mode: paymentMode, status: "success",
      }).select().single();
      if (payError) throw payError;

      const records = enrollmentRecords.map(r => ({ ...r, payment_id: payment.id }));
      const { error } = await supabase.from("enrollments").insert(records);
      if (error) throw error;

      toast.success(`Enrolled successfully! Amount: ₹${breakdown.total.toLocaleString()}`);
      setStep("browse");
      setSelectedBatchIds([]);
      setStudent(null);
      setUser(null);
      setSelectedPlanId("");
    } catch {
      toast.error("Enrollment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {["Browse", "Identify", "Pay"].map((s, i) => {
          const stepIdx = step === "browse" ? 0 : step === "phone" ? 1 : step === "details" ? 1 : 2;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${i <= stepIdx ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
              <span className={i <= stepIdx ? "text-foreground" : "text-muted-foreground"}>{s}</span>
              {i < 2 && <div className={`h-px w-8 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      {step === "browse" && (
        <>
          <BatchBrowser selectedBatchIds={selectedBatchIds} onToggleBatch={toggleBatch} />
          {selectedBatchIds.length > 0 && (
            <Button className="w-full gradient-primary" onClick={() => setStep("phone")}>
              Continue with {selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? "es" : ""}
            </Button>
          )}
        </>
      )}

      {step === "phone" && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <PhoneEntry
              onStudentFound={(s, u) => { setStudent(s); setUser(u); setStep("pay"); }}
              onNewUser={(phone) => { setNewPhone(phone); setStep("details"); }}
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

      {step === "pay" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">Review & Pay</h3>
              <Button variant="ghost" size="sm" onClick={() => setStep("browse")}>← Start Over</Button>
            </div>
            <p className="text-sm text-muted-foreground">Welcome, <span className="text-foreground font-medium">{student?.name}</span></p>

            <div>
              <Label>Subscription Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {validPlans.map(p => {
                    const perBatchFee = (p.total_regular_cycles || 0) * 3767 + (p.total_grid_cycles || 0) * 5300;
                    return <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{perBatchFee.toLocaleString("en-IN")}/batch</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {assignment && (
                <div className="mt-2 p-2 rounded border border-border text-sm">
                  <p className="text-muted-foreground">Validity: <span className="text-foreground font-medium">{assignment.startCycle.name}</span> → <span className="text-foreground font-medium">{assignment.endCycle.name}</span></p>
                </div>
              )}
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

            {breakdown && assignment && (
              <FeeBreakdownDisplay breakdown={breakdown} regularCycles={assignment.regularCount} gridCycles={assignment.gridCount} detectedStatus={detectedStatus} />
            )}

            <Button className="w-full gradient-primary" onClick={handleEnroll} disabled={submitting || !breakdown}>
              {submitting ? "Processing..." : `Confirm & Pay ₹${breakdown?.total.toLocaleString() || "0"}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Flow 2: Drop-In ────────────────────────────────────
function DropInFlow() {
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
      const { data: newUser, error: userErr } = await supabase.from("users").insert({
        organization_id: 1, name: newName.trim(), phone: newPhone,
      }).select().single();
      if (userErr) throw userErr;
      const { data: newStudent, error: studErr } = await supabase.from("students").insert({
        organization_id: 1, name: newName.trim(), phone: newPhone, user_id: newUser.id,
      }).select().single();
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
      {step === "browse" && (
        <>
          <SessionBrowser selectedSessionId={selectedSession?.id ?? null} onSelectSession={s => { setSelectedSession(s); setStep("phone"); }} />
        </>
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

// ─── Flow 3: My Account ─────────────────────────────────
function AccountFlow() {
  const [student, setStudent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  if (!student) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <PhoneEntry
            onStudentFound={(s, u) => { setStudent(s); setUser(u); }}
            onNewUser={() => toast.error("No account found with this number. Please use 'Join a Batch' to register.")}
          />
        </CardContent>
      </Card>
    );
  }

  return <StudentDashboard student={student} user={user} onDone={() => { setStudent(null); setUser(null); }} />;
}

export default RegisterPage;
