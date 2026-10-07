import { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { trackMetaPurchaseOnce } from "@/components/MetaPixel";

/**
 * Handles Stripe direct/funnel returns that intentionally land on My Dashboard
 * rather than CheckoutComplete. It verifies the supplied Stripe session before
 * emitting the same privacy-minimal Meta Purchase event.
 */
export function PurchaseSuccessTracker() {
  const checkoutSessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("purchase") === "success" ? params.get("session_id") ?? "" : "";
  }, []);

  const checkout = trpc.lmsLearner.getCheckoutSessionStatus.useQuery(
    { sessionId: checkoutSessionId },
    { enabled: Boolean(checkoutSessionId), retry: 2, retryDelay: 1000 },
  );

  useEffect(() => {
    if (!checkoutSessionId || checkout.data?.status !== "complete") return;
    if (checkout.data.paymentStatus !== "paid" && checkout.data.paymentStatus !== "no_payment_required") return;
    trackMetaPurchaseOnce(checkoutSessionId);
  }, [checkoutSessionId, checkout.data?.status, checkout.data?.paymentStatus]);

  return null;
}
