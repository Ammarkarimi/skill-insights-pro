/** Paddle.js v2: loaded on demand; opens the overlay checkout for a transaction our server created. */

const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

interface PaddleEvent {
  name?: string;
  data?: { transaction_id?: string };
}

interface PaddleGlobal {
  Environment: { set: (env: string) => void };
  Initialize: (options: { token: string; eventCallback: (e: PaddleEvent) => void }) => void;
  Checkout: { open: (options: Record<string, unknown>) => void; close: () => void };
}

let ready: Promise<PaddleGlobal> | null = null;
let listener: ((e: PaddleEvent) => void) | null = null;

function load(token: string, environment: string): Promise<PaddleGlobal> {
  ready ??= new Promise<PaddleGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => {
      const paddle = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
      if (!paddle) return reject(new Error("Paddle did not load."));
      if (environment === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({ token, eventCallback: (e) => listener?.(e) });
      resolve(paddle);
    };
    script.onerror = () => {
      ready = null;
      reject(new Error("Could not load the checkout. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return ready;
}

/** Opens Checkout. Resolves "completed" after a successful payment, or "closed" if the buyer leaves. */
export async function payWithPaddle(opts: {
  token: string;
  environment: string;
  transactionId: string;
  email: string;
}): Promise<"completed" | "closed"> {
  const paddle = await load(opts.token, opts.environment);
  return new Promise((resolve) => {
    let done = false;
    listener = (e) => {
      if (e.name === "checkout.completed" && !done) {
        done = true;
        // Let the buyer see Paddle's confirmation for a moment, then return to the page.
        setTimeout(() => paddle.Checkout.close(), 1500);
        resolve("completed");
      } else if (e.name === "checkout.closed" && !done) {
        done = true;
        resolve("closed");
      }
    };
    paddle.Checkout.open({
      transactionId: opts.transactionId,
      customer: { email: opts.email },
      settings: { displayMode: "overlay", theme: "light", allowLogout: false },
    });
  });
}
