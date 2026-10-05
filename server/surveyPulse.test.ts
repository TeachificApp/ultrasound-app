import { describe, expect, it } from "vitest";
import {
  SURVEY_PULSE_MINIMUM_SAMPLE,
  SURVEY_PULSE_STANDARD_ANNUAL_WEEKS,
  SURVEY_PULSE_STANDARD_WEEKLY_HOURS,
  annualSalaryFromHourlyRate,
  buildSurveyPulseDashboard,
  filterSurveyPulseResponses,
  hourlyRateFromAnnualSalary,
  type SurveyPulseResponseForAnalytics,
} from "../shared/surveyPulse";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function response(overrides: Partial<SurveyPulseResponseForAnalytics> = {}): SurveyPulseResponseForAnalytics {
  return {
    state: "FL",
    specialty: "Vascular",
    credentialsJson: JSON.stringify(["RVT"]),
    experienceBand: "4–7 years",
    employmentSetting: "Hospital / health system",
    employmentType: "Full-time",
    role: "Staff sonographer",
    annualBaseSalaryCents: 90_000_00,
    hourlyRateCents: 4_500,
    weeklyHours: 40,
    callResponsibilities: true,
    travelAssignment: false,
    benefitsJson: JSON.stringify(["Medical insurance", "Retirement match"]),
    submittedAt: new Date("2026-09-30T12:00:00.000Z"),
    ...overrides,
  };
}

describe("Survey Pulse aggregate privacy contract", () => {
  it("converts annual and hourly pay at a standard 40-hour work week", () => {
    expect(SURVEY_PULSE_STANDARD_WEEKLY_HOURS).toBe(40);
    expect(SURVEY_PULSE_STANDARD_ANNUAL_WEEKS).toBe(52);
    expect(hourlyRateFromAnnualSalary(87_000)).toBe(41.83);
    expect(annualSalaryFromHourlyRate(42)).toBe(87_360);
    expect(hourlyRateFromAnnualSalary(-1)).toBeNull();
    expect(annualSalaryFromHourlyRate(Number.NaN)).toBeNull();
  });

  it("allows either salary field to become the manual source and keeps database errors private", () => {
    const form = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SurveyPulse.tsx"), "utf8");
    const router = readFileSync(resolve(import.meta.dirname, "../server/routers/surveyPulseRouter.ts"), "utf8");

    expect(form).toContain("const updateAnnualSalary");
    expect(form).toContain("const updateHourlyRate");
    expect(form).toContain("updateAnnualSalary(event.target.value)");
    expect(form).toContain("updateHourlyRate(event.target.value)");
    expect(form).toContain("Type into either salary field to manually override");
    expect(router).toContain("[SurveyPulse] Anonymous response insert failed:");
    expect(router).toContain("No response was recorded. Please try again shortly.");
  });

  it("suppresses benchmarks and category breakdowns below the five-response threshold", () => {
    const dashboard = buildSurveyPulseDashboard(Array.from({ length: SURVEY_PULSE_MINIMUM_SAMPLE - 1 }, () => response()));
    expect(dashboard.sampleSize).toBe(4);
    expect(dashboard.meetsMinimumSample).toBe(false);
    expect(dashboard.benchmark).toBeNull();
    expect(dashboard.workforce).toBeNull();
    expect(dashboard.distributions.states).toEqual([]);
  });

  it("returns aggregate salary metrics but never source rows after the threshold is met", () => {
    const dashboard = buildSurveyPulseDashboard([
      response({ annualBaseSalaryCents: 80_000_00 }),
      response({ annualBaseSalaryCents: 85_000_00 }),
      response({ annualBaseSalaryCents: 90_000_00 }),
      response({ annualBaseSalaryCents: 95_000_00 }),
      response({ annualBaseSalaryCents: 100_000_00 }),
    ]);
    expect(dashboard.meetsMinimumSample).toBe(true);
    expect(dashboard.benchmark?.medianAnnualBaseCents).toBe(90_000_00);
    expect(dashboard.benchmark?.p25AnnualBaseCents).toBe(85_000_00);
    expect(dashboard.benchmark?.p75AnnualBaseCents).toBe(95_000_00);
    expect("responses" in dashboard).toBe(false);
  });

  it("applies filters before enforcing the privacy threshold", () => {
    const responses = [
      ...Array.from({ length: 5 }, () => response({ state: "FL" })),
      ...Array.from({ length: 4 }, () => response({ state: "GA" })),
    ];
    expect(filterSurveyPulseResponses(responses, { state: "GA" })).toHaveLength(4);
    expect(buildSurveyPulseDashboard(responses, { state: "GA" }).benchmark).toBeNull();
    expect(buildSurveyPulseDashboard(responses, { state: "FL" }).benchmark?.medianAnnualBaseCents).toBe(90_000_00);
  });
});
