import { useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type DirectCheckoutProductType =
  | "course"
  | "quiz"
  | "cohort"
  | "download"
  | "product"
  | "bundle"
  | "workshop"
  | "webinar"
  | "membership";

type DirectCheckoutResult = {
  checkoutUrl: string | null;
  freeSuccess?: boolean;
  successUrl?: string | null;
};

/** Run a direct-checkout mutation and open Stripe or redirect on success. */
export async function runDirectCheckout(
  mutate: (input: {
    productType: DirectCheckoutProductType;
    productId: number;
    origin: string;
    promoCode?: string;
    funnelId?: number;
    pageId?: number;
  }) => Promise<DirectCheckoutResult>,
  params: {
    productType: string;
    productId: number;
    promoCode?: string;
    funnelId?: number;
    pageId?: number;
    /** Same-window navigation for embedded checkout pages (workshop/webinar/membership). */
    sameWindow?: boolean;
  },
) {
  const result = await mutate({
    productType: params.productType as DirectCheckoutProductType,
    productId: params.productId,
    origin: window.location.origin,
    promoCode: params.promoCode,
    funnelId: params.funnelId,
    pageId: params.pageId,
  });
  if (result.freeSuccess) {
    toast.success("Access granted! Redirecting…");
    const url = result.successUrl;
    if (url) setTimeout(() => { window.location.href = url; }, 1200);
    return;
  }
  if (result.checkoutUrl) {
    const embeddedTypes = new Set(["workshop", "webinar", "membership"]);
    if (params.sameWindow || embeddedTypes.has(params.productType)) {
      window.location.href = result.checkoutUrl;
    } else {
      window.open(result.checkoutUrl, "_blank");
    }
  }
}

/** Hook for landing pages / BlockPreview direct-checkout CTAs. */
export function useDirectCheckout(options?: { funnelId?: number; pageId?: number }) {
  const createDirectCheckout = trpc.funnelPublic.createDirectCheckout.useMutation();
  return useCallback(
    async (productType: string, productId: number, promoCode?: string) => {
      try {
        await runDirectCheckout(createDirectCheckout.mutateAsync, {
          productType,
          productId,
          promoCode,
          funnelId: options?.funnelId,
          pageId: options?.pageId,
        });
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to start checkout");
      }
    },
    [createDirectCheckout, options?.funnelId, options?.pageId],
  );
}
