import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AUTH_EMAIL_COOLDOWN_MS,
  AUTH_EMAIL_MAX_PER_ADDRESS_HOUR,
  AUTH_EMAIL_MAX_PER_IP_HOUR,
  normalizeAuthEmailForRateLimit,
} from "../shared/authEmailRateLimit";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}));

describe("auth email rate limit constants", () => {
  it("uses a 5-minute cooldown and hourly caps", () => {
    expect(AUTH_EMAIL_COOLDOWN_MS).toBe(5 * 60 * 1000);
    expect(AUTH_EMAIL_MAX_PER_ADDRESS_HOUR).toBe(3);
    expect(AUTH_EMAIL_MAX_PER_IP_HOUR).toBe(15);
  });

  it("normalizes email addresses", () => {
    expect(normalizeAuthEmailForRateLimit("  Lara@Example.COM ")).toBe("lara@example.com");
  });
});

describe("checkAuthEmailRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);
  });

  it("blocks when the hourly per-address cap is reached", async () => {
    mockWhere
      .mockResolvedValueOnce([{ count: AUTH_EMAIL_MAX_PER_ADDRESS_HOUR }]);

    const { checkAuthEmailRateLimit } = await import("./lib/authEmailRateLimit");
    const result = await checkAuthEmailRateLimit({
      email: "user@example.com",
      type: "magic_link",
      ipAddress: "1.2.3.4",
    });
    expect(result).toEqual({ allowed: false, reason: "email_hourly" });
  });

  it("blocks repeat sends inside the cooldown window", async () => {
    mockWhere
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const { checkAuthEmailRateLimit } = await import("./lib/authEmailRateLimit");
    const result = await checkAuthEmailRateLimit({
      email: "user@example.com",
      type: "password_reset",
      ipAddress: "1.2.3.4",
    });
    expect(result).toEqual({ allowed: false, reason: "cooldown" });
  });

  it("allows the first send for an address and IP", async () => {
    mockWhere
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const { checkAuthEmailRateLimit } = await import("./lib/authEmailRateLimit");
    const result = await checkAuthEmailRateLimit({
      email: "user@example.com",
      type: "magic_link",
      ipAddress: "1.2.3.4",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("allows sends when Drizzle wraps a missing auth_email_send_log table error", async () => {
    mockWhere.mockRejectedValueOnce(
      new Error(
        "Failed query: select count(*) from `auth_email_send_log` where (`auth_email_send_log`.`email` = ?)",
      ),
    );

    const { checkAuthEmailRateLimit } = await import("./lib/authEmailRateLimit");
    const result = await checkAuthEmailRateLimit({
      email: "user@example.com",
      type: "magic_link",
      ipAddress: "1.2.3.4",
    });
    expect(result).toEqual({ allowed: true });
  });
});
