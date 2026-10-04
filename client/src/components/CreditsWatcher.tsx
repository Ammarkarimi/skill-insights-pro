import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { INSUFFICIENT_EVENT } from "@/lib/api";

/** Global handler: whenever the API says "out of credits", offer a one-click top-up. */
const CreditsWatcher = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const onInsufficient = (e: Event) => {
      toast.error("Not enough credits", {
        description: (e as CustomEvent<string>).detail,
        action: { label: "Buy credits", onClick: () => navigate("/billing") },
      });
    };
    window.addEventListener(INSUFFICIENT_EVENT, onInsufficient);
    return () => window.removeEventListener(INSUFFICIENT_EVENT, onInsufficient);
  }, [navigate]);
  return null;
};

export default CreditsWatcher;
