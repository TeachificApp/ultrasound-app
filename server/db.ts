import { and, avg, count, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  peerReviews,
  policies,
  qaLogs,
  appropriateUseCases,
  labSubscriptions,
  labMembers,
  labPeerReviews,
  echoCases,
  strainSnapshots,
  imageQualityReviews,
  echoCorrelations,
  physicianPeerReviews,
  physicianNotifications,
  accreditationReadiness,
  accreditationReadinessNavigator,
  caseMixSubmissions,
  cmeEntries,
  userRoles,
  type UserRole,
  type InsertUserRole,
  type CmeEntry,
  type InsertCmeEntry,
  type AccreditationReadiness,
  type InsertAccreditationReadiness,
  type AccreditationReadinessNavigator,
  type InsertAccreditationReadinessNavigator,
  type CaseMixSubmission,
  type InsertCaseMixSubmission,
  type ImageQualityReview,
  type InsertImageQualityReview,
  type LabSubscription,
  type LabMember,
  type LabPeerReview,
  type PhysicianPeerReview,
  type InsertPhysicianPeerReview,
  type PhysicianNotification,
  physicianOverReadInvitations,
  type PhysicianOverReadInvitation,
  type InsertPhysicianOverReadInvitation,
  physicianOverReadSubmissions,
  type PhysicianOverReadSubmission,
  type InsertPhysicianOverReadSubmission,
  physicianComparisonReviews,
  type PhysicianComparisonReview,
  type InsertPhysicianComparisonReview,
  scanCoachMedia,
  type ScanCoachMedia,
  type InsertScanCoachMedia,
  possibleCaseStudies,
  type PossibleCaseStudy,
  type InsertPossibleCaseStudy,
  accreditationFormTemplates,
  type AccreditationFormTemplate,
  type InsertAccreditationFormTemplate,
  accreditationFormSections,
  type AccreditationFormSection,
  type InsertAccreditationFormSection,
  accreditationFormItems,
  type AccreditationFormItem,
  type InsertAccreditationFormItem,
  accreditationFormOptions,
  type AccreditationFormOption,
  type InsertAccreditationFormOption,
  accreditationFormBranchRules,
  type AccreditationFormBranchRule,
  type InsertAccreditationFormBranchRule,
  accreditationFormOrgVisibilityRules,
  type AccreditationFormOrgVisibilityRule,
  type InsertAccreditationFormOrgVisibilityRule,
  diyOrganizations,
  type DiyOrganization,
  accreditationFormTemplateAssignments,
  type AccreditationFormTemplateAssignment,
  type InsertAccreditationFormTemplateAssignment,
  accreditationFormSubmissions,
  type AccreditationFormSubmission,
  type InsertAccreditationFormSubmission,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getUsersByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  return db.select().from(users).where(or(...ids.map(id => eq(users.id, id))));
}


export async function updateUserProfile(userId: number, data: {
  email?: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  credentials?: string;
  specialty?: string;
  yearsExperience?: number | null;
  location?: string;
  website?: string;
  isPublicProfile?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserPasswordHash(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.passwordHash ?? null;
}

export async function setPremiumStatus(
  userId: number,
  isPremium: boolean,
  source: "thinkific" | "admin" | "manual" = "admin"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    isPremium,
    premiumGrantedAt: isPremium ? new Date() : null,
    premiumSource: isPremium ? source : null,
  }).where(eq(users.id, userId));
}

export async function updateUserPassword(userId: number, newHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
}

export async function setPendingEmail(
  userId: number,
  pendingEmail: string,
  token: string,
  expiry: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ pendingEmail, pendingEmailToken: token, pendingEmailExpiry: expiry })
    .where(eq(users.id, userId));
}

export async function getUserByPendingEmailToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.pendingEmailToken, token))
    .limit(1);
  return rows[0];
}

export async function confirmPendingEmail(userId: number, newEmail: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({
      email: newEmail,
      pendingEmail: null,
      pendingEmailToken: null,
      pendingEmailExpiry: null,
    })
    .where(eq(users.id, userId));
}

export async function clearPendingEmail(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ pendingEmail: null, pendingEmailToken: null, pendingEmailExpiry: null })
    .where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function setPasswordResetToken(
  userId: number,
  token: string,
  expiry: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ passwordResetToken: token, passwordResetExpiry: expiry })
    .where(eq(users.id, userId));
}

export async function getUserByPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return rows[0];
}

export async function clearPasswordResetToken(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ passwordResetToken: null, passwordResetExpiry: null })
    .where(eq(users.id, userId));
}

export async function setMagicLinkToken(
  userId: number,
  token: string,
  expiry: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ magicLinkToken: token, magicLinkExpiry: expiry })
    .where(eq(users.id, userId));
}

export async function getUserByMagicLinkToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.magicLinkToken, token))
    .limit(1);
  return rows[0];
}

export async function clearMagicLinkToken(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ magicLinkToken: null, magicLinkExpiry: null })
    .where(eq(users.id, userId));
}



// ─── ACCREDITATION HELPERS ────────────────────────────────────────────────────

