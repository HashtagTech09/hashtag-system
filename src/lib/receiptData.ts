import { supabase } from "@/integrations/supabase/client";
import type { ReceiptData } from "@/lib/receiptTemplate";

interface ReceiptProof {
  gatewayPaymentId?: string;
  orderId?: string;
  cashToken?: string;
}

export async function fetchConfirmedReceiptData(paymentId: number | string, studentId?: number, proof: ReceiptProof = {}): Promise<ReceiptData> {
  const id = Number(paymentId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Invalid payment id for receipt");
  }

  const { data, error } = await supabase.functions.invoke("get-receipt-data", {
    body: {
      payment_id: id,
      student_id: studentId,
      gateway_payment_id: proof.gatewayPaymentId,
      order_id: proof.orderId,
      cash_token: proof.cashToken,
    },
  });

  if (error) {
    throw new Error(error.message || "Could not load receipt");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.receipt || data;
}
