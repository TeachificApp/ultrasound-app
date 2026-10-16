import { and, eq, inArray, sql } from "drizzle-orm";
import {
  expoPointsProgramEvents,
  expoPointsPrograms,
  expoPointsTransactions,
  ultrasoundExpoPackages,
  ultrasoundExpoRegistrations,
  vendorPartnerApplications,
} from "../../drizzle/schema";
import { normalizeExpoPointsRoles, type ExpoPointsEligibilityRole } from "../../shared/expoPoints";

export type ExpoPointsParticipant = {
  role: ExpoPointsEligibilityRole;
  eventIds: number[];
};

/** Finds paid event participation and approved vendor status without trusting email alone. */
export async function getExpoPointsParticipant(db: any, userId: number, programId: number): Promise<ExpoPointsParticipant | null> {
  const [program] = await db.select().from(expoPointsPrograms).where(eq(expoPointsPrograms.id, programId)).limit(1);
  if (!program || !program.isActive) return null;
  const programEvents = await db.select({ eventId: expoPointsProgramEvents.eventId })
    .from(expoPointsProgramEvents).where(eq(expoPointsProgramEvents.programId, programId));
  const eventIds = programEvents.map((row: any) => row.eventId);
  if (!eventIds.length) return null;

  const registrations = await db.select({ eventId: ultrasoundExpoRegistrations.eventId, packageType: ultrasoundExpoPackages.packageType })
    .from(ultrasoundExpoRegistrations)
    .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
    .where(and(
      eq(ultrasoundExpoRegistrations.userId, userId),
      eq(ultrasoundExpoRegistrations.paymentStatus, "paid"),
      inArray(ultrasoundExpoRegistrations.eventId, eventIds),
      inArray(ultrasoundExpoPackages.packageType, ["registrant", "exhibitor", "sponsor"]),
    ));
  const applicationRows = await db.select({ id: vendorPartnerApplications.id }).from(vendorPartnerApplications)
    .where(and(eq(vendorPartnerApplications.linkedUserId, userId), eq(vendorPartnerApplications.status, "approved")));
  const eligible = new Set(normalizeExpoPointsRoles(JSON.parse(program.eligibleRolesJson || "[]")));
  const roles: ExpoPointsEligibilityRole[] = [];
  if (registrations.some((row: any) => row.packageType === "registrant")) roles.push("attendee");
  if (registrations.some((row: any) => row.packageType === "exhibitor")) roles.push("exhibitor");
  if (registrations.some((row: any) => row.packageType === "sponsor")) roles.push("sponsor");
  if (applicationRows.length) roles.push("vendor");
  const role = roles.find((candidate) => eligible.has(candidate));
  return role ? { role, eventIds } : null;
}

export async function getExpoPointsBalance(db: any, programId: number, userId: number) {
  const [row] = await db.select({ total: sql<number>`COALESCE(SUM(${expoPointsTransactions.points}), 0)` })
    .from(expoPointsTransactions)
    .where(and(eq(expoPointsTransactions.programId, programId), eq(expoPointsTransactions.userId, userId)));
  return Number(row?.total ?? 0);
}
