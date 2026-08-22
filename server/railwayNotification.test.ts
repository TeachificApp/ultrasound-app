import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Railway-compatible administrator notifications", () => {
  it("uses local logging and configured email without calling the Manus notification endpoint", async () => {
    const source = await readFile(new URL("./_core/notification.ts", import.meta.url), "utf8");
    expect(source).toContain("sendAdminAlert(title, content)");
    expect(source).toContain("logAdminNotification({ title, content, source: \"system\" })");
    expect(source).not.toContain("WebDevService/SendNotification");
    expect(source).not.toContain("forgeApiUrl");
    expect(source).not.toContain("forgeApiKey");
  });
});
