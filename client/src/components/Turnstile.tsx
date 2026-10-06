import { useEffect, useRef } from "react";

/** Cloudflare Turnstile bot check. Renders nothing when no site key is configured. */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the security check."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  /** Change this to get a fresh token (tokens are single use). */
  resetKey?: number;
  onError?: (message: string) => void;
}

const Turnstile = ({ siteKey, onToken, resetKey = 0, onError }: Props) => {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const handlers = useRef({ onToken, onError });
  handlers.current = { onToken, onError };

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (token: string) => handlers.current.onToken(token),
          "expired-callback": () => handlers.current.onToken(""),
          "error-callback": () => {
            handlers.current.onToken("");
            handlers.current.onError?.("The security check failed. Please refresh the page and try again.");
          },
        });
      })
      .catch((err: Error) => handlers.current.onError?.(err.message));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widget.current) {
      window.turnstile?.reset(widget.current);
      handlers.current.onToken("");
    }
  }, [resetKey]);

  return <div ref={box} className="flex justify-center min-h-[65px]" />;
};

export default Turnstile;
