import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Music, Sparkles } from "lucide-react";
import SessionBrowser from "./SessionBrowser";
import PhoneEntry from "./PhoneEntry";
import UserHub from "./UserHub";
import AccountSetup from "./AccountSetup";
import AccountOwnerChoice from "./AccountOwnerChoice";
import { useSimulatedToday } from "@/contexts/TestDateContext";
import type { ReceiptData } from "@/lib/receiptTemplate";
import { needsAccountSetup, type AccountOwnerType } from "@/lib/accountOwner";
import StudioSelection from "./StudioSelection";
import { DEFAULT_DROP_IN_TOTAL, DEFAULT_LONG_DROP_IN_TOTAL, getDropInPricingForSession } from "@/lib/dropInPricing";
import { initiateRazorpayPayment } from "@/lib/razorpayUtils";
import { fetchConfirmedReceiptData } from "@/lib/receiptData";
import ReceiptConfirmation, { ConfirmationLoading } from "./ReceiptConfirmation";

type Step = "studio" | "browse" | "phone" | "setup" | "hub" | "details" | "confirm" | "waiting" | "confirming" | "confirmed";
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"] & {
  users?: UserRow | null;
};
type BatchSessionRow = Database["public"]["Tables"]["batch_sessions"]["Row"] & {
  batch_label?: string | null;
};
type CashRecipient = Pick<UserRow, "id" | "name" | "email">;