export async function createPeerReview(data: {
  reviewerId: number;
  patientId?: string;
  studyDate?: string;
  modality: "TTE" | "TEE" | "Stress" | "Pediatric" | "Fetal" | "HOCM" | "POCUS";
  sonographerInitials?: string;
  imageQuality?: "excellent" | "good" | "adequate" | "poor";
  imageQualityNotes?: string;
  reportAccuracy?: "accurate" | "minor_discrepancy" | "major_discrepancy";
  reportNotes?: string;
  technicalAdherence?: "full" | "partial" | "non_adherent";
  technicalNotes?: string;
  overallScore?: number;
  feedback?: string;
  status?: "draft" | "submitted" | "complete";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(peerReviews).values(data).$returningId();
  return row;
}

export async function getPeerReviews(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(peerReviews)
    .where(eq(peerReviews.reviewerId, userId))
    .orderBy(desc(peerReviews.createdAt))
    .limit(limit).offset(offset);
}

export async function createPolicy(data: {
  authorId: number;
  labId?: number | null;
  diyOrgId?: number | null;
  title: string;
  category: "infection_control" | "equipment" | "patient_safety" | "protocol" | "staff_competency" | "quality_assurance" | "appropriate_use" | "report_turnaround" | "emergency" | "other";
  modality?: "TTE" | "TEE" | "Stress" | "Pediatric" | "Fetal" | "HOCM" | "POCUS" | "All";
  content: string;
  version?: string;
  effectiveDate?: string;
  reviewDate?: string;
  status?: "draft" | "active" | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(policies).values(data).$returningId();
  return row;
}

/**
 * Get policies scoped by OrgID.
 * - If labId provided: return policies for that lab (all members of the lab can read).
 * - If diyOrgId provided: return policies for that DIY org.
 * - Falls back to authorId-only scope if neither is provided (legacy).
 */
export async function getPolicies(userId: number, opts?: { labId?: number; diyOrgId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const { or, and } = await import("drizzle-orm");
  let whereClause;
  if (opts?.labId) {
    whereClause = eq(policies.labId, opts.labId);
  } else if (opts?.diyOrgId) {
    whereClause = eq(policies.diyOrgId, opts.diyOrgId);
  } else {
    whereClause = eq(policies.authorId, userId);
  }
  return db.select().from(policies)
    .where(whereClause)
    .orderBy(desc(policies.updatedAt));
}

export async function updatePolicy(id: number, data: Partial<{
  title: string;
  category: "infection_control" | "equipment" | "patient_safety" | "protocol" | "staff_competency" | "quality_assurance" | "appropriate_use" | "report_turnaround" | "emergency" | "other";
  content: string;
  version: string;
  status: "draft" | "active" | "archived";
  reviewDate: string;
  effectiveDate: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(policies).set(data).where(eq(policies.id, id));
}

export async function createQaLog(data: {
  userId: number;
  category: "equipment" | "protocol" | "image_quality" | "report_turnaround" | "staff_competency" | "infection_control" | "patient_safety" | "other";
  title: string;
  description?: string;
  finding?: "pass" | "fail" | "needs_improvement" | "na";
  actionRequired?: string;
  actionTaken?: string;
  dueDate?: string;
  attachmentUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(qaLogs).values(data).$returningId();
  return row;
}

export async function getQaLogs(userId: number, limit = 30, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qaLogs)
    .where(eq(qaLogs.userId, userId))
    .orderBy(desc(qaLogs.createdAt))
    .limit(limit).offset(offset);
}

export async function createAucEntry(data: {
  userId: number;
  // New Formsite form269 fields
  dateReviewCompleted?: string;
  studyDate?: string;
  examIdentifier?: string;
  referringPhysician?: string;
  examTypes?: string;
  limitedOrComplete?: string;
  indicationAppropriateness?: string;
  reviewComments?: string;
  // Legacy fields
  modality?: "TTE" | "TEE" | "Stress" | "Pediatric" | "Fetal" | "HOCM" | "POCUS";
  indication?: string;
  appropriatenessRating?: "appropriate" | "may_be_appropriate" | "rarely_appropriate" | "unknown";
  clinicalScenario?: string;
  outcome?: string;
  notes?: string;
  flagged?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(appropriateUseCases).values({
    ...data,
    // Ensure required fields have defaults
    indication: data.indication ?? data.examTypes ?? "",
    modality: data.modality ?? "TTE",
  }).$returningId();
  return row;
}

export async function getAucEntries(userId: number, limit = 30, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appropriateUseCases)
    .where(eq(appropriateUseCases.userId, userId))
    .orderBy(desc(appropriateUseCases.createdAt))
    .limit(limit).offset(offset);
}

// ─── Lab Subscription Helpers ─────────────────────────────────────────────────

export async function createLabSubscription(data: {
  adminUserId: number;
  labName: string;
  labAddress?: string;
  labPhone?: string;
  plan?: "basic" | "professional" | "enterprise";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const seats = data.plan === "enterprise" ? 999 : data.plan === "professional" ? 25 : 5;
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day trial
  const [row] = await db.insert(labSubscriptions).values({
    ...data,
    seats,
    status: "trialing",
    trialEndsAt,
  }).$returningId();
  return row;
}

export async function getLabByAdmin(adminUserId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(labSubscriptions)
    .where(eq(labSubscriptions.adminUserId, adminUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLabById(labId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateLabSubscription(labId: number, data: Partial<{
  labName: string;
  labAddress: string;
  labPhone: string;
  plan: "basic" | "professional" | "enterprise";
  status: "active" | "trialing" | "past_due" | "canceled" | "paused";
  seats: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(labSubscriptions).set(data).where(eq(labSubscriptions.id, labId));
}

// ─── Lab Member Helpers ───────────────────────────────────────────────────────

export async function addLabMember(data: {
  labId: number;
  inviteEmail: string;
  displayName?: string;
  credentials?: string;
  role?: "admin" | "medical_director" | "technical_director" | "medical_staff" | "technical_staff";
  specialty?: string;
  department?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if already a member
  const existing = await db.select().from(labMembers)
    .where(and(eq(labMembers.labId, data.labId), eq(labMembers.inviteEmail, data.inviteEmail)))
    .limit(1);
  if (existing.length > 0) throw new Error("This email is already a lab member.");
  const inviteToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const [row] = await db.insert(labMembers).values({ ...data, inviteToken, inviteStatus: "pending" }).$returningId();
  return row;
}

export async function getLabMembers(labId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(labMembers)
    .where(and(eq(labMembers.labId, labId), eq(labMembers.isActive, true)))
    .orderBy(labMembers.displayName);
}

export async function updateLabMember(memberId: number, data: Partial<{
  displayName: string;
  credentials: string;
  role: "admin" | "medical_director" | "technical_director" | "medical_staff" | "technical_staff";
  specialty: string;
  department: string;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(labMembers).set(data).where(eq(labMembers.id, memberId));
}

export async function removeLabMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(labMembers).set({ isActive: false }).where(eq(labMembers.id, memberId));
}

// ─── Lab Peer Review Helpers ──────────────────────────────────────────────────

export async function createLabPeerReview(data: {
  labId: number;
  peerReviewId: number;
  reviewerId: number;
  revieweeId: number;
  qualityScore?: number;
  qualityTier?: "Excellent" | "Good" | "Adequate" | "Needs Improvement";
  iqScore?: number;
  raScore?: number;
  taScore?: number;
  reviewMonth?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(labPeerReviews).values(data).$returningId();
  return row;
}

export async function getLabPeerReviews(labId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    lpr: labPeerReviews,
    pr: peerReviews,
    reviewer: { id: labMembers.id, displayName: labMembers.displayName, credentials: labMembers.credentials },
  })
    .from(labPeerReviews)
    .innerJoin(peerReviews, eq(labPeerReviews.peerReviewId, peerReviews.id))
    .innerJoin(labMembers, eq(labPeerReviews.reviewerId, labMembers.id))
    .where(eq(labPeerReviews.labId, labId))
    .orderBy(desc(labPeerReviews.createdAt))
    .limit(limit).offset(offset);
}

// ─── Staff Analytics Helpers ──────────────────────────────────────────────────

/** Per-member monthly Quality Score averages for growth curves */
export async function getStaffQsTrend(labId: number, revieweeId: number, months = 12) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const rows = await db.select({
    reviewMonth: labPeerReviews.reviewMonth,
    avgQs: avg(labPeerReviews.qualityScore),
    avgIq: avg(labPeerReviews.iqScore),
    avgRa: avg(labPeerReviews.raScore),
    avgTa: avg(labPeerReviews.taScore),
    reviewCount: count(labPeerReviews.id),
  })
    .from(labPeerReviews)
    .where(and(eq(labPeerReviews.labId, labId), eq(labPeerReviews.revieweeId, revieweeId)))
    .groupBy(labPeerReviews.reviewMonth)
    .orderBy(labPeerReviews.reviewMonth);
  return rows;
}

/** All staff latest QS snapshot for lab-wide leaderboard */
export async function getLabStaffSnapshot(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    revieweeId: labPeerReviews.revieweeId,
    avgQs: avg(labPeerReviews.qualityScore),
    avgIq: avg(labPeerReviews.iqScore),
    avgRa: avg(labPeerReviews.raScore),
    avgTa: avg(labPeerReviews.taScore),
    reviewCount: count(labPeerReviews.id),
    lastReviewMonth: sql<string>`MAX(${labPeerReviews.reviewMonth})`,
  })
    .from(labPeerReviews)
    .where(eq(labPeerReviews.labId, labId))
    .groupBy(labPeerReviews.revieweeId);
  return rows;
}

/** Monthly lab-wide summary for reporting */
export async function getLabMonthlySummary(labId: number, months = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    reviewMonth: labPeerReviews.reviewMonth,
    avgQs: avg(labPeerReviews.qualityScore),
    reviewCount: count(labPeerReviews.id),
    excellentCount: sql<number>`SUM(CASE WHEN ${labPeerReviews.qualityTier} = 'Excellent' THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${labPeerReviews.qualityTier} = 'Good' THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${labPeerReviews.qualityTier} = 'Adequate' THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${labPeerReviews.qualityTier} = 'Needs Improvement' THEN 1 ELSE 0 END)`,
  })
    .from(labPeerReviews)
    .where(eq(labPeerReviews.labId, labId))
    .groupBy(labPeerReviews.reviewMonth)
    .orderBy(labPeerReviews.reviewMonth);
}

// ─── Echo Cases ───────────────────────────────────────────────────────────────

export async function createEchoCase(data: {
  userId: number;
  title: string;
  patientAge?: number | null;
  patientSex?: "M" | "F" | "Other" | null;
  clinicalHistory?: string | null;
  indication?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  isPublic?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(echoCases).values({
    userId: data.userId,
    title: data.title,
    patientAge: data.patientAge ?? null,
    patientSex: data.patientSex ?? null,
    clinicalHistory: data.clinicalHistory ?? null,
    indication: data.indication ?? null,
    diagnosis: data.diagnosis ?? null,
    notes: data.notes ?? null,
    isPublic: data.isPublic ?? false,
  });
}

export async function getEchoCasesByUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(echoCases)
    .where(eq(echoCases.userId, userId))
    .orderBy(desc(echoCases.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getEchoCaseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(echoCases).where(eq(echoCases.id, id));
  return row ?? null;
}

// ─── Strain Snapshots ─────────────────────────────────────────────────────────

export async function createStrainSnapshot(data: {
  userId: number;
  caseId?: number | null;
  caseTitle?: string | null;
  segmentValues: string;
  wallMotionScores?: string | null;
  lvGls?: string | null;
  rvStrain?: string | null;
  laStrain?: string | null;
  wmsi?: string | null;
  vendor?: string | null;
  frameRate?: number | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(strainSnapshots).values({
    userId: data.userId,
    caseId: data.caseId ?? null,
    caseTitle: data.caseTitle ?? null,
    segmentValues: data.segmentValues,
    wallMotionScores: data.wallMotionScores ?? null,
    lvGls: data.lvGls ?? null,
    rvStrain: data.rvStrain ?? null,
    laStrain: data.laStrain ?? null,
    wmsi: data.wmsi ?? null,
    vendor: data.vendor ?? null,
    frameRate: data.frameRate ?? null,
    notes: data.notes ?? null,
  });
}

export async function getStrainSnapshotsByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(strainSnapshots)
    .where(eq(strainSnapshots.caseId, caseId))
    .orderBy(desc(strainSnapshots.createdAt));
}

export async function getStrainSnapshotsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(strainSnapshots)
    .where(eq(strainSnapshots.userId, userId))
    .orderBy(desc(strainSnapshots.createdAt))
    .limit(limit);
}

// ─── Image Quality Reviews ─────────────────────────────────────────────────────
export async function createImageQualityReview(data: InsertImageQualityReview) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(imageQualityReviews).values(data);
  const result = await db.select().from(imageQualityReviews)
    .where(eq(imageQualityReviews.userId, data.userId))
    .orderBy(desc(imageQualityReviews.createdAt)).limit(1);
  return result[0];
}

export async function getImageQualityReviewsByUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(imageQualityReviews)
    .where(eq(imageQualityReviews.userId, userId))
    .orderBy(desc(imageQualityReviews.createdAt))
    .limit(limit).offset(offset);
}

export async function getImageQualityReviewById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(imageQualityReviews)
    .where(eq(imageQualityReviews.id, id)).limit(1);
  return result[0];
}

export async function updateImageQualityReview(id: number, userId: number, data: Partial<InsertImageQualityReview>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(imageQualityReviews).set(data)
    .where(and(eq(imageQualityReviews.id, id), eq(imageQualityReviews.userId, userId)));
}

export async function deleteImageQualityReview(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(imageQualityReviews)
    .where(and(eq(imageQualityReviews.id, id), eq(imageQualityReviews.userId, userId)));
}

export async function getIqrStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, avgScore: 0, byExamType: [] };
  const rows = await db.select({
    total: count(),
    avgScore: avg(imageQualityReviews.qualityScore),
  }).from(imageQualityReviews).where(eq(imageQualityReviews.userId, userId));
  const byType = await db.select({
    examType: imageQualityReviews.examType,
    count: count(),
    avgScore: avg(imageQualityReviews.qualityScore),
  }).from(imageQualityReviews).where(eq(imageQualityReviews.userId, userId))
    .groupBy(imageQualityReviews.examType);
  return { total: rows[0]?.total ?? 0, avgScore: rows[0]?.avgScore ?? 0, byExamType: byType };
}

// ─── Lab IQR Analytics ─────────────────────────────────────────────────────────

/** Get all IQR reviews for a lab, optionally filtered by reviewee */
export async function getIQRReviewsByLab(
  labId: number,
  revieweeLabMemberId?: number,
  examType?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(imageQualityReviews.labId, labId)];
  if (revieweeLabMemberId !== undefined) {
    conditions.push(eq(imageQualityReviews.revieweeLabMemberId, revieweeLabMemberId));
  }
  if (examType) conditions.push(eq(imageQualityReviews.examType, examType));
  if (dateFrom) conditions.push(sql`${imageQualityReviews.createdAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${imageQualityReviews.createdAt} <= ${dateTo}`);
  return db.select().from(imageQualityReviews)
    .where(and(...conditions))
    .orderBy(desc(imageQualityReviews.createdAt));
}

