// @vitest-environment jsdom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  savePackage: vi.fn(),
  invalidate: vi.fn(async () => undefined),
}));
const events = [
  {
    id: 11,
    tenant: "ultrasound_expo",
    name: "General Imaging Expo 2028",
    slug: "general-imaging-2028",
    startsAt: new Date("2028-01-11T17:00:00Z"),
    endsAt: new Date("2028-01-14T01:00:00Z"),
    timezone: "America/New_York",
    locationLabel: "Orlando",
    description: "Saved general education copy",
    heroImageUrl: "https://example.com/general.png",
    registrationTerms: "Saved terms",
    attendeeInstructions: "Saved arrival instructions",
    partnerInstructions: "Saved booth instructions",
    status: "published",
  },
  {
    id: 22,
    tenant: "echo_expo",
    name: "Cardiac Imaging Expo 2028",
    slug: "cardiac-imaging-2028",
    startsAt: new Date("2028-01-14T17:00:00Z"),
    endsAt: new Date("2028-01-16T19:00:00Z"),
    timezone: "America/New_York",
    locationLabel: "Orlando",
    description: "Saved cardiac education copy",
    heroImageUrl: "/manus-storage/echo-approved.png",
    registrationTerms: "Cardiac terms",
    attendeeInstructions: "Cardiac arrival",
    partnerInstructions: "Cardiac booth",
    status: "draft",
  },
  {
    id: 33,
    tenant: "echo_expo",
    name: "Archived Cardiac Event",
    slug: "archived-cardiac",
    startsAt: new Date("2027-01-14T17:00:00Z"),
    endsAt: new Date("2027-01-16T19:00:00Z"),
    timezone: "America/New_York",
    locationLabel: "Orlando",
    description: "Historical content",
    heroImageUrl: null,
    registrationTerms: "",
    attendeeInstructions: "",
    partnerInstructions: "",
    status: "archived",
  },
];
const registrations = [
  {
    id: 101,
    eventId: 11,
    attendeeName: "General Vendor",
    attendeeEmail: "general@example.com",
    organizationName: "General Organization",
    packageName: "General booth",
    packageType: "exhibitor",
    partnerTypes: ["vendor", "exhibitor"],
    amountCents: 10000,
    currency: "usd",
    paymentStatus: "paid",
  },
  {
    id: 202,
    eventId: 22,
    attendeeName: "Cardiac Vendor",
    attendeeEmail: "cardiac@example.com",
    organizationName: "Cardiac Organization",
    packageName: "Cardiac booth",
    packageType: "exhibitor",
    partnerTypes: ["vendor", "exhibitor"],
    amountCents: 20000,
    currency: "usd",
    paymentStatus: "paid",
  },
];
const snapshot = {
  events,
  packages: [],
  registrations,
  paidTotal: 30000,
  tenantSchemaAvailable: true,
};
const mutation = (mutate: any) => ({ mutate, isPending: false, error: null });
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ultrasoundExpo: {
      adminSnapshot: {
        useQuery: () => ({
          data: snapshot,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      createEvent: { useMutation: () => mutation(mocks.create) },
      updateEvent: { useMutation: () => mutation(mocks.update) },
      duplicateEvent: { useMutation: () => mutation(mocks.duplicate) },
      deleteEvent: { useMutation: () => mutation(mocks.remove) },
      restoreEvent: { useMutation: () => mutation(mocks.restore) },
      savePackage: { useMutation: () => mutation(mocks.savePackage) },
    },
    useUtils: () => ({
      ultrasoundExpo: { adminSnapshot: { invalidate: mocks.invalidate } },
      ultrasoundExpoEvent: {
        adminEventWorkspace: { invalidate: mocks.invalidate },
      },
      vendorPortal: { adminExpoOperations: { invalidate: mocks.invalidate } },
    }),
  },
}));
vi.mock("@/components/admin/ExpoEventInstancePanel", () => ({
  ExpoEventInstancePanel: ({ eventId, section }: any) =>
    createElement(
      "div",
      { "data-instance-section": section, "data-event-id": eventId },
      `${section} tools for ${eventId}`
    ),
}));
vi.mock("@/components/admin/ExpoPartnerOperationsPanel", () => ({
  ExpoPartnerOperationsPanel: ({ eventId, section }: any) =>
    createElement(
      "div",
      { "data-partner-section": section, "data-event-id": eventId },
      `${section} partner tools for ${eventId}`
    ),
}));
vi.mock("@/components/admin/VendorPartnerAdminPanel", () => ({
  VendorPartnerAdminPanel: () =>
    createElement(
      "div",
      { "data-global-approvals": true },
      "Organization approval tools"
    ),
}));
vi.mock("@/components/admin/ExpoAudienceManagementPanel", () => ({
  ExpoAudienceManagementPanel: () =>
    createElement(
      "div",
      { "data-all-audiences": true },
      "All-event audience tools"
    ),
}));
import UltrasoundExpoAdmin from "../client/src/pages/admin/UltrasoundExpoAdmin";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const button = (text: string, scope: ParentNode = document) => {
  const found = Array.from(scope.querySelectorAll("button")).find(
    node => node.textContent?.trim() === text
  );
  if (!found) throw Error(`Button not found: ${text}`);
  return found as HTMLButtonElement;
};
const field = (text: string, scope: ParentNode = document) => {
  const label = Array.from(scope.querySelectorAll("label")).find(
    node => node.querySelector("span")?.textContent === text
  );
  const input = label?.querySelector("input,textarea,select");
  if (!input) throw Error(`Field not found: ${text}`);
  return input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
};
async function inputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  await act(async () => {
    const proto =
      input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function click(text: string, scope: ParentNode = document) {
  await act(async () => button(text, scope).click());
}
async function openTab(text: string) {
  await act(async () => {
    const trigger = button(text);
    trigger.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, button: 0 })
    );
    trigger.click();
  });
  return document.querySelector(
    '[role="tabpanel"][data-state="active"]'
  ) as HTMLElement;
}
async function selectSavedEvent(name: string) {
  const choice = Array.from(document.querySelectorAll("aside button")).find(
    node => node.textContent?.includes(name)
  );
  if (!choice) throw Error("Saved event selector missing");
  await act(async () => (choice as HTMLButtonElement).click());
}

