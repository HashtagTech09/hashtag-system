import { useState, useEffect } from "react";
import { supabase, recoveryInitialization } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { clearRecoveryUrl, initialRecoveryIntent } from "@/lib/authRecovery";
import { useAuth } from "@/hooks/useAuth";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    // getSession waits for the SDK's implicit/PKCE callback processing; never exchange twice.
    const validate = async () => {
      try {
        const initialization = await recoveryInitialization;
        const { data, error } = await supabase.auth.getSession();
        if (initialRecoveryIntent.failed || initialization.failed || error || !data.session) {
          if (active) setValidSession(false);
          return;
        }
        const { data: verified, error: verificationError } = await supabase.auth.getUser();
        if (active) setValidSession(!verificationError && !!verified.user);
      } catch {
        if (active) setValidSession(false);
      } finally {
        if (active) clearRecoveryUrl();
      }
    };
    void validate();
    return () => { active = false; };
  }, []);

  const returnToLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      finishRecovery();
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validSession || loading) return;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      // End only this browser's recovery session; do not sign other staff out.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) toast.error("Password updated. Please sign out before signing in again.");
      toast.success("Password updated successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 glass-card rounded-xl glow-primary animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <img src="/favicon.png" alt="Hashtag" className="h-8 w-8" />
            <h1 className="text-3xl font-bold font-display">Hashtag</h1>
          </div>
          <p className="text-muted-foreground mt-2">Reset Password</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Button className="w-full gradient-primary" disabled={loading} onClick={() => void returnToLogin()}>
              Go to Login
            </Button>
          </div>
        ) : validSession === false ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Invalid or expired reset link. Please request a new one.
            </p>
            <Button className="w-full gradient-primary" disabled={loading} onClick={() => void returnToLogin()}>
              Go to Login
            </Button>
          </div>
        ) : validSession === null ? (
          <p role="status" className="text-center text-sm text-muted-foreground">Verifying reset link...</p>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full gradient-primary" disabled={loading || validSession === null}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
