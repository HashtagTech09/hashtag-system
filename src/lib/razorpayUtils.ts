import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

let scriptLoaded = false;

export function loadRazorpayScript(): Promise<void> {
  if (scriptLoaded && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

interface RazorpayOrderParams {
  student_id: number;
  organization_id?: number;
  batch_ids: number[];
  amount: number;
  gst: number;
  final_amount: number;
  enrollment_data: any;
  student_name: string;
  student_phone: string;
  batch_names: string;
  plan_name: string;
}

interface RazorpayCheckoutOptions {
  orderParams: RazorpayOrderParams;
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

export async function initiateRazorpayPayment({ orderParams, onSuccess, onFailure }: RazorpayCheckoutOptions) {
  try {
    await loadRazorpayScript();

    const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
      body: orderParams,
    });

    if (error) {
      throw new Error(error.message || "Failed to create order");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    const { order_id, razorpay_key_id, amount } = data;

    const options = {
      key: razorpay_key_id,
      amount,
      currency: "INR",
      name: "Hashtag",
      description: `Registration - ${orderParams.plan_name}`,
      order_id,
      prefill: {
        name: orderParams.student_name,
        contact: orderParams.student_phone,
      },
      notes: {
        batches: orderParams.batch_names,
        plan: orderParams.plan_name,
      },
      handler: function () {
        // Payment successful on client side — webhook will finalize
        onSuccess();
      },
      modal: {
        ondismiss: function () {
          onFailure("Payment cancelled");
        },
      },
      theme: {
        color: "#6366f1",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      onFailure(response.error?.description || "Payment failed");
    });
    rzp.open();
  } catch (e: any) {
    onFailure(e.message);
  }
}
