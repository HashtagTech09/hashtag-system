import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import hashtagLogo from "@/assets/hashtag-pink.png";
import type { ReceiptData } from "@/lib/receiptTemplate";
import { fetchConfirmedReceiptData } from "@/lib/receiptData";
import ReceiptConfirmation, { ConfirmationLoading } from "@/components/register/ReceiptConfirmation";

const EXPIRED_MESSAGE = "This confirmation link has expired. Please create a new cash request.";

const getFunctionErrorMessage = async (functionErr: any) => {
  const context = functionErr?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error;
    } catch (_) {
      // Fall through to the generic function error message.
    }
  }
  return functionErr?.message || "Could not confirm cash payment";
};

const ConfirmCashPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const isDropInRequest = Boolean((request?.enrollment_data as any)?.drop_in);
  const itemLabel = isDropInRequest ? "Session" : "Batches";
  const actionNoun = isDropInRequest ? "book the drop-in" : "enroll the student";

  useEffect(() => {
    if (!token) { setError("Invalid link — no token provided."); setLoading(false); return; }

    const fetchRequest = async () => {
      const { data, error: fetchErr } = await supabase
        .from("cash_payment_requests")
        .select("*")
        .eq("token", token)
        .single();

      if (fetchErr || !data) {
        setError("Cash payment request not found or invalid link.");
        setLoading(false);
        return;
      }

      if (data.status === "confirmed") {
        setConfirmed(true);
        setRequest(data);
        setLoading(false);
        return;
      }

      if (data.status === "expired") {
        setError("This confirmation link has expired.");
        setLoading(false);
        return;
      }

      if (data.status === "cancelled") {
        setError("This request has been cancelled.");
        setLoading(false);
        return;
      }

      if (data.status === "rejected") {
        setError("This request has been rejected.");
        setLoading(false);
        return;
      }

      if (data.status === "processing") {
        setError("This request is already being processed.");
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
        setError(EXPIRED_MESSAGE);
        setLoading(false);
        return;
      }

      setRequest(data);

      // Fetch student name, staff name, batch names
      const [studentRes, staffRes, batchRes] = await Promise.all([
        supabase.from("students").select("name").eq("id", data.student_id).single(),
        supabase.from("users").select("name").eq("id", data.staff_user_id).single(),
        supabase.from("batches").select("id, name").in("id", data.batch_ids as number[]),
      ]);

      setStudentName(studentRes.data?.name || "Unknown");
      setStaffName(staffRes.data?.name || "Unknown");
      setBatchNames(batchRes.data?.map((b: any) => b.name) || []);
      setLoading(false);
    };

    fetchRequest();
  }, [token]);

  useEffect(() => {
    if (!request?.expires_at || confirmed || error) return;

    const expiresAt = new Date(request.expires_at).getTime();
    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      setError(EXPIRED_MESSAGE);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError(EXPIRED_MESSAGE);
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [request?.expires_at, confirmed, error]);

  const handleConfirm = async () => {
    if (!request) return;
    setConfirming(true);
    try {
      if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
        setError(EXPIRED_MESSAGE);
        toast.error(EXPIRED_MESSAGE);
        return;
      }

      const { data, error: functionErr } = await supabase.functions.invoke("confirm-cash-payment", {
        body: { token },
      });
      if (functionErr || data?.error) {
        throw new Error(data?.error || await getFunctionErrorMessage(functionErr));
      }
      setConfirmed(true);
      if (data?.payment_id) {
        try {
          const receipt = await fetchConfirmedReceiptData(data.payment_id, request.student_id, { cashToken: token || undefined });
          setReceiptData(receipt);
        } catch (receiptErr: any) {
          toast.error("Cash confirmed, but receipt could not be loaded: " + (receiptErr?.message || "Please try from Payments."));
        }
      }
      toast.success(data?.already_confirmed ? "Payment was already confirmed." : "Payment confirmed successfully!");
    } catch (e: any) {
      setError(e.message);
      toast.error("Failed to confirm: " + e.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src={hashtagLogo} alt="Hashtag" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="font-display font-bold text-foreground text-lg">Hashtag</h1>
            <p className="text-xs text-muted-foreground">Cash Payment Confirmation</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && !confirming && (
          <Card className="glass-card">
            <CardContent className="p-6 text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-foreground font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {confirming && (
          <ConfirmationLoading label="Confirming cash payment..." />
        )}

        {confirmed && receiptData && !confirming && (
          <ReceiptConfirmation
            title="Cash Confirmed"
            message={isDropInRequest
              ? "Cash has been confirmed, the drop-in has been booked, and the receipt is ready."
              : "Cash has been confirmed, the student has been enrolled, and the receipt is ready."}
            data={receiptData}
          />
        )}

        {confirmed && !receiptData && !confirming && (
          <Card className="glass-card">
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-lg font-display font-semibold text-foreground">Cash Confirmed</h2>
              <p className="text-sm text-muted-foreground">
                {isDropInRequest
                  ? "The cash payment has been recorded and the drop-in has been booked."
                  : "The cash payment has been recorded and the student has been enrolled."}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && !confirmed && !confirming && request && (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-display font-semibold text-foreground">Confirm Cash Received</h2>
              <p className="text-sm text-muted-foreground">
                You ({staffName}) are confirming cash received from <span className="text-foreground font-medium">{studentName}</span>. This will {actionNoun} immediately.
              </p>

              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium text-foreground">{studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{itemLabel}</span>
                  <span className="text-foreground text-right">{batchNames.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{Number(request.amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (18%)</span>
                  <span>₹{Number(request.gst).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                  <span>Total Amount</span>
                  <span className="text-primary">₹{Number(request.final_amount).toLocaleString("en-IN")}</span>
                </div>
                {request.expires_at && (
                  <div className="flex justify-between text-xs border-t border-border pt-2 mt-2">
                    <span className="text-muted-foreground">Accept by</span>
                    <span className="text-warning">{new Date(request.expires_at).toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              <Button
                className="w-full gradient-primary"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : (
                  isDropInRequest ? "Confirm Cash Received & Book Drop-in" : "Confirm Cash Received & Enroll"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ConfirmCashPage;
