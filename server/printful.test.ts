import { describe, it, expect } from "vitest";

describe("Printful API key validation", () => {
  it("should authenticate with Printful API", async () => {
    const apiKey = process.env.PRINTFUL_API_KEY;
    expect(apiKey, "PRINTFUL_API_KEY must be set").toBeTruthy();

    const res = await fetch("https://api.printful.com/store", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(res.status, `Expected 200 but got ${res.status}`).toBe(200);
    const data = (await res.json()) as { code: number; result?: { id: number; name: string } };
    expect(data.code).toBe(200);
    console.log("[Printful] Connected to store:", data.result?.name ?? "(unknown)");
  });
});
