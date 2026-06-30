import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getShopifyStores,
  listProducts,
  parseShopifyProductGid,
  testStoreConnection,
} from "./shopify";

describe("shopify helpers", () => {
  it("parses Shopify product GIDs", () => {
    expect(parseShopifyProductGid("gid://shopify/Product/7891234567890")).toBe("7891234567890");
    expect(parseShopifyProductGid("7891234567890")).toBe("7891234567890");
  });

  it("loads numbered store env vars", () => {
    const prev = {
      SHOPIFY_STORES: process.env.SHOPIFY_STORES,
      SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      SHOPIFY_STORE_DOMAIN_2: process.env.SHOPIFY_STORE_DOMAIN_2,
      SHOPIFY_STOREFRONT_ACCESS_TOKEN_2: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2,
    };

    delete process.env.SHOPIFY_STORES;
    process.env.SHOPIFY_STORE_DOMAIN = "primary.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpua_primary";
    process.env.SHOPIFY_STORE_DOMAIN_2 = "secondary.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2 = "shpss_secondary";

    const stores = getShopifyStores();
    expect(stores).toHaveLength(2);
    expect(stores[0]?.key).toBe("default");
    expect(stores[1]?.key).toBe("store2");
    expect(stores[1]?.token).toBe("shpss_secondary");

    Object.assign(process.env, prev);
  });
});

describe("shopify API client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.SHOPIFY_STORES;
    process.env.SHOPIFY_STORE_DOMAIN = "demo.myshopify.com";
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpss_demo_token";
    delete process.env.SHOPIFY_STORE_DOMAIN_2;
    delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN_2;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses private storefront token header for shpss tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          shop: { name: "Demo Shop" },
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await testStoreConnection("default");
    expect(result.shopName).toBe("Demo Shop");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Shopify-Storefront-Private-Token"]).toBe("shpss_demo_token");
  });

  it("maps product list results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          products: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{
              node: {
                id: "gid://shopify/Product/123",
                title: "Workbook",
                handle: "workbook",
                onlineStoreUrl: "https://demo.com/products/workbook",
                description: "<p>Details</p>",
                featuredImage: { url: "https://cdn.shopify.com/image.jpg" },
                priceRange: { minVariantPrice: { amount: "29.00", currencyCode: "USD" } },
              },
            }],
          },
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await listProducts("default", 10);
    expect(result.products[0]?.numericId).toBe("123");
    expect(result.products[0]?.title).toBe("Workbook");
    expect(result.products[0]?.url).toBe("https://demo.com/products/workbook");
  });
});
