import React from "react";
import { Coins } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/** Shows how many credits an action costs, so users always know before they spend. */
const CostNote: React.FC<{ action: string; quantity?: number; className?: string }> = ({
  action,
  quantity = 1,
  className,
}) => {
  const { cost } = useAuth();
  const total = cost(action) * quantity;
  if (!total) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Coins className="h-3 w-3" />
      {total} credit{total === 1 ? "" : "s"}
    </span>
  );
};

export default CostNote;