/** Aggregate per-staff Quality Score stats for a lab */
export async function getLabStaffIQRStats(
  labId: number,
  examType?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [
    eq(imageQualityReviews.labId, labId),
    sql`${imageQualityReviews.revieweeLabMemberId} IS NOT NULL`,
  ];
  if (examType) conditions.push(eq(imageQualityReviews.examType, examType));
  if (dateFrom) conditions.push(sql`${imageQualityReviews.createdAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${imageQualityReviews.createdAt} <= ${dateTo}`);
  return db.select({
    revieweeLabMemberId: imageQualityReviews.revieweeLabMemberId,
    revieweeName: imageQualityReviews.revieweeName,
    reviewCount: count(),
    avgScore: avg(imageQualityReviews.qualityScore),
    latestReviewDate: sql<string>`MAX(${imageQualityReviews.dateReviewCompleted})`,
    excellentCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 90 THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 75 AND ${imageQualityReviews.qualityScore} < 90 THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 60 AND ${imageQualityReviews.qualityScore} < 75 THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} < 60 THEN 1 ELSE 0 END)`,
  })
    .from(imageQualityReviews)
    .where(and(...conditions))
    .groupBy(imageQualityReviews.revieweeLabMemberId, imageQualityReviews.revieweeName)
    .orderBy(desc(avg(imageQualityReviews.qualityScore)));
}

/** Get monthly Quality Score trend for a specific staff member */
export async function getStaffIQRTrend(labId: number, revieweeLabMemberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    month: sql<string>`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`,
    avgScore: avg(imageQualityReviews.qualityScore),
    reviewCount: count(),
  })
    .from(imageQualityReviews)
    .where(and(
      eq(imageQualityReviews.labId, labId),
      eq(imageQualityReviews.revieweeLabMemberId, revieweeLabMemberId)
    ))
    .groupBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`);
}

/** Get exam-type-level breakdown for a staff member: avg score + count per exam type */
export async function getStaffIQRDomainBreakdown(labId: number, revieweeLabMemberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    examType: imageQualityReviews.examType,
    reviewCount: count(),
    avgScore: avg(imageQualityReviews.qualityScore),
    excellentCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 90 THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 75 AND ${imageQualityReviews.qualityScore} < 90 THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 60 AND ${imageQualityReviews.qualityScore} < 75 THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} < 60 THEN 1 ELSE 0 END)`,
  })
    .from(imageQualityReviews)
    .where(and(
      eq(imageQualityReviews.labId, labId),
      eq(imageQualityReviews.revieweeLabMemberId, revieweeLabMemberId),
      sql`${imageQualityReviews.examType} IS NOT NULL`,
    ))
    .groupBy(imageQualityReviews.examType)
    .orderBy(sql`count(*) DESC`);
}

/** Lab-wide monthly summary for the Reports tab */
export async function getLabIQRMonthlySummary(
  labId: number,
  reviewType?: string,
  examType?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(imageQualityReviews.labId, labId)];
  if (reviewType) conditions.push(eq(imageQualityReviews.reviewType, reviewType));
  if (examType) conditions.push(eq(imageQualityReviews.examType, examType));
  if (dateFrom) conditions.push(sql`${imageQualityReviews.createdAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${imageQualityReviews.createdAt} <= ${dateTo}`);
  return db.select({
    month: sql<string>`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`,
    reviewCount: count(),
    avgScore: avg(imageQualityReviews.qualityScore),
    staffReviewed: sql<number>`COUNT(DISTINCT ${imageQualityReviews.revieweeLabMemberId})`,
    excellentCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 90 THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 75 AND ${imageQualityReviews.qualityScore} < 90 THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 60 AND ${imageQualityReviews.qualityScore} < 75 THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} < 60 THEN 1 ELSE 0 END)`,
  })
    .from(imageQualityReviews)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`);
}

/** Get lab members enriched with their IQR stats */
export async function getLabMembersWithIQRStats(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(labMembers)
    .where(eq(labMembers.labId, labId));
  const stats = await getLabStaffIQRStats(labId);
  const statsMap = new Map(stats.map(s => [s.revieweeLabMemberId, s]));
  return members.map(m => ({
    ...m,
    iqrStats: statsMap.get(m.id) ?? null,
  }));
}

// ─── Echo Correlation Helpers ─────────────────────────────────────────────────
export async function createEchoCorrelation(data: typeof echoCorrelations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(echoCorrelations).values(data);
}

export async function getEchoCorrelationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(echoCorrelations)
    .where(eq(echoCorrelations.userId, userId))
    .orderBy(desc(echoCorrelations.createdAt));
}

export async function getEchoCorrelationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(echoCorrelations)
    .where(eq(echoCorrelations.id, id));
  return row ?? null;
}

export async function updateEchoCorrelation(id: number, data: Partial<typeof echoCorrelations.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(echoCorrelations).set(data).where(eq(echoCorrelations.id, id));
}

export async function deleteEchoCorrelation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(echoCorrelations).where(eq(echoCorrelations.id, id));
}

export async function getEchoCorrelationsByLab(labId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(echoCorrelations)
    .where(eq(echoCorrelations.labId, labId))
    .orderBy(desc(echoCorrelations.createdAt));
}

// ─── Case Mix Tracker ─────────────────────────────────────────────────────────
/** Aggregate reviewed case counts per exam type from IQR, Peer Reviews, and Echo Correlations */
export async function getCaseMix(userId: number) {
  const db = await getDb();
  if (!db) return { iqr: [], peerReview: [], echoCorrelation: [] };

  // IQR counts by examType
  const iqrCounts = await db.select({
    examType: imageQualityReviews.examType,
    count: count(),
  }).from(imageQualityReviews)
    .where(eq(imageQualityReviews.userId, userId))
    .groupBy(imageQualityReviews.examType);

  // Peer Review counts by modality
  const peerCounts = await db.select({
    modality: peerReviews.modality,
    count: count(),
  }).from(peerReviews)
    .where(eq(peerReviews.reviewerId, userId))
    .groupBy(peerReviews.modality);

  // Echo Correlation counts by examType
  const corrCounts = await db.select({
    examType: echoCorrelations.examType,
    count: count(),
  }).from(echoCorrelations)
    .where(eq(echoCorrelations.userId, userId))
    .groupBy(echoCorrelations.examType);

  return {
    iqr: iqrCounts,
    peerReview: peerCounts,
    echoCorrelation: corrCounts,
  };
}

// ─── Get lab by member userId (for non-admin members to fetch their lab's staff) ─
export async function getLabByMemberUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  // First check if user is admin of a lab
  const adminLab = await db.select().from(labSubscriptions)
    .where(eq(labSubscriptions.adminUserId, userId))
    .limit(1);
  if (adminLab.length > 0) return adminLab[0];
  // Otherwise check if user is a member of a lab
  const membership = await db.select().from(labMembers)
    .where(and(eq(labMembers.userId, userId), eq(labMembers.isActive, true)))
    .limit(1);
  if (membership.length === 0) return null;
  const lab = await db.select().from(labSubscriptions)
    .where(eq(labSubscriptions.id, membership[0].labId))
    .limit(1);
  return lab.length > 0 ? lab[0] : null;
}

// ─── IQR Analytics — Lab Admin ────────────────────────────────────────────────

/**
 * Lab-wide IQR snapshot: one row per staff member with avg quality score,
 * review count, last review date, and exam type breakdown.
 * Used for the Lab Admin Analytics leaderboard chart.
 */
export async function getIqrLabSnapshot(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    revieweeLabMemberId: imageQualityReviews.revieweeLabMemberId,
    revieweeName: imageQualityReviews.revieweeName,
    avgScore: avg(imageQualityReviews.qualityScore),
    reviewCount: count(imageQualityReviews.id),
    lastReviewDate: sql<string>`MAX(DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m'))`,
    excellentCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 90 THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 75 AND ${imageQualityReviews.qualityScore} < 90 THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 60 AND ${imageQualityReviews.qualityScore} < 75 THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} < 60 THEN 1 ELSE 0 END)`,
  })
    .from(imageQualityReviews)
    .where(
      and(
        eq(imageQualityReviews.labId, labId),
        sql`${imageQualityReviews.revieweeLabMemberId} IS NOT NULL`,
        sql`${imageQualityReviews.qualityScore} IS NOT NULL`,
      )
    )
    .groupBy(imageQualityReviews.revieweeLabMemberId, imageQualityReviews.revieweeName)
    .orderBy(sql`avg(${imageQualityReviews.qualityScore}) DESC`);
  return rows;
}

/**
 * Monthly IQR quality score trend for a specific lab member.
 * Used for the individual staff growth curve chart.
 */
export async function getIqrStaffTrend(labId: number, revieweeLabMemberId: number, months = 12) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const rows = await db.select({
    reviewMonth: sql<string>`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`,
    avgScore: avg(imageQualityReviews.qualityScore),
    reviewCount: count(imageQualityReviews.id),
    examTypes: sql<string>`GROUP_CONCAT(DISTINCT ${imageQualityReviews.examType})`,
  })
    .from(imageQualityReviews)
    .where(
      and(
        eq(imageQualityReviews.labId, labId),
        eq(imageQualityReviews.revieweeLabMemberId, revieweeLabMemberId),
        sql`${imageQualityReviews.qualityScore} IS NOT NULL`,
        gte(imageQualityReviews.createdAt, cutoff),
      )
    )
    .groupBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`);
  return rows;
}

/**
 * Monthly lab-wide IQR summary: avg score, review count, tier breakdown.
 * Used for the Reports tab monthly chart.
 */
export async function getIqrLabMonthlySummary(labId: number, months = 12, reviewType?: string) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const conditions = [
    eq(imageQualityReviews.labId, labId),
    sql`${imageQualityReviews.qualityScore} IS NOT NULL`,
    gte(imageQualityReviews.createdAt, cutoff),
    ...(reviewType ? [eq(imageQualityReviews.reviewType, reviewType)] : []),
  ];
  const rows = await db.select({
    reviewMonth: sql<string>`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`,
    avgScore: avg(imageQualityReviews.qualityScore),
    reviewCount: count(imageQualityReviews.id),
    excellentCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 90 THEN 1 ELSE 0 END)`,
    goodCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 75 AND ${imageQualityReviews.qualityScore} < 90 THEN 1 ELSE 0 END)`,
    adequateCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} >= 60 AND ${imageQualityReviews.qualityScore} < 75 THEN 1 ELSE 0 END)`,
    needsImprovementCount: sql<number>`SUM(CASE WHEN ${imageQualityReviews.qualityScore} < 60 THEN 1 ELSE 0 END)`,
  })
    .from(imageQualityReviews)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${imageQualityReviews.createdAt}, '%Y-%m')`);
  return rows;
}

/**
 * Exam type breakdown for a lab: count and avg score per exam type.
 * Used for the Analytics tab exam type distribution chart.
 */
