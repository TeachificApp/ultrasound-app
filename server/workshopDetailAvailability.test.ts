import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WorkshopInstanceCard } from "../client/src/pages/WorkshopDetail";

const containers: HTMLElement[] = [];
const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  containers.splice(0).forEach((container) => container.remove());
  delete (globalThis as any).window;
  delete (globalThis as any).document;
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
