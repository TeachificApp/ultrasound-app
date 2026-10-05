export const SURVEY_PULSE_MINIMUM_SAMPLE = 5;
export const SURVEY_PULSE_STANDARD_WEEKLY_HOURS = 40;
export const SURVEY_PULSE_STANDARD_ANNUAL_WEEKS = 52;

/**
 * Converts an annual base salary to the 40-hour weekly equivalent hourly rate.
 * The salary survey keeps reported weekly hours as its own field; this standard
 * conversion is deliberately consistent for apples-to-apples compensation entry.
 */
export function hourlyRateFromAnnualSalary(annualSalary: number) {
  if (!Number.isFinite(annualSalary) || annualSalary < 0) return null;
  return Math.round(
    (annualSalary / (SURVEY_PULSE_STANDARD_WEEKLY_HOURS * SURVEY_PULSE_STANDARD_ANNUAL_WEEKS)) * 100,
  ) / 100;
}

/** Converts an hourly rate to its annual 40-hour weekly equivalent. */
export function annualSalaryFromHourlyRate(hourlyRate: number) {
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return null;
  return Math.round(hourlyRate * SURVEY_PULSE_STANDARD_WEEKLY_HOURS * SURVEY_PULSE_STANDARD_ANNUAL_WEEKS);
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export const SURVEY_PULSE_SPECIALTIES = [
  "General ultrasound",
  "Abdominal",
  "OB/GYN",
  "Breast",
  "Vascular",
  "Cardiac / echocardiography",
  "Pediatric / congenital echo",
  "Fetal echocardiography",
  "POCUS",
  "Musculoskeletal",
  "Neurosonography",
  "Travel sonography",
  "Other ultrasound specialty",
] as const;

export const SURVEY_PULSE_CREDENTIALS = [
  "RDMS", "RVT", "RDCS", "RCS", "RCCS", "RMSKS", "AE", "PE", "OB/GYN", "AB", "BR", "PS", "FE", "Other credential",
] as const;

export const SURVEY_PULSE_EXPERIENCE_BANDS = [
  "Less than 1 year",
  "1–3 years",
  "4–7 years",
  "8–12 years",
  "13–20 years",
  "21+ years",
] as const;

export const SURVEY_PULSE_SETTINGS = [
  "Hospital / health system",
  "Outpatient imaging center",
  "Physician practice",
  "Academic medical center",
  "Mobile / independent imaging",
  "Travel staffing agency",
  "Government / VA",
  "Other clinical setting",
] as const;

export const SURVEY_PULSE_EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "PRN / per diem", "Travel contract", "Independent contractor",
] as const;

export const SURVEY_PULSE_ROLES = [
  "Staff sonographer",
  "Lead / senior sonographer",
  "Supervisor / manager",
  "Director",
  "Educator / clinical instructor",
  "Applications specialist",
  "Other sonography role",
] as const;

export const SURVEY_PULSE_BENEFITS = [
  "Medical insurance",
  "Dental insurance",
  "Vision insurance",
  "Retirement match",
  "Paid time off",
  "Continuing education allowance",
  "Credentialing reimbursement",
  "Tuition reimbursement",
  "None of the above",
] as const;

export const SURVEY_PULSE_CALL_PAY_TYPES = [
  "No call responsibilities",
  "Flat on-call stipend",
  "Hourly on-call pay",
  "Call-back minimum",
  "Included in base pay",
  "Other structured compensation",
] as const;

export type SurveyPulseResponseForAnalytics = {
  state: string;
  specialty: string;
  credentialsJson: string | null;
  experienceBand: string;
  employmentSetting: string;
  employmentType: string;
  role: string;
  annualBaseSalaryCents: number;
  hourlyRateCents: number | null;
  weeklyHours: number | null;
  callResponsibilities: boolean;
  travelAssignment: boolean;
  benefitsJson: string | null;
  submittedAt: Date;
};

export type SurveyPulseFilters = {
  state?: string;
  specialty?: string;
  experienceBand?: string;
  employmentSetting?: string;
  employmentType?: string;
  role?: string;
};

export type SurveyPulseCategory = { label: string; count: number; percentage: number };

function parseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}

