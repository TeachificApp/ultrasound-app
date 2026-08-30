import { describe, expect, it } from "vitest";
import { resolveEmailListMembershipAction } from "./lib/emailListHelper";

describe("email list membership policy", () => {
  it("inserts a newsletter subscriber once and only updates active contacts with better identity data", () => {
    expect(resolveEmailListMembershipAction(undefined, true)).toBe("insert");
    expect(resolveEmailListMembershipAction("subscribed", false)).toBe("skip");
    expect(resolveEmailListMembershipAction("subscribed", true)).toBe("update");
  });

  it("preserves an opt-out unless the subscriber explicitly re-subscribes", () => {
    expect(resolveEmailListMembershipAction("unsubscribed", true)).toBe("skip");
    expect(resolveEmailListMembershipAction("unsubscribed", true, true)).toBe("reactivate");
  });
});
