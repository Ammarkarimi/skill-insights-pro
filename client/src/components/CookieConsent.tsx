import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { hasTracking, OPEN_SETTINGS_EVENT, setConsent, storedConsent, trackPageView } from "@/lib/analytics";
import { useSiteConfig } from "@/lib/site";

/**
 * Cookie banner (UK PECR / GDPR), shown only when analytics or ad tags are configured. Rejecting is as
 * easy as accepting, and "Cookie settings" links reopen it. Also reports page views after consent.
 */
const CookieConsent = () => {
  const site = useSiteConfig();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const tracking = hasTracking(site?.analytics);

  useEffect(() => {
    if (tracking && storedConsent() === null) setOpen(true);
  }, [tracking]);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  if (!open || !tracking) return null;
  const choose = (choice: "granted" | "denied") => {
    setOpen(false);
    void setConsent(choice);
  };
  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-[60] border-t bg-white p-4 shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-lg sm:border"
    >
      <p className="text-sm text-gray-700">
        We use cookies to see how the site is used and which of our ads work. Cookies that keep you signed in are
        always on. You can change your choice at any time.{" "}
        <Link to="/privacy#cookies" className="text-primary underline">
          Cookie details
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => choose("denied")}>
          Reject
        </Button>
        <Button size="sm" className="flex-1" onClick={() => choose("granted")}>
          Accept
        </Button>
      </div>
    </div>
  );
};

export default CookieConsent;
