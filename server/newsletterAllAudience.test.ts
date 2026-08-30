import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("newsletter All Contacts synchronization", () => {
  const routerSource = readFileSync(resolve(import.meta.dirname, "routers/newsletterRouter.ts"), "utf8");
  const helperSource = readFileSync(resolve(import.meta.dirname, "lib/emailListHelper.ts"), "utf8");

  it("reconciles new, active, and explicitly re-subscribed newsletter contacts to All Contacts", () => {
    expect(routerSource).toContain('source: "newsletter_subscribe"');
    expect(routerSource).toContain('resubscribe: true');
    expect(helperSource).toContain("newsletterSubscribers.isActive, 1");
  });

  it("keeps newsletter opt-outs out of campaign audiences until an explicit re-subscription", () => {
    expect(routerSource).toContain("await unsubscribeFromAllContacts(row.email)");
    expect(routerSource).toContain("await unsubscribeFromAllContacts(email)");
    expect(helperSource).toContain('existingStatus === "unsubscribed"');
    expect(helperSource).toContain('return resubscribe ? "reactivate" : "skip"');
  });
});