export async function getIqrExamTypeBreakdown(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    examType: imageQualityReviews.examType,
    reviewCount: count(imageQualityReviews.id),
    avgScore: avg(imageQualityReviews.qualityScore),
  })
    .from(imageQualityReviews)
    .where(
      and(
        eq(imageQualityReviews.labId, labId),
        sql`${imageQualityReviews.examType} IS NOT NULL`,
      )
    )
    .groupBy(imageQualityReviews.examType)
    .orderBy(sql`count(${imageQualityReviews.id}) DESC`);
  return rows;
}

/**
 * Per-member exam type breakdown: how many of each exam type a staff member has been reviewed on.
 */
export async function getIqrMemberExamBreakdown(labId: number, revieweeLabMemberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    examType: imageQualityReviews.examType,
    reviewCount: count(imageQualityReviews.id),
    avgScore: avg(imageQualityReviews.qualityScore),
  })
    .from(imageQualityReviews)
    .where(
      and(
        eq(imageQualityReviews.labId, labId),
        eq(imageQualityReviews.revieweeLabMemberId, revieweeLabMemberId),
        sql`${imageQualityReviews.examType} IS NOT NULL`,
      )
    )
    .groupBy(imageQualityReviews.examType)
    .orderBy(sql`count(${imageQualityReviews.id}) DESC`);
}

// ─── Physician Peer Review DB Helpers ────────────────────────────────────────

/** Create a new Physician Peer Review */
export async function createPhysicianPeerReview(data: InsertPhysicianPeerReview) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(physicianPeerReviews).values(data);
  return result;
}

/** Get all Physician Peer Reviews for a user (most recent first) */
export async function getPhysicianPeerReviewsByUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(physicianPeerReviews)
    .where(eq(physicianPeerReviews.userId, userId))
    .orderBy(desc(physicianPeerReviews.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Get all Physician Peer Reviews for a lab (most recent first) */
export async function getPhysicianPeerReviewsByLab(labId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(physicianPeerReviews)
    .where(eq(physicianPeerReviews.labId, labId))
    .orderBy(desc(physicianPeerReviews.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Get a single Physician Peer Review by ID */
export async function getPhysicianPeerReviewById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(physicianPeerReviews).where(eq(physicianPeerReviews.id, id));
  return row ?? null;
}

/** Update a Physician Peer Review */
export async function updatePhysicianPeerReview(id: number, userId: number, data: Partial<InsertPhysicianPeerReview>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.update(physicianPeerReviews).set({ ...data, updatedAt: new Date() })
    .where(and(eq(physicianPeerReviews.id, id), eq(physicianPeerReviews.userId, userId)));
}

/** Delete a Physician Peer Review */
export async function deletePhysicianPeerReview(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.delete(physicianPeerReviews)
    .where(and(eq(physicianPeerReviews.id, id), eq(physicianPeerReviews.userId, userId)));
}

/** Lab-wide staff snapshot for Physician Peer Reviews (for Lab Admin Analytics) */
export async function getPhysicianPeerReviewStaffSnapshot(labId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    revieweeLabMemberId: physicianPeerReviews.revieweeLabMemberId,
    revieweeName: physicianPeerReviews.revieweeName,
    reviewCount: count(physicianPeerReviews.id),
    avgConcordanceScore: avg(physicianPeerReviews.concordanceScore),
    lastReviewDate: sql<string>`MAX(${physicianPeerReviews.createdAt})`,
  })
    .from(physicianPeerReviews)
    .where(and(
      eq(physicianPeerReviews.labId, labId),
      sql`${physicianPeerReviews.revieweeLabMemberId} IS NOT NULL`,
    ))
    .groupBy(physicianPeerReviews.revieweeLabMemberId, physicianPeerReviews.revieweeName)
    .orderBy(sql`avg(${physicianPeerReviews.concordanceScore}) DESC`);
}

//** Monthly summary of physician peer reviews for Lab Admin Analytics */
export async function getPhysicianPeerReviewMonthlySummary(labId: number, examType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(physicianPeerReviews.labId, labId)];
  if (examType) conditions.push(eq(physicianPeerReviews.examType, examType));
  return db.select({
    month: sql<string>`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`,
    reviewCount: count(),
    avgConcordanceScore: avg(physicianPeerReviews.concordanceScore),
    physiciansReviewed: sql<number>`COUNT(DISTINCT physicianPeerReviews.revieweeLabMemberId)`,
  })
    .from(physicianPeerReviews)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`);
}

/** Trend for a specific physician (for Lab Admin Analytics growth curve) */
export async function getPhysicianPeerReviewTrend(labId: number, revieweeLabMemberId: number, examType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(physicianPeerReviews.labId, labId),
    eq(physicianPeerReviews.revieweeLabMemberId, revieweeLabMemberId),
  ];
  if (examType) conditions.push(eq(physicianPeerReviews.examType, examType));
  return db.select({
    month: sql<string>`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`,
    avgConcordanceScore: avg(physicianPeerReviews.concordanceScore),
    reviewCount: count(),
  })
    .from(physicianPeerReviews)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(physicianPeerReviews.createdAt, '%Y-%m')`);
}

// ─── Physician Notifications ──────────────────────────────────────────────────

/** Create a notification for a physician after a Physician Peer Review is submitted */
export async function createPhysicianNotification(data: {
  recipientUserId: number;
  recipientLabMemberId?: number;
  reviewId: number;
  title: string;
  message: string;
  payload?: object;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(physicianNotifications).values({
    recipientUserId: data.recipientUserId,
    recipientLabMemberId: data.recipientLabMemberId ?? null,
    reviewId: data.reviewId,
    type: "peer_review_result",
    title: data.title,
    message: data.message,
    payload: data.payload ? JSON.stringify(data.payload) : null,
    isRead: false,
    isDismissed: false,
  });
}

/** Get all notifications for a user (newest first, excluding dismissed) */
export async function getPhysicianNotifications(recipientUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(physicianNotifications)
    .where(and(
      eq(physicianNotifications.recipientUserId, recipientUserId),
      eq(physicianNotifications.isDismissed, false),
    ))
    .orderBy(desc(physicianNotifications.createdAt))
    .limit(limit);
}

/** Count unread notifications for a user */
export async function countUnreadPhysicianNotifications(recipientUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() })
    .from(physicianNotifications)
    .where(and(
      eq(physicianNotifications.recipientUserId, recipientUserId),
      eq(physicianNotifications.isRead, false),
      eq(physicianNotifications.isDismissed, false),
    ));
  return result[0]?.cnt ?? 0;
}

/** Mark a single notification as read */
export async function markPhysicianNotificationRead(id: number, recipientUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(physicianNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(physicianNotifications.id, id),
      eq(physicianNotifications.recipientUserId, recipientUserId),
    ));
}

/** Mark all notifications as read for a user */
export async function markAllPhysicianNotificationsRead(recipientUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(physicianNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(physicianNotifications.recipientUserId, recipientUserId),
      eq(physicianNotifications.isRead, false),
    ));
}

/** Dismiss (soft-delete) a notification */
export async function dismissPhysicianNotification(id: number, recipientUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(physicianNotifications)
    .set({ isDismissed: true })
    .where(and(
      eq(physicianNotifications.id, id),
      eq(physicianNotifications.recipientUserId, recipientUserId),
    ));
}

// ─── Accreditation Readiness Helpers ─────────────────────────────────────────

/** Get or initialize readiness record for a lab */
export async function getAccreditationReadiness(labId: number, userId: number): Promise<AccreditationReadiness | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(accreditationReadiness)
    .where(eq(accreditationReadiness.labId, labId))
    .orderBy(desc(accreditationReadiness.updatedAt))
    .limit(1);
  if (existing.length > 0) return existing[0];
  // Auto-create a blank record
  await db.insert(accreditationReadiness).values({
    labId,
    userId,
    checklistProgress: "{}",
    itemNotes: "{}",
    completionPct: 0,
  });
  const created = await db.select().from(accreditationReadiness)
    .where(eq(accreditationReadiness.labId, labId)).limit(1);
  return created[0] ?? null;
}

/** Save checklist progress for a lab */
export async function saveAccreditationReadiness(
  labId: number,
  userId: number,
  checklistProgress: Record<string, boolean>,
  itemNotes: Record<string, string>,
  completionPct: number,
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: accreditationReadiness.id })
    .from(accreditationReadiness)
    .where(eq(accreditationReadiness.labId, labId))
    .limit(1);
  const progressStr = JSON.stringify(checklistProgress);
  const notesStr = JSON.stringify(itemNotes);
  if (existing.length > 0) {
    await db.update(accreditationReadiness)
      .set({ checklistProgress: progressStr, itemNotes: notesStr, completionPct, userId })
      .where(eq(accreditationReadiness.labId, labId));
  } else {
    await db.insert(accreditationReadiness).values({
      labId,
      userId,
      checklistProgress: progressStr,
      itemNotes: notesStr,
      completionPct,
    });
  }
}

// ─── Case Mix Submission Helpers ──────────────────────────────────────────────

/** Create a new case mix submission */
export async function createCaseMixSubmission(data: InsertCaseMixSubmission) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(caseMixSubmissions).values(data);
}

/** Get all case mix submissions for a lab */
export async function getCaseMixSubmissions(labId: number, limit = 200, offset = 0): Promise<CaseMixSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseMixSubmissions)
    .where(eq(caseMixSubmissions.labId, labId))
    .orderBy(desc(caseMixSubmissions.createdAt))
    .limit(limit).offset(offset);
}

/** Get case mix submission counts by modality and caseType for a lab */
export async function getCaseMixSummary(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    modality: caseMixSubmissions.modality,
    caseType: caseMixSubmissions.caseType,
    count: count(caseMixSubmissions.id),
  })
    .from(caseMixSubmissions)
    .where(eq(caseMixSubmissions.labId, labId))
    .groupBy(caseMixSubmissions.modality, caseMixSubmissions.caseType);
  return rows;
}

/** Delete a case mix submission */
export async function deleteCaseMixSubmission(id: number, labId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(caseMixSubmissions)
    .where(and(eq(caseMixSubmissions.id, id), eq(caseMixSubmissions.labId, labId)));
}

/** Update a case mix submission status */
export async function updateCaseMixSubmissionStatus(id: number, labId: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(caseMixSubmissions)
    .set({ status })
    .where(and(eq(caseMixSubmissions.id, id), eq(caseMixSubmissions.labId, labId)));
}