beforeEach(async () => {
  vi.stubGlobal("React", React);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(UltrasoundExpoAdmin)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("streamlined Expo event management", () => {
  it("starts with only event settings and does not eagerly mount every long panel", () => {
    expect(
      document.querySelectorAll('[role="tabpanel"][data-state="active"]')
    ).toHaveLength(1);
    expect(document.querySelector("[data-instance-section]")).toBeNull();
    expect(document.querySelector("[data-partner-section]")).toBeNull();
    expect(document.querySelector("[data-global-approvals]")).toBeNull();
    for (const label of [
      "Event settings",
      "Event vendors",
      "Event exhibitors",
      "Event map",
      "Exhibitor prospectus",
    ])
      expect(button(label).getAttribute("role")).toBe("tab");
  });
  it("filters saved events by their explicit brand, not by the name or the domain", async () => {
    const filters = document.querySelector(
      '[aria-label="Event category filter"]'
    )!;
    await click("EchoExpo™", filters);
    const sidebar = document.querySelector("aside")!.textContent;
    expect(sidebar).toContain("Cardiac Imaging Expo 2028");
    expect(sidebar).not.toContain("General Imaging Expo 2028");
    expect(sidebar).not.toContain("Archived Cardiac Event");
    expect(document.querySelector("main h2")?.textContent).toBe(
      "Cardiac Imaging Expo 2028"
    );
  });
  it("keeps the saved end date January 13 in the event's timezone and allows category corrections", async () => {
    expect(field("Ends").value).toBe("2028-01-13T20:00");
    expect((field("Event category") as HTMLSelectElement).disabled).toBe(false);
    await inputValue(field("Event category"), "echo_expo");
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "Saving moves this event into EchoExpo™"
    );
    await click("Save event settings");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 11,
        tenant: "echo_expo",
        endsAt: new Date("2028-01-14T01:00:00Z"),
        description: "Saved general education copy",
        registrationTerms: "Saved terms",
      })
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates a new EchoExpo form without accidentally editing the first UltrasoundExpo", async () => {
    await click("New EchoExpo™");
    expect(field("Event category").value).toBe("echo_expo");
    expect(field("Starts").value).toBe("");
    expect(field("Event name").value).toBe("EchoExpo™");
    expect(document.querySelector("main h2")?.textContent).toContain(
      "New EchoExpo™ event"
    );
    expect(button("Event map").disabled).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("mounts a prospectus tab only for the selected event and retains a visited editor across tabs", async () => {
    await selectSavedEvent("Cardiac Imaging Expo 2028");
    const prospectus = await openTab("Exhibitor prospectus");
    expect(
      prospectus
        .querySelector('[data-partner-section="prospectus"]')
        ?.getAttribute("data-event-id")
    ).toBe("22");
    await openTab("Event map");
    expect(
      document
        .querySelector('[data-partner-section="map"]')
        ?.getAttribute("data-event-id")
    ).toBe("22");
    expect(
      document.querySelector('[data-partner-section="prospectus"]')
    ).not.toBeNull();
    const active = document.querySelector(
      '[role="tabpanel"][data-state="active"]'
    )!;
    expect(
      active.querySelector('[data-partner-section="prospectus"]')
    ).toBeNull();
  });
  it("shows only the selected event's vendor and exhibitor registrations", async () => {
    const vendorPanel = await openTab("Event vendors");
    expect(vendorPanel.textContent).toContain("General Vendor");
    expect(vendorPanel.textContent).not.toContain("Cardiac Vendor");
    await selectSavedEvent("Cardiac Imaging Expo 2028");
    const exhibitorPanel = await openTab("Event exhibitors");
    expect(exhibitorPanel.textContent).toContain("Cardiac Vendor");
    expect(exhibitorPanel.textContent).not.toContain("General Vendor");
  });
  it("offers configurable duplicate name, brand and dates instead of immediately creating another record", async () => {
    await click("Duplicate");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(mocks.duplicate).not.toHaveBeenCalled();
    await inputValue(field("New event category", dialog), "echo_expo");
    await inputValue(field("New event name", dialog), "New Cardiac Event 2029");
    await inputValue(field("New URL slug", dialog), "new-cardiac-2029");
    await click("Create duplicate draft", dialog);
    expect(mocks.duplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: 11,
        tenant: "echo_expo",
        name: "New Cardiac Event 2029",
        slug: "new-cardiac-2029",
        status: "draft",
        timezone: "America/New_York",
        startsAt: new Date("2029-01-11T17:00:00Z"),
      })
    );
  });
  it("requires the event-name confirmation before a reversible deletion can be submitted", async () => {
    await click("Delete event");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Archived");
    expect(dialog.textContent).toContain("payment records");
    expect(button("Delete event", dialog).disabled).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalled();
    await inputValue(field("Event name confirmation", dialog), "wrong event");
    expect(button("Delete event", dialog).disabled).toBe(true);
    await inputValue(
      field("Event name confirmation", dialog),
      "General Imaging Expo 2028"
    );
    await click("Delete event", dialog);
    expect(mocks.remove).toHaveBeenCalledWith({
      id: 11,
      confirmName: "General Imaging Expo 2028",
    });
  });
  it("keeps archived events recoverable, separately filtered by category", async () => {
    const filters = document.querySelector(
      '[aria-label="Event category filter"]'
    )!;
    await click("EchoExpo™", filters);
    await click("Archived (1)");
    expect(document.querySelector("main h2")?.textContent).toBe(
      "Archived Cardiac Event"
    );
    await click("Restore as draft");
    expect(mocks.restore).toHaveBeenCalledWith({ id: 33 });
  });
  it("keeps organization-wide approvals and website editors accessible but clearly separate", async () => {
    const approvals = await openTab("Partner approvals");
    expect(approvals.textContent).toContain("across Expo events");
    expect(approvals.querySelector("[data-global-approvals]")).not.toBeNull();
    const websites = await openTab("Website pages");
    expect(
      websites.querySelector(
        'a[href="/admin/lms/site-pages?domain=ultrasoundexpo.com"]'
      )
    ).not.toBeNull();
    expect(
      websites.querySelector(
        'a[href="/admin/lms/site-pages?domain=echocardiographyexpo.com"]'
      )
    ).not.toBeNull();
  });
});
