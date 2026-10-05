/** Razorpay Standard Checkout: loads checkout.js on demand and opens the payment modal. */

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

let loading: Promise<RazorpayCtor> | null = null;

function load(): Promise<RazorpayCtor> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error("Razorpay did not load."));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load Razorpay. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/** Opens Checkout. Resolves with the signed result on success, or null if the user closes it. */
export async function payWithRazorpay(order: RazorpayOrder): Promise<RazorpaySuccess | null> {
  const Razorpay = await load();
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#7c6be6" },
      handler: (r: RazorpaySuccess) => resolve(r),
      modal: { ondismiss: () => resolve(null) },
    });
    // A failed attempt is shown inside the modal, where the user can retry or close it.
    rzp.open();
  });
}
