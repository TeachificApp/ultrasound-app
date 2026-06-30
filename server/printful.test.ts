import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrintfulConfigured,
  retailPriceToCents,
  splitFullName,
  listStores,
  createOrder,
} from "./printful";

describe("printful helpers", () => {
  it("splitFullName handles empty and multi-part names", () => {
    expect(splitFullName(null)).toEqual({ first: "Customer", last: "." });
    expect(splitFullName("Alex Smith")).toEqual({ first: "Alex", last: "Smith" });
  });

  it("retailPriceToCents converts dollar strings", () => {
    expect(retailPriceToCents("15.99")).toBe(1599);
    expect(retailPriceToCents(null)).toBe(0);
  });

  it("isPrintfulConfigured reflects env key", () => {
    const original = process.env.PRINTFUL_API_KEY;
    process.env.PRINTFUL_API_KEY = "";
    expect(isPrintfulConfigured()).toBe(false);
    process.env.PRINTFUL_API_KEY = "pf_key";
    expect(isPrintfulConfigured()).toBe(true);
    process.env.PRINTFUL_API_KEY = original;
  });
});

describe("printful API client", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PRINTFUL_API_KEY;

  beforeEach(() => {
    process.env.PRINTFUL_API_KEY = "pf_test_key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PRINTFUL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("sends bearer auth for store list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 200, result: [{ id: 1, name: "Test Store", type: "native" }] }),
    });
    global.fetch = fetchMock as typeof fetch;

    const stores = await listStores();
    expect(stores[0]?.name).toBe("Test Store");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.printful.com/stores");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pf_test_key");
  });

  it("posts confirmed order payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 200, result: { id: 99, status: "pending" } }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await createOrder(
      18405098,
      {
        external_id: "aaus-ppo-1",
        shipping: "STANDARD",
        recipient: {
          name: "Alex Smith",
          address1: "1 Main St",
          city: "Boston",
          country_code: "US",
          zip: "02108",
        },
        items: [{ sync_variant_id: 5376720312, quantity: 1, retail_price: "15.99" }],
      },
      true,
    );

    expect(result.id).toBe(99);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.printful.com/orders?confirm=true");
    expect((init.headers as Record<string, string>)["X-PF-Store-Id"]).toBe("18405098");
    const body = JSON.parse(String(init.body));
    expect(body.external_id).toBe("aaus-ppo-1");
  });

  it("throws on API errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 401, error: { message: "Unauthorized" } }),
    }) as typeof fetch;

    await expect(listStores()).rejects.toThrow(/Unauthorized/i);
  });
});

describe("Printful live connection", () => {
  it.skipIf(!process.env.PRINTFUL_API_KEY?.trim())(
    "authenticates when PRINTFUL_API_KEY is set",
    async () => {
      const stores = await listStores();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThan(0);
    },
  );
});
