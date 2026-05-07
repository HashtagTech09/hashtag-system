export interface ReceiptData {
  student_name?: string;
  batches?: string;
  amount?: number | string;
  payment_mode?: string;
  transaction_id?: string;
  date?: string;
  plan_name?: string;
}

export function buildReceiptHtml(data: ReceiptData = {}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;margin:0">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="color:#ff007f;margin:0;font-size:24px">Hashtag</h1>
    <p style="color:#888;font-size:13px;margin:4px 0">Payment Receipt</p>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <table style="width:100%;font-size:14px;color:#333">
    <tr><td style="padding:8px 0;color:#888">Student</td><td style="padding:8px 0;text-align:right;font-weight:600">${data.student_name || "—"}</td></tr>
    ${data.plan_name ? `<tr><td style="padding:8px 0;color:#888">Plan</td><td style="padding:8px 0;text-align:right">${data.plan_name}</td></tr>` : ""}
    <tr><td style="padding:8px 0;color:#888">Batches</td><td style="padding:8px 0;text-align:right">${data.batches || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#ff007f">₹${data.amount ?? "0"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Payment Mode</td><td style="padding:8px 0;text-align:right">${data.payment_mode || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Transaction ID</td><td style="padding:8px 0;text-align:right;font-size:12px">${data.transaction_id || "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;text-align:right">${data.date || new Date().toLocaleDateString("en-IN")}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="text-align:center;color:#aaa;font-size:11px;margin:0">Thank you for dancing with us! 💃</p>
</div>
</body></html>`;
}
