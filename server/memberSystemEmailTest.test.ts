import { describe, expect, it } from "vitest";
import {
  MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL,
  MEMBER_SYSTEM_EMAIL_TEST_TYPES,
  renderMemberSystemEmailTest,
} from "./lib/memberSystemEmailTest";

describe("member system email tests", () => {
  it("renders every supported member template as a clearly marked safe test", async () => {
    for (const type of MEMBER_SYSTEM_EMAIL_TEST_TYPES) {
      const rendered = await renderMemberSystemEmailTest({
        type,
        memberFirstName: "Taylor",
        brandMode: "combined",
      });

      expect(rendered.subject).toMatch(/^\[TEST\] /);
      expect(rendered.htmlBody).toContain("TEST EMAIL");
      expect(rendered.htmlBody).toContain("Taylor");
      expect(rendered.htmlBody).toContain(MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL);
      expect(rendered.previewText).toMatch(/^\[TEST\] /);

      const webLinks = [...rendered.htmlBody.matchAll(/href="(https?:\/\/[^"\s]+)"/gi)].map((match) => match[1]);
      expect(webLinks.length).toBeGreaterThan(0);
      expect(new Set(webLinks)).toEqual(new Set([MEMBER_SYSTEM_EMAIL_TEST_ACTION_URL]));
    }
  });
});
