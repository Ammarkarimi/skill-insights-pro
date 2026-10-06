import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { payWithPaddle } from "@/lib/paddle";
import { trackPurchase } from "@/lib/analytics";
import { payWithRazorpay, RazorpayOrder } from "@/lib/razorpay";
import { cn } from "@/lib/utils";
import CurrencySwitch from "@/components/CurrencySwitch";

/** What the server says after checking a payment. */
interface Confirmed {
  paid: boolean;
  pending?: boolean;
  credits: number;
  amountCents?: number;
  currency?: string;
  ref?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const pay = usePayCurrency(pricing);
  // UK and EU law: buyers of digital content must ask for it now and accept losing the right to cancel.
  const needsConsent = pay.provider === "paddle" || pay.provider === "stripe";

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
        .post<Confirmed>("/api/billing/confirm", { session_id: sessionId })
        .then(async ({ data }) => {
          await refresh();
          await loadHistory();
          if (data.paid) onPurchased(data);
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

  // Analytics and ad conversions (only after cookie consent; once per payment).
  const onPurchased = (data: Confirmed) => trackPurchase(data);

  const buy = async (packId: string) => {
    if (needsConsent && !consent) {
      setConsentMissing(true);
      document.getElementById("supply-consent")?.focus();
      return;
    }
    setBuying(packId);
    try {
      if (pay.provider === "razorpay") return await buyInr(packId);
      if (pay.provider === "paddle") return await buyPaddle(packId);
      const { data } = await api.post<{ url: string }>("/api/billing/checkout", { pack_id: packId, consent });
      window.location.href = data.url;
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error && !("response" in err) ? err.message : apiErrorMessage(err), variant: "destructive" });
      setBuying(null);
    }
  };

  // Paddle: the overlay checkout opens on this page; credits are confirmed with the server afterwards
  // (the webhook also grants them, so a closed tab never loses a purchase).
  const buyPaddle = async (packId: string) => {
    const { data: txn } = await api.post<{ transactionId: string; email: string }>("/api/billing/paddle/transaction", {
      pack_id: packId,
      currency: pay.currency,
      consent,
    });
    const outcome = await payWithPaddle({
      token: pricing?.paddle?.clientToken ?? "",
      environment: pricing?.paddle?.environment ?? "production",
      transactionId: txn.transactionId,
      email: txn.email,
    });
    if (outcome === "closed") {
      toast({ title: "Checkout closed", description: "You have not been charged." });
      setBuying(null);
      return;
    }
    setConfirming(true);
    try {
      let result: Confirmed | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data } = await api.post<Confirmed>("/api/billing/paddle/confirm", { transaction_id: txn.transactionId });
        result = data;
        if (data.paid) break;
        await sleep(2000);
      }
      await refresh();
      await loadHistory();
      if (result?.paid) onPurchased(result);
      toast(
        result?.paid
          ? { title: "Payment successful", description: "Your credits have been added." }
          : { title: "Payment is processing", description: "Your credits will appear within a few minutes." },
      );
    } finally {
      setConfirming(false);
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
      const { data } = await api.post<Confirmed>("/api/billing/razorpay/verify", {
        order_id: result.razorpay_order_id,
        payment_id: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      });
      await refresh();
      await loadHistory();
      if (data.paid) onPurchased(data);
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

        {(pay.showSwitch || pay.taxNote) && (
          <div className="flex flex-wrap items-center gap-3">
            {pay.showSwitch && <CurrencySwitch options={pay.options} current={pay.current} onChange={pay.set} />}
            {pay.taxNote && <span className="text-xs text-gray-500">{pay.taxNote}</span>}
          </div>
        )}

        {pricing && !pay.canBuy && (
          <Alert>
            <AlertTitle>Purchases are temporarily unavailable</AlertTitle>
            <AlertDescription>Please check back soon.</AlertDescription>
          </Alert>
        )}

        {needsConsent && (
          <label
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-white p-3 text-sm text-gray-700",
              consentMissing && !consent && "border-red-400 bg-red-50",
            )}
          >
            <input
              id="supply-consent"
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setConsentMissing(false);
              }}
            />
            <span>
              Add my credits straight away. I understand that once I start using them I lose my 14-day right to
              cancel. Unused packs can still be refunded within 14 days (see the{" "}
              <Link to="/refunds" target="_blank" className="text-primary underline">
                Refund Policy
              </Link>
              ).
              {consentMissing && !consent && (
                <span className="block mt-1 text-red-600">Please tick this box to continue to payment.</span>
              )}
            </span>
          </label>
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
                <div className="text-3xl font-bold">{formatMoney(pack.cents, pay.currency)}</div>
                <div className="text-gray-600">{pack.credits} credits</div>
                <div className="text-xs text-muted-foreground">
                  {formatMoney(Math.round(pack.cents / pack.credits), pay.currency)} per credit
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pack.highlight ? "default" : "outline"}
                  disabled={!pay.canBuy || buying !== null}
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
