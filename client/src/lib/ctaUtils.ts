import { shouldRouteWorkshopCtaToCheckout } from "@shared/workshopPricing";

export type DirectCheckoutHandler = (
  productType: string,
  productId: number,
  promoCode?: string,
) => void | Promise<void>;

/**
 * Build data-* attributes for direct-checkout product targeting on CTA buttons.
 */
export function ctaCheckoutDataAttrs(d: {
  checkoutProductType?: string | null;
  checkoutProductId?: number | null;
  checkoutPromoCode?: string | null;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (d.checkoutProductType && d.checkoutProductId) {
    attrs["data-checkout-type"] = d.checkoutProductType;
    attrs["data-checkout-id"] = String(d.checkoutProductId);
    if (d.checkoutPromoCode) attrs["data-checkout-promo"] = d.checkoutPromoCode;
  }
  return attrs;
}

/**
 * Shared CTA button click handler.
 * Extracted from CourseLanding to avoid circular static imports with
 * BlockPreview and WorkshopLanding (both need this utility but are also
 * dynamically imported by App.tsx alongside CourseLanding).
 *
 * Returns true when the click was handled (caller may rely on this for delegation).
 * Only prevents default / stops propagation when handled so parent pages can delegate
 * when BlockPreview is rendered without inline callbacks.
 *
 * soldOutOverride: when a button has `data-soldout-override="<url>"` AND the
 * page is in sold-out/waitlist mode, the caller passes `onSoldOutOverride`.
 * If the button has the attribute set, `onSoldOutOverride(url)` is called
 * instead of the normal enroll/checkout path, allowing the admin to bypass
 * the sold-out gate for specific CTAs (e.g. redirect to a new-dates page).
 */
export function handleCtaBtnClick(
  e: React.MouseEvent<HTMLElement>,
  onEnroll?: () => void,
  onEnrollWithOption?: (pricingOptionId: number | undefined) => void,
  onCheckoutPage?: (pricingOptionId?: number) => void,
  /** Called instead of waitlist/sold-out modal when button has data-soldout-override set */
  onSoldOutOverride?: (overrideUrl: string) => void,
  /** Stripe hosted checkout when data-checkout-type/id are set on the button */
  onDirectCheckout?: DirectCheckoutHandler,
): boolean {
  const target = (e.target as HTMLElement).closest("[data-cta-btn]") as HTMLElement | null;
  if (!target) return false;

  const finish = (handled: boolean) => {
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
    return handled;
  };

  const action = target.dataset.action ?? "url";

  // Explicit product picker on the button wins over page-context workshop routing.
  if ((action === "direct_checkout" || action === "group_purchase") && target.dataset.checkoutType && target.dataset.checkoutId && onDirectCheckout) {
    void onDirectCheckout(
      target.dataset.checkoutType,
      Number(target.dataset.checkoutId),
      target.dataset.checkoutPromo,
    );
    return finish(true);
  }

  if (shouldRouteWorkshopCtaToCheckout(action, target.textContent ?? undefined)) {
    if (onCheckoutPage) {
      onCheckoutPage(undefined);
      return finish(true);
    }
    if (onEnroll) {
      onEnroll();
      return finish(true);
    }
    return finish(false);
  }

  // Sold-out override: if the button has a soldout-override URL and we're in
  // sold-out/waitlist mode (caller provides onSoldOutOverride), use it.
  const soldOutOverrideUrl = target.dataset.soldoutOverride;
  if (soldOutOverrideUrl && onSoldOutOverride) {
    onSoldOutOverride(soldOutOverrideUrl);
    return finish(true);
  }

  if (action === "url") {
    const link = target.dataset.link;
    if (link && link !== "#") {
      window.open(link, "_blank", "noopener,noreferrer");
      return finish(true);
    }
    return finish(false);
  }
  if (action === "send_email") {
    const email = target.dataset.email;
    if (email) {
      window.location.href = `mailto:${email}`;
      return finish(true);
    }
    return finish(false);
  }
  if (action === "phone") {
    const phone = target.dataset.phone;
    if (phone) {
      window.location.href = `tel:${phone.replace(/\s/g, "")}`;
      return finish(true);
    }
    return finish(false);
  }
  if (action === "scroll_to_section") {
    const anchor = target.dataset.anchor;
    if (anchor) {
      const el = document.getElementById(anchor.replace(/^#/, ""));
      if (el) el.scrollIntoView({ behavior: "smooth" });
      return finish(!!el);
    }
    return finish(false);
  }
  if (action === "open_popup") {
    const popup = target.dataset.popup;
    if (popup) {
      const w = 800;
      const h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(popup, "_blank", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
      return finish(true);
    }
    return finish(false);
  }
  if (action === "download_file") {
    const dl = target.dataset.download;
    if (dl) {
      window.open(dl, "_blank", "noopener,noreferrer");
      return finish(true);
    }
    return finish(false);
  }
  if (action === "direct_checkout" || action === "group_purchase") {
    if (onCheckoutPage) {
      onCheckoutPage(undefined);
      return finish(true);
    }
    if (onEnroll) {
      onEnroll();
      return finish(true);
    }
    return finish(false);
  }
  if (action === "free_enrollment") {
    const productType = target.dataset.productType;
    const productId = target.dataset.productId ? Number(target.dataset.productId) : undefined;
    if (onEnroll) {
      (onEnroll as any)?.(productType, productId);
      return finish(true);
    }
    return finish(false);
  }
  if (action === "pricing_option") {
    const rawId = target.dataset.pricingOption;
    const poId = rawId ? Number(rawId) : undefined;
    if (onCheckoutPage) {
      onCheckoutPage(poId);
      return finish(true);
    }
    if (onEnrollWithOption) {
      onEnrollWithOption(poId);
      return finish(true);
    }
    if (onEnroll) {
      onEnroll();
      return finish(true);
    }
    return finish(false);
  }
  if (action === "enroll_next_available") {
    if (onCheckoutPage) {
      onCheckoutPage(undefined);
      return finish(true);
    }
    if (onEnroll) {
      onEnroll();
      return finish(true);
    }
    return finish(false);
  }

  return finish(false);
}
