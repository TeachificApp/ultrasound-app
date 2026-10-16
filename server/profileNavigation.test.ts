import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("shared signed-in navigation", () => {
  it("keeps Learn as the single destination for learner account choices", async () => {
    const source = await readFile("client/src/components/UnifiedProfileLinks.tsx", "utf8");
    expect(source).toContain('LEARN_APP_URL');
    expect(source).toContain('tab: "content"');
    expect(source).toContain('tab: "subscriptions"');
    expect(source).toContain("My Dashboard");
    expect(source).toContain("My Content");
    expect(source).toContain("My Subscriptions");
  });

  it("uses one profile-navigation source in the Learn, app, member, and Expo headers", async () => {
    const [appLayout, learnLayout, membersLayout, ultrasoundExpo, echoExpo] = await Promise.all([
      readFile("client/src/components/Layout.tsx", "utf8"),
      readFile("client/src/components/LMSLayout.tsx", "utf8"),
      readFile("client/src/components/MembersLayout.tsx", "utf8"),
      readFile("client/src/pages/UltrasoundExpoSite.tsx", "utf8"),
      readFile("client/src/pages/EchoExpoSite.tsx", "utf8"),
    ]);
    expect(appLayout).toContain("<UnifiedProfileLinks");
    expect(learnLayout).toContain("<UnifiedProfileLinks");
    expect(membersLayout).toContain("<UnifiedProfileLinks");
    expect(ultrasoundExpo).toContain("<ExpoAccountMenu");
    expect(ultrasoundExpo).toContain("<ExpoMobileAccountLinks");
    expect(echoExpo).toContain("<ExpoAccountMenu");
    expect(echoExpo).toContain("<ExpoMobileAccountLinks");
  });

  it("shows the event dashboard only to an event registrant, partner, or platform administrator", async () => {
    const source = await readFile("client/src/components/UnifiedProfileLinks.tsx", "utf8");
    expect(source).toContain("registrations.data?.length");
    expect(source).toContain("partnerAccess.data?.approved?.ultrasoundExpo");
    expect(source).toContain('href="https://ultrasoundexpo.com/expo-dashboard"');
  });
});
