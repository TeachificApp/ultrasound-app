import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

describe("reusable revenue partner Stripe setup link", () => {
  it("routes the clear public URL to the existing secure Stripe setup screen", () => {
    const app = readProjectFile("../client/src/App.tsx");

    expect(app).toContain('path="/revenue-partner/stripe-setup"');
    expect(app).toContain("<PartnerSignup />");
  });

  it("preserves the allowlist protection for new partners while allowing existing partners to resume", () => {
    const router = readProjectFile("./routers/revenueShareRouter.ts");

    expect(router).toContain("const [existing] = await db");
    expect(router).toContain("if (!existing && !allowed)");
    expect(router).toMatch(/public URL\s+\/\/ cannot create arbitrary Stripe Connect accounts/);
    expect(router).toContain("if (!stripeAccountId)");
    expect(router).toContain("createStripeConnectAccount");
  });

  it("returns Stripe to the same stable setup route after completion or refresh", () => {
    const router = readProjectFile("./routers/revenueShareRouter.ts");

    expect(router).toContain(
      "`${baseUrl}/revenue-partner/stripe-setup?status=complete`"
    );
    expect(router).toContain(
      "`${baseUrl}/revenue-partner/stripe-setup?status=refresh`"
    );
  });

  it("shows and copies the reusable URL from Revenue Share administration", () => {
    const admin = readProjectFile(
      "../client/src/pages/admin/RevenueShareAdmin.tsx"
    );

    expect(admin).toContain(
      'const genericSetupUrl = "https://learn.allaboutultrasound.com/revenue-partner/stripe-setup"'
    );
    expect(admin).toContain("Reusable Revenue Partner Stripe Setup Link");
    expect(admin).toContain("copyGenericSetupLink");
  });

  it("identifies the public page as Stripe setup without exposing it in navigation", () => {
    const page = readProjectFile("../client/src/pages/PartnerSignup.tsx");

    expect(page).toContain("Revenue Partner Stripe Setup");
    expect(page).toContain("Continue to Stripe Setup");
    expect(page).toContain("For approved revenue partners.");
  });
});