function distribution(values: string[], sampleSize: number): SurveyPulseCategory[] {
  if (sampleSize < SURVEY_PULSE_MINIMUM_SAMPLE) return [];
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count >= SURVEY_PULSE_MINIMUM_SAMPLE)
    .map(([label, count]) => ({ label, count, percentage: Math.round((count / sampleSize) * 100) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

export function filterSurveyPulseResponses(
  responses: SurveyPulseResponseForAnalytics[],
  filters: SurveyPulseFilters,
) {
  return responses.filter((response) => {
    return (!filters.state || response.state === filters.state)
      && (!filters.specialty || response.specialty === filters.specialty)
      && (!filters.experienceBand || response.experienceBand === filters.experienceBand)
      && (!filters.employmentSetting || response.employmentSetting === filters.employmentSetting)
      && (!filters.employmentType || response.employmentType === filters.employmentType)
      && (!filters.role || response.role === filters.role);
  });
}

/**
 * Produces aggregate-only salary intelligence. This helper intentionally accepts
 * no identifying fields and never returns row-level survey submissions.
 */
export function buildSurveyPulseDashboard(
  responses: SurveyPulseResponseForAnalytics[],
  filters: SurveyPulseFilters = {},
) {
  const scoped = filterSurveyPulseResponses(responses, filters);
  const sampleSize = scoped.length;
  const meetsMinimumSample = sampleSize >= SURVEY_PULSE_MINIMUM_SAMPLE;
  const salaries = scoped.map((response) => response.annualBaseSalaryCents).sort((a, b) => a - b);
  const hourlyRates = scoped
    .map((response) => response.hourlyRateCents)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const hours = scoped
    .map((response) => response.weeklyHours)
    .filter((value): value is number => typeof value === "number" && value > 0);

  const benefitValues = scoped.flatMap((response) => parseArray(response.benefitsJson));
  const credentialValues = scoped.flatMap((response) => parseArray(response.credentialsJson));
  const monthlyValues = new Map<string, number>();
  scoped.forEach((response) => {
    const month = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", timeZone: "UTC" }).format(response.submittedAt);
    monthlyValues.set(month, (monthlyValues.get(month) ?? 0) + 1);
  });

  return {
    sampleSize,
    meetsMinimumSample,
    minimumSample: SURVEY_PULSE_MINIMUM_SAMPLE,
    filters,
    benchmark: meetsMinimumSample ? {
      medianAnnualBaseCents: percentile(salaries, 0.5),
      p25AnnualBaseCents: percentile(salaries, 0.25),
      p75AnnualBaseCents: percentile(salaries, 0.75),
      averageAnnualBaseCents: salaries.length ? Math.round(salaries.reduce((sum, value) => sum + value, 0) / salaries.length) : null,
      medianHourlyRateCents: percentile(hourlyRates.sort((a, b) => a - b), 0.5),
      medianWeeklyHours: percentile(hours.sort((a, b) => a - b), 0.5),
    } : null,
    workforce: meetsMinimumSample ? {
      callResponsibilityRate: rate(scoped.filter((response) => response.callResponsibilities).length, sampleSize),
      travelAssignmentRate: rate(scoped.filter((response) => response.travelAssignment).length, sampleSize),
      benefitCoverage: distribution(benefitValues, sampleSize),
    } : null,
    distributions: {
      states: distribution(scoped.map((response) => response.state), sampleSize),
      specialties: distribution(scoped.map((response) => response.specialty), sampleSize),
      credentials: distribution(credentialValues, sampleSize),
      experienceBands: distribution(scoped.map((response) => response.experienceBand), sampleSize),
      employmentSettings: distribution(scoped.map((response) => response.employmentSetting), sampleSize),
      employmentTypes: distribution(scoped.map((response) => response.employmentType), sampleSize),
      roles: distribution(scoped.map((response) => response.role), sampleSize),
    },
    participation: [...monthlyValues.entries()].map(([label, count]) => ({ label, count })),
    methodology: {
      anonymous: true,
      minimumSample: SURVEY_PULSE_MINIMUM_SAMPLE,
      note: "Results are aggregated only. Breakdowns and benchmarks appear only when at least five anonymous responses meet the selected filters.",
    },
  };
}
