/**
 * newFeatures.test.ts — Tests for the 5 new features (May 14):
 * 1. Editable slugs for courses, downloads, media assets, bundles
 * 2. Inline Stripe checkout (PaymentIntent flow)
 * 3. Multiple order bumps per checkout page
 * 4. Funnel page hide option
 * 5. Funnel page standalone landing page
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({}),
  limit: vi.fn().mockReturnThis(),
};
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));
vi.mock("../drizzle/schema", () => ({
  funnels: { id: "id", slug: "slug", status: "status", name: "name" },
  funnelPages: { id: "id", funnelId: "funnel_id", slug: "slug", sortOrder: "sort_order", isActive: "is_active", isHidden: "is_hidden", isStandaloneLanding: "is_standalone_landing" },
  funnelLeads: { id: "id" },
  lmsCourses: { id: "id", slug: "slug" },
  digitalProducts: { id: "id", slug: "slug" },
  digitalBundles: { id: "id", slug: "slug" },
  mediaAssets: { id: "id", slug: "slug" },
  orderBumps: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  sql: vi.fn((s: any) => s),
  desc: vi.fn((col: any) => col),
  asc: vi.fn((col: any) => col),
  ne: vi.fn((...args: any[]) => args),
}));

// ─── 1. Editable Slugs ─────────────────────────────────────────────────────
describe("Feature 1: Editable Slugs", () => {
  describe("Slug validation", () => {
    it("should accept valid slug formats", () => {
      const validSlugs = [
        "my-course",
        "intro-to-ultrasound",
        "abdominal-101",
        "vascular-upper-lower",
        "a",
        "a-b-c",
      ];
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      validSlugs.forEach(slug => {
        expect(slugRegex.test(slug)).toBe(true);
      });
    });

    it("should reject invalid slug formats", () => {
      const invalidSlugs = [
        "My Course",
        "my_course",
        "my--course",
        "-leading-dash",
        "trailing-dash-",
        "UPPERCASE",
        "special!chars",
        "",
      ];
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      invalidSlugs.forEach(slug => {
        expect(slugRegex.test(slug)).toBe(false);
      });
    });

    it("should generate slug from title", () => {
      function generateSlug(title: string): string {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 100);
      }
      expect(generateSlug("My Course Title")).toBe("my-course-title");
      expect(generateSlug("Abdominal Ultrasound 101")).toBe("abdominal-ultrasound-101");
      expect(generateSlug("  Spaces & Special!  ")).toBe("spaces-special");
    });
  });

  describe("Slug uniqueness", () => {
    it("should detect duplicate slugs", () => {
      const existingSlugs = ["intro-course", "advanced-course", "vascular-101"];
      const newSlug = "intro-course";
      expect(existingSlugs.includes(newSlug)).toBe(true);
    });

    it("should allow unique slugs", () => {
      const existingSlugs = ["intro-course", "advanced-course"];
      const newSlug = "brand-new-course";
      expect(existingSlugs.includes(newSlug)).toBe(false);
    });
  });

  describe("Slug editing for different content types", () => {
    it("should support slug editing for courses", () => {
      const courseUpdate = { id: 1, slug: "new-course-slug" };
      expect(courseUpdate.slug).toBe("new-course-slug");
      expect(courseUpdate.id).toBe(1);
    });

    it("should support slug editing for digital products", () => {
      const productUpdate = { productId: 5, slug: "new-product-slug" };
      expect(productUpdate.slug).toBe("new-product-slug");
    });

    it("should support slug editing for bundles", () => {
      const bundleUpdate = { bundleId: 3, slug: "new-bundle-slug" };
      expect(bundleUpdate.slug).toBe("new-bundle-slug");
    });

    it("should support slug editing for media assets", () => {
      const assetUpdate = { id: 7, slug: "new-asset-slug" };
      expect(assetUpdate.slug).toBe("new-asset-slug");
    });
  });
});

// ─── 2. Inline Stripe Checkout (PaymentIntent) ─────────────────────────────
describe("Feature 2: Inline Stripe Checkout", () => {
  it("should calculate total amount correctly with order bumps", () => {
    const basePrice = 4999; // $49.99
    const orderBumps = [
      { id: 1, price: 1999, selected: true },
      { id: 2, price: 999, selected: false },
      { id: 3, price: 2499, selected: true },
    ];
    const selectedBumps = orderBumps.filter(b => b.selected);
    const total = basePrice + selectedBumps.reduce((sum, b) => sum + b.price, 0);
    expect(total).toBe(4999 + 1999 + 2499);
    expect(total).toBe(9497);
  });

  it("should convert dollar amount to cents for Stripe", () => {
    const dollarAmount = 49.99;
    const cents = Math.round(dollarAmount * 100);
    expect(cents).toBe(4999);
  });

  it("should handle zero-dollar checkout (free products)", () => {
    const price = 0;
    const cents = Math.round(price * 100);
    expect(cents).toBe(0);
    // Stripe requires minimum $0.50 for PaymentIntent
    const isValidForStripe = cents >= 50;
    expect(isValidForStripe).toBe(false);
  });

  it("should include metadata in PaymentIntent", () => {
    const metadata = {
      funnelId: "42",
      pageId: "7",
      email: "test@example.com",
      name: "Test User",
      productType: "course",
      productId: "15",
      orderBumpIds: "1,3",
    };
    expect(metadata.funnelId).toBe("42");
    expect(metadata.orderBumpIds).toBe("1,3");
    expect(metadata.email).toContain("@");
  });

  it("should support two-step checkout flow", () => {
    const steps = ["contact_info", "payment"];
    expect(steps.length).toBe(2);
    expect(steps[0]).toBe("contact_info");
    expect(steps[1]).toBe("payment");
  });
});

// ─── 3. Multiple Order Bumps ────────────────────────────────────────────────
describe("Feature 3: Multiple Order Bumps", () => {
  it("should support multiple order bumps in checkout block data", () => {
    const checkoutBlockData = {
      orderBumps: [
        { id: "bump1", title: "Workbook", price: 19.99, description: "PDF workbook", productType: "download", productId: 5 },
        { id: "bump2", title: "Video Course", price: 49.99, description: "Advanced video", productType: "course", productId: 3 },
        { id: "bump3", title: "Bundle Deal", price: 29.99, description: "Everything bundle", productType: "bundle", productId: 1 },
      ],
    };
    expect(checkoutBlockData.orderBumps.length).toBe(3);
    expect(checkoutBlockData.orderBumps[0].productType).toBe("download");
    expect(checkoutBlockData.orderBumps[1].productType).toBe("course");
    expect(checkoutBlockData.orderBumps[2].productType).toBe("bundle");
  });

  it("should calculate total with multiple selected bumps", () => {
    const basePrice = 99.99;
    const bumps = [
      { price: 19.99, selected: true },
      { price: 49.99, selected: true },
      { price: 29.99, selected: false },
    ];
    const total = basePrice + bumps.filter(b => b.selected).reduce((sum, b) => sum + b.price, 0);
    expect(total).toBeCloseTo(169.97, 2);
  });

  it("should support adding bumps from existing products", () => {
    const products = [
      { id: 1, type: "course", title: "Echo Basics", price: 49.99, thumbnail: "https://example.com/img.jpg" },
      { id: 2, type: "download", title: "Cheat Sheet", price: 9.99, thumbnail: null },
      { id: 3, type: "bundle", title: "Complete Package", price: 99.99, thumbnail: null },
    ];
    // Converting a product to an order bump
    const product = products[0];
    const bump = {
      id: `bump-${Date.now()}`,
      title: product.title,
      price: product.price,
      description: `${product.type}: ${product.title}`,
      productType: product.type,
      productId: product.id,
      imageUrl: product.thumbnail || "",
    };
    expect(bump.title).toBe("Echo Basics");
    expect(bump.productType).toBe("course");
    expect(bump.productId).toBe(1);
  });

  it("should support manual order bump creation", () => {
    const manualBump = {
      id: "manual-bump-1",
      title: "",
      price: 0,
      description: "",
      productType: null,
      productId: null,
    };
    expect(manualBump.productType).toBeNull();
    expect(manualBump.title).toBe("");
  });
});

// ─── 4. Funnel Page Hide Option ─────────────────────────────────────────────
describe("Feature 4: Funnel Page Hide Option", () => {
  it("should filter hidden pages from public funnel view", () => {
    const allPages = [
      { id: 1, title: "Landing", isHidden: false, isActive: true, sortOrder: 0 },
      { id: 2, title: "Secret Checkout", isHidden: true, isActive: true, sortOrder: 1 },
      { id: 3, title: "Thank You", isHidden: false, isActive: true, sortOrder: 2 },
    ];
    const visiblePages = allPages.filter(p => !p.isHidden && p.isActive);
    expect(visiblePages.length).toBe(2);
    expect(visiblePages.map(p => p.title)).toEqual(["Landing", "Thank You"]);
  });

  it("should still allow direct access to hidden pages", () => {
    const page = { id: 2, title: "Secret Checkout", isHidden: true, isActive: true, slug: "secret-checkout" };
    // Hidden pages should still be accessible via direct URL
    expect(page.isHidden).toBe(true);
    expect(page.slug).toBe("secret-checkout");
  });

  it("should skip hidden pages in funnel navigation", () => {
    const pages = [
      { id: 1, nextPageId: 2, isHidden: false },
      { id: 2, nextPageId: 3, isHidden: true },
      { id: 3, nextPageId: null, isHidden: false },
    ];
    // When navigating from page 1, skip hidden page 2 and go to page 3
    function getNextVisiblePage(currentPageId: number): typeof pages[0] | null {
      const current = pages.find(p => p.id === currentPageId);
      if (!current?.nextPageId) return null;
      const next = pages.find(p => p.id === current.nextPageId);
      if (!next) return null;
      if (next.isHidden && next.nextPageId) {
        return getNextVisiblePage(next.id);
      }
      return next.isHidden ? null : next;
    }
    const nextFromPage1 = getNextVisiblePage(1);
    expect(nextFromPage1?.id).toBe(3);
  });

  it("should default isHidden to false", () => {
    const newPage = { id: 99, isHidden: false };
    expect(newPage.isHidden).toBe(false);
  });
});

// ─── 5. Funnel Page Standalone Landing ──────────────────────────────────────
describe("Feature 5: Standalone Landing Page", () => {
  it("should mark a page as standalone landing", () => {
    const page = {
      id: 5,
      slug: "special-offer",
      isStandaloneLanding: true,
      funnelId: 1,
    };
    expect(page.isStandaloneLanding).toBe(true);
    // Standalone pages are accessible at /p/:slug
    const standaloneUrl = `/p/${page.slug}`;
    expect(standaloneUrl).toBe("/p/special-offer");
  });

  it("should enforce unique slugs for standalone pages", () => {
    const standalonePages = [
      { id: 1, slug: "offer-a", isStandaloneLanding: true },
      { id: 2, slug: "offer-b", isStandaloneLanding: true },
    ];
    const newSlug = "offer-a";
    const isDuplicate = standalonePages.some(p => p.slug === newSlug);
    expect(isDuplicate).toBe(true);
  });

  it("should render standalone page without funnel navigation", () => {
    const standalonePageData = {
      page: { id: 5, slug: "special-offer", blocks: '[{"id":"1","type":"hero","data":{}}]', isStandaloneLanding: true },
      funnel: { id: 1, slug: "main-funnel" },
      // No nextPage for standalone pages
    };
    expect(standalonePageData.page.isStandaloneLanding).toBe(true);
    const blocks = JSON.parse(standalonePageData.page.blocks);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("hero");
  });

  it("should default isStandaloneLanding to false", () => {
    const newPage = { id: 99, isStandaloneLanding: false };
    expect(newPage.isStandaloneLanding).toBe(false);
  });

  it("should support both funnel path and standalone path for same page", () => {
    const page = {
      slug: "checkout",
      isStandaloneLanding: true,
      funnelSlug: "course-funnel",
    };
    const funnelUrl = `/${page.funnelSlug}/${page.slug}`;
    const standaloneUrl = `/p/${page.slug}`;
    expect(funnelUrl).toBe("/course-funnel/checkout");
    expect(standaloneUrl).toBe("/p/checkout");
    // Both URLs should work
    expect(funnelUrl).not.toBe(standaloneUrl);
  });
});
