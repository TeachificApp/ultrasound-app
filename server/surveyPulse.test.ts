import { describe, expect, it } from "vitest";
import {
  SURVEY_PULSE_MINIMUM_SAMPLE,
  buildSurveyPulseDashboard,
  filterSurveyPulseResponses,
  type SurveyPulseResponseForAnalytics,
} from "../shared/surveyPulse";

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
