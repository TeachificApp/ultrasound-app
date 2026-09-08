import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureTransactionalEmailDelivery } from "./lib/ensureTransactionalEmailDelivery";

vi.mock("./lib/sendgridSuppressions", () => ({
  getSendGridSuppressionStatus: vi.fn(),
  isSendGridDeliveryBlocked: vi.fn(),
  clearSendGridSuppressionLists: vi.fn(),
}));

vi.mock("./lib/email/providerConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/email/providerConfig")>();
  return {
    ...actual,
    isSendGridProvider: vi.fn(() => true),
  };
});

import {
  getSendGridSuppressionStatus,
  isSendGridDeliveryBlocked,
  clearSendGridSuppressionLists,
} from "./lib/sendgridSuppressions";
import { isSendGridProvider } from "./lib/email/providerConfig";

describe("ensureTransactionalEmailDelivery", () => {
  beforeEach(() => {
    vi.mocked(getSendGridSuppressionStatus).mockReset();
    vi.mocked(isSendGridDeliveryBlocked).mockReset();
    vi.mocked(clearSendGridSuppressionLists).mockReset();
    vi.mocked(isSendGridProvider).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips SendGrid suppression checks when provider is not sendgrid", async () => {
    vi.mocked(isSendGridProvider).mockReturnValue(false);
    const result = await ensureTransactionalEmailDelivery("user@example.com");
    expect(result.cleared).toBe(false);
    expect(getSendGridSuppressionStatus).not.toHaveBeenCalled();
    expect(clearSendGridSuppressionLists).not.toHaveBeenCalled();
  });

  it("skips clearing when SendGrid is not blocking delivery", async () => {
    const clean = {
      global_unsubscribe: false,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    };
    vi.mocked(getSendGridSuppressionStatus).mockResolvedValue(clean);
    vi.mocked(isSendGridDeliveryBlocked).mockReturnValue(false);

    const result = await ensureTransactionalEmailDelivery("user@example.com");
    expect(result.cleared).toBe(false);
    expect(clearSendGridSuppressionLists).not.toHaveBeenCalled();
  });

  it("clears suppressions when delivery is blocked", async () => {
    const blocked = {
      global_unsubscribe: true,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    };
    const clean = {
      global_unsubscribe: false,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    };
    vi.mocked(getSendGridSuppressionStatus)
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(clean);
    vi.mocked(isSendGridDeliveryBlocked)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const result = await ensureTransactionalEmailDelivery("user@example.com");
    expect(result.cleared).toBe(true);
    expect(clearSendGridSuppressionLists).toHaveBeenCalledWith("user@example.com");
    expect(result.after.global_unsubscribe).toBe(false);
  });
});
