import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("transactional email policy", () => {
  const source = (relativePath: string) =>
    readFileSync(resolve(process.cwd(), relativePath), "utf8");

  it("classifies service messages as transactional unless they deliberately identify a campaign", () => {
    const emailSource = source("server/_core/email.ts");
    expect(emailSource).toContain("transactional: opts.transactional ?? !(opts.listUnsubscribeUrl || opts.campaignId)");
  });

  it("does not allow campaign opt-outs to create a global provider suppression", () => {
    expect(source("server/routes/unsubscribe.ts")).not.toContain("addToSendGridGlobalUnsubscribes");
    expect(source("server/lib/campaignUnsubscribe.ts")).not.toContain("addToSendGridGlobalUnsubscribes");
    expect(source("server/routers/emailCampaignRouter.ts")).not.toContain("addToSendGridGlobalUnsubscribes");
  });

  it("keeps opted-out recipients excluded from campaign audiences", () => {
    const resolverSource = source("server/lib/emailCampaignAudienceResolver.ts");
    expect(resolverSource).toContain("if (user?.unsubscribedAt) continue");
    expect(resolverSource).toContain("if (user?.unsubscribedAt) base.delete(email)");
  });
});