// ─── CME Helpers ──────────────────────────────────────────────────────────────
/** Get CME credit totals per staff member for a lab */
export async function getCmeStaffSummary(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    labMemberId: cmeEntries.labMemberId,
    totalCredits: sql<number>`COALESCE(SUM(${cmeEntries.creditHours}), 0)`,
    entryCount: count(cmeEntries.id),
  })
    .from(cmeEntries)
    .where(eq(cmeEntries.labId, labId))
    .groupBy(cmeEntries.labMemberId);
  return rows;
}

/** Get all CME entries for a specific lab member */
export async function getCmeEntriesForMember(labId: number, labMemberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(cmeEntries)
    .where(and(eq(cmeEntries.labId, labId), eq(cmeEntries.labMemberId, labMemberId)))
    .orderBy(desc(cmeEntries.activityDate));
}

/** Add a CME entry for a staff member */
export async function addCmeEntry(data: {
  labId: number;
  labMemberId: number;
  title: string;
  provider?: string;
  category: "echo_specific" | "cardiovascular" | "general_medical" | "technical" | "safety" | "leadership" | "other";
  activityDate: string;
  creditHours: number;
  certificationNumber?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(cmeEntries).values(data);
}

/** Delete a CME entry */
export async function deleteCmeEntry(id: number, labId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cmeEntries)
    .where(and(eq(cmeEntries.id, id), eq(cmeEntries.labId, labId)));
}

// ─── Accreditation Readiness Navigator (Free-Tier) ────────────────────────────
// Independent from the DIY Tool readiness — keyed by userId only (no labId required).

/** Get or initialize readiness record for a user (Navigator / free-tier) */
export async function getAccreditationReadinessNavigator(userId: number): Promise<AccreditationReadinessNavigator | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(accreditationReadinessNavigator)
    .where(eq(accreditationReadinessNavigator.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];
  // Auto-create a blank record
  await db.insert(accreditationReadinessNavigator).values({
    userId,
    checklistProgress: "{}",
    itemNotes: "{}",
    completionPct: 0,
  });
  const created = await db.select().from(accreditationReadinessNavigator)
    .where(eq(accreditationReadinessNavigator.userId, userId)).limit(1);
  return created[0] ?? null;
}

/** Save checklist progress for a user (Navigator / free-tier) */
export async function saveAccreditationReadinessNavigator(
  userId: number,
  checklistProgress: Record<string, boolean>,
  itemNotes: Record<string, string>,
  completionPct: number,
) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: accreditationReadinessNavigator.id })
    .from(accreditationReadinessNavigator)
    .where(eq(accreditationReadinessNavigator.userId, userId))
    .limit(1);
  const progressStr = JSON.stringify(checklistProgress);
  const notesStr = JSON.stringify(itemNotes);
  if (existing.length > 0) {
    await db.update(accreditationReadinessNavigator)
      .set({ checklistProgress: progressStr, itemNotes: notesStr, completionPct })
      .where(eq(accreditationReadinessNavigator.userId, userId));
  } else {
    await db.insert(accreditationReadinessNavigator).values({
      userId,
      checklistProgress: progressStr,
      itemNotes: notesStr,
      completionPct,
    });
  }
}

// ─── Readiness Auto-Check Signals ────────────────────────────────────────────
/**
 * Returns a map of checklist item IDs → true when the corresponding DB records
 * exist for the given lab. Only items that can be auto-detected are included.
 * Items NOT in the returned map must be checked manually by the user.
 */
export async function getReadinessAutoChecks(labId: number): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return {};

  const result: Record<string, boolean> = {};

  // ── Personnel ──────────────────────────────────────────────────────────────
  const members = await db
    .select({ role: labMembers.role, id: labMembers.id })
    .from(labMembers)
    .where(and(eq(labMembers.labId, labId), eq(labMembers.isActive, true)));

  const hasMedDir = members.some(m => m.role === "medical_director");
  const hasTechDir = members.some(m => m.role === "technical_director");
  const hasSonographers = members.some(m => m.role === "technical_staff");
  const hasPhysicians = members.some(m => m.role === "medical_staff");

  result["s2-md-1"] = hasMedDir;
  result["s2-td-1"] = hasTechDir;
  result["s2-s-1"] = hasSonographers;
  result["s2-s-2"] = hasSonographers;
  result["s2-p-1"] = hasPhysicians;

  // ── CME documented ─────────────────────────────────────────────────────────
  const cmeRows = await db
    .select({ labMemberId: cmeEntries.labMemberId, total: count(cmeEntries.id) })
    .from(cmeEntries)
    .where(eq(cmeEntries.labId, labId))
    .groupBy(cmeEntries.labMemberId);

  const membersWithCme = new Set(cmeRows.filter(r => r.total > 0).map(r => r.labMemberId));
  const medDirIds = members.filter(m => m.role === "medical_director").map(m => m.id);
  const techDirIds = members.filter(m => m.role === "technical_director").map(m => m.id);
  const sonoIds = members.filter(m => m.role === "technical_staff").map(m => m.id);
  const physIds = members.filter(m => m.role === "medical_staff").map(m => m.id);

  result["s2-md-6"] = medDirIds.length > 0 && medDirIds.some(id => membersWithCme.has(id));
  result["s2-td-5"] = techDirIds.length > 0 && techDirIds.some(id => membersWithCme.has(id));
  result["s2-s-6"] = sonoIds.length > 0 && sonoIds.some(id => membersWithCme.has(id));
  result["s2-p-4"] = physIds.length > 0 && physIds.some(id => membersWithCme.has(id));

  // ── Policies ───────────────────────────────────────────────────────────────
  // Policies are scoped by authorId. For lab admins the authorId is the userId
  // of the lab owner, so we look up the lab's adminUserId first.
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);

  if (labRow.length > 0) {
    const adminUserId = labRow[0].adminUserId;
    const activePolicies = await db
      .select({ category: policies.category })
      .from(policies)
      .where(and(eq(policies.authorId, adminUserId), eq(policies.status, "active")));

    const policyCategories = new Set(activePolicies.map(p => p.category));
    result["s4-c-1"] = policyCategories.has("protocol");
    result["s4-c-2"] = policyCategories.has("protocol");
    result["s4-c-3"] = policyCategories.has("protocol");
    result["s4-c-4"] = policyCategories.has("protocol");
    result["s4-s-1"] = policyCategories.has("emergency");
    result["s4-s-2"] = policyCategories.has("infection_control");
    result["s4-s-3"] = policyCategories.has("patient_safety");
    result["s4-qa-1"] = policyCategories.has("quality_assurance");
    result["s4-qa-2"] = policyCategories.has("quality_assurance");
    result["s4-qa-3"] = policyCategories.has("quality_assurance");
    result["s4-qa-4"] = policyCategories.has("report_turnaround");
    result["s4-a-3"] = policyCategories.has("staff_competency");
    result["s4-a-5"] = policyCategories.has("staff_competency");
  }

  // ── Image Quality Reviews ──────────────────────────────────────────────────
  const iqrCount = await db
    .select({ n: count(imageQualityReviews.id) })
    .from(imageQualityReviews)
    .where(eq(imageQualityReviews.labId, labId));
  const hasIqr = (iqrCount[0]?.n ?? 0) > 0;
  result["s5-iqr-1"] = hasIqr;
  result["s5-iqr-2"] = hasIqr;

  // ── Physician Peer Reviews ─────────────────────────────────────────────────
  const pprCount = await db
    .select({ n: count(physicianPeerReviews.id) })
    .from(physicianPeerReviews)
    .where(eq(physicianPeerReviews.labId, labId));
  const hasPpr = (pprCount[0]?.n ?? 0) > 0;
  result["s5-pr-1"] = hasPpr;
  result["s5-pr-2"] = hasPpr;
  result["s2-p-5"] = hasPpr;

  // ── Correlation Studies ────────────────────────────────────────────────────
  // echoCorrelations uses userId (the lab admin's userId) as the scope key
  if (labRow.length > 0) {
    const adminUserId = labRow[0].adminUserId;
    const corrCount = await db
      .select({ n: count(echoCorrelations.id) })
      .from(echoCorrelations)
      .where(eq(echoCorrelations.userId, adminUserId));
    const hasCorr = (corrCount[0]?.n ?? 0) > 0;
    result["s5-cor-1"] = hasCorr;
    result["s5-cor-2"] = hasCorr;
  }

  // ── Case Mix Submissions ───────────────────────────────────────────────────
  const caseMixRows = await db
    .select({
      modality: caseMixSubmissions.modality,
      isTechDir: caseMixSubmissions.isTechDirectorCase,
      isMedDir: caseMixSubmissions.isMedDirectorCase,
    })
    .from(caseMixSubmissions)
    .where(eq(caseMixSubmissions.labId, labId));

  const modalitiesPresent = new Set(caseMixRows.map(r => r.modality));
  result["s6-cm-1"] = modalitiesPresent.has("ATTE");
  result["s6-cm-2"] = modalitiesPresent.has("ATEE");
  result["s6-cm-3"] = modalitiesPresent.has("STRESS");
  result["s6-cm-4"] = modalitiesPresent.has("ACTE");
  result["s6-cm-5"] = modalitiesPresent.has("PTTE");
  result["s6-cm-6"] = modalitiesPresent.has("PTEE");
  result["s6-cm-7"] = modalitiesPresent.has("FETAL");
  result["s6-cm-9"] = caseMixRows.some(r => r.isTechDir);
  result["s6-cm-10"] = caseMixRows.some(r => r.isMedDir);

  return result;
}

// ─── RBAC / User Roles ────────────────────────────────────────────────────────

export type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "accreditation_manager";

/** Return all roles assigned to a user */
export async function getUserRoles(userId: number): Promise<AppRole[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map(r => r.role as AppRole);
}

/** Check if a user has a specific role */
export async function userHasRole(userId: number, role: AppRole): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).limit(1);
  return rows.length > 0;
}

/** Assign a role to a user (idempotent) */
export async function assignRole(
  userId: number,
  role: AppRole,
  assignedByUserId: number,
  grantedByLabId?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Check if already assigned
  const existing = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).limit(1);
  if (existing.length > 0) return; // already has role
  await db.insert(userRoles).values({
    userId,
    role,
    assignedByUserId,
    grantedByLabId: grantedByLabId ?? null,
  });
  // Sync isPremium flag when premium_user role is granted
  if (role === "premium_user") {
    await setPremiumStatus(userId, true, "admin");
  }
}

/** Remove a role from a user */
export async function removeRole(userId: number, role: AppRole): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  // Sync isPremium flag when premium_user role is revoked
  if (role === "premium_user") {
    await setPremiumStatus(userId, false, "admin");
  }
}

