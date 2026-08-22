import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { Route, Router } from "wouter";
import { JSDOM } from "jsdom";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), options: null as any }));
vi.mock("@/lib/trpc", () => ({
  trpc: { auth: { resetPassword: { useMutation: (options: any) => { mocks.options = options; return { mutate: mocks.mutate, isPending: false }; } } } },
}));

import LegacyPasswordSetupRedirect from "../client/src/components/LegacyPasswordSetupRedirect";
import ResetPassword from "../client/src/pages/ResetPassword";

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  mocks.mutate.mockReset();
  mocks.options = null;
  window.history.replaceState(null, "", "/");
});

describe("password setup legacy route and completion", () => {
  it("mounts the legacy email route, preserves its token, and resolves the reset-password page", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.allaboutultrasound.com/auth/reset-password?token=valid-token" });
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).location = dom.window.location;
    (globalThis as any).Event = dom.window.Event;
    (globalThis as any).HTMLElement = dom.window.HTMLElement;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).addEventListener = dom.window.addEventListener.bind(dom.window);
    (globalThis as any).removeEventListener = dom.window.removeEventListener.bind(dom.window);
    host = document.createElement("div"); document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(React.createElement(Router, null,
        React.createElement(LegacyPasswordSetupRedirect),
        React.createElement(Route, { path: "/reset-password", component: ResetPassword }),
      ));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(window.location.pathname).toBe("/reset-password");
    expect(window.location.search).toBe("?token=valid-token");
    expect(host.textContent).toContain("Set new password");
  });

});
