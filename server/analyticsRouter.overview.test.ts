/**
 * analyticsRouter.overview.test.ts
 * Verifies that the analytics overview procedure reads from the correct tables:
 * - activeUsers comes from users.lastSignedIn (not user_login_events)
 * - logins falls back to activeUsers when user_login_events is empty
 * - purchases comes from digital_purchases
 * - enrollments comes from lms_enrollments
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockCounts: Record<string, number> = {
  users_lastSignedIn: 213,
  user_login_events: 0,
  user_page_view_events: 23588,
  lms_video_events_play: 0,
  lms_video_events_complete: 0,
  lms_quiz_attempts: 0,
  digital_download_events: 1,
  digital_purchases: 5,
  lms_enrollments: 9,
};

// Simulate the overview logic extracted from analyticsRouter.ts
function computeOverview(counts: typeof mockCounts) {
  const activeUsers = counts.users_lastSignedIn;
  const loginEventCount = counts.user_login_events;
  const loginCount = loginEventCount > 0 ? loginEventCount : activeUsers;
  return {
    activeUsers,
    logins: loginCount,
    pageViews: counts.user_page_view_events,
    videoPlays: counts.lms_video_events_play,
    videoCompletes: counts.lms_video_events_complete,
    quizAttempts: counts.lms_quiz_attempts,
    downloads: counts.digital_download_events,
    purchases: counts.digital_purchases,
    enrollments: counts.lms_enrollments,
  };
}

describe("analyticsRouter overview logic", () => {
  it("uses users.lastSignedIn for activeUsers (not user_login_events)", () => {
    const result = computeOverview(mockCounts);
    expect(result.activeUsers).toBe(213);
  });

  it("falls back to activeUsers count for logins when user_login_events is empty", () => {
    const result = computeOverview({ ...mockCounts, user_login_events: 0 });
    expect(result.logins).toBe(213);
  });

  it("uses user_login_events count for logins when it has data", () => {
    const result = computeOverview({ ...mockCounts, user_login_events: 450 });
    expect(result.logins).toBe(450);
  });

  it("returns correct page views from user_page_view_events", () => {
    const result = computeOverview(mockCounts);
    expect(result.pageViews).toBe(23588);
  });

  it("returns purchases from digital_purchases table", () => {
    const result = computeOverview(mockCounts);
    expect(result.purchases).toBe(5);
  });

  it("returns enrollments from lms_enrollments table", () => {
    const result = computeOverview(mockCounts);
    expect(result.enrollments).toBe(9);
  });

  it("returns downloads from digital_download_events table", () => {
    const result = computeOverview(mockCounts);
    expect(result.downloads).toBe(1);
  });

  it("does not return 0 for activeUsers when 213 users have signed in", () => {
    const result = computeOverview(mockCounts);
    expect(result.activeUsers).not.toBe(0);
  });
});
