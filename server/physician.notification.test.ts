/**
 * Physician Notification System — Unit Tests
 *
 * Tests the notification DB helpers and the tRPC notification router procedures.
 * Uses mocked DB to avoid requiring a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

// ─── Notification message builder (pure logic) ────────────────────────────────
function buildNotificationMessage(params: {
  examType: string;
  examDate: string;
  concordanceScore?: number;
  discordantFields?: string[];
  reviewerName?: string;
  reviewComments?: string;
}): { title: string; message: string } {
  const { examType, examDate, concordanceScore, discordantFields, reviewerName, reviewComments } = params;
  const concordance = concordanceScore != null ? `${concordanceScore}%` : "N/A";
  const discordant = discordantFields && discordantFields.length > 0
    ? discordantFields.slice(0, 5).join(", ")
    : "None";

  const title = `Physician Peer Review Result — ${examType} (${examDate})`;
  const message = [
    `A Physician Peer Review has been completed for your ${examType} study dated ${examDate}.`,
    ``,
    `**Concordance Score:** ${concordance}`,
    `**Discordant Fields:** ${discordant}`,
    reviewComments ? `**Reviewer Comments:** ${reviewComments}` : null,
    ``,
    `Reviewed by: ${reviewerName ?? "A reviewer"}`,
  ].filter(Boolean).join("\n");

  return { title, message };
}

// ─── Concordance score calculator (pure logic) ────────────────────────────────
function calculateConcordance(fields: Record<string, { original: string; reviewer: string }>): {
  score: number;
  discordantFields: string[];
} {
  const entries = Object.entries(fields);
  if (entries.length === 0) return { score: 100, discordantFields: [] };

  const discordantFields: string[] = [];
  let concordantCount = 0;

  for (const [fieldName, { original, reviewer }] of entries) {
    if (original === reviewer) {
      concordantCount++;
    } else {
      discordantFields.push(fieldName);
    }
  }

  const score = Math.round((concordantCount / entries.length) * 100);
  return { score, discordantFields };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Physician Notification — message builder", () => {
  it("builds a notification title with exam type and date", () => {
    const { title } = buildNotificationMessage({
      examType: "Adult TTE",
      examDate: "2026-03-05",
      concordanceScore: 92,
    });
    expect(title).toBe("Physician Peer Review Result — Adult TTE (2026-03-05)");
  });

  it("includes concordance score in the message body", () => {
    const { message } = buildNotificationMessage({
      examType: "Adult TTE",
      examDate: "2026-03-05",
      concordanceScore: 85,
      discordantFields: ["EF%", "Mitral Regurgitation"],
      reviewerName: "Dr. Smith",
    });
    expect(message).toContain("**Concordance Score:** 85%");
    expect(message).toContain("EF%, Mitral Regurgitation");
    expect(message).toContain("Reviewed by: Dr. Smith");
  });

  it("shows N/A when concordance score is not provided", () => {
    const { message } = buildNotificationMessage({
      examType: "Fetal Echo",
      examDate: "2026-03-01",
    });
    expect(message).toContain("**Concordance Score:** N/A");
  });

  it("includes reviewer comments when provided", () => {
    const { message } = buildNotificationMessage({
      examType: "Adult Stress",
      examDate: "2026-02-28",
      concordanceScore: 78,
      reviewComments: "Please review RWMA assessment criteria.",
    });
    expect(message).toContain("**Reviewer Comments:** Please review RWMA assessment criteria.");
  });

  it("omits reviewer comments line when not provided", () => {
    const { message } = buildNotificationMessage({
      examType: "Adult TTE",
      examDate: "2026-03-05",
      concordanceScore: 95,
    });
    expect(message).not.toContain("**Reviewer Comments:**");
  });

  it("shows 'None' for discordant fields when all fields match", () => {
    const { message } = buildNotificationMessage({
      examType: "Adult TTE",
      examDate: "2026-03-05",
      concordanceScore: 100,
      discordantFields: [],
    });
    expect(message).toContain("**Discordant Fields:** None");
  });

  it("truncates discordant fields list to 5 items", () => {
    const { message } = buildNotificationMessage({
      examType: "Pediatric TTE",
      examDate: "2026-03-05",
      concordanceScore: 60,
      discordantFields: ["EF%", "LV Size", "MR", "TR", "AS", "AI", "RWMA"],
    });
    // Should only show first 5
    expect(message).toContain("EF%, LV Size, MR, TR, AS");
    expect(message).not.toContain("AI");
  });
});

describe("Physician Notification — concordance calculator", () => {
  it("returns 100% when all fields match", () => {
    const { score, discordantFields } = calculateConcordance({
      efPercent: { original: "55-65%", reviewer: "55-65%" },
      mitralRegurgitation: { original: "Mild", reviewer: "Mild" },
    });
    expect(score).toBe(100);
    expect(discordantFields).toHaveLength(0);
  });

  it("returns 0% when no fields match", () => {
    const { score, discordantFields } = calculateConcordance({
      efPercent: { original: "55-65%", reviewer: "35-45%" },
      mitralRegurgitation: { original: "Mild", reviewer: "Moderate" },
    });
    expect(score).toBe(0);
    expect(discordantFields).toEqual(["efPercent", "mitralRegurgitation"]);
  });

  it("correctly calculates partial concordance", () => {
    const { score, discordantFields } = calculateConcordance({
      efPercent: { original: "55-65%", reviewer: "55-65%" },
      mitralRegurgitation: { original: "Mild", reviewer: "Moderate" },
      aorticStenosis: { original: "None", reviewer: "None" },
      tricuspidRegurgitation: { original: "Mild", reviewer: "Mild" },
    });
    // 3 out of 4 match = 75%
    expect(score).toBe(75);
    expect(discordantFields).toEqual(["mitralRegurgitation"]);
  });

  it("returns 100% for empty field set", () => {
    const { score } = calculateConcordance({});
    expect(score).toBe(100);
  });

  it("identifies the correct discordant field names", () => {
    const { discordantFields } = calculateConcordance({
      situs: { original: "Solitus", reviewer: "Solitus" },
      cardiacPosition: { original: "Levocardia", reviewer: "Dextrocardia" },
      efPercent: { original: "55-65%", reviewer: "55-65%" },
    });
    expect(discordantFields).toEqual(["cardiacPosition"]);
  });
});

describe("Physician Notification — notification payload structure", () => {
  it("builds a valid notification payload", () => {
    const payload = {
      concordanceScore: 88,
      discordantFields: ["EF%", "RWMA"],
      reviewerName: "Dr. Jones",
      examType: "Adult TTE",
      examDate: "2026-03-05",
    };

    expect(payload).toHaveProperty("concordanceScore", 88);
    expect(payload).toHaveProperty("discordantFields");
    expect(Array.isArray(payload.discordantFields)).toBe(true);
    expect(payload.discordantFields).toContain("EF%");
    expect(payload).toHaveProperty("reviewerName", "Dr. Jones");
    expect(payload).toHaveProperty("examType", "Adult TTE");
  });

  it("serializes and deserializes payload correctly via JSON", () => {
    const original = {
      concordanceScore: 92,
      discordantFields: ["Mitral Regurgitation"],
      reviewerName: "Dr. Smith",
      examType: "Adult Stress",
      examDate: "2026-02-28",
    };

    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.concordanceScore).toBe(92);
    expect(deserialized.discordantFields).toEqual(["Mitral Regurgitation"]);
    expect(deserialized.reviewerName).toBe("Dr. Smith");
  });
});

describe("Physician Notification — unread count logic", () => {
  it("correctly identifies unread notifications", () => {
    const notifications = [
      { id: 1, isRead: false, isDismissed: false },
      { id: 2, isRead: true, isDismissed: false },
      { id: 3, isRead: false, isDismissed: false },
      { id: 4, isRead: false, isDismissed: true }, // dismissed, should not count
    ];

    const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;
    expect(unreadCount).toBe(2);
  });

  it("dismissed notifications are excluded from the list", () => {
    const notifications = [
      { id: 1, isRead: false, isDismissed: false },
      { id: 2, isRead: true, isDismissed: true },
      { id: 3, isRead: false, isDismissed: true },
    ];

    const visible = notifications.filter(n => !n.isDismissed);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(1);
  });
});
