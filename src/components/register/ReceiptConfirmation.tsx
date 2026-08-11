import { CheckCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildReceiptHtml, ReceiptData } from "@/lib/receiptTemplate";

interface ReceiptConfirmationProps {
  data: ReceiptData;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export function downloadReceiptHtml(data: ReceiptData) {
  const html = buildReceiptHtml(data);
  const slug = [
    data.student_name || "student",
    data.transaction_id || "receipt",
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug || "receipt"}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ConfirmationLoading({ label = "Confirming payment..." }: { label?: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-8 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">{label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Please wait while we finish enrollment and prepare the receipt.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReceiptConfirmation({
  data,
  title = "Payment Confirmed",
  message = "The payment is confirmed and the receipt is ready.",
  actionLabel = "Start over",
  onAction,
  recipientEmail,
  recipientPhone,
}: ReceiptConfirmationProps) {
  const html = buildReceiptHtml(data);

  return (
    <Card className="glass-card">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          {(recipientEmail || recipientPhone) && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground space-y-1">
              {recipientEmail && <div>Email: <span className="text-foreground">{recipientEmail}</span></div>}
              {recipientPhone && <div>WhatsApp: <span className="text-foreground">{recipientPhone}</span></div>}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-white">
          <iframe
            title="Receipt preview"
            srcDoc={html}
            className="h-[520px] w-full bg-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button className="gradient-primary" onClick={() => downloadReceiptHtml(data)}>
            <Download className="h-4 w-4 mr-2" />
            Download Receipt
          </Button>
          {onAction && (
            <Button variant="outline" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
