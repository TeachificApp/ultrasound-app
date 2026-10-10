import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const brandMembershipRouter = source("server/routers/brandMembershipRouter.ts");
const premiumPage = source("client/src/pages/Premium.tsx");
const brandWebhook = source("server/webhooks/stripe.ts");

describe("guest app Premium checkout", () => {
  it("offers a public checkout endpoint that collects the buyer's intended identity", () => {
    expect(brandMembershipRouter).toContain("createGuestCheckout: publicProcedure");
    expect(brandMembershipRouter).toContain('name: z.string().trim().min(1).max(200)');
    expect(brandMembershipRouter).toContain('email: z.string().trim().email()');
    expect(brandMembershipRouter).toContain("customer_email: email");
    expect(brandMembershipRouter).toContain("customer_name: name");
  });

  it("does not require a local sign-in or provision an account before payment", () => {
    expect(brandMembershipRouter).toContain("We deliberately do not provision a local account before a payment completes");
    expect(brandMembershipRouter).not.toContain("getOrCreateUserByEmail");
    expect(brandMembershipRouter).toContain("...(existingUserId ? { client_reference_id: String(existingUserId) } : {})");
  });

  it("keeps post-payment account creation and entitlement grant in the verified Stripe webhook", () => {
    expect(brandWebhook).toContain("handleBrandMembershipCheckoutCompleted");
    expect(brandWebhook).toContain("getOrCreateUserByEmail");
    expect(brandWebhook).toContain("Brand membership: welcome email sent to new user");
    expect(brandWebhook).toContain("handleDualMembershipCheckoutCompleted");
  });

  it("replaces anonymous sign-in gates with an account-free Premium checkout form", () => {
    expect(premiumPage).toContain("Start Premium — no sign-in required");
    expect(premiumPage).toContain("trpc.brandMembership.createGuestCheckout.useMutation");
    expect(premiumPage).toContain("You do not need to sign in first.");
    expect(premiumPage).not.toContain("function SignInBtn()");
  });
});
