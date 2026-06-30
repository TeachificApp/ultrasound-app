import { describe, it, expect, vi, beforeEach } from "vitest";
import { importShopifyProductRecord } from "./importShopifyProduct";
import type { ShopifyProductSummary } from "../shopify";

const shopifyProduct: ShopifyProductSummary = {
  id: "gid://shopify/Product/123",
  numericId: "123",
  title: "Ultrasound Workbook",
  handle: "ultrasound-workbook",
  url: "https://demo.com/products/ultrasound-workbook",
  imageUrl: "https://cdn.shopify.com/workbook.jpg",
  priceAmount: "29.99",
  priceCurrency: "USD",
  descriptionHtml: "<p>Great book</p>",
};

function createMockDb(existing: { id: number; slug: string; title: string } | null = null) {
  const insertResult = { insertId: 99 };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(existing ? [existing] : []),
  };
  return {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([insertResult]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
}

describe("importShopifyProductRecord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SHOPIFY_STORE_DOMAIN = "demo.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpss_demo_token";
    delete process.env.SHOPIFY_STORE_DOMAIN_2;
    delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2;
    delete process.env.SHOPIFY_STORES;
  });

  it("skips when product already imported", async () => {
    const db = createMockDb({ id: 5, slug: "ultrasound-workbook", title: "Ultrasound Workbook" });
    const result = await importShopifyProductRecord(db as any, "default", shopifyProduct);
    expect(result.action).toBe("skipped");
    expect(result.productId).toBe(5);
    expect(result.reason).toBe("already_imported");
  });

  it("creates a draft physical product from Shopify data", async () => {
    const db = createMockDb(null);
    const result = await importShopifyProductRecord(db as any, "default", shopifyProduct);
    expect(result.action).toBe("created");
    expect(result.productId).toBe(99);
    expect(result.slug).toBe("ultrasound-workbook");
    expect(db.insert).toHaveBeenCalled();
    const values = db.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(values.price).toBe(2999);
    expect(values.checkoutMode).toBe("shopify");
    expect(values.shopifyProductId).toBe("123");
    expect(values.status).toBe("draft");
  });

  it("can publish on import", async () => {
    const db = createMockDb(null);
    const result = await importShopifyProductRecord(db as any, "default", shopifyProduct, { publish: true });
    expect(result.action).toBe("created");
    const values = db.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(values.status).toBe("published");
  });
});
