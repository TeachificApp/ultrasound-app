import { describe, expect, it } from "vitest";
import { buildContentWaitlistAdminNotification } from "./lib/contentWaitlistNotification";

describe("shared content Waitlist notification", () => {
  it("routes a new signup's name and email to the approved platform administrator", () => {
    const message = buildContentWaitlistAdminNotification({
      title: "Adult Echo Workshop",
      productType: "workshop_instance",
      name: "Avery Sonographer",
      email: "avery@example.com",
    });
    expect(message.to).toBe("admin@allaboutultrasound.com");
    expect(message.subject).toContain("Adult Echo Workshop");
    expect(message.text).toContain("Avery Sonographer");
    expect(message.text).toContain("avery@example.com");
  });
});
