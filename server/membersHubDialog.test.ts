// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createMember: vi.fn(async () => ({ userId: 42, isNewUser: true })),
  createAndEnroll: vi.fn(async () => undefined),
  grantProduct: vi.fn(async () => undefined),
  grantMembership: vi.fn(async () => undefined),
  invalidateMembers: vi.fn(async () => undefined),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    adminUser: {
      listMembers: { useQuery: () => ({ data: { members: [], total: 0, totalPages: 1 }, isLoading: false }) },
    },
    lmsAdmin: {
      listCourses: { useQuery: () => ({ data: { courses: [{ id: 1, title: "Abdominal Ultrasound", type: "course" }] } }) },
      createMember: { useMutation: () => ({ isPending: false, mutateAsync: mocks.createMember }) },
      createAndEnrollUser: { useMutation: () => ({ isPending: false, mutateAsync: mocks.createAndEnroll }) },
      grantMembershipAccess: { useMutation: () => ({ isPending: false, mutateAsync: mocks.grantMembership }) },
    },
    productAnalytics: {
      listAllProductsWithStats: { useQuery: () => ({ data: { products: [{ id: 3, title: "Registry Review Bundle", type: "bundle" }] } }) },
      grantProductAccess: { useMutation: () => ({ isPending: false, mutateAsync: mocks.grantProduct }) },
    },
    membership: {
      listAll: { useQuery: () => ({ data: [{ id: 5, title: "CME Membership", billingInterval: "annual" }] }) },
    },
    useUtils: () => ({ adminUser: { listMembers: { invalidate: mocks.invalidateMembers } } }),
  },
}));

import { AllMembersPanel } from "../client/src/pages/admin/MembersHub";

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findLabelCheckbox(text: string) {
  const label = Array.from(document.querySelectorAll("label")).find((element) => element.textContent?.includes(text));
  if (!label) throw new Error(`Could not find catalog row for ${text}`);
  const input = label.querySelector("input[type=checkbox]");
  if (!input) throw new Error(`Could not find checkbox for ${text}`);
  return input as HTMLInputElement;
}

describe("Members Hub direct access dialog", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    document.querySelectorAll("[data-radix-portal]").forEach((element) => element.remove());
    vi.clearAllMocks();
  });

  it("loads memberships and bundles from its queries, filters them, selects them, and submits matching grants", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(AllMembersPanel)));

    const openButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("New Member & Access"));
    await act(async () => openButton?.click());

    expect(document.body.textContent).toContain("Registry Review Bundle");
    expect(document.body.textContent).toContain("CME Membership");

    const catalogSearch = document.querySelector('input[placeholder="Search all access options…"]') as HTMLInputElement;
    await act(async () => setInputValue(catalogSearch, "registry"));
    expect(document.body.textContent).toContain("Registry Review Bundle");
    expect(document.body.textContent).not.toContain("CME Membership");

    await act(async () => setInputValue(catalogSearch, ""));
    await act(async () => findLabelCheckbox("Abdominal Ultrasound").click());
    await act(async () => findLabelCheckbox("Registry Review Bundle").click());
    await act(async () => findLabelCheckbox("CME Membership").click());

    await act(async () => setInputValue(document.querySelector("#member-name") as HTMLInputElement, "Taylor Learner"));
    await act(async () => setInputValue(document.querySelector("#member-email") as HTMLInputElement, "taylor@example.com"));
    const submitButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Create Member & Assign Access");
    await act(async () => submitButton?.click());

    expect(mocks.createMember).toHaveBeenCalledWith({ name: "Taylor Learner", email: "taylor@example.com" });
    expect(mocks.createAndEnroll).toHaveBeenCalledWith({ name: "Taylor Learner", email: "taylor@example.com", courseId: 1 });
    expect(mocks.grantProduct).toHaveBeenCalledWith({ userEmail: "taylor@example.com", productType: "bundle", productId: 3 });
    expect(mocks.grantMembership).toHaveBeenCalledWith({ userId: 42, planId: 5 });
  });
});
