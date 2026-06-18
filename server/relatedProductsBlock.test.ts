import { describe, expect, it } from "vitest";
import {
  pickManualRelatedProducts,
  resolveRelatedProductsSelectionMode,
  type RelatedProductFeedItem,
} from "@shared/relatedProductsBlock";

const courseA: RelatedProductFeedItem = {
  id: 1,
  type: "course",
  slug: "course-a",
  title: "Course A",
  price: 99,
  href: "/courses/course-a",
};

const downloadB: RelatedProductFeedItem = {
  id: 2,
  type: "download",
  slug: "download-b",
  title: "Download B",
  price: 29,
  href: "/downloads/download-b",
};

const workshopC: RelatedProductFeedItem = {
  id: 3,
  type: "workshop",
  slug: "workshop-c",
  title: "Workshop C",
  price: 199,
  href: "/workshops/workshop-c",
};

describe("resolveRelatedProductsSelectionMode", () => {
  it("uses explicit selectionMode when set", () => {
    expect(resolveRelatedProductsSelectionMode({ selectionMode: "auto", manualItems: [{ type: "course", id: 1 }] })).toBe("auto");
    expect(resolveRelatedProductsSelectionMode({ selectionMode: "manual" })).toBe("manual");
  });

  it("infers manual mode from manualItems when selectionMode is missing", () => {
    expect(
      resolveRelatedProductsSelectionMode({
        manualItems: [{ type: "workshop", id: 3 }],
      })
    ).toBe("manual");
  });

  it("defaults to auto when no manual picks exist", () => {
    expect(resolveRelatedProductsSelectionMode({})).toBe("auto");
    expect(resolveRelatedProductsSelectionMode({ manualItems: [] })).toBe("auto");
  });
});

describe("pickManualRelatedProducts", () => {
  const fetched = [courseA, downloadB, workshopC];

  it("returns only selected items in picker order", () => {
    const refs = [
      { type: "workshop", id: 3 },
      { type: "download", id: 2 },
    ];
    expect(pickManualRelatedProducts(refs, fetched, 12)).toEqual([workshopC, downloadB]);
  });

  it("does not include unselected products from the fetch response", () => {
    const refs = [{ type: "course", id: 1 }];
    expect(pickManualRelatedProducts(refs, fetched, 12)).toEqual([courseA]);
  });

  it("respects maxItems", () => {
    const refs = [
      { type: "course", id: 1 },
      { type: "download", id: 2 },
      { type: "workshop", id: 3 },
    ];
    expect(pickManualRelatedProducts(refs, fetched, 2)).toEqual([courseA, downloadB]);
  });

  it("dedupes duplicate manual refs by type-id", () => {
    const refs = [
      { type: "course", id: 1 },
      { type: "course", id: 1 },
    ];
    expect(pickManualRelatedProducts(refs, fetched, 12)).toEqual([courseA]);
  });

  it("returns empty when nothing is selected", () => {
    expect(pickManualRelatedProducts([], fetched, 3)).toEqual([]);
  });
});