export default function DropInFlow() {
  const [step, setStep] = useState<Step>("studio");
  const [selectedStudioId, setSelectedStudioId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<BatchSessionRow | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [accountOwnerType, setAccountOwnerType] = useState<AccountOwnerType>("self");
  const [dropInFee, setDropInFee] = useState(DEFAULT_DROP_IN_TOTAL);
  const [longDropInFee, setLongDropInFee] = useState(DEFAULT_LONG_DROP_IN_TOTAL);
  const [paymentMode, setPaymentMode] = useState("razorpay");
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [testConfirmationUrl, setTestConfirmationUrl] = useState<string | null>(null);
  const simulatedToday = useSimulatedToday();
  const dropInPricing = getDropInPricingForSession(selectedSession, {
    regularTotal: dropInFee,
    longTotal: longDropInFee,
  });
  const selectedSessionLabel = selectedSession
    ? `${selectedSession.batch_label || `Batch ${selectedSession.batch_id}`} • ${selectedSession.session_date} • ${selectedSession.start_time}–${selectedSession.end_time}`
    : "";
  const paymentActionLabel = paymentMode === "cash"
    ? `Request cash confirmation ₹${dropInPricing.inclusiveTotal.toLocaleString("en-IN")}`
    : `Pay ₹${dropInPricing.inclusiveTotal.toLocaleString("en-IN")} with Razorpay`;

  useEffect(() => {
    supabase.from("system_settings").select("*").eq("organization_id", 1).in("key", ["drop_in_fee", "drop_in_long_fee"]).then(({ data }) => {
      (data || []).forEach(setting => {
        const value = Number(setting.value);
        if (!Number.isFinite(value) || value <= 0) return;
        if (setting.key === "drop_in_fee") setDropInFee(value);
        if (setting.key === "drop_in_long_fee") setLongDropInFee(value);
      });
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

  const getCashApprovalRecipients = async (batchId: number): Promise<CashRecipient[]> => {
    const { data: batchRows } = await supabase
      .from("batches")
      .select("id, instructor_id, instructor_2_id, studios(dreamcatcher_id, wingperson_id)")
      .eq("id", batchId);

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
    (users || []).forEach((recipient) => {
      if (recipient.email) byEmail.set(recipient.email.toLowerCase(), recipient);
    });
    return Array.from(byEmail.values());
  };

  const handleDropIn = async () => {
    if (!student || !selectedSession) return;
    setSubmitting(true);
    try {
      const { baseAmount, gst, inclusiveTotal } = dropInPricing;
      const sessionLabel = selectedSessionLabel;

      const showConfirmedReceipt = async (details?: { paymentId?: number; orderId?: string; gatewayPaymentId?: string }) => {
        const paymentId = details?.paymentId;
        if (!paymentId) {
          toast.error("Payment was confirmed, but the receipt payment id was missing.");
          return;
        }
        try {
          const receipt = await fetchConfirmedReceiptData(paymentId, student.id, {
            gatewayPaymentId: details?.gatewayPaymentId,
            orderId: details?.orderId,
          });
          setReceiptData(receipt);
          setStep("confirmed");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load receipt";
          toast.error("Payment confirmed, but receipt could not be loaded: " + message);
          setStep("confirm");
        }
      };

      if (paymentMode === "razorpay") {
        await initiateRazorpayPayment({
          waitForWebhook: true,
          orderParams: {
            student_id: student.id,
            organization_id: 1,
            batch_ids: [selectedSession.batch_id],
            amount: baseAmount,
            gst,
            final_amount: inclusiveTotal,
            enrollment_data: {
              business_date: simulatedToday,
              date: simulatedToday,
              drop_in: {
                organization_id: 1,
                student_id: student.id,
                batch_session_id: selectedSession.id,
                amount: baseAmount,
                business_date: simulatedToday,
                date: simulatedToday,
              },
            },
            student_name: student.name,
            student_phone: student.phone || student.users?.phone || user?.phone || "",
            batch_names: sessionLabel,
            plan_name: "Drop-In",
            description: `Drop-in - ${sessionLabel}`,
            date: simulatedToday,
          },
          onSuccess: async (details) => {
            toast.success("Payment confirmed. Drop-in booked!");
            setStep("confirming");
            await showConfirmedReceipt(details);
          },
          onFailure: (err) => toast.error(err),
        });
        return;
      }

      const cashRecipients = await getCashApprovalRecipients(selectedSession.batch_id);
      if (cashRecipients.length === 0) {
        toast.error("No manager or instructor email is assigned to this batch. Please contact support.");
        return;
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const primaryApprover = cashRecipients[0];
      const { data: cashReq, error: cashErr } = await supabase.from("cash_payment_requests").insert({
        organization_id: 1,
        student_id: student.id,
        staff_user_id: primaryApprover.id,
        amount: baseAmount,
        gst,
        final_amount: inclusiveTotal,
        enrollment_data: {
          business_date: simulatedToday,
          date: simulatedToday,
          drop_in: {
            organization_id: 1,
            student_id: student.id,
            batch_session_id: selectedSession.id,
            amount: baseAmount,
            business_date: simulatedToday,
            date: simulatedToday,
          },
        } as unknown as Json,
        batch_ids: [selectedSession.batch_id] as unknown as Json,
        expires_at: expiresAt,
        recipient_user_ids: cashRecipients.map((r) => r.id) as unknown as Json,
      }).select().single();
      if (cashErr) throw cashErr;

      const confirmUrl = `${window.location.origin}/confirm-cash?token=${cashReq.token}`;
      const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-cash-confirmation", {
        body: {
          recipients: cashRecipients.map((r) => ({ email: r.email, name: r.name })),
          student_name: student.name,
          amount: inclusiveTotal.toLocaleString("en-IN"),
          confirmation_url: confirmUrl,
          expires_in_minutes: 10,
          batch_names: sessionLabel,
        },
      });
      if (emailErr) throw emailErr;

      setTestConfirmationUrl(emailData?.test_mode ? confirmUrl : null);
      toast.success("Cash approval request sent. Drop-in will be booked after manager/instructor approval.");
      setStep("waiting");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Booking failed: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep("studio");
    setSelectedStudioId(null);
    setSelectedSession(null);
    setStudent(null);
    setUser(null);
    setStudents([]);
    setOwnerName("");
    setStudentName("");
    setAccountOwnerType("self");
    setReceiptData(null);
    setTestConfirmationUrl(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Not ready to commit?</span> Try a drop-in class ✨
        </p>
      </div>

      {step === "studio" && (
        <StudioSelection
          onSelectStudio={(studioId) => {
            setSelectedStudioId(studioId);
            setSelectedSession(null);
            setStep("browse");
          }}
        />
      )}

      {step === "browse" && selectedStudioId && (
        <SessionBrowser
          studioId={selectedStudioId}
          selectedSessionId={selectedSession?.id ?? null}
          onBack={() => {
            setSelectedSession(null);
            setStep("studio");
          }}
          onSelectSession={s => { setSelectedSession(s); setStep("phone"); }}
        />
      )}

      {step === "phone" && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">Selected: {selectedSessionLabel}</p>
              <Button variant="ghost" size="sm" onClick={() => setStep("browse")}>Change</Button>
            </div>
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
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Session</span><span className="text-right">{selectedSessionLabel}</span></div>
              {dropInPricing.isLongSlot && (
                <div className="flex justify-between"><span className="text-muted-foreground">Slot type</span><span>2.5-hour drop-in</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Drop-in fee (incl. GST)</span><span>₹{dropInPricing.inclusiveTotal.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Base amount</span><span>₹{dropInPricing.baseAmount.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{dropInPricing.gst.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>₹{dropInPricing.inclusiveTotal.toLocaleString("en-IN")}</span></div>
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
              {paymentMode === "cash" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cash does not book immediately. The studio manager or instructor must confirm cash received within 10 minutes.
                </p>
              )}
            </div>
            <Button className="w-full gradient-primary" onClick={handleDropIn} disabled={submitting}>
              {submitting ? "Processing..." : paymentActionLabel}
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
            <h3 className="font-display font-semibold text-foreground">Pending Manager/Instructor Approval</h3>
            <p className="text-sm text-muted-foreground">
              Cash approval has been sent to the batch manager and instructor. Once one of them confirms cash received within 10 minutes, the drop-in will be booked.
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
            <Button variant="outline" onClick={reset}>Book Another Drop-in</Button>
          </CardContent>
        </Card>
      )}

      {step === "confirming" && (
        <ConfirmationLoading label="Confirming drop-in..." />
      )}

      {step === "confirmed" && receiptData && (
        <ReceiptConfirmation
          title="Drop-in Confirmed"
          message="The drop-in payment is confirmed and the receipt is ready."
          data={receiptData}
          recipientEmail={student?.email || student?.users?.email}
          recipientPhone={student?.phone || student?.users?.phone}
          onAction={reset}
          actionLabel="Book another drop-in"
        />
      )}
    </div>
  );
}
