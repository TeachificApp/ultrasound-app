// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import React, { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatScheduledInput, parseScheduledTimestamp } from "../shared/platformTime";

// All workspace and mutation hooks are mocked: adminEventWorkspace grants community
// access on the real backend, so these regressions must never invoke it or any DB.
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  invalidate: vi.fn(),
  refetch: vi.fn(),
  agenda: vi.fn(),
  page: vi.fn(),
  recording: vi.fn(),
  resetAgenda: vi.fn(),
  resetPage: vi.fn(),
  resetRecording: vi.fn(),
  options: {} as Record<string, any>,
  states: {} as Record<string, { isPending?: boolean; error?: Error }>,
  result: {} as any,
}));
vi.mock("@/lib/trpc", () => {
  const mutation = (name: string, mutate: any, reset: any) => ({
    useMutation: (options: any) => {
      mocks.options[name] = options;
      return { mutate, reset, isPending: mocks.states[name]?.isPending ?? false, error: mocks.states[name]?.error ?? null };
    },
  });
  return { trpc: {
    useUtils: () => ({ ultrasoundExpoEvent: { adminEventWorkspace: { invalidate: mocks.invalidate } } }),
    ultrasoundExpoEvent: {
      adminEventWorkspace: { useQuery: (input: any) => { mocks.query(input); return { ...mocks.result, refetch: mocks.refetch }; } },
      adminSaveAgendaItem: mutation("agenda", mocks.agenda, mocks.resetAgenda),
      adminSaveEventPage: mutation("page", mocks.page, mocks.resetPage),
      adminSaveRecording: mutation("recording", mocks.recording, mocks.resetRecording),
    },
  } };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/admin/ExpoPointsAdminPanel", () => ({
  ExpoPointsAdminPanel: ({ eventId }: { eventId: number }) => createElement("div", { "data-expo-section": "points" }, `ExpoPoints event ${eventId}`),
}));

import { ExpoEventInstancePanel, type ExpoEventInstanceSection } from "../client/src/components/admin/ExpoEventInstancePanel";

