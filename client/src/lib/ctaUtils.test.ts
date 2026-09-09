import { describe, expect, it, vi } from "vitest";
import { ctaCheckoutDataAttrs, handleCtaBtnClick } from "./ctaUtils";

function mockCtaButton(attrs: Record<string, string>) {
  const el = {
    dataset: attrs,
    textContent: attrs.textContent ?? "",
    closest(selector: string) {
      return selector === "[data-cta-btn]" ? this : null;
    },
  };
  return el as unknown as HTMLElement;
}

function mockClickEvent(button: HTMLElement) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  return {
    event: {
      target: button,
      preventDefault,
      stopPropagation,
    } as unknown as React.MouseEvent<HTMLElement>,
    preventDefault,
    stopPropagation,
  };
}

describe("handleCtaBtnClick", () => {
  it("does not stop propagation when direct_checkout has no handlers (parent delegation)", () => {
    const button = mockCtaButton({ action: "direct_checkout" });
    const { event, preventDefault, stopPropagation } = mockClickEvent(button);

    const handled = handleCtaBtnClick(event);

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it("handles direct_checkout when onCheckoutPage is provided", () => {
    const button = mockCtaButton({ action: "direct_checkout" });
    const { event, preventDefault, stopPropagation } = mockClickEvent(button);
    const onCheckoutPage = vi.fn();

    const handled = handleCtaBtnClick(event, undefined, undefined, onCheckoutPage);

    expect(handled).toBe(true);
    expect(onCheckoutPage).toHaveBeenCalledWith(undefined);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("prefers onDirectCheckout when checkout product attrs are set", () => {
    const button = mockCtaButton({ action: "direct_checkout", checkoutType: "course", checkoutId: "42" });
    const { event } = mockClickEvent(button);
    const onDirectCheckout = vi.fn();
    const onCheckoutPage = vi.fn();

    handleCtaBtnClick(event, undefined, undefined, onCheckoutPage, undefined, onDirectCheckout);

    expect(onDirectCheckout).toHaveBeenCalledWith("course", 42, undefined);
    expect(onCheckoutPage).not.toHaveBeenCalled();
  });
});

describe("ctaCheckoutDataAttrs", () => {
  it("maps checkout product fields to data attributes", () => {
    expect(ctaCheckoutDataAttrs({ checkoutProductType: "workshop", checkoutProductId: 7, checkoutPromoCode: "SAVE10" })).toEqual({
      "data-checkout-type": "workshop",
      "data-checkout-id": "7",
      "data-checkout-promo": "SAVE10",
    });
  });
});