/** Ensure a user has the base "user" role (called on every login) */
export async function ensureUserRole(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "user"))).limit(1);
  if (existing.length > 0) return;
  await db.insert(userRoles).values({ userId, role: "user", assignedByUserId: userId });
}

/** Mark a user as enrolled in the Thinkific free membership (sets thinkificEnrolledAt to now) */
export async function markThinkificEnrolled(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users)
    .set({ thinkificEnrolledAt: new Date() })
    .where(eq(users.id, userId));
}

/** List all users with their roles (for admin panel) */
export type UserTypeFilter =
  | 'all'
  | 'pending'
  | 'active'
  | 'premium'
  | 'diy_admin'
  | 'diy_user'
  | 'platform_admin'
  | 'free';

export async function listUsersWithRoles(
  limit = 100,
  offset = 0,
  userType: UserTypeFilter = 'all',
  searchQuery = '',
) {
  const db = await getDb();
  if (!db) return [];

  // For role-based filters, get matching userIds first
  const ROLE_FILTERS: Partial<Record<UserTypeFilter, AppRole>> = {
    premium: 'premium_user',
    diy_admin: 'diy_admin',
    diy_user: 'diy_user',
    platform_admin: 'platform_admin',
  };

  let roleFilteredIds: number[] | null = null;
  if (userType in ROLE_FILTERS) {
    const role = ROLE_FILTERS[userType as keyof typeof ROLE_FILTERS]!;
    const rows = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.role, role));
    roleFilteredIds = rows.map(r => r.userId);
    if (roleFilteredIds.length === 0) return [];
  }

  // Build WHERE conditions
  const conditions: any[] = [];
  if (userType === 'pending') conditions.push(eq(users.isPending, true));
  if (userType === 'active') conditions.push(eq(users.isPending, false));
  if (roleFilteredIds !== null) {
    conditions.push(or(...roleFilteredIds.map(id => eq(users.id, id))));
  }
  if (searchQuery.trim()) {
    const q = `%${searchQuery.trim()}%`;
    conditions.push(or(
      like(users.name, q),
      like(users.email, q),
      like(users.displayName, q),
    ));
  }

  const baseQuery = db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  const allUsers = conditions.length > 0
    ? await baseQuery.where(and(...conditions))
    : await baseQuery;

  if (allUsers.length === 0) return [];

  const userIds = allUsers.map(u => u.id);
  const allRoles = await db.select().from(userRoles)
    .where(or(...userIds.map(id => eq(userRoles.userId, id))));
  const roleMap = new Map<number, AppRole[]>();
  for (const r of allRoles) {
    const list = roleMap.get(r.userId) ?? [];
    list.push(r.role as AppRole);
    roleMap.set(r.userId, list);
  }

  let result = allUsers.map(u => ({
    ...u,
    roles: roleMap.get(u.id) ?? [],
  }));

  // 'free' = active users with no special roles
  if (userType === 'free') {
    result = result.filter(u => u.roles.length === 0 && !u.isPending);
  }

  return result;
}

/** Count total users */
export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(users);
  return result[0]?.total ?? 0;
}

/** Get users with a specific role (for seat management) */
export async function getUsersByRole(role: AppRole) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userRoles).where(eq(userRoles.role, role));
  if (rows.length === 0) return [];
  const userIds = rows.map(r => r.userId);
  const userList = await db.select().from(users)
    .where(or(...userIds.map(id => eq(users.id, id))));
  return userList.map(u => ({
    ...u,
    roleRow: rows.find(r => r.userId === u.id),
  }));
}

/** Find a user by email address (case-insensitive) */
export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalised = email.trim().toLowerCase();
  // Try exact match first, then case-insensitive via sql
  const result = await db.select().from(users)
    .where(sql`LOWER(${users.email}) = ${normalised}`)
    .limit(1);
  return result[0] ?? undefined;
}

/** Find a user by email and return with their roles */
export async function findUserByEmailWithRoles(email: string) {
  const user = await findUserByEmail(email);
  if (!user) return undefined;
  const roles = await getUserRoles(user.id);
  return { ...user, roles };
}

/**
 * Create a pending (pre-registered) stub user account for an email address.
 * Used when an admin assigns a role to a user who has never signed in.
 * When the user first signs in via OAuth, the pending account is merged
 * (matched by email) and isPending is cleared.
 * Returns the new user's id.
 */
export async function createPendingUser(email: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const normalised = email.trim().toLowerCase();
  // Generate a unique synthetic openId so the NOT NULL constraint is satisfied
  const syntheticOpenId = `pending_${normalised}_${Date.now()}`;
  await db.insert(users).values({
    openId: syntheticOpenId,
    email: normalised,
    name: normalised,
    isPending: true,
    pendingCreatedAt: new Date(),
    lastSignedIn: new Date(),
  });
  // Retrieve the inserted row to get the auto-incremented id
  const result = await db.select().from(users)
    .where(sql`LOWER(${users.email}) = ${normalised} AND ${users.isPending} = 1`)
    .orderBy(desc(users.id))
    .limit(1);
  if (!result[0]) throw new Error(`Failed to create pending user for ${email}`);
  return result[0].id;
}

/**
 * Activate a pending user account when they first sign in via OAuth.
 * Merges the pending stub (matched by email) with the real OAuth identity.
 * Returns true if a pending account was found and activated.
 */
export async function activatePendingUser(email: string, realOpenId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const normalised = email.trim().toLowerCase();
  const pending = await db.select().from(users)
    .where(sql`LOWER(${users.email}) = ${normalised} AND ${users.isPending} = 1`)
    .limit(1);
  if (!pending[0]) return false;
  // Update the pending stub with the real OAuth identity and clear isPending
  await db.update(users).set({
    openId: realOpenId,
    isPending: false,
    pendingCreatedAt: null,
    lastSignedIn: new Date(),
  }).where(eq(users.id, pending[0].id));
  return true;
}

/** Get DIY users for a specific lab (seat management) */
export async function getDiyUsersForLab(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userRoles)
    .where(and(eq(userRoles.role, "diy_user"), eq(userRoles.grantedByLabId, labId)));
  if (rows.length === 0) return [];
  const userIds = rows.map(r => r.userId);
  const userList = await db.select().from(users)
    .where(or(...userIds.map(id => eq(users.id, id))));
  return userList.map(u => ({
    ...u,
    grantedAt: rows.find(r => r.userId === u.id)?.createdAt,
  }));
}

/** Count users who have been pre-registered but have not yet signed in (isPending = true) */
export async function countPendingUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(eq(users.isPending, true));
  return Number(rows[0]?.count ?? 0);
}

// ─── ScanCoach Media helpers ──────────────────────────────────────────────────

/** Insert a new media record for a ScanCoach view */
export async function insertScanCoachMedia(data: InsertScanCoachMedia): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(scanCoachMedia).values(data);
  return (result[0] as any).insertId as number;
}

/** Get all media for a specific view, ordered by sortOrder */
export async function getScanCoachMediaByView(viewId: string): Promise<ScanCoachMedia[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scanCoachMedia)
    .where(eq(scanCoachMedia.viewId, viewId))
    .orderBy(scanCoachMedia.sortOrder);
}

/** Get all media for multiple views at once (used for bulk preload) */
export async function getScanCoachMediaByViews(viewIds: string[]): Promise<ScanCoachMedia[]> {
  if (!viewIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scanCoachMedia)
    .where(inArray(scanCoachMedia.viewId, viewIds))
    .orderBy(scanCoachMedia.sortOrder);
}

/** Delete a media record by id */
export async function deleteScanCoachMedia(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(scanCoachMedia).where(eq(scanCoachMedia.id, id));
}

// ─── Physician Over-Read Invitation Helpers ───────────────────────────────────

/** Create a new over-read invitation (Step 1 trigger) */
export async function createOverReadInvitation(data: InsertPhysicianOverReadInvitation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(physicianOverReadInvitations).values(data);
  return (result as any).insertId as number;
}

/** Get an invitation by its access token (used by the public form endpoint) */
export async function getOverReadInvitationByToken(token: string): Promise<PhysicianOverReadInvitation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(physicianOverReadInvitations)
    .where(eq(physicianOverReadInvitations.accessToken, token))
    .limit(1);
  return row;
}

/** Get all invitations for a lab */
export async function getOverReadInvitationsByLab(labId: number): Promise<PhysicianOverReadInvitation[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(physicianOverReadInvitations)
    .where(eq(physicianOverReadInvitations.labId, labId))
    .orderBy(desc(physicianOverReadInvitations.createdAt));
}

/** Get a single invitation by ID */
export async function getOverReadInvitationById(id: number): Promise<PhysicianOverReadInvitation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(physicianOverReadInvitations)
    .where(eq(physicianOverReadInvitations.id, id))
    .limit(1);
  return row;
}

/** Update invitation status */
export async function updateOverReadInvitationStatus(
  id: number,
  status: "pending" | "opened" | "completed" | "expired",
  extra?: { openedAt?: Date; completedAt?: Date; submissionId?: number }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(physicianOverReadInvitations)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(physicianOverReadInvitations.id, id));
}

/** Delete an invitation */
export async function deleteOverReadInvitation(id: number, labId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(physicianOverReadInvitations)
    .where(and(eq(physicianOverReadInvitations.id, id), eq(physicianOverReadInvitations.labId, labId)));
}

// ─── Physician Over-Read Submission Helpers (Step 1 results) ──────────────────

/** Save a physician's over-read submission */
export async function createOverReadSubmission(data: InsertPhysicianOverReadSubmission): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(physicianOverReadSubmissions).values(data);
  return (result as any).insertId as number;
}

/** Get a submission by ID */
export async function getOverReadSubmissionById(id: number): Promise<PhysicianOverReadSubmission | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(physicianOverReadSubmissions)
    .where(eq(physicianOverReadSubmissions.id, id))
    .limit(1);
  return row;
}

/** Get all submissions for a lab */
export async function getOverReadSubmissionsByLab(labId: number): Promise<PhysicianOverReadSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(physicianOverReadSubmissions)
    .where(eq(physicianOverReadSubmissions.labId, labId))
    .orderBy(desc(physicianOverReadSubmissions.createdAt));
}

// ─── Physician Comparison Review Helpers (Step 2) ─────────────────────────────

/** Create a comparison review */
export async function createComparisonReview(data: InsertPhysicianComparisonReview): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(physicianComparisonReviews).values(data);
  return (result as any).insertId as number;
}

