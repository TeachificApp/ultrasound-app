import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAINTENANCE_BANNER_DISMISSAL_KEY } from "../shared/maintenanceBanner";

const auth = vi.hoisted(() => ({ user: { id: 1 }, loading: false }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => auth }));

import MaintenanceBanner from "../client/src/components/MaintenanceBanner";

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  auth.user = { id: 1 };
  auth.loading = false;
});

async function mount() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://learn.allaboutultrasound.com" });
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(React.createElement(MaintenanceBanner)));
  return container;
}

describe("MaintenanceBanner interaction", () => {
  it("renders for a signed-in user, persists dismissal, and stays hidden on remount", async () => {
    const firstMount = await mount();
    expect(firstMount.textContent).toContain("Scheduled Server Maintenance Aug 22–24, 2026");

    const dismiss = firstMount.querySelector('[aria-label="Dismiss maintenance notice"]') as HTMLButtonElement;
    await act(async () => dismiss.click());
    expect(window.localStorage.getItem(MAINTENANCE_BANNER_DISMISSAL_KEY)).toBe("true");
    expect(firstMount.textContent).not.toContain("Scheduled Server Maintenance");

    act(() => root?.unmount());
    root = createRoot(firstMount);
    await act(async () => root?.render(React.createElement(MaintenanceBanner)));
    expect(firstMount.textContent).not.toContain("Scheduled Server Maintenance");
  });

  it("does not render for a logged-out visitor", async () => {
    auth.user = null;
    const mounted = await mount();
    expect(mounted.textContent).toBe("");
  });
});
