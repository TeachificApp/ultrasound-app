import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrintifyConfigured,
  splitFullName,
  listShops,
  createOrder,
} from "./printify";

describe("printify helpers", () => {
  it("splitFullName handles empty and multi-part names", () => {
    expect(splitFullName(null)).toEqual({ first: "Customer", last: "." });
    expect(splitFullName("Alex")).toEqual({ first: "Alex", last: "." });
    expect(splitFullName("Alex Smith")).toEqual({ first: "Alex", last: "Smith" });
    expect(splitFullName("Mary Jane Watson")).toEqual({ first: "Mary", last: "Jane Watson" });
  });

  it("isPrintifyConfigured reflects env token", () => {
    const original = process.env.PRINTIFY_API_TOKEN;
    process.env.PRINTIFY_API_TOKEN = "";
    expect(isPrintifyConfigured()).toBe(false);
    process.env.PRINTIFY_API_TOKEN = "pf_token";
    expect(isPrintifyConfigured()).toBe(true);
    process.env.PRINTIFY_API_TOKEN = original;
  });
});

describe("printify API client", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.PRINTIFY_API_TOKEN;

  beforeEach(() => {
    process.env.PRINTIFY_API_TOKEN = "pf_test_token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PRINTIFY_API_TOKEN = originalToken;
    vi.restoreAllMocks();
  });

  it("sends bearer auth for shop list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: 1, title: "Test Shop", sales_channel: "shopify" }]),
    });
    global.fetch = fetchMock as typeof fetch;

    const shops = await listShops();
    expect(shops).toHaveLength(1);
    expect(shops[0]?.title).toBe("Test Shop");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.printify.com/v1/shops.json");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pf_test_token");
  });

  it("posts order payload to shop orders endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "pf-order-1", status: "pending" }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await createOrder(5544447, {
      external_id: "aaus-ppo-99",
      line_items: [{ product_id: "abc", variant_id: 12345, quantity: 1 }],
      shipping_method: 1,
      address_to: {
        first_name: "Alex",
        last_name: "Smith",
        email: "alex@example.com",
        phone: "0000000000",
        country: "US",
        region: "MA",
        address1: "1 Main St",
        city: "Boston",
        zip: "02108",
      },
    });

    expect(result.id).toBe("pf-order-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.printify.com/v1/shops/5544447/orders.json");
    const body = JSON.parse(String(init.body));
    expect(body.external_id).toBe("aaus-ppo-99");
    expect(body.line_items[0].variant_id).toBe(12345);
  });

  it("throws on API errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    }) as typeof fetch;

    await expect(listShops()).rejects.toThrow(/Unauthorized/i);
  });
});

describe("Printify live connection", () => {
  it.skipIf(!process.env.PRINTIFY_API_TOKEN?.trim())(
    "authenticates when PRINTIFY_API_TOKEN is set",
    async () => {
      const shops = await listShops();
      expect(Array.isArray(shops)).toBe(true);
    },
  );
});
