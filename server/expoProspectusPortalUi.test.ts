// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authenticated: true,
  approved: true,
  mutate: vi.fn(),
}));
const expo = {
  events: [
    { id: 11, tenant: "ultrasound_expo", name: "General Expo" },
    { id: 22, tenant: "echo_expo", name: "Cardiac Expo" },
  ],
  packages: [],
  booths: [],
  boothRequests: [],
  resources: [
    {
      id: 101,
      eventId: 11,
      title: "General prospectus",
      resourceType: "document",
      resourceUrl: "/manus-storage/general-prospectus.pdf",
    },
    {
      id: 202,
      eventId: 22,
      title: "Cardiac prospectus",
      resourceType: "document",
      resourceUrl: "/manus-storage/cardiac-prospectus.pdf",
    },
  ],
};
function mutation() {
  return { mutate: mocks.mutate, isPending: false };
}
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: mocks.authenticated, loading: false }),
}));
vi.mock("@/components/ExpoPartnerProfileManager", () => ({
  ExpoPartnerProfileManager: () => null,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    vendorPortal: {
      myAccess: {
        useQuery: () => ({
          data: {
            approved: { aausIHeartEcho: false, ultrasoundExpo: mocks.approved },
          },
          isLoading: false,
        }),
      },
      myPortal: {
        useQuery: () => ({ data: { ultrasoundExpo: expo }, isLoading: false }),
      },
      requestExpoBooth: { useMutation: mutation },
    },
    sponsorship: { createCheckout: { useMutation: mutation } },
    eventPartnership: { createCheckout: { useMutation: mutation } },
    ultrasoundExpo: {
      createPartnerCheckout: { useMutation: mutation },
      createCombinedPartnerCheckout: { useMutation: mutation },
    },
    useUtils: () => ({ vendorPortal: { myPortal: { invalidate: vi.fn() } } }),
  },
}));
import ApprovedPartnerPortal from "../client/src/pages/ApprovedPartnerPortal";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("React", React);
  mocks.authenticated = true;
  mocks.approved = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(ApprovedPartnerPortal)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("approved exhibitor prospectus downloads", () => {
  it("adds a download action without removing the existing resource-opening link", () => {
    expect(
      document.querySelector(
        'a[download][href="/manus-storage/general-prospectus.pdf"]'
      )?.textContent
    ).toContain("Download prospectus");
    expect(
      Array.from(
        document.querySelectorAll(
          'a[href="/manus-storage/general-prospectus.pdf"]'
        )
      ).some(anchor => anchor.textContent?.includes("Open resource"))
    ).toBe(true);
    expect(document.body.textContent).toContain("browser’s download button");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("keeps EchoExpo documents separate until that category is selected", async () => {
    expect(
      document.querySelector(
        'a[download][href="/manus-storage/cardiac-prospectus.pdf"]'
      )
    ).toBeNull();
    const echo = Array.from(document.querySelectorAll("button")).find(
      button => button.textContent === "EchoExpo™"
    )!;
    await act(async () => echo.click());
    expect(
      document.querySelector(
        'a[download][href="/manus-storage/cardiac-prospectus.pdf"]'
      )
    ).not.toBeNull();
    expect(
      document.querySelector(
        'a[download][href="/manus-storage/general-prospectus.pdf"]'
      )
    ).toBeNull();
  });
  it("keeps downloads behind approved authenticated partner access", async () => {
    mocks.approved = false;
    await act(async () => root.render(createElement(ApprovedPartnerPortal)));
    expect(document.querySelector("a[download]")).toBeNull();
    mocks.authenticated = false;
    await act(async () => root.render(createElement(ApprovedPartnerPortal)));
    expect(document.body.textContent).toContain(
      "Sign in to the Partner Portal"
    );
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