const sections: ExpoEventInstanceSection[] = ["agenda", "pages", "attendees", "recordings", "community", "points"];
const fixture = (id = 11) => ({
  event: { id, name: `Expo event ${id}`, slug: `expo-${id}`, timezone: "America/New_York", startsAt: new Date("2028-01-11T17:00:00Z"), endsAt: new Date("2028-01-13T19:00:00Z"), locationLabel: `Event location ${id}` },
  agenda: [{ id: 101, eventId: id, title: "Saved agenda title", description: "Authored agenda description", startsAt: new Date("2028-01-12T15:30:00Z"), endsAt: new Date("2028-01-12T16:45:00Z"), locationLabel: "Scan room", speakerNames: "Existing speakers", category: "Hands-on", status: "published", sortOrder: 7 }],
  pages: [{ id: 201, eventId: id, title: "Authored page title", slug: "existing-page", accessLevel: "registered", pageType: "attendee", status: "published", blocksJson: '[{"id":"preserved","type":"text","content":"Existing authored blocks"}]' }],
  recordings: [{ id: 301, eventId: id, title: "Saved recording title", description: "Authored recording description", videoUrl: "https://example.test/video", thumbnailUrl: "https://example.test/thumbnail", durationSeconds: 420, status: "published", sortOrder: 3 }],
  attendeeRegistrations: [{ id: 401, attendeeName: "Registered attendee", attendeeEmail: "attendee@example.test", organizationName: "Attendee organization", packageName: "Attendance package" }],
  partnerRegistrations: [{ id: 501, attendeeName: "Registered exhibitor", attendeeEmail: "partner@example.test", organizationName: "Partner organization", packageName: "Exhibitor package" }],
  recordingOrders: [{ id: 601 }, { id: 602 }],
  profiles: [{ id: 701, displayName: "Existing organization page", isPublished: true }],
  community: { id: 801, slug: `expo-${id}-community` },
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;
const mount = async (section?: ExpoEventInstanceSection, eventId = 11) => {
  if (!host) { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); }
  await act(async () => root!.render(createElement(ExpoEventInstancePanel, { eventId, section })));
};
const button = (text: string) => Array.from(host!.querySelectorAll("button")).find(item => item.textContent === text)!;
const field = (label: string) => {
  const item = Array.from(host!.querySelectorAll("label")).find(item => item.textContent?.startsWith(label));
  if (!item) throw new Error(`Missing field ${label}`);
  return item.querySelector("input, textarea, select") as HTMLInputElement;
};
const changeField = async (label: string, value: string) => {
  const input = field(label);
  const prototype = input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : input.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
};
const submit = async () => { await act(async () => host!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.options = {};
  mocks.states = {};
  mocks.result = { data: fixture(), isLoading: false, isFetching: false, error: null };
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.refetch.mockResolvedValue(undefined);
  vi.stubGlobal("React", React); // Match Vitest's classic JSX transform.
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network is allowed in event panel regressions"); }));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("Expo event workspace section rendering", () => {
  it.each(sections)("renders only the %s section controls", section => {
    const markup = renderToStaticMarkup(createElement(ExpoEventInstancePanel, { eventId: 11, section }));
    expect(markup).toContain(`data-expo-section="${section}"`);
    for (const other of sections.filter(item => item !== section)) expect(markup).not.toContain(`data-expo-section="${other}"`);
    expect(markup).not.toContain("Build and manage this event’s agenda");
    if (section !== "community") expect(markup).not.toContain('href="/community/');
    expect(mocks.agenda).not.toHaveBeenCalled();
    expect(mocks.page).not.toHaveBeenCalled();
    expect(mocks.recording).not.toHaveBeenCalled();
    if (section === "points") expect(mocks.query).not.toHaveBeenCalled();
    else expect(mocks.query).toHaveBeenCalledWith({ eventId: 11 });
  });

  it("retains the full legacy workspace for callers omitting section", () => {
    const markup = renderToStaticMarkup(createElement(ExpoEventInstancePanel, { eventId: 11 }));
    for (const section of sections) expect(markup).toContain(`data-expo-section="${section}"`);
    for (const text of ["Saved agenda title", "Authored page title", "Registered attendee", "Registered exhibitor", "Saved recording title", "Existing organization page"]) expect(markup).toContain(text);
    expect(markup).toContain('/admin/ultrasound-expo/events/11/pages/201/edit');
    expect(markup).toContain('href="/community/expo-11-community"');
  });

  it("keeps roster, partner directory, page editor links, and order counts in their own sections", () => {
    const render = (section: ExpoEventInstanceSection) => renderToStaticMarkup(createElement(ExpoEventInstancePanel, { eventId: 11, section }));
    const attendees = render("attendees");
    expect(attendees).toContain("Registered attendee");
    expect(attendees).not.toContain("Registered exhibitor");
    const community = render("community");
    expect(community).toContain("Registered exhibitor");
    expect(community).toContain("Existing organization page");
    expect(community).not.toContain("Registered attendee");
    const recordings = render("recordings");
    expect(recordings).toContain("Recording orders");
    expect(recordings).toMatch(/>2<\/p>/);
    expect(recordings).not.toContain("Existing organization page");
    expect(render("pages")).toContain('/admin/ultrasound-expo/events/11/pages/201/edit');
  });

  it("shows retryable loading/error states without unrelated forms", async () => {
    mocks.result = { isLoading: true, isFetching: true, data: undefined, error: null };
    await mount("agenda");
    expect(host!.textContent).toContain("Loading event-instance workspace");
    expect(host!.querySelector("form")).toBeNull();
    mocks.result = { isLoading: false, isFetching: false, data: undefined, error: new Error("Synthetic failure") };
    await mount("agenda");
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
    await act(async () => button("Try again").click());
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached data visible after a failed refresh and disables the active refresh", async () => {
    mocks.result.error = new Error("Synthetic refresh failure");
    mocks.result.isFetching = true;
    await mount("pages");
    expect(host!.textContent).toContain("Authored page title");
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain("Previously loaded data");
    expect(button("Refreshing…").disabled).toBe(true);
    mocks.result.isFetching = false;
    await mount("pages");
    await act(async () => button("Refresh").click());
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});

describe("Expo event form editing and isolation", () => {
  it("edits an existing agenda item and round-trips its instant in the event timezone", async () => {
    await mount("agenda");
    expect(field("Starts").value).toBe("2028-01-11T12:00");
    expect(field("Ends").value).toBe("2028-01-13T14:00");
    await act(async () => button("Edit agenda item").click());
    expect(field("Starts").value).toBe("2028-01-12T10:30");
    expect(field("Description").value).toBe("Authored agenda description");
    expect(field("Speakers").value).toBe("Existing speakers");
    expect(field("Category").value).toBe("Hands-on");
    expect(field("Visibility").value).toBe("published");
    await changeField("Activity title", "Edited agenda title");
    await submit();
    expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({ id: 101, eventId: 11, title: "Edited agenda title", startsAt: new Date("2028-01-12T15:30:00Z"), endsAt: new Date("2028-01-12T16:45:00Z"), sortOrder: 7 }));
    await act(async () => mocks.options.agenda.onSuccess());
    expect(mocks.invalidate).toHaveBeenCalledWith({ eventId: 11 });
    expect(field("Activity title").value).toBe("");
    expect(host!.textContent).not.toContain("Editing agenda item #");
  });

  it("uses a non-platform event timezone for defaults and save conversion", async () => {
    mocks.result.data.event.timezone = "America/Los_Angeles";
    await mount("agenda");
    expect(field("Starts").value).toBe("2028-01-11T09:00");
    expect(host!.textContent).toContain("America/Los_Angeles");
    await changeField("Activity title", "Pacific agenda");
    await submit();
    expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({ startsAt: new Date("2028-01-11T17:00:00Z"), endsAt: new Date("2028-01-13T19:00:00Z") }));
    const instant = new Date("2028-07-11T17:00:00Z");
    expect(parseScheduledTimestamp(formatScheduledInput(instant, "America/Los_Angeles"), "America/Los_Angeles")).toEqual(instant);
  });

  it("rejects an agenda end before its start without calling a mutation", async () => {
    await mount("agenda");
    await changeField("Activity title", "Invalid range");
    await changeField("Ends", "2028-01-10T12:00");
    await submit();
    expect(mocks.agenda).not.toHaveBeenCalled();
  });

  it("preserves all existing recording fields when editing by ID and supports cancel", async () => {
    await mount("recordings");
    await act(async () => button("Edit recording").click());
    expect(field("Recording title").value).toBe("Saved recording title");
    expect(field("Duration (seconds)").value).toBe("420");
    expect(field("Video URL").value).toBe("https://example.test/video");
    await changeField("Description", "Edited recording description");
    await submit();
    expect(mocks.recording).toHaveBeenCalledWith(expect.objectContaining({ id: 301, eventId: 11, title: "Saved recording title", description: "Edited recording description", videoUrl: "https://example.test/video", thumbnailUrl: "https://example.test/thumbnail", durationSeconds: 420, status: "published", sortOrder: 3 }));
    await act(async () => button("Cancel edit").click());
    expect(field("Recording title").value).toBe("");
    expect(field("Duration (seconds)").value).toBe("");
    expect(mocks.resetRecording).toHaveBeenCalledTimes(2);
  });

  it("creates a new page without submitting existing page IDs or overwriting authored blocks", async () => {
    const existingBlocks = mocks.result.data.pages[0].blocksJson;
    await mount("pages");
    await changeField("Page title", "New authored page");
    await changeField("Audience", "partners");
    await changeField("Search title", "SEO title");
    await changeField("Search description", "SEO description");
    await submit();
    const payload = mocks.page.mock.calls[0][0];
    expect(payload).toMatchObject({ eventId: 11, title: "New authored page", slug: "new-authored-page", accessLevel: "partners", seoTitle: "SEO title", seoDescription: "SEO description", blocksJson: "[]" });
    expect(payload).not.toHaveProperty("id");
    expect(mocks.result.data.pages[0].blocksJson).toBe(existingBlocks);
  });

  it.each(["agenda", "pages", "recordings"] as const)("resets %s transient fields when eventId changes without a parent key", async section => {
    await mount(section);
    const label = section === "agenda" ? "Activity title" : section === "pages" ? "Page title" : "Recording title";
    if (section === "agenda") await act(async () => button("Edit agenda item").click());
    if (section === "recordings") await act(async () => button("Edit recording").click());
    await changeField(label, "Unsaved first event changes");
    mocks.result.data = fixture(22);
    await mount(section, 22);
    expect(field(label).value).toBe("");
    expect(host!.textContent).not.toContain("Editing agenda item #");
    expect(host!.textContent).not.toContain("Editing recording #");
    expect(mocks.query).toHaveBeenLastCalledWith({ eventId: 22 });
    if (section === "agenda") expect(field("Location").value).toBe("Event location 22");
  });

  it("renders mutation errors and locks controls and duplicate submits while saving", async () => {
    mocks.states.agenda = { isPending: true, error: new Error("Synthetic save failure") };
    await mount("agenda");
    expect(host!.querySelector('[role="alert"]')?.textContent).toBe("Synthetic save failure");
    expect(host!.querySelector("fieldset")?.disabled).toBe(true);
    expect(button("Saving…").disabled).toBe(true);
    expect(button("Edit agenda item").disabled).toBe(true);
    await submit();
    expect(mocks.agenda).not.toHaveBeenCalled();
  });
});

describe("Expo panel source safety", () => {
  it("keeps the section contract, timezone helpers, event reset, and existing-only mutations", () => {
    const source = readFileSync("client/src/components/admin/ExpoEventInstancePanel.tsx", "utf8");
    expect(source).toContain("export type ExpoEventInstanceSection");
    for (const section of sections) expect(source).toContain(`"${section}"`);
    expect(source).toContain("<EventInstanceWorkspace key={eventId}");
    expect(source).toContain("formatScheduledInput(value, timezone)");
    expect(source).toContain('parseScheduledTimestamp(agenda.startsAt, timezone, "start")');
    expect(source).not.toContain("toISOString().slice(0, 16)");
    expect(source).not.toContain("new Date(agenda.startsAt)");
    expect(source.match(/\.useMutation\(/g)).toHaveLength(3);
    for (const handler of ["adminSaveAgendaItem", "adminSaveEventPage", "adminSaveRecording"]) expect(source).toContain(handler);
    expect(source).not.toMatch(/(?:sendEmail|sendMail|grantUltrasoundExpoEventCommunityAccess|createCheckout)/);
  });
});