/** Get all comparison reviews for a lab */
export async function getComparisonReviewsByLab(labId: number): Promise<PhysicianComparisonReview[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(physicianComparisonReviews)
    .where(eq(physicianComparisonReviews.labId, labId))
    .orderBy(desc(physicianComparisonReviews.createdAt));
}

/** Get a comparison review by ID */
export async function getComparisonReviewById(id: number): Promise<PhysicianComparisonReview | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select()
    .from(physicianComparisonReviews)
    .where(eq(physicianComparisonReviews.id, id))
    .limit(1);
  return row;
}

/** Delete a comparison review */
export async function deleteComparisonReview(id: number, labId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(physicianComparisonReviews)
    .where(and(eq(physicianComparisonReviews.id, id), eq(physicianComparisonReviews.labId, labId)));
}

/** Monthly summary for physician comparison reviews (over-read workflow) */
export async function getComparisonReviewsMonthlySummary(labId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    reviewCount: count(),
    avgConcordanceScore: avg(physicianComparisonReviews.concordanceScore),
    physiciansReviewed: sql<number>`COUNT(DISTINCT overReadingPhysician)`,
  })
    .from(physicianComparisonReviews)
    .where(eq(physicianComparisonReviews.labId, labId))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`);
}

// ─── Possible Case Studies ────────────────────────────────────────────────────

/** Generate next sequential case study ID for a lab, e.g. "CS-2026-001" */
export async function generateCaseStudyId(labId: number): Promise<string> {
  const db = await getDb();
  if (!db) return `CS-${new Date().getFullYear()}-001`;
  const year = new Date().getFullYear();
  const existing = await db
    .select({ caseStudyId: possibleCaseStudies.caseStudyId })
    .from(possibleCaseStudies)
    .where(
      and(
        eq(possibleCaseStudies.labId, labId),
        sql`YEAR(createdAt) = ${year}`
      )
    );
  const maxSeq = existing.reduce((max, r) => {
    const match = r.caseStudyId?.match(/CS-\d{4}-(\d+)/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `CS-${year}-${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function createPossibleCaseStudy(data: InsertPossibleCaseStudy) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(possibleCaseStudies).values(data);
  return result;
}

export async function getPossibleCaseStudies(labId: number, filters?: { examType?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(possibleCaseStudies.labId, labId)];
  if (filters?.examType) conditions.push(eq(possibleCaseStudies.examType, filters.examType));
  if (filters?.status) conditions.push(eq(possibleCaseStudies.submissionStatus, filters.status as any));
  return db
    .select()
    .from(possibleCaseStudies)
    .where(and(...conditions))
    .orderBy(desc(possibleCaseStudies.createdAt));
}

export async function updatePossibleCaseStudy(id: number, labId: number, data: Partial<InsertPossibleCaseStudy>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(possibleCaseStudies)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(possibleCaseStudies.id, id), eq(possibleCaseStudies.labId, labId)));
}

export async function deletePossibleCaseStudy(id: number, labId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(possibleCaseStudies)
    .where(and(eq(possibleCaseStudies.id, id), eq(possibleCaseStudies.labId, labId)));
}

// ─── Accreditation Form Builder DB Helpers ────────────────────────────────────

export async function listFormTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormTemplates).orderBy(accreditationFormTemplates.name);
}

export async function getFormTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(accreditationFormTemplates).where(eq(accreditationFormTemplates.id, id));
  return rows[0] ?? null;
}

export async function createFormTemplate(data: InsertAccreditationFormTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormTemplates).values(data);
  return (result as any).insertId as number;
}

export async function updateFormTemplate(id: number, data: Partial<InsertAccreditationFormTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormTemplates).set({ ...data, updatedAt: new Date() }).where(eq(accreditationFormTemplates.id, id));
}

export async function deleteFormTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Cascade delete all related data
  const sections = await db.select({ id: accreditationFormSections.id }).from(accreditationFormSections).where(eq(accreditationFormSections.templateId, id));
  for (const s of sections) {
    const items = await db.select({ id: accreditationFormItems.id }).from(accreditationFormItems).where(eq(accreditationFormItems.sectionId, s.id));
    for (const item of items) {
      await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, item.id));
    }
    await db.delete(accreditationFormItems).where(eq(accreditationFormItems.sectionId, s.id));
  }
  await db.delete(accreditationFormSections).where(eq(accreditationFormSections.templateId, id));
  await db.delete(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, id));
  await db.delete(accreditationFormTemplates).where(eq(accreditationFormTemplates.id, id));
}

export async function getFullFormTemplate(id: number) {
  const db = await getDb();
  if (!db) return null;
  const template = await getFormTemplateById(id);
  if (!template) return null;
  const sections = await db.select().from(accreditationFormSections).where(eq(accreditationFormSections.templateId, id)).orderBy(accreditationFormSections.sortOrder);
  const items = await db.select().from(accreditationFormItems).where(eq(accreditationFormItems.templateId, id)).orderBy(accreditationFormItems.sortOrder);
  const itemIds = items.map(i => i.id);
  const options = itemIds.length > 0 ? await db.select().from(accreditationFormOptions).where(inArray(accreditationFormOptions.itemId, itemIds)).orderBy(accreditationFormOptions.sortOrder) : [];
  const branchRules = await db.select().from(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, id));
  return { template, sections, items, options, branchRules };
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function createFormSection(data: InsertAccreditationFormSection) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormSections).values(data);
  return (result as any).insertId as number;
}

export async function updateFormSection(id: number, data: Partial<InsertAccreditationFormSection>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormSections).set(data).where(eq(accreditationFormSections.id, id));
}

export async function deleteFormSection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const items = await db.select({ id: accreditationFormItems.id }).from(accreditationFormItems).where(eq(accreditationFormItems.sectionId, id));
  for (const item of items) {
    await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, item.id));
  }
  await db.delete(accreditationFormItems).where(eq(accreditationFormItems.sectionId, id));
  await db.delete(accreditationFormSections).where(eq(accreditationFormSections.id, id));
}

export async function reorderFormSections(sectionOrders: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (const { id, sortOrder } of sectionOrders) {
    await db.update(accreditationFormSections).set({ sortOrder }).where(eq(accreditationFormSections.id, id));
  }
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function createFormItem(data: InsertAccreditationFormItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormItems).values(data);
  return (result as any).insertId as number;
}

export async function updateFormItem(id: number, data: Partial<InsertAccreditationFormItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormItems).set(data).where(eq(accreditationFormItems.id, id));
}

export async function deleteFormItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, id));
  await db.delete(accreditationFormBranchRules).where(
    or(eq(accreditationFormBranchRules.targetItemId, id), eq(accreditationFormBranchRules.conditionItemId, id))
  );
  await db.delete(accreditationFormItems).where(eq(accreditationFormItems.id, id));
}

export async function reorderFormItems(itemOrders: { id: number; sortOrder: number; sectionId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (const { id, sortOrder, sectionId } of itemOrders) {
    await db.update(accreditationFormItems).set({ sortOrder, sectionId }).where(eq(accreditationFormItems.id, id));
  }
}

// ─── Options ──────────────────────────────────────────────────────────────────

export async function createFormOption(data: InsertAccreditationFormOption) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormOptions).values(data);
  return (result as any).insertId as number;
}

export async function updateFormOption(id: number, data: Partial<InsertAccreditationFormOption>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormOptions).set(data).where(eq(accreditationFormOptions.id, id));
}

export async function deleteFormOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.id, id));
}

export async function replaceFormOptions(itemId: number, options: Omit<InsertAccreditationFormOption, "itemId">[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, itemId));
  if (options.length > 0) {
    await db.insert(accreditationFormOptions).values(options.map(o => ({ ...o, itemId })));
  }
}

// ─── Branch Rules ─────────────────────────────────────────────────────────────

export async function createFormBranchRule(data: InsertAccreditationFormBranchRule) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormBranchRules).values(data);
  return (result as any).insertId as number;
}

export async function updateFormBranchRule(id: number, data: Partial<InsertAccreditationFormBranchRule>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormBranchRules).set(data).where(eq(accreditationFormBranchRules.id, id));
}

export async function deleteFormBranchRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.id, id));
}

export async function getFormBranchRulesByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, templateId));
}

export type { AccreditationFormTemplate, InsertAccreditationFormTemplate, AccreditationFormSection, InsertAccreditationFormSection, AccreditationFormItem, InsertAccreditationFormItem, AccreditationFormOption, InsertAccreditationFormOption, AccreditationFormBranchRule, InsertAccreditationFormBranchRule };

// ─── Org Visibility Rules DB Helpers ─────────────────────────────────────────

export async function listDiyOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: diyOrganizations.id, name: diyOrganizations.name, accreditationTypes: diyOrganizations.accreditationTypes })
    .from(diyOrganizations)
    .orderBy(diyOrganizations.name);
}

export async function getOrgVisibilityRulesByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.templateId, templateId));
}

export async function upsertOrgVisibilityRule(data: InsertAccreditationFormOrgVisibilityRule) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormOrgVisibilityRules).values(data);
  return (result as any).insertId as number;
}

export async function updateOrgVisibilityRule(id: number, data: Partial<InsertAccreditationFormOrgVisibilityRule>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormOrgVisibilityRules).set({ ...data, updatedAt: new Date() }).where(eq(accreditationFormOrgVisibilityRules.id, id));
}

export async function deleteOrgVisibilityRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.id, id));
}

export async function saveOrgVisibilityRules(templateId: number, rules: InsertAccreditationFormOrgVisibilityRule[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.templateId, templateId));
  if (rules.length > 0) {
    await db.insert(accreditationFormOrgVisibilityRules).values(rules);
  }
}

export type { AccreditationFormOrgVisibilityRule, InsertAccreditationFormOrgVisibilityRule, DiyOrganization };

// ─── FORM TEMPLATE ASSIGNMENTS ────────────────────────────────────────────────

export async function getTemplateAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormTemplateAssignments).orderBy(accreditationFormTemplateAssignments.formType);
}

