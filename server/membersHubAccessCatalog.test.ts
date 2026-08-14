import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberAccessCatalogList } from "../client/src/components/admin/MemberAccessCatalogList";
import {
  buildMemberAccessCatalog,
  submitMemberAccessGrants,
  toggleMemberAccessId,
  toggleMemberAccessProduct,
} from "../client/src/lib/memberAccessCatalog";

describe("Members Hub searchable access catalog", () => {
  const catalogData = {
    courses: [{ id: 1, title: "Abdominal Ultrasound", type: "course" }],
    products: [
      { id: 2, title: "Vascular Workbook", type: "download" },
      { id: 3, title: "Registry Review Bundle", type: "bundle" },
      { id: 4, title: "Physical Probe", type: "physical" },
    ],
    memberships: [
      { id: 5, title: "CME Membership", billingInterval: "annual" },
      { id: 6, title: "Legacy Membership", billingInterval: "monthly" },
    ],
  };

  it("loads all supported access types and retains admin-created memberships and bundles", () => {
    const catalog = buildMemberAccessCatalog(catalogData, "");
    expect(catalog.courses.map((item) => item.title)).toEqual(["Abdominal Ultrasound"]);
    expect(catalog.products).toEqual([
      { id: 2, title: "Vascular Workbook", type: "download" },
      { id: 3, title: "Registry Review Bundle", type: "bundle" },
    ]);
    expect(catalog.memberships.map((item) => item.title)).toEqual(["CME Membership", "Legacy Membership"]);
  });

  it("searches across categories and filters to the matching catalog row", () => {
    expect(buildMemberAccessCatalog(catalogData, "registry").products.map((item) => item.id)).toEqual([3]);
    expect(buildMemberAccessCatalog(catalogData, "annual").memberships.map((item) => item.id)).toEqual([5]);
    expect(buildMemberAccessCatalog(catalogData, "abdominal").courses.map((item) => item.id)).toEqual([1]);
  });

  it("renders query-loaded admin memberships and bundles in the visible access catalog", () => {
    const markup = renderToStaticMarkup(createElement(MemberAccessCatalogList, {
      ...catalogData,
      search: "",
      selectedCourseIds: [],
      selectedProducts: [],
      selectedPlanIds: [],
      onToggleCourse: vi.fn(),
      onToggleProduct: vi.fn(),
      onTogglePlan: vi.fn(),
    }));
    expect(markup).toContain("Registry Review Bundle");
    expect(markup).toContain("CME Membership");
    expect(markup).toContain("Legacy Membership");
    expect(markup).not.toContain("Physical Probe");
  });

  it("filters the rendered catalog by supported access type without losing search behavior", () => {
    const baseProps = {
      ...catalogData,
      search: "",
      selectedCourseIds: [],
      selectedProducts: [],
      selectedPlanIds: [],
      onToggleCourse: vi.fn(),
      onToggleProduct: vi.fn(),
      onTogglePlan: vi.fn(),
    };
    const downloadMarkup = renderToStaticMarkup(createElement(MemberAccessCatalogList, { ...baseProps, filter: "downloads" }));
    const bundleMarkup = renderToStaticMarkup(createElement(MemberAccessCatalogList, { ...baseProps, filter: "bundles" }));
    const membershipMarkup = renderToStaticMarkup(createElement(MemberAccessCatalogList, { ...baseProps, filter: "memberships", search: "legacy" }));

    expect(downloadMarkup).toContain("Vascular Workbook");
    expect(downloadMarkup).not.toContain("Registry Review Bundle");
    expect(bundleMarkup).toContain("Registry Review Bundle");
    expect(bundleMarkup).not.toContain("Vascular Workbook");
    expect(membershipMarkup).toContain("Legacy Membership");
    expect(membershipMarkup).not.toContain("CME Membership");
  });

  it("selects and deselects the access records that the grant workflow submits", () => {
    expect(toggleMemberAccessId([], 1)).toEqual([1]);
    expect(toggleMemberAccessId([1], 1)).toEqual([]);
    const bundle = { id: 3, title: "Registry Review Bundle", type: "bundle" as const };
    expect(toggleMemberAccessProduct([], bundle)).toEqual([bundle]);
    expect(toggleMemberAccessProduct([bundle], bundle)).toEqual([]);
  });

  it("submits each selected course, bundle, and membership through the matching grant mutation", async () => {
    const createAndEnroll = vi.fn(async () => undefined);
    const grantProductAccess = vi.fn(async () => undefined);
    const grantMembershipAccess = vi.fn(async () => undefined);

    await submitMemberAccessGrants({
      member: { name: "Taylor Learner", email: "taylor@example.com", userId: 42 },
      courseIds: [1],
      products: [{ id: 3, title: "Registry Review Bundle", type: "bundle" }],
      planIds: [5],
      createAndEnroll,
      grantProductAccess,
      grantMembershipAccess,
    });

    expect(createAndEnroll).toHaveBeenCalledWith({ name: "Taylor Learner", email: "taylor@example.com", courseId: 1 });
    expect(grantProductAccess).toHaveBeenCalledWith({ userEmail: "taylor@example.com", productType: "bundle", productId: 3 });
    expect(grantMembershipAccess).toHaveBeenCalledWith({ userId: 42, planId: 5 });
  });
});
