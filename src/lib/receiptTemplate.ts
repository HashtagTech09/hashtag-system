export interface ReceiptData {
  receipt_title?: string;
  student_name?: string;
  student_phone?: string;
  student_email?: string;
  account_owner_name?: string;
  account_owner_phone?: string;
  batches?: string;
  studio_names?: string;
  batch_codes?: string;
  amount?: number | string;
  subtotal?: number | string;
  gst?: number | string;
  registration_fee?: number | string;
  drop_in_adjustment?: number | string;
  total?: number | string;
  payment_mode?: string;
  payment_status?: string;
  payment_id?: string;
  transaction_id?: string;
  date?: string;
  confirmed_at?: string;
  plan_name?: string;
  status_type?: string;
  validity?: string;
  start_date?: string;
  end_date?: string;
  cycles?: string;
}

function escapeHtml(value?: number | string | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function row(label: string, value?: number | string | null, options: { strong?: boolean; small?: boolean; highlight?: boolean } = {}) {
  if (value === undefined || value === null || value === "") return "";
  const valueStyle = [
    "padding:8px 0;text-align:right",
    options.strong ? "font-weight:700" : "",
    options.small ? "font-size:12px" : "",
    options.highlight ? "color:#ff007f" : "",
  ].filter(Boolean).join(";");

  return `<tr>
    <td style="padding:8px 0;color:#888;vertical-align:top">${escapeHtml(label)}</td>
    <td style="${valueStyle}">${escapeHtml(value)}</td>
  </tr>`;
}

function money(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return undefined;
  return `₹${value}`;
}

export function buildReceiptHtml(data: ReceiptData = {}): string {
  const title = data.receipt_title || "Payment Receipt";
  const total = data.total ?? data.amount ?? "0";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;margin:0">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="color:#ff007f;margin:0;font-size:24px">Hashtag</h1>
    <p style="color:#888;font-size:13px;margin:4px 0">${escapeHtml(title)}</p>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <table style="width:100%;font-size:14px;color:#333">
    ${row("Student", data.student_name || "—", { strong: true })}
    ${row("Student phone", data.student_phone)}
    ${row("Student email", data.student_email)}
    ${row("Account owner", data.account_owner_name)}
    ${row("Account owner phone", data.account_owner_phone)}
    ${row("Plan", data.plan_name)}
    ${row("Registration type", data.status_type)}
    ${row("Studio", data.studio_names)}
    ${row("Batches", data.batches || "—")}
    ${row("Batch codes", data.batch_codes)}
    ${row("Cycles", data.cycles)}
    ${row("Validity", data.validity || (data.start_date && data.end_date ? `${data.start_date} → ${data.end_date}` : undefined), { strong: true })}
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <table style="width:100%;font-size:14px;color:#333">
    ${row("Class subtotal", money(data.subtotal))}
    ${row("GST", money(data.gst))}
    ${row("Registration fee incl. GST", money(data.registration_fee))}
    ${row("Drop-in adjustment", data.drop_in_adjustment ? `-₹${data.drop_in_adjustment}` : undefined)}
    ${row("Total paid", money(total), { strong: true, highlight: true })}
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <table style="width:100%;font-size:14px;color:#333">
    ${row("Payment mode", data.payment_mode || "—")}
    ${row("Payment status", data.payment_status)}
    ${row("Payment ID", data.payment_id, { small: true })}
    ${row("Transaction ID", data.transaction_id || "N/A", { small: true })}
    ${row("Confirmed at", data.confirmed_at)}
    ${row("Date", data.date || new Date().toLocaleDateString("en-IN"))}
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="text-align:center;color:#aaa;font-size:11px;margin:0">Thank you for dancing with us.</p>
</div>
</body></html>`;
}