export async function getActiveTemplateForFormType(formType: string, orgId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Prefer org-specific assignment, fall back to global
  if (orgId) {
    const orgRow = await db.select().from(accreditationFormTemplateAssignments)
      .where(and(
        eq(accreditationFormTemplateAssignments.formType, formType),
        eq(accreditationFormTemplateAssignments.orgId, orgId),
        eq(accreditationFormTemplateAssignments.isActive, true)
      )).limit(1);
    if (orgRow.length > 0) return orgRow[0];
  }
  const globalRow = await db.select().from(accreditationFormTemplateAssignments)
    .where(and(
      eq(accreditationFormTemplateAssignments.formType, formType),
      eq(accreditationFormTemplateAssignments.isActive, true),
      sql`${accreditationFormTemplateAssignments.orgId} IS NULL`
    )).limit(1);
  return globalRow[0];
}

export async function getActiveFormMenuItems(orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all active assignments, prefer org-specific over global
  const rows = await db.select({
    id: accreditationFormTemplateAssignments.id,
    formType: accreditationFormTemplateAssignments.formType,
    templateId: accreditationFormTemplateAssignments.templateId,
    orgId: accreditationFormTemplateAssignments.orgId,
    templateName: accreditationFormTemplates.name,
    templateDescription: accreditationFormTemplates.description,
  })
    .from(accreditationFormTemplateAssignments)
    .innerJoin(accreditationFormTemplates, eq(accreditationFormTemplateAssignments.templateId, accreditationFormTemplates.id))
    .where(eq(accreditationFormTemplateAssignments.isActive, true))
    .orderBy(accreditationFormTemplateAssignments.formType);
  // Deduplicate: prefer org-specific over global for same formType
  const seen = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    const key = row.formType;
    const existing = seen.get(key);
    if (!existing || (row.orgId === orgId && existing.orgId !== orgId)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

export async function upsertTemplateAssignment(data: InsertAccreditationFormTemplateAssignment) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  // Deactivate any existing assignment for same formType + orgId scope
  await db.update(accreditationFormTemplateAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(accreditationFormTemplateAssignments.formType, data.formType),
      data.orgId
        ? eq(accreditationFormTemplateAssignments.orgId, data.orgId)
        : sql`${accreditationFormTemplateAssignments.orgId} IS NULL`
    ));
  const [result] = await db.insert(accreditationFormTemplateAssignments).values({ ...data, isActive: true });
  return (result as any).insertId as number;
}

export async function deleteTemplateAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.delete(accreditationFormTemplateAssignments).where(eq(accreditationFormTemplateAssignments.id, id));
}

// ─── FORM SUBMISSIONS ─────────────────────────────────────────────────────────

export async function createFormSubmission(data: InsertAccreditationFormSubmission) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [result] = await db.insert(accreditationFormSubmissions).values(data);
  return (result as any).insertId as number;
}

export async function getFormSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(accreditationFormSubmissions).where(eq(accreditationFormSubmissions.id, id)).limit(1);
  return rows[0];
}

export async function getFormSubmissionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormSubmissions)
    .where(eq(accreditationFormSubmissions.submittedByUserId, userId))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function getFormSubmissionsByOrg(orgId: number, formType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(accreditationFormSubmissions.orgId, orgId)];
  if (formType) conditions.push(eq(accreditationFormSubmissions.formType, formType));
  return db.select().from(accreditationFormSubmissions)
    .where(and(...conditions))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function getFormSubmissionsByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormSubmissions)
    .where(eq(accreditationFormSubmissions.templateId, templateId))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function updateFormSubmissionStatus(id: number, status: 'draft' | 'submitted' | 'reviewed') {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(accreditationFormSubmissions).set({ status, updatedAt: new Date() }).where(eq(accreditationFormSubmissions.id, id));
}

// ─── Form Responses: Advanced Query Helpers ─────────────────────────────────

export interface FormSubmissionFilter {
  labId: number;
  formType?: string;
  templateId?: number;
  submittedByUserId?: number;
  status?: 'draft' | 'submitted' | 'reviewed';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export async function getFormSubmissionsForLab(filter: FormSubmissionFilter) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  // Resolve labId → adminUserId → diyOrganizations.ownerUserId → orgId
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, filter.labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return { rows: [], total: 0 };
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return { rows: [], total: 0 };
  const conditions: Parameters<typeof and>[0][] = [eq(accreditationFormSubmissions.orgId, orgId)];
  if (filter.formType) conditions.push(eq(accreditationFormSubmissions.formType, filter.formType));
  if (filter.templateId) conditions.push(eq(accreditationFormSubmissions.templateId, filter.templateId));
  if (filter.submittedByUserId) conditions.push(eq(accreditationFormSubmissions.submittedByUserId, filter.submittedByUserId));
  if (filter.status) conditions.push(eq(accreditationFormSubmissions.status, filter.status));
  if (filter.dateFrom) conditions.push(gte(accreditationFormSubmissions.submittedAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(accreditationFormSubmissions.submittedAt, filter.dateTo));
  const whereClause = and(...conditions);
  const countResult = await db
    .select({ total: count() })
    .from(accreditationFormSubmissions)
    .where(whereClause);
  const total = countResult[0]?.total ?? 0;
  const rows = await db
    .select({
      id: accreditationFormSubmissions.id,
      templateId: accreditationFormSubmissions.templateId,
      formType: accreditationFormSubmissions.formType,
      submittedByUserId: accreditationFormSubmissions.submittedByUserId,
      reviewTargetType: accreditationFormSubmissions.reviewTargetType,
      reviewTargetId: accreditationFormSubmissions.reviewTargetId,
      qualityScore: accreditationFormSubmissions.qualityScore,
      maxPossibleScore: accreditationFormSubmissions.maxPossibleScore,
      status: accreditationFormSubmissions.status,
      submittedAt: accreditationFormSubmissions.submittedAt,
      updatedAt: accreditationFormSubmissions.updatedAt,
      submitterName: users.name,
      submitterDisplayName: users.displayName,
      submitterEmail: users.email,
      submitterCredentials: users.credentials,
      templateName: accreditationFormTemplates.name,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .leftJoin(accreditationFormTemplates, eq(accreditationFormSubmissions.templateId, accreditationFormTemplates.id))
    .where(whereClause)
    .orderBy(desc(accreditationFormSubmissions.submittedAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);
  return { rows, total };
}

export async function getFormSubmissionWithDetails(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: accreditationFormSubmissions.id,
      templateId: accreditationFormSubmissions.templateId,
      formType: accreditationFormSubmissions.formType,
      submittedByUserId: accreditationFormSubmissions.submittedByUserId,
      reviewTargetType: accreditationFormSubmissions.reviewTargetType,
      reviewTargetId: accreditationFormSubmissions.reviewTargetId,
      responses: accreditationFormSubmissions.responses,
      qualityScore: accreditationFormSubmissions.qualityScore,
      maxPossibleScore: accreditationFormSubmissions.maxPossibleScore,
      status: accreditationFormSubmissions.status,
      submittedAt: accreditationFormSubmissions.submittedAt,
      updatedAt: accreditationFormSubmissions.updatedAt,
      submitterName: users.name,
      submitterDisplayName: users.displayName,
      submitterEmail: users.email,
      submitterCredentials: users.credentials,
      templateName: accreditationFormTemplates.name,
      templateFormType: accreditationFormTemplates.formType,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .leftJoin(accreditationFormTemplates, eq(accreditationFormSubmissions.templateId, accreditationFormTemplates.id))
    .where(eq(accreditationFormSubmissions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getFormSubmissionStatsForLab(labId: number) {
  const db = await getDb();
  if (!db) return null;
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return null;
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return null;
  const where = eq(accreditationFormSubmissions.orgId, orgId);
  const [totalResult, byTypeResult, avgScoreResult, recentResult] = await Promise.all([
    db.select({ total: count() }).from(accreditationFormSubmissions).where(where),
    db
      .select({
        formType: accreditationFormSubmissions.formType,
        cnt: count(),
        avgScore: avg(accreditationFormSubmissions.qualityScore),
      })
      .from(accreditationFormSubmissions)
      .where(where)
      .groupBy(accreditationFormSubmissions.formType),
    db
      .select({ avgScore: avg(accreditationFormSubmissions.qualityScore) })
      .from(accreditationFormSubmissions)
      .where(and(where, eq(accreditationFormSubmissions.status, 'submitted'))),
    db
      .select({ recent: count() })
      .from(accreditationFormSubmissions)
      .where(and(where, gte(accreditationFormSubmissions.submittedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))),
  ]);
  return {
    total: totalResult[0]?.total ?? 0,
    byType: byTypeResult,
    avgQualityScore: Number(avgScoreResult[0]?.avgScore ?? 0),
    last30Days: recentResult[0]?.recent ?? 0,
  };
}

export async function getFormSubmissionStaffList(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return [];
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return [];
  const rows = await db
    .selectDistinct({
      userId: accreditationFormSubmissions.submittedByUserId,
      name: users.name,
      displayName: users.displayName,
      credentials: users.credentials,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .where(eq(accreditationFormSubmissions.orgId, orgId));
  return rows;
}

export type { AccreditationFormTemplateAssignment, InsertAccreditationFormTemplateAssignment, AccreditationFormSubmission, InsertAccreditationFormSubmission };

/** Deduplicate userRoles and backfill missing 'user' roles for all non-pending users */
export async function cleanupUserRolesDb(): Promise<{ deduped: number; backfilled: number }> {
  const db = await getDb();
  if (!db) return { deduped: 0, backfilled: 0 };

  // Step 1: Find duplicate userRoles rows (same userId + role, keep lowest id)
  const allRoles = await db.select().from(userRoles);
  const seen = new Map<string, number>(); // key -> min id to keep
  const toDelete: number[] = [];
  for (const r of allRoles) {
    const key = `${r.userId}:${r.role}`;
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, r.id);
    } else {
      // Keep the lower id, delete the higher
      if (r.id < existing) {
        toDelete.push(existing);
        seen.set(key, r.id);
      } else {
        toDelete.push(r.id);
      }
    }
  }
  if (toDelete.length > 0) {
    await db.delete(userRoles).where(inArray(userRoles.id, toDelete));
  }

  // Step 2: Backfill 'user' role for all non-pending users who don't have it
  const allUsers = await db.select({ id: users.id, isPending: users.isPending }).from(users);
  const usersWithUserRole = new Set(
    allRoles
      .filter(r => r.role === 'user')
      .map(r => r.userId)
  );
  let backfilled = 0;
  for (const u of allUsers) {
    if (!u.isPending && !usersWithUserRole.has(u.id)) {
      await db.insert(userRoles).values({ userId: u.id, role: 'user', assignedByUserId: u.id });
      backfilled++;
    }
  }

  return { deduped: toDelete.length, backfilled };
}
