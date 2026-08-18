import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Route } from "wouter";

const closedCheckoutMeta = {
  clientSecret: null,
  free: false,
  workshopTitle: "Closed workshop",
  instanceTitle: "Closed session",
  workshopThumbnail: null,
  primaryColor: "#189aa1",
  accentColor: "#4ad9e0",
  productName: "Closed workshop",
  displayPrice: "2297.00",
  currency: "usd",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  checkoutTermsText: "Terms",
  checkoutTermsLink1Text: "Terms",
  checkoutTermsLink1Url: "/terms",
  checkoutTermsLink2Text: "Privacy",
  checkoutTermsLink2Url: "/privacy",
  availabilityStatus: "enrollment_closed" as const,
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    workshopLearner: {
      createEmbeddedCheckoutSession: {
        useMutation: (options: { onSuccess: (data: typeof closedCheckoutMeta) => void }) => ({
          mutate: () => options.onSuccess(closedCheckoutMeta),
          isError: false,
          isPending: false,
        }),
      },
    },
  },
}));

import { WorkshopInstanceCard } from "../client/src/pages/WorkshopDetail";
import WorkshopCheckout, { WorkshopCheckoutClosedState } from "../client/src/pages/WorkshopCheckout";

const containers: HTMLElement[] = [];
const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  containers.splice(0).forEach((container) => container.remove());
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).location;
  delete (globalThis as any).addEventListener;
  delete (globalThis as any).removeEventListener;
});

async function renderCard(instance: any, onWaitlist = () => undefined) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com/workshops/example" });
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(React.createElement(WorkshopInstanceCard, { instance, workshopSlug: "example", onWaitlist }));
  });
  return container;
}

describe("legacy Workshop Detail availability actions", () => {
  it("opens Waitlist capture instead of rendering a checkout link for a waitlist instance", async () => {
    let selected: any = null;
    const container = await renderCard({ id: 8, title: "Spring workshop", status: "waitlist", availableForPurchase: false }, (instance) => { selected = instance; });
    const button = container.querySelector('[data-testid="workshop-waitlist-cta"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(container.querySelector('a[href*="/checkout/workshop/"]')).toBeNull();
    await act(async () => button.click());
    expect(selected?.id).toBe(8);
  });

  it("renders Enrollment Closed as a disabled non-link", async () => {
    const container = await renderCard({ id: 9, title: "Closed workshop", status: "enrollment_closed", availableForPurchase: false });
    const button = container.querySelector('[data-testid="workshop-closed-cta"]') as HTMLButtonElement;
    expect(button?.disabled).toBe(true);
    expect(container.querySelector('a[href*="/checkout/workshop/"]')).toBeNull();
  });
});

describe("WorkshopCheckout closed availability state", () => {
  it("renders a disabled closed action and no payment form", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com/checkout/workshop/example" });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).location = dom.window.location;
    (globalThis as any).addEventListener = dom.window.addEventListener.bind(dom.window);
    (globalThis as any).removeEventListener = dom.window.removeEventListener.bind(dom.window);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => root.render(React.createElement(WorkshopCheckoutClosedState, { title: "Closed workshop", backHref: "/workshops/example" })));
    expect((container.querySelector('[data-testid="workshop-checkout-closed-cta"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('a[href*="/checkout/"]')).toBeNull();
    expect(container.textContent).not.toContain("Stripe");
    expect(container.textContent).toContain("Payment is not available");
  });

  it("mounts the checkout page’s closed availability route without any embedded payment or checkout navigation", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com/checkout/workshop/example?instance=9" });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).location = dom.window.location;
    (globalThis as any).addEventListener = dom.window.addEventListener.bind(dom.window);
    (globalThis as any).removeEventListener = dom.window.removeEventListener.bind(dom.window);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(React.createElement(Route, { path: "/checkout/workshop/:slug", component: WorkshopCheckout }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect((container.querySelector('[data-testid="workshop-checkout-closed-cta"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('a[href*="/checkout/"]')).toBeNull();
    expect(container.querySelector('a[href*="/workshops/"]')).not.toBeNull();
  });
});
