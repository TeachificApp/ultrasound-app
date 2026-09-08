import { describe, expect, it } from "vitest";
import { readStorageUrlResponse } from "./storage";

describe("storage URL response parsing", () => {
  it("accepts a JSON response with a durable URL", async () => {
    await expect(
      readStorageUrlResponse(
        new Response(JSON.stringify({ url: "https://media.example.test/question.png" }), { status: 200 }),
        "upload",
      ),
    ).resolves.toBe("https://media.example.test/question.png");
  });

  it("turns an HTML response into a clear storage configuration error", async () => {
    await expect(
      readStorageUrlResponse(new Response("<!DOCTYPE html><html></html>", { status: 200 }), "download URL"),
    ).rejects.toThrow(/unexpected non-JSON response/i);
  });

  it("does not accept a JSON response without a usable URL", async () => {
    await expect(
      readStorageUrlResponse(new Response(JSON.stringify({ ok: true }), { status: 200 }), "upload"),
    ).rejects.toThrow(/usable file URL/i);
  });
});
