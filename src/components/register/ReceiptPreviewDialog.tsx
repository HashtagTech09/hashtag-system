import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildReceiptHtml, ReceiptData } from "@/lib/receiptTemplate";

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export default function ReceiptPreviewDialog({ open, onClose, data, recipientEmail, recipientPhone }: Props) {
  const html = buildReceiptHtml(data);
  const downloadReceipt = () => {
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
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
        </DialogHeader>
        {(recipientEmail || recipientPhone) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {recipientEmail && <div>Will send to email: <span className="text-foreground">{recipientEmail}</span></div>}
            {recipientPhone && <div>Will send to WhatsApp: <span className="text-foreground">{recipientPhone}</span></div>}
          </div>
        )}
        <iframe
          title="Receipt preview"
          srcDoc={html}
          className="w-full h-[480px] rounded-md border border-border bg-white"
        />
        <DialogFooter>
          <Button variant="secondary" onClick={downloadReceipt}>Download Receipt</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
