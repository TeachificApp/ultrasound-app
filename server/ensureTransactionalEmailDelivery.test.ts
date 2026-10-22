import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureTransactionalEmailDelivery } from "./lib/ensureTransactionalEmailDelivery";

vi.mock("./lib/sendgridSuppressions", () => ({
  getSendGridSuppressionStatus: vi.fn(),
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
  clearSendGridSuppressionLists,
} from "./lib/sendgridSuppressions";
import { isSendGridProvider } from "./lib/email/providerConfig";

describe("ensureTransactionalEmailDelivery", () => {
  beforeEach(() => {
    vi.mocked(getSendGridSuppressionStatus).mockReset();
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

  it("reports a clean provider state without clearing any preferences", async () => {
    const clean = {
      global_unsubscribe: false,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    };
    vi.mocked(getSendGridSuppressionStatus).mockResolvedValue(clean);

    const result = await ensureTransactionalEmailDelivery("user@example.com");
    expect(result.cleared).toBe(false);
    expect(clearSendGridSuppressionLists).not.toHaveBeenCalled();
  });

  it("preserves a marketing suppression because the provider bypasses it for transactional email", async () => {
    const blocked = {
      global_unsubscribe: true,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    };
    vi.mocked(getSendGridSuppressionStatus).mockResolvedValue(blocked);

    const result = await ensureTransactionalEmailDelivery("user@example.com");
    expect(result.cleared).toBe(false);
    expect(clearSendGridSuppressionLists).not.toHaveBeenCalled();
    expect(result.after.global_unsubscribe).toBe(true);
  });
});
