import { z } from "zod";
import { desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { surveyPulseResponses } from "../../drizzle/schema";
import {
  SURVEY_PULSE_BENEFITS,
  SURVEY_PULSE_CALL_PAY_TYPES,
  SURVEY_PULSE_CREDENTIALS,
  SURVEY_PULSE_EMPLOYMENT_TYPES,
  SURVEY_PULSE_EXPERIENCE_BANDS,
  SURVEY_PULSE_ROLES,
  SURVEY_PULSE_SETTINGS,
  SURVEY_PULSE_SPECIALTIES,
  US_STATES,
  buildSurveyPulseDashboard,
  type SurveyPulseFilters,
} from "../../shared/surveyPulse";

const stateSchema = z.enum(US_STATES);
const specialtySchema = z.enum(SURVEY_PULSE_SPECIALTIES);
const experienceBandSchema = z.enum(SURVEY_PULSE_EXPERIENCE_BANDS);
const settingSchema = z.enum(SURVEY_PULSE_SETTINGS);
const employmentTypeSchema = z.enum(SURVEY_PULSE_EMPLOYMENT_TYPES);
const roleSchema = z.enum(SURVEY_PULSE_ROLES);

const dashboardFiltersSchema = z.object({
  state: stateSchema.optional(),
  specialty: specialtySchema.optional(),
  experienceBand: experienceBandSchema.optional(),
  employmentSetting: settingSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  role: roleSchema.optional(),
}).default({});

const submissionSchema = z.object({
  state: stateSchema,
  specialty: specialtySchema,
  credentials: z.array(z.enum(SURVEY_PULSE_CREDENTIALS)).max(SURVEY_PULSE_CREDENTIALS.length).default([]),
  experienceBand: experienceBandSchema,
  employmentSetting: settingSchema,
  employmentType: employmentTypeSchema,
  role: roleSchema,
  annualBaseSalary: z.number().int().min(20_000).max(500_000),
  hourlyRate: z.number().min(10).max(500).optional().nullable(),
  weeklyHours: z.number().int().min(1).max(100).optional().nullable(),
  callResponsibilities: z.boolean().default(false),
  callPayType: z.enum(SURVEY_PULSE_CALL_PAY_TYPES).optional().nullable(),
  additionalCompensation: z.number().int().min(0).max(250_000).optional().nullable(),
  travelAssignment: z.boolean().default(false),
  benefits: z.array(z.enum(SURVEY_PULSE_BENEFITS)).max(SURVEY_PULSE_BENEFITS.length).default([]),
});

/**
 * An anonymous workforce survey. Intentionally no account, client IP, user agent,
 * email, contact, employer, exact workplace, or free-text field is accepted.
 */
export const surveyPulseRouter = router({
  getDashboard: publicProcedure
    .input(z.object({ filters: dashboardFiltersSchema }).default({ filters: {} }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return buildSurveyPulseDashboard([], input.filters as SurveyPulseFilters);

      // Select only fields required for aggregate calculation. Never return rows.
      const responses = await db.select({
        state: surveyPulseResponses.state,
        specialty: surveyPulseResponses.specialty,
        credentialsJson: surveyPulseResponses.credentialsJson,
        experienceBand: surveyPulseResponses.experienceBand,
        employmentSetting: surveyPulseResponses.employmentSetting,
        employmentType: surveyPulseResponses.employmentType,
        role: surveyPulseResponses.role,
        annualBaseSalaryCents: surveyPulseResponses.annualBaseSalaryCents,
        hourlyRateCents: surveyPulseResponses.hourlyRateCents,
        weeklyHours: surveyPulseResponses.weeklyHours,
        callResponsibilities: surveyPulseResponses.callResponsibilities,
        travelAssignment: surveyPulseResponses.travelAssignment,
        benefitsJson: surveyPulseResponses.benefitsJson,
        submittedAt: surveyPulseResponses.submittedAt,
      }).from(surveyPulseResponses).orderBy(desc(surveyPulseResponses.submittedAt));

      return buildSurveyPulseDashboard(responses, input.filters as SurveyPulseFilters);
    }),

  submitAnonymous: publicProcedure
    .input(submissionSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Survey Pulse is temporarily unavailable. Please try again shortly.");

      try {
        await db.insert(surveyPulseResponses).values({
          state: input.state,
          specialty: input.specialty,
          credentialsJson: input.credentials.length ? JSON.stringify(input.credentials) : null,
          experienceBand: input.experienceBand,
          employmentSetting: input.employmentSetting,
          employmentType: input.employmentType,
          role: input.role,
          annualBaseSalaryCents: input.annualBaseSalary * 100,
          hourlyRateCents: input.hourlyRate ? Math.round(input.hourlyRate * 100) : null,
          weeklyHours: input.weeklyHours ?? null,
          callResponsibilities: input.callResponsibilities,
          callPayType: input.callResponsibilities ? input.callPayType ?? null : null,
          additionalCompensationCents: input.additionalCompensation != null ? input.additionalCompensation * 100 : null,
          travelAssignment: input.travelAssignment,
          benefitsJson: input.benefits.length ? JSON.stringify(input.benefits) : null,
        });
      } catch (error) {
        // Anonymous survey errors must never disclose raw SQL or submitted
        // response values to the participant. Keep diagnostic details server-side.
        console.error("[SurveyPulse] Anonymous response insert failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We could not save your anonymous response just now. No response was recorded. Please try again shortly.",
        });
      }

      return {
        success: true,
        message: "Thank you. Your anonymous response has been added to the aggregate Survey Pulse dataset.",
      };
    }),
});
