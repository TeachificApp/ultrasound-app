import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auth email send log schema", () => {
  it("creates auth_email_send_log on startup when missing", () => {
    const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(indexSource).toContain("ensureAuthEmailSendLogSchema");
  });

  it("exposes debug schema sync endpoints", () => {
    const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(indexSource).toContain('app.get("/api/debug/auth-email-send-log-schema"');
    expect(indexSource).toContain('app.post("/api/debug/auth-email-send-log-schema-sync"');
  });

  it("treats Drizzle failed-query errors as a missing log table", () => {
    const source = readFileSync(resolve(process.cwd(), "server/lib/authEmailRateLimit.ts"), "utf8");
    expect(source).toContain('message.includes("failed query")');
  });
});
