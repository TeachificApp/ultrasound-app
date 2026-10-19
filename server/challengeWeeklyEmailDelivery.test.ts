import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const automaticSender = readFileSync(`${root}/server/jobs/challengeCron.ts`, "utf8");
const manualSender = readFileSync(`${root}/server/streakReminders.ts`, "utf8");
const manualTemplate = readFileSync(`${root}/server/_core/email.ts`, "utf8");

describe("weekly Daily Challenge email delivery", () => {
  it("keeps daily challenge publishing separate from Monday-only email delivery", () => {
    expect(automaticSender).toContain("Challenges continue publishing every day.");
    expect(automaticSender).toContain("isChallengeEmailMonday()");
    expect(manualSender).toContain("const scheduledForToday = isChallengeEmailMonday()");
    expect(manualSender).toContain("no email sent");
  });

  it("delivers a branded weekly play and leaderboard reminder for both apps", () => {
    expect(automaticSender).toContain("Your Weekly Echo Challenge & Leaderboard");
    expect(automaticSender).toContain("Your Weekly Ultrasound Challenge & Leaderboard");
    expect(automaticSender).toContain("leaderboardUrl");
    expect(manualTemplate).toContain("Your Monday Daily Challenge & Leaderboard Reminder");
    expect(manualTemplate).toContain("Play Today's Daily Challenge");
    expect(manualTemplate).toContain("View this week's leaderboard");
  });

  it("honors the existing opt-in preference before automatic delivery", () => {
    expect(automaticSender).toContain("prefs.dailyChallenge === false || prefs.quickfireReminder === false");
    expect(manualSender).toContain("if (!prefs.quickfireReminder)");
  });
});
