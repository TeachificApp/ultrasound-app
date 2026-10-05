import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

describe("auth email debug endpoint hardening", () => {
  it("requires debug authorization before exposing transactional provider status", () => {
    expect(indexSource).toContain('app.get("/api/debug/email-status", async (req, res) => {');
    expect(indexSource).toContain('if (denyUnlessDebugAuthorized(req, res)) return;');
  });

  it("requires debug authorization before sending password reset or magic link test emails", () => {
    expect(indexSource).toContain('app.get("/api/debug/test-password-reset"');
    expect(indexSource).toContain('app.get("/api/debug/test-magic-link"');
    expect(indexSource).toContain("denyUnlessDebugAuthorized");
  });
});
