import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { INSUFFICIENT_EVENT } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/** Global handler: whenever the API says "out of credits", offer a one-click top-up. */
const CreditsWatcher = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const unverified = !!user && !user.emailVerified;
  useEffect(() => {
    const onInsufficient = (e: Event) => {
      if (unverified) {
        toast.error("Confirm your email first", {
          description: "Your free credits are added as soon as you open the link we emailed you.",
          action: { label: "Buy credits", onClick: () => navigate("/billing") },
        });
        return;
      }
      toast.error("Not enough credits", {
        description: (e as CustomEvent<string>).detail,
        action: { label: "Buy credits", onClick: () => navigate("/billing") },
      });
    };
    window.addEventListener(INSUFFICIENT_EVENT, onInsufficient);
    return () => window.removeEventListener(INSUFFICIENT_EVENT, onInsufficient);
  }, [navigate, unverified]);
  return null;
};

export default CreditsWatcher;
