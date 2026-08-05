import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Music, Check } from "lucide-react";
import { initiateRazorpayPayment } from "@/lib/razorpayUtils";
import { isPlanValid, computeCycleAssignment, computeFeeBreakdown, detectStudentStatus, getStartCycleIndex } from "@/lib/enrollmentUtils";
import type { PlanCycle, SubPlan } from "@/lib/enrollmentUtils";
import { allocateCyclesForPlan } from "@/lib/cycleUtils";
import { sortBatchesByHierarchy, computePaymentAllocations } from "@/lib/styleHierarchy";
import StudioSelection from "./StudioSelection";
import StyleSelection from "./StyleSelection";
import LevelSelection from "./LevelSelection";
import BatchSelection from "./BatchSelection";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import AccountSetup from "./AccountSetup";
import AccountOwnerChoice from "./AccountOwnerChoice";
import FeeBreakdownDisplay from "./FeeBreakdown";
import ReceiptPreviewDialog from "./ReceiptPreviewDialog";
import { useSimulatedToday } from "@/contexts/TestDateContext";
import type { ReceiptData } from "@/lib/receiptTemplate";
import { needsAccountSetup, type AccountOwnerType } from "@/lib/accountOwner";

type Step = "studio" | "style" | "level" | "batch" | "phone" | "setup" | "hub" | "details" | "pay" | "waiting";
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};
type BatchRow = Database["public"]["Tables"]["batches"]["Row"];
type CashRecipient = Pick<UserRow, "id" | "name" | "email">;

