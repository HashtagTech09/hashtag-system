import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildReceiptHtml, ReceiptData } from "@/lib/receiptTemplate";
import { downloadReceiptHtml } from "./ReceiptConfirmation";

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export default function ReceiptPreviewDialog({ open, onClose, data, recipientEmail, recipientPhone }: Props) {
  const html = buildReceiptHtml(data);

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
          <Button variant="secondary" onClick={() => downloadReceiptHtml(data)}>Download Receipt</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
