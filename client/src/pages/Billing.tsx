import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Coins, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage, formatMoney } from "@/lib/api";
import { ACTION_LABELS } from "@/lib/pricing";
import { usePayCurrency } from "@/lib/currency";
import { payWithRazorpay, RazorpayOrder } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

interface History {
  credits: number;
  payments: { id: number; pack: string; credits: number; amountCents: number; currency: string; createdAt: string }[];
  usage: { action: string; credits: number; createdAt: string }[];
}

const Billing: React.FC = () => {
  const { pricing, refresh, user } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [buying, setBuying] = useState<string | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pay = usePayCurrency(pricing);

  const loadHistory = () =>
    api
      .get<History>("/api/billing/history")
      .then((r) => setHistory(r.data))
      .catch(() => undefined);

  useEffect(() => {
    loadHistory();
  }, []);

  // Returning from Stripe Checkout.
  useEffect(() => {
    const status = params.get("status");
    const sessionId = params.get("session_id");
    if (status === "success" && sessionId) {
      setConfirming(true);
      api
        .post("/api/billing/confirm", { session_id: sessionId })
        .then(async () => {
          await refresh();
          await loadHistory();
          toast({ title: "Payment successful", description: "Your credits have been added." });
        })
        .catch((err) => toast({ title: "Could not confirm payment", description: apiErrorMessage(err), variant: "destructive" }))
        .finally(() => {
          setConfirming(false);
          setParams({}, { replace: true });
        });
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled", description: "You have not been charged." });
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (packId: string) => {
    setBuying(packId);
    try {
      if (pay.current === "inr") return await buyInr(packId);
      const { data } = await api.post<{ url: string }>("/api/billing/checkout", { pack_id: packId });
      window.location.href = data.url;
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error && !("response" in err) ? err.message : apiErrorMessage(err), variant: "destructive" });
      setBuying(null);
    }
  };

  // Razorpay: the payment happens in a modal on this page, then the server verifies it.
  const buyInr = async (packId: string) => {
    const { data: order } = await api.post<RazorpayOrder>("/api/billing/razorpay/order", { pack_id: packId });
    const result = await payWithRazorpay(order);
    if (!result) {
      toast({ title: "Payment cancelled", description: "You have not been charged." });
      setBuying(null);
      return;
    }
    setConfirming(true);
    try {
      const { data } = await api.post<{ paid: boolean; pending: boolean }>("/api/billing/razorpay/verify", {
        order_id: result.razorpay_order_id,
        payment_id: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      });
      await refresh();
      await loadHistory();
      toast(
        data.paid
          ? { title: "Payment successful", description: "Your credits have been added." }
          : { title: "Payment is processing", description: "Your credits will appear within a few minutes." },
      );
    } finally {
      setConfirming(false);
      setBuying(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="page-header">Credits &amp; Billing</h1>
          <p className="text-gray-600 flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            You have <strong>{user?.credits ?? 0}</strong> credits. Credits never expire, and you are never charged
            for a request that fails.
          </p>
        </div>

        {confirming && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Confirming your payment…</AlertTitle>
            <AlertDescription>This only takes a moment.</AlertDescription>
          </Alert>
        )}

        {pay.showSwitch && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="Payment currency">
              {(
                [
                  ["default", `${(pricing?.currency ?? "usd").toUpperCase()} · card`],
                  ["inr", "INR · UPI, cards, netbanking"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => pay.set(value)}
                  aria-pressed={pay.current === value}
                  className={cn("rounded-md px-3 py-1.5 text-sm", pay.current === value ? "bg-primary text-primary-foreground" : "text-gray-700")}
                >
                  {label}
                </button>
              ))}
            </div>
            {pay.current === "inr" && <span className="text-xs text-gray-500">Prices include taxes. Payments by Razorpay.</span>}
          </div>
        )}

        {pricing && !pricing.paymentsEnabled && !pay.inrOn && (
          <Alert>
            <AlertTitle>Purchases are temporarily unavailable</AlertTitle>
            <AlertDescription>Please check back soon.</AlertDescription>
          </Alert>
        )}

        <div className={cn("grid grid-cols-1 gap-6", pay.packs.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
          {pricing && pay.packs.map((pack) => (
            <Card key={pack.id} className={pack.highlight ? "border-primary border-2 relative" : "relative"}>
              {pack.highlight && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>}
              <CardHeader>
                <CardTitle>{pack.name}</CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">{formatMoney(pack.price_cents, pay.currency)}</div>
                <div className="text-gray-600">{pack.credits} credits</div>
                <div className="text-xs text-muted-foreground">
                  {formatMoney(Math.round(pack.price_cents / pack.credits), pay.currency)} per credit
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pack.highlight ? "default" : "outline"}
                  disabled={(pay.current === "inr" ? !pay.inrOn : !pay.defaultOn) || buying !== null}
                  onClick={() => buy(pack.id)}
                >
                  {buying === pack.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buy {pack.credits} credits
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {pricing && (
          <Card>
            <CardHeader>
              <CardTitle>What things cost</CardTitle>
              <CardDescription>Credits are only deducted when a result is successfully delivered.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(pricing.costs).map(([action, credits]) => (
                  <li key={action} className="flex justify-between border-b py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      {ACTION_LABELS[action] ?? action}
                    </span>
                    <span className="font-medium">
                      {credits} credit{credits === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {history && (history.payments.length > 0 || history.usage.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                {history.payments.length === 0 ? (
                  <p className="text-sm text-gray-500">No purchases yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>+{p.credits}</TableCell>
                          <TableCell>{formatMoney(p.amountCents, p.currency || "usd")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent usage</CardTitle>
              </CardHeader>
              <CardContent>
                {history.usage.length === 0 ? (
                  <p className="text-sm text-gray-500">No usage yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.usage.slice(0, 15).map((u, i) => (
                        <TableRow key={i}>
                          <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>{ACTION_LABELS[u.action] ?? u.action}</TableCell>
                          <TableCell>-{u.credits}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Billing;