export default function JoinBatchFlow() {
  const [step, setStep] = useState<Step>("studio");
  const [selectedStudioId, setSelectedStudioId] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [accountOwnerType, setAccountOwnerType] = useState<AccountOwnerType>("self");
  const [planCycles, setPlanCycles] = useState<PlanCycle[]>([]);
  const [subPlans, setSubPlans] = useState<SubPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMode, setPaymentMode] = useState("razorpay");
  const [submitting, setSubmitting] = useState(false);
  const [allBatches, setAllBatches] = useState<BatchRow[]>([]);
  const [detectedStatus, setDetectedStatus] = useState<string>("NEW");
  const [latestEndDate, setLatestEndDate] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [testConfirmationUrl, setTestConfirmationUrl] = useState<string | null>(null);
  const simulatedToday = useSimulatedToday();

  useEffect(() => {
    supabase.from("batches").select("*").eq("organization_id", 1).then(({ data }) => setAllBatches(data || []));
  }, []);

  useEffect(() => {
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

  const startCycleIdx = planCycles.length > 0 ? getStartCycleIndex(planCycles, simulatedToday) : 0;
  const validPlans = subPlans.filter(p => isPlanValid(p, planCycles, startCycleIdx));

  useEffect(() => {
    if (step === "pay" && validPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(String(validPlans[0].id));
    }
  }, [step, validPlans, selectedPlanId]);

  const assignment = selectedPlanId ? computeCycleAssignment(subPlans.find(p => p.id === Number(selectedPlanId))!, planCycles, startCycleIdx) : null;

  const selectedBatchObjects = selectedBatchIds.map(id => allBatches.find(b => b.id === Number(id))).filter(Boolean);
  const sortedSelectedBatches = sortBatchesByHierarchy(selectedBatchObjects);

  const getCashApprovalRecipients = async (): Promise<CashRecipient[]> => {
    const batchIds = selectedBatchIds.map(Number);
    if (batchIds.length === 0) return [];

    const { data: batchRows } = await supabase
      .from("batches")
      .select("id, instructor_id, instructor_2_id, studios(dreamcatcher_id, wingperson_id)")
      .in("id", batchIds);

    const recipientIds = new Set<number>();
    (batchRows || []).forEach((batch: any) => {
      [batch.instructor_id, batch.instructor_2_id, batch.studios?.dreamcatcher_id, batch.studios?.wingperson_id]
        .filter(Boolean)
        .forEach((id: number) => recipientIds.add(id));
    });

    if (recipientIds.size === 0) {
      const { data: managerRoles } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name)")
        .eq("organization_id", 1)
        .eq("roles.name", "manager");
      (managerRoles || []).forEach((row: any) => recipientIds.add(row.user_id));
    }

    if (recipientIds.size === 0) return [];
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", Array.from(recipientIds));

    const byEmail = new Map<string, CashRecipient>();
    (users || []).forEach((u) => {
      if (u.email) byEmail.set(u.email.toLowerCase(), u);
    });
    return Array.from(byEmail.values());
  };

  useEffect(() => {
    const detectStatus = async () => {
      if (!student) { setDetectedStatus("NEW"); setLatestEndDate(null); return; }
      const { data: enrollments } = await supabase
        .from("enrollments").select("end_date").eq("student_id", student.id).order("end_date", { ascending: false });
      const result = detectStudentStatus(enrollments || [], planCycles, simulatedToday);
      setDetectedStatus(result.status);
      setLatestEndDate(result.latestEndDate);
    };
    detectStatus();
  }, [student, planCycles, simulatedToday]);

  const breakdown = selectedBatchIds.length > 0 && assignment ? computeFeeBreakdown({
    batchCount: selectedBatchIds.length,
    regularCycles: assignment.regularCount,
    gridCycles: assignment.gridCount,
    detectedStatus,
    latestEndDate,
    dropInAmount: 0,
    sortedBatches: sortedSelectedBatches.map(b => ({ id: b.id, name: b.name, style_base: b.style_base })),
    today: simulatedToday,
  }) : null;

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const continueAfterAccountSetup = (list: StudentRow[]) => {
    if (list.length === 0) {
      // Verified user with no students yet — go to hub so they can add one
      setStep("hub");
    } else if (list.length === 1) {
      setStudent(list[0]);
      setStep("pay");
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
      // Re-check in case the user signed up in another tab
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
      setStep("pay");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Failed to create account: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!student || selectedBatchIds.length === 0 || !assignment || !breakdown) return;
    setSubmitting(true);
    try {
      const plan = subPlans.find(p => p.id === Number(selectedPlanId));
      if (!plan) { toast.error("Plan not found."); setSubmitting(false); return; }
      const startCycleIndex = planCycles.findIndex(c => c.id === assignment.startCycle.id);
      const allocated = startCycleIndex >= 0 ? allocateCyclesForPlan(plan, planCycles, startCycleIndex) : [];
      if (allocated.length === 0) {
        toast.error("Could not allocate cycles for this plan. Please contact support.");
        setSubmitting(false);
        return;
      }
      const cyclesTemplate = allocated.map(c => ({ cycle_id: c.cycleId, cycle_type: c.cycleType }));

      const enrollmentRecords = sortedSelectedBatches.map(batch => ({
        organization_id: 1, student_id: student.id, batch_id: batch.id,
        status_type: detectedStatus,
        registration_fee_applied: breakdown.applyRegFee, late_renewal: breakdown.isLateRenewal,
        start_date: assignment.startCycle.start_date,
        end_date: assignment.endCycle.end_date || assignment.startCycle.start_date,
        subscription_plan_id: Number(selectedPlanId),
        start_cycle_id: assignment.startCycle.id, end_cycle_id: assignment.endCycle.id,
        previous_batch_id: null,
      }));

      const allocations = computePaymentAllocations(
        sortedSelectedBatches.map(b => ({ id: b.id, studio_id: b.studio_id })),
        breakdown.perBatchFee, breakdown.discountPct, breakdown.total
      );

      const planName = subPlans.find(p => p.id === Number(selectedPlanId))?.name || "";
      const batchNames = sortedSelectedBatches.map(b => b.name).join(", ");

      const showReceipt = (mode: string, txnId: string) => {
        setReceiptData({
          student_name: student.name,
          plan_name: planName,
          batches: batchNames,
          amount: breakdown.total.toLocaleString("en-IN"),
          payment_mode: mode,
          transaction_id: txnId,
          date: simulatedToday,
        });
        setReceiptOpen(true);
      };

      if (paymentMode === "razorpay") {
        await initiateRazorpayPayment({
          orderParams: {
            student_id: student.id, organization_id: 1, batch_ids: selectedBatchIds.map(Number),
            amount: breakdown.subtotal, gst: breakdown.gst, final_amount: breakdown.total,
            enrollment_data: { enrollments: enrollmentRecords, enrollment_cycles_template: cyclesTemplate, payment_allocations: allocations },
            student_name: student.name, student_phone: student.phone || "", batch_names: batchNames, plan_name: planName,
          },
          onSuccess: () => {
            toast.success("Payment initiated! Enrollment will be confirmed once payment is captured.");
            showReceipt("Razorpay", "Pending capture");
          },
          onFailure: (err) => toast.error(err),
        });
        setSubmitting(false);
        return;
      }

      const cashRecipients = await getCashApprovalRecipients();
      if (cashRecipients.length === 0) {
        toast.error("No manager or instructor email is assigned to this batch. Please contact support.");
        setSubmitting(false);
        return;
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const primaryApprover = cashRecipients[0];
      const { data: cashReq, error: cashErr } = await supabase.from("cash_payment_requests").insert({
        organization_id: 1, student_id: student.id, staff_user_id: primaryApprover.id,
        amount: breakdown.subtotal, gst: breakdown.gst, final_amount: breakdown.total,
        enrollment_data: { enrollments: enrollmentRecords, enrollment_cycles_template: cyclesTemplate, payment_allocations: allocations } as unknown as Json,
        batch_ids: selectedBatchIds.map(Number) as unknown as Json,
        expires_at: expiresAt,
        recipient_user_ids: cashRecipients.map((r) => r.id) as unknown as Json,
      }).select().single();
      if (cashErr) throw cashErr;

      const confirmUrl = `${window.location.origin}/confirm-cash?token=${cashReq.token}`;
      const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-cash-confirmation", {
        body: {
          recipients: cashRecipients.map((r) => ({ email: r.email, name: r.name })),
          student_name: student.name, amount: breakdown.total.toLocaleString("en-IN"), confirmation_url: confirmUrl,
          expires_in_minutes: 10,
        },
      });
      if (emailErr) throw emailErr;
      setTestConfirmationUrl(emailData?.test_mode ? confirmUrl : null);

      toast.success("Cash payment request sent to the batch team for 10-minute confirmation!");
      showReceipt("Cash", `CASH-${cashReq.id}`);
      setStep("waiting");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Enrollment failed: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep("studio");
    setSelectedStudioId(null);
    setSelectedStyle("");
    setSelectedLevel("");
    setSelectedBatchIds([]);
    setStudent(null);
    setUser(null);
    setStudents([]);
    setOwnerName("");
    setStudentName("");
    setAccountOwnerType("self");
    setSelectedPlanId("");
    setTestConfirmationUrl(null);
  };

  const stepLabels = ["Studio", "Style", "Level", "Batch", "Verify", "Pay"];
  const stepIdx = { studio: 0, style: 1, level: 2, batch: 3, phone: 4, setup: 4, hub: 4, details: 4, pay: 5, waiting: 5 }[step];


  const getPlanPerBatchFee = (p: SubPlan) => (p.total_regular_cycles || 0) * 3767 + (p.total_grid_cycles || 0) * 5300;

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 text-xs">
        {stepLabels.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${i <= stepIdx ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i + 1}
            </div>
            <span className={`hidden sm:inline ${i <= stepIdx ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < stepLabels.length - 1 && <div className={`h-px w-4 sm:w-6 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {step === "studio" && (
        <StudioSelection onSelectStudio={id => { setSelectedStudioId(id); setStep("style"); }} />
      )}

      {step === "style" && selectedStudioId && (
        <StyleSelection
          studioId={selectedStudioId}
          onSelectStyle={s => { setSelectedStyle(s); setStep("level"); }}
          onBack={() => { setSelectedStudioId(null); setStep("studio"); }}
        />
      )}

      {step === "level" && selectedStudioId && (
        <LevelSelection
          studioId={selectedStudioId}
          selectedStyle={selectedStyle}
          onSelectLevel={l => { setSelectedLevel(l); setStep("batch"); }}
          onBack={() => { setSelectedStyle(""); setStep("style"); }}
        />
      )}

      {step === "batch" && selectedStudioId && (
        <BatchSelection
          selectedStyle={selectedStyle}
          studioId={selectedStudioId}
          selectedLevel={selectedLevel}
          selectedBatchIds={selectedBatchIds}
          onToggleBatch={toggleBatch}
          onContinue={() => setStep("phone")}
          onBack={() => { setSelectedLevel(""); setStep("level"); }}
        />
      )}

      {step === "phone" && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <PhoneEntry
              onUserResolved={handleUserResolved}
              onNewUser={(phone) => { setNewPhone(phone); setStep("details"); }}
            />
          </CardContent>
        </Card>
      )}

      {step === "hub" && user && (
        <UserHub
          user={user}
          students={students}
          ctaVerb="Continue"
          onBack={() => setStep("phone")}
          onPickStudent={(s) => {
            setStudent(s);
            setStudents(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
            setStep("pay");
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
              <p className="text-xs text-muted-foreground mt-1">This is who manages the account.</p>
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


      {step === "pay" && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">Review & Pay</h3>
              <Button variant="ghost" size="sm" onClick={resetFlow}>← Start Over</Button>
            </div>
            <p className="text-sm text-muted-foreground">Welcome, <span className="text-foreground font-medium">{student?.name}</span></p>

            {/* Plan as cards */}
            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {validPlans.map(p => {
                  const isSelected = selectedPlanId === String(p.id);
                  const perBatch = getPlanPerBatchFee(p);
                  return (
                    <Card
                      key={p.id}
                      className={`cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-primary glow-primary" : "hover:border-primary/50"}`}
                      onClick={() => setSelectedPlanId(String(p.id))}
                    >
                      <CardContent className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display font-semibold text-foreground">{p.name}</h4>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-lg font-bold text-foreground">₹{perBatch.toLocaleString("en-IN")}<span className="text-xs font-normal text-muted-foreground">/batch</span></p>
                        <p className="text-xs text-muted-foreground">{p.total_cycles} cycle{p.total_cycles > 1 ? "s" : ""}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {assignment && (
                <div className="p-2 rounded border border-border text-sm">
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

            {paymentMode === "cash" && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <Label>Cash approval</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  A confirmation email will be sent to the batch manager and instructor. They must confirm within 10 minutes after receiving cash.
                </p>
              </div>
            )}

            {breakdown && assignment && (
              <FeeBreakdownDisplay breakdown={breakdown} regularCycles={assignment.regularCount} gridCycles={assignment.gridCount} detectedStatus={detectedStatus} />
            )}

            <Button className="w-full gradient-primary" onClick={handleEnroll} disabled={submitting || !breakdown}>
              {submitting ? "Processing..." : `Confirm & Pay ₹${breakdown?.total.toLocaleString() || "0"}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "waiting" && (
        <Card className="glass-card">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Music className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <h3 className="font-display font-semibold text-foreground">Waiting for Staff Confirmation</h3>
            <p className="text-sm text-muted-foreground">
              A confirmation email has been sent to the batch manager and instructor. Once one of them confirms within 10 minutes, your enrollment will be completed.
            </p>
            {testConfirmationUrl && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-3 text-left">
                <div>
                  <Label>Test mode confirmation link</Label>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{testConfirmationUrl}</p>
                </div>
                <Button className="w-full gradient-primary" onClick={() => window.open(testConfirmationUrl, "_blank", "noopener,noreferrer")}>
                  Open confirmation link
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={resetFlow}>Start New Registration</Button>
          </CardContent>
        </Card>
      )}

      <ReceiptPreviewDialog
        open={receiptOpen}
        onClose={() => { setReceiptOpen(false); resetFlow(); }}
        data={receiptData || {}}
        recipientEmail={student?.email || student?.users?.email}
        recipientPhone={student?.phone || student?.users?.phone}
      />
    </div>
  );
}
