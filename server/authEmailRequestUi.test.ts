import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({
  magicOptions: null as any,
  resetOptions: null as any,
  inputProps: null as any,
  magicMutate: vi.fn(),
  resetMutate: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { auth: {
  requestMagicLink: { useMutation: (options: any) => {
    mocks.magicOptions = options;
    return { mutate: mocks.magicMutate, isPending: false, reset: vi.fn() };
  } },
  requestPasswordReset: { useMutation: (options: any) => {
    mocks.resetOptions = options;
    return { mutate: mocks.resetMutate, isPending: false };
  } },
  registerWithPassword: { useMutation: () => ({ isPending: false, reset: vi.fn() }) },
} } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, isAuthenticated: false }) }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
  useLocation: () => ["/login", vi.fn()],
}));
vi.mock("@/hooks/useSubdomain", () => ({
  isCombinedBrandingDomain: () => false,
  isIHeartEchoDomain: () => false,
  isLearnDomain: () => false,
  MEMBERS_APP_URL: "https://members.allaboutultrasound.com",
}));
vi.mock("@/lib/authPageBrand", () => ({ getAuthPageBrandName: () => "All About Ultrasound", getAuthPageLogoUrl: () => "test-logo" }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => React.createElement("button", props, children) }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => {
  mocks.inputProps = props;
  const { autoFocus: _autoFocus, ...inputProps } = props;
  return React.createElement("input", inputProps);
} }));
vi.mock("@/components/ui/label", () => ({ Label: ({ children, ...props }: any) => React.createElement("label", props, children) }));
vi.mock("@/components/ui/dialog", () => {
  const Div = ({ children }: any) => React.createElement("div", null, children);
  return { Dialog: () => null, DialogContent: Div, DialogDescription: Div, DialogFooter: Div, DialogHeader: Div, DialogTitle: Div };
});
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import ForgotPassword from "../client/src/pages/ForgotPassword";
import MagicLinkRequest from "../client/src/pages/MagicLinkRequest";
import Login from "../client/src/pages/Login";
import { getAuthEmailRetryAfterMs, getAuthEmailThrottleMessage } from "../shared/authEmailRateLimit";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;
let now: number;
let ticks: Map<number, () => void>;

beforeEach(() => {
  vi.clearAllMocks();
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.allaboutultrasound.com/login" });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("location", dom.window.location);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  now = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  ticks = new Map();
  vi.spyOn(window, "setInterval").mockImplementation(((fn: () => void) => {
    const id = ticks.size + 1;
    ticks.set(id, fn);
    return id;
  }) as any);
  vi.spyOn(window, "clearInterval").mockImplementation((id) => { ticks.delete(id); });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  dom.window.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(component: typeof ForgotPassword | typeof MagicLinkRequest | typeof Login) {
  await act(async () => root.render(React.createElement(component)));
  if (component === Login) {
    const magicButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Send me a magic link instead"));
    await act(async () => magicButton?.click());
  }
  await act(async () => mocks.inputProps.onChange({ target: { value: "learner@example.com" } }));
}

const pages = [
  ["ForgotPassword", ForgotPassword, () => mocks.resetOptions, "Check your email"],
  ["MagicLinkRequest", MagicLinkRequest, () => mocks.magicOptions, "Check your inbox"],
  ["Login magic-link mode", Login, () => mocks.magicOptions, "Check your inbox"],
] as const;

describe.each(pages)("%s retry UI", (_name, component, options, sentHeading) => {
  it.each(["cooldown", "hourly_limit"])("does not display a sent confirmation when %s is returned", async (deliveryStatus) => {
    await mount(component);
    await act(async () => options().onSuccess({ success: true, deliveryStatus, retryAfterMs: 75_000 }));
    expect(host.textContent).not.toContain(sentHeading);
    expect(host.textContent).toContain("No new email was sent.");
    expect(host.textContent).toContain("2 minutes");
    if (deliveryStatus === "hourly_limit") expect(host.textContent).toContain("up to one hour");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    await act(async () => host.querySelector("form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    expect(mocks.magicMutate).not.toHaveBeenCalled();
    expect(mocks.resetMutate).not.toHaveBeenCalled();

    // The button enables at the server deadline, rather than a hard-coded minute.
    now += 60_000;
    await act(async () => { for (const tick of ticks.values()) tick(); });
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    now += 15_000;
    await act(async () => { for (const tick of ticks.values()) tick(); });
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await act(async () => host.querySelector("form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    expect(_name === "ForgotPassword" ? mocks.resetMutate : mocks.magicMutate).toHaveBeenCalledOnce();
  });

  it("keeps the original confirmation only for accepted or generically acknowledged requests", async () => {
    await mount(component);
    await act(async () => options().onSuccess({ success: true, deliveryStatus: _name === "ForgotPassword" ? "acknowledged" : "sent" }));
    expect(host.textContent).toContain(sentHeading);
    expect(host.querySelector("form")).toBeNull();
  });
});

describe("reset failure and magic-link unavailable UI", () => {
  it("does not show Check your email after reset sending fails", async () => {
    await mount(ForgotPassword);
    await act(async () => mocks.resetOptions.onError({ message: "Password reset email is temporarily unavailable." }));
    expect(host.textContent).not.toContain("Check your email");
    expect(host.querySelector("form")).not.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith("Password reset email is temporarily unavailable.");
  });

  it.each([MagicLinkRequest, Login])("does not show a sent confirmation for unavailable magic-link preparation", async (component) => {
    await mount(component);
    await act(async () => mocks.magicOptions.onSuccess({ success: true, deliveryStatus: "unavailable" }));
    expect(host.textContent).not.toContain("Check your inbox");
    expect(host.textContent).toContain("We could not prepare a sign-in email right now.");
    expect(host.querySelector("form")).not.toBeNull();
  });
});

describe("auth email retry helpers", () => {
  it("uses the true auth-type cooldowns and a conservative hour for either hourly cap", () => {
    expect(getAuthEmailRetryAfterMs("magic_link", { allowed: false, reason: "cooldown" })).toBe(60_000);
    expect(getAuthEmailRetryAfterMs("password_reset", { allowed: false, reason: "cooldown" })).toBe(300_000);
    for (const type of ["magic_link", "password_reset"] as const) {
      for (const reason of ["email_hourly", "ip_hourly"] as const) {
        expect(getAuthEmailRetryAfterMs(type, { allowed: false, reason })).toBe(3_600_000);
      }
    }
  });

  it("uses a supplied positive retry duration but rejects invalid retry values", () => {
    expect(getAuthEmailRetryAfterMs("magic_link", { allowed: false, reason: "cooldown", retryAfterMs: 12_000 })).toBe(12_000);
    expect(getAuthEmailRetryAfterMs("magic_link", { allowed: false, reason: "cooldown", retryAfterMs: NaN })).toBe(60_000);
    expect(getAuthEmailRetryAfterMs("magic_link", { allowed: true })).toBe(0);
  });

  it("does not give throttle messaging for accepted requests and permits retry at zero", () => {
    expect(getAuthEmailThrottleMessage("acknowledged", 0)).toBeNull();
    expect(getAuthEmailThrottleMessage("sent", 0)).toBeNull();
    expect(getAuthEmailThrottleMessage("cooldown", 0)).toContain("now");
  });
});
