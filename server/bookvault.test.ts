import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildDocRef,
  createOrder,
  normalizeIsbn,
  testConnection,
} from "./bookvault";

describe("bookvault helpers", () => {
  it("normalizes ISBN formatting", () => {
    expect(normalizeIsbn("978-0-123456-78-9")).toBe("9780123456789");
    expect(normalizeIsbn(null)).toBe("");
  });

  it("builds stable DocRef values", () => {
    expect(buildDocRef(42)).toBe("aaus-ppo-42");
  });
});

describe("bookvault API client", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.BOOKVAULT_API_KEY;

  beforeEach(() => {
    process.env.BOOKVAULT_API_KEY = "bv_test_key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BOOKVAULT_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("sends basic auth and order payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ DocRef: "aaus-ppo-1", PodRef: "BV123", Status: "Received" }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await createOrder({
      DocRef: "aaus-ppo-1",
      Address: {
        Addressee: "Alex Smith",
        Address1: "1 Main St",
        Town: "Boston",
        Postcode: "02108",
        Country: { ISO_Code: "US" },
        Email: "alex@example.com",
      },
      OrderLines: [{ Quantity: 1, ISBN: "9780123456789" }],
    });

    expect(result.PodRef).toBe("BV123");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.bookvault.app/v3/Order");
    expect((init.headers as Record<string, string>).Authorization).toBe("basic bv_test_key");
    const body = JSON.parse(String(init.body));
    expect(body.OrderLines[0].ISBN).toBe("9780123456789");
    expect(body.DispatchRequest.RequestedService).toBe("CheapestTracked");
  });

  it("throws on invalid token responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Invalid Token",
    }) as typeof fetch;

    await expect(testConnection()).rejects.toThrow(/Invalid BookVault API key|Invalid Token/i);
  });
});

describe("BookVault live connection", () => {
  it.skipIf(!process.env.BOOKVAULT_API_KEY?.trim())(
    "authenticates when BOOKVAULT_API_KEY is set",
    async () => {
      const apiKey = process.env.BOOKVAULT_API_KEY!.trim();
      const res = await fetch("https://api.bookvault.app/v3/Account", {
        headers: { Authorization: `basic ${apiKey.startsWith("bv_") ? apiKey : `bv_${apiKey}`}` },
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.toLowerCase()).not.toContain("invalid token");
    },
  );
});
