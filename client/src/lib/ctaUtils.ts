/**
 * Shared CTA button click handler.
 * Extracted from CourseLanding to avoid circular static imports with
 * BlockPreview and WorkshopLanding (both need this utility but are also
 * dynamically imported by App.tsx alongside CourseLanding).
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
) {
  const target = (e.target as HTMLElement).closest("[data-cta-btn]") as HTMLElement | null;
  if (!target) return;
  e.preventDefault();
  e.stopPropagation();
  const action = target.dataset.action ?? "url";

  // Sold-out override: if the button has a soldout-override URL and we're in
  // sold-out/waitlist mode (caller provides onSoldOutOverride), use it.
  const soldOutOverrideUrl = target.dataset.soldoutOverride;
  if (soldOutOverrideUrl && onSoldOutOverride) {
    onSoldOutOverride(soldOutOverrideUrl);
    return;
  }

  if (action === "url") {
    const link = target.dataset.link;
    if (link && link !== "#") window.open(link, "_blank", "noopener,noreferrer");
  } else if (action === "send_email") {
    const email = target.dataset.email;
    if (email) window.location.href = `mailto:${email}`;
  } else if (action === "phone") {
    const phone = target.dataset.phone;
    if (phone) window.location.href = `tel:${phone.replace(/\s/g, "")}`;
  } else if (action === "scroll_to_section") {
    const anchor = target.dataset.anchor;
    if (anchor) {
      const el = document.getElementById(anchor.replace(/^#/, ""));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  } else if (action === "open_popup") {
    const popup = target.dataset.popup;
    if (popup) {
      const w = 800, h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(popup, "_blank", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    }
  } else if (action === "download_file") {
    const dl = target.dataset.download;
    if (dl) window.open(dl, "_blank", "noopener,noreferrer");
  } else if (action === "direct_checkout" || action === "group_purchase") {
    if (onCheckoutPage) onCheckoutPage(undefined);
    else onEnroll?.();
  } else if (action === "free_enrollment") {
    const productType = target.dataset.productType;
    const productId = target.dataset.productId ? Number(target.dataset.productId) : undefined;
    (onEnroll as any)?.(productType, productId);
  } else if (action === "pricing_option") {
    const rawId = target.dataset.pricingOption;
    const poId = rawId ? Number(rawId) : undefined;
    if (onCheckoutPage) {
      onCheckoutPage(poId);
    } else if (onEnrollWithOption) {
      onEnrollWithOption(poId);
    } else {
      onEnroll?.();
    }
  } else if (action === "enroll_next_available") {
    if (onCheckoutPage) onCheckoutPage(undefined);
    else onEnroll?.();
  }
}
