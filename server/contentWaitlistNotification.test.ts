import { describe, it, expect } from "vitest";
import { buildContentWaitlistAdminNotification } from "./lib/contentWaitlistNotification";
import { DEFAULT_PLATFORM_ADMIN_EMAIL } from "../shared/platformAdminEmail";

describe("content waitlist admin notification", () => {
  it("routes a new signup to the platform admin inbox", () => {
    const message = buildContentWaitlistAdminNotification({
      title: "Adult Echo Workshop",
      productType: "workshop_instance",
      name: "Avery Sonographer",
      email: "avery@example.com",
    });
    expect(message.to.email).toBe(DEFAULT_PLATFORM_ADMIN_EMAIL);
    expect(message.subject).toContain("Adult Echo Workshop");
    expect(message.htmlBody).toContain("Avery Sonographer");
    expect(message.htmlBody).toContain("avery@example.com");
  });
});
