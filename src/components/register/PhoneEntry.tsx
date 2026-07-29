import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PhoneEntryProps {
  /** Called when an existing user is found. `students` is the full list under that user (can be empty). */
  onUserResolved: (user: any, students: any[]) => void;
  /** Called when the phone number is not in the system yet. */
  onNewUser: (phone: string) => void;
}

export default function PhoneEntry({ onUserResolved, onNewUser }: PhoneEntryProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [cleanedPhone, setCleanedPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    const searchPhone = cleaned.length === 10 ? cleaned : cleaned.slice(-10);
    setCleanedPhone(searchPhone);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-otp", {
        body: { phone: searchPhone },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Failed to send OTP");
        return;
      }

      if (data?.test_mode && data?.test_otp) {
        setTestOtp(data.test_otp);
      }

      setOtpSent(true);
      toast.success("OTP sent to your WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp-otp", {
        body: { phone: cleanedPhone, otp },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Invalid OTP");
        return;
      }

      await lookupUser(cleanedPhone);
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Resolve a phone number to a single User and ALL of their Students.
   * Strategy (split queries — see mem://logic/student-identification-strategy):
   *   1. Look up users by phone first (the account owner).
   *   2. If found, fetch every student linked to that user_id.
   *   3. Fallback: if no user matches but a student row carries the phone,
   *      use that student's user_id to load the full sibling set.
   */
  const lookupUser = async (searchPhone: string) => {
    setLookingUp(true);
    try {
      // 1. user-first lookup (the account owner)
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .eq("organization_id", 1)
        .ilike("phone", `%${searchPhone}`);

      if (users && users.length > 0) {
        const user = users[0];
        const { data: students } = await supabase
          .from("students")
          .select("*, users(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (students && students.length > 0) {
          onUserResolved(user, students);
          return;
        }

        const { data: orphanStudents } = await supabase
          .from("students")
          .select("*, users(*)")
          .eq("organization_id", 1)
          .is("user_id", null)
          .ilike("phone", `%${searchPhone}`)
          .order("created_at", { ascending: true });
        onUserResolved(user, orphanStudents || []);
        return;
      }

      // 2. fallback: phone lives only on a student row
      const { data: studentsByPhone } = await supabase
        .from("students")
        .select("*, users(*)")
        .eq("organization_id", 1)
        .ilike("phone", `%${searchPhone}`);

      if (studentsByPhone && studentsByPhone.length > 0) {
        const ownerUser = studentsByPhone[0].users;
        const ownerId = studentsByPhone[0].user_id;
        const { data: siblings } = await supabase
          .from("students")
          .select("*, users(*)")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: true });
        onUserResolved(ownerUser, siblings || studentsByPhone);
        return;
      }

      onNewUser(searchPhone);
    } catch {
      toast.error("Lookup failed");
    } finally {
      setLookingUp(false);
    }
  };

  if (lookingUp) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Logging you in...</p>
      </div>
    );
  }

  if (otpSent) {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-base">Enter OTP</Label>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a 6-digit code to <span className="font-medium text-foreground">{cleanedPhone}</span> via WhatsApp
          </p>
        </div>

        {testOtp && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
            <Badge variant="secondary" className="bg-warning/20 text-warning text-xs">TEST MODE</Badge>
            <span className="text-sm font-mono text-warning">{testOtp}</span>
          </div>
        )}

        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setOtpSent(false); setOtp(""); setTestOtp(null); }} className="flex-1">
            Change Number
          </Button>
          <Button onClick={handleVerifyOtp} disabled={verifying || otp.length !== 6} className="flex-1 gradient-primary">
            {verifying ? "Verifying..." : "Verify & Continue"}
          </Button>
        </div>

        <button
          onClick={handleSendOtp}
          className="text-sm text-muted-foreground hover:text-foreground underline mx-auto block"
        >
          Resend OTP
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Log in to your account</Label>
        <p className="text-sm text-muted-foreground mt-1">
          One account per phone number — manage all your students from one login.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="10-digit phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="text-lg"
          maxLength={13}
          onKeyDown={e => e.key === "Enter" && handleSendOtp()}
        />
        <Button onClick={handleSendOtp} disabled={loading} className="gradient-primary shrink-0">
          {loading ? "Sending..." : "Send OTP"}
        </Button>
      </div>
    </div>
  );
}
