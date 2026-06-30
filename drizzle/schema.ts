import {
  boolean,
  decimal,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  varchar,
  bigint,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 128 }).unique(), // nullable for email/password users
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Profile fields
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  displayName: varchar("displayName", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  coverUrl: text("coverUrl"),
  bio: text("bio"),
  credentials: varchar("credentials", { length: 200 }),
  specialty: varchar("specialty", { length: 100 }),
  yearsExperience: int("yearsExperience"),
  location: varchar("location", { length: 150 }),
  website: varchar("website", { length: 255 }),
  isPublicProfile: boolean("isPublicProfile").default(true).notNull(),
  isPremium: boolean("isPremium").default(false).notNull(),
  premiumGrantedAt: timestamp("premiumGrantedAt"),
  premiumSource: varchar("premiumSource", { length: 64 }), // "thinkific" | "admin" | "manual"
  followersCount: int("followersCount").default(0).notNull(),
  followingCount: int("followingCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  thinkificEnrolledAt: timestamp("thinkificEnrolledAt"),
  // Pre-registration: admin can create a stub account before the user first signs in
  isPending: boolean("isPending").default(false).notNull(),
  pendingCreatedAt: timestamp("pendingCreatedAt"),
  // Custom email/password auth (white-label, no OAuth portal)
  passwordHash: text("passwordHash"),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }),
  emailVerificationExpiry: timestamp("emailVerificationExpiry"),
  passwordResetToken: varchar("passwordResetToken", { length: 128 }),
  passwordResetExpiry: timestamp("passwordResetExpiry"),
  // Email change verification
  pendingEmail: varchar("pendingEmail", { length: 320 }),
  pendingEmailToken: varchar("pendingEmailToken", { length: 128 }),
  pendingEmailExpiry: timestamp("pendingEmailExpiry"),
  // Magic link login (passwordless)
  magicLinkToken: varchar("magicLinkToken", { length: 128 }),
  magicLinkExpiry: timestamp("magicLinkExpiry"),
  // Persistent access token — embedded in purchase/access emails.
  // Never expires, reusable (clicking the link always works).
  accessToken: varchar("accessToken", { length: 128 }),
  // Notification preferences (JSON: { quickfireReminder: boolean, reminderTime: "HH:MM" })
  notificationPrefs: text("notificationPrefs"),
  // IANA timezone string for 9am local-time challenge notifications (e.g. "America/New_York")
  timezone: varchar("timezone", { length: 64 }),
  // Last date (YYYY-MM-DD ET) a daily challenge notification email was sent to this user.
  // DB-backed deduplication so server restarts within the 9am ET window don't re-send.
  lastChallengeNotifDate: varchar("lastChallengeNotifDate", { length: 10 }),
  // Demo/test account flag — marks seeded demo users so they are visually distinguished in admin UI
  isDemo: boolean("isDemo").default(false).notNull(),
  // JSON: {acs:bool, adultEcho:bool, pediatricEcho:bool, fetalEcho:bool} — false means opted out of that category
  // null/missing means opted in to all categories (default)
  challengeCategoryPrefs: text("challengeCategoryPrefs"),
  // JSON: {acs:bool, adultEcho:bool, pediatricEcho:bool, fetalEcho:bool}
  // Content interest preferences — used to filter platform emails and personalize content
  // null/missing means no preferences set (all content shown)
  interestPrefs: text("interestPrefs"),
  // Email unsubscribe — set when user clicks the unsubscribe link in a campaign email
  unsubscribedAt: timestamp("unsubscribedAt"),
  // Unique token used in unsubscribe links — generated on first campaign send
  unsubscribeToken: varchar("unsubscribeToken", { length: 64 }),
  // Comment ban: when true, user cannot post lesson comments (silent — no notification sent)
  commentBanned: boolean("commentBanned").default(false).notNull(),
  // Community role — admin/moderator get special badges and moderation powers in Community
  communityRole: mysqlEnum("communityRole", ["member", "moderator", "admin"]).default("member").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Accreditation: Peer Reviews ────────────────────────────────────────────

export const peerReviews = mysqlTable("peerReviews", {
  id: int("id").autoincrement().primaryKey(),
  reviewerId: int("reviewerId").notNull(),
  patientId: varchar("patientId", { length: 64 }), // de-identified
  studyDate: varchar("studyDate", { length: 20 }),
  modality: mysqlEnum("modality", ["Abdominal", "Vascular", "OB/Gyn", "MSK", "POCUS", "Thyroid", "Breast", "Renal", "Fetal Echo", "Other"]).notNull(),
  sonographerInitials: varchar("sonographerInitials", { length: 20 }),
  imageQuality: mysqlEnum("imageQuality", ["excellent", "good", "adequate", "poor"]),
  imageQualityNotes: text("imageQualityNotes"),
  reportAccuracy: mysqlEnum("reportAccuracy", ["accurate", "minor_discrepancy", "major_discrepancy"]),
  reportNotes: text("reportNotes"),
  technicalAdherence: mysqlEnum("technicalAdherence", ["full", "partial", "non_adherent"]),
  technicalNotes: text("technicalNotes"),
  overallScore: int("overallScore"), // 1-5
  feedback: text("feedback"),
  status: mysqlEnum("status", ["draft", "submitted", "complete"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PeerReview = typeof peerReviews.$inferSelect;
export type InsertPeerReview = typeof peerReviews.$inferInsert;

// ─── Accreditation: QA Logs ───────────────────────────────────────────────────

export const qaLogs = mysqlTable("qaLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", [
    "equipment", "protocol", "image_quality", "report_turnaround",
    "staff_competency", "infection_control", "patient_safety", "other"
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  finding: mysqlEnum("finding", ["pass", "fail", "needs_improvement", "na"]).default("pass").notNull(),
  actionRequired: text("actionRequired"),
  actionTaken: text("actionTaken"),
  dueDate: varchar("dueDate", { length: 20 }),
  resolvedAt: timestamp("resolvedAt"),
  attachmentUrl: text("attachmentUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QaLog = typeof qaLogs.$inferSelect;
export type InsertQaLog = typeof qaLogs.$inferInsert;

// ─── Accreditation: Policies ──────────────────────────────────────────────────

export const policies = mysqlTable("policies", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  // OrgID scoping: labId ties to the lab that owns this policy; diyOrgId ties to a DIY accreditation org
  labId: int("labId"),
  diyOrgId: int("diyOrgId"),
  title: varchar("title", { length: 300 }).notNull(),
  category: mysqlEnum("category", [
    "infection_control", "equipment", "patient_safety", "protocol",
    "staff_competency", "quality_assurance", "appropriate_use",
    "report_turnaround", "emergency", "other"
  ]).notNull(),
  modality: mysqlEnum("modality", ["Abdominal", "Vascular", "OB/Gyn", "MSK", "POCUS", "Thyroid", "Breast", "Renal", "Fetal Echo", "Other", "All"]).default("All").notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  effectiveDate: varchar("effectiveDate", { length: 20 }),
  reviewDate: varchar("reviewDate", { length: 20 }),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = typeof policies.$inferInsert;

// ─── Accreditation: Appropriate Use Cases ────────────────────────────────────

export const appropriateUseCases = mysqlTable("appropriateUseCases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Formsite form269 fields
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  studyDate: varchar("studyDate", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 100 }),
  referringPhysician: varchar("referringPhysician", { length: 200 }),
  // Exam type (comma-separated: Adult TTE, Adult STE, Adult TEE)
  examTypes: text("examTypes"),
  limitedOrComplete: varchar("limitedOrComplete", { length: 50 }),
  // Indication appropriateness — A9/A8/A7/U6/U5/U4/I3/I2/I1
  indicationAppropriateness: varchar("indicationAppropriateness", { length: 300 }),
  reviewComments: text("reviewComments"),
  // Legacy fields kept for backward compatibility
  modality: mysqlEnum("modality", ["Abdominal", "Vascular", "OB/Gyn", "MSK", "POCUS", "Thyroid", "Breast", "Renal", "Fetal Echo", "Other"]),
  indication: text("indication"),
  appropriatenessRating: mysqlEnum("appropriatenessRating", ["appropriate", "may_be_appropriate", "rarely_appropriate", "unknown"]).default("unknown").notNull(),
  clinicalScenario: text("clinicalScenario"),
  outcome: text("outcome"),
  notes: text("notes"),
  flagged: boolean("flagged").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppropriateUseCase = typeof appropriateUseCases.$inferSelect;
export type InsertAppropriateUseCase = typeof appropriateUseCases.$inferInsert;

// ─── Lab Subscriptions ────────────────────────────────────────────────────────

export const labSubscriptions = mysqlTable("labSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),         // owner / billing admin
  labName: varchar("labName", { length: 200 }).notNull(),
  labAddress: text("labAddress"),
  labPhone: varchar("labPhone", { length: 30 }),
  plan: mysqlEnum("plan", ["basic", "professional", "enterprise"]).default("basic").notNull(),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "canceled", "paused"]).default("trialing").notNull(),
  seats: int("seats").default(5).notNull(),          // max staff members
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  billingCycleStart: timestamp("billingCycleStart"),
  billingCycleEnd: timestamp("billingCycleEnd"),
  trialEndsAt: timestamp("trialEndsAt"),
  canceledAt: timestamp("canceledAt"),
  notes: text("notes"),
  // IAC accreditation types the lab is seeking or currently holds (JSON array)
  // Values: "adult_echo" | "pediatric_fetal_echo"
  accreditationTypes: text("accreditationTypes"),
  accreditationOnboardingComplete: boolean("accreditationOnboardingComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabSubscription = typeof labSubscriptions.$inferSelect;
export type InsertLabSubscription = typeof labSubscriptions.$inferInsert;

// ─── Lab Members ─────────────────────────────────────────────────────────────

export const labMembers = mysqlTable("labMembers", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId").notNull(),
  userId: int("userId"),                             // null until invite accepted
  inviteEmail: varchar("inviteEmail", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  credentials: varchar("credentials", { length: 200 }),
  role: mysqlEnum("role", ["medical_director", "technical_director", "medical_staff", "technical_staff", "admin"]).default("technical_staff").notNull(),
  specialty: varchar("specialty", { length: 100 }),
  department: varchar("department", { length: 100 }),
  inviteStatus: mysqlEnum("inviteStatus", ["pending", "accepted", "declined"]).default("pending").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }),
  joinedAt: timestamp("joinedAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabMember = typeof labMembers.$inferSelect;
export type InsertLabMember = typeof labMembers.$inferInsert;

// ─── CME Entries ──────────────────────────────────────────────────────────────
// Continuing Medical/Technical Education entries per lab member

export const cmeEntries = mysqlTable("cmeEntries", {
  id: int("id").autoincrement().primaryKey(),
  labMemberId: int("labMemberId").notNull(),          // FK → labMembers.id
  labId: int("labId").notNull(),                      // FK → labSubscriptions.id (for scoping)
  title: varchar("title", { length: 200 }).notNull(),
  provider: varchar("provider", { length: 200 }),
  category: mysqlEnum("category", [
    "echo_specific",
    "cardiovascular",
    "general_medical",
    "technical",
    "safety",
    "leadership",
    "other"
  ]).default("echo_specific").notNull(),
  activityDate: varchar("activityDate", { length: 20 }).notNull(), // YYYY-MM-DD
  creditHours: int("creditHours").notNull().default(0),
  certificationNumber: varchar("certificationNumber", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CmeEntry = typeof cmeEntries.$inferSelect;
export type InsertCmeEntry = typeof cmeEntries.$inferInsert;

// ─── Lab Peer Reviews (extends peerReviews with lab context) ─────────────────
// We add labId + revieweeId + qualityScore to peerReviews via a separate
// labPeerReviews table that references peerReviews.id for clean separation.

export const labPeerReviews = mysqlTable("labPeerReviews", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId").notNull(),
  peerReviewId: int("peerReviewId").notNull(),       // FK → peerReviews.id
  reviewerId: int("reviewerId").notNull(),            // labMembers.id (reviewer)
  revieweeId: int("revieweeId").notNull(),            // labMembers.id (sonographer being reviewed)
  qualityScore: int("qualityScore"),                  // 0–100 computed composite
  qualityTier: mysqlEnum("qualityTier", ["Excellent", "Good", "Adequate", "Needs Improvement"]),
  iqScore: int("iqScore"),                           // image quality component 0–100
  raScore: int("raScore"),                           // report accuracy component 0–100
  taScore: int("taScore"),                           // technical adherence component 0–100
  reviewMonth: varchar("reviewMonth", { length: 7 }), // "YYYY-MM" for easy grouping
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LabPeerReview = typeof labPeerReviews.$inferSelect;
export type InsertLabPeerReview = typeof labPeerReviews.$inferInsert;

// ─── Echo Cases (user-created case library) ───────────────────────────────────
export const echoCases = mysqlTable("echoCases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  patientAge: int("patientAge"),
  patientSex: mysqlEnum("patientSex", ["M", "F", "Other"]),
  clinicalHistory: text("clinicalHistory"),
  indication: varchar("indication", { length: 200 }),
  diagnosis: varchar("diagnosis", { length: 200 }),
  notes: text("notes"),
  isPublic: boolean("isPublic").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EchoCase = typeof echoCases.$inferSelect;
export type InsertEchoCase = typeof echoCases.$inferInsert;

// ─── Strain Snapshots (attached to echo cases) ────────────────────────────────
export const strainSnapshots = mysqlTable("strainSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  caseId: int("caseId"),                              // nullable — can save without a case
  caseTitle: varchar("caseTitle", { length: 200 }),   // denormalized for display
  // Segment values: JSON array of {id, value, wallMotionScore}
  segmentValues: text("segmentValues").notNull(),      // JSON string
  wallMotionScores: text("wallMotionScores"),          // JSON string {segId: score}
  // Summary metrics
  lvGls: text("lvGls"),                               // stored as string to preserve null
  rvStrain: text("rvStrain"),
  laStrain: text("laStrain"),
  wmsi: text("wmsi"),                                 // wall motion score index
  // Acquisition context
  vendor: varchar("vendor", { length: 100 }),
  frameRate: int("frameRate"),
  // Clinical notes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StrainSnapshot = typeof strainSnapshots.$inferSelect;
export type InsertStrainSnapshot = typeof strainSnapshots.$inferInsert;

// ─── Image Quality Reviews ────────────────────────────────────────────────────
export const imageQualityReviews = mysqlTable("imageQualityReviews", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  // Lab integration — nullable so standalone reviews still work
  labId: int("labId"),                                          // FK → labSubscriptions.id
  revieweeLabMemberId: int("revieweeLabMemberId"),               // FK → labMembers.id
  revieweeUserId: int("revieweeUserId"),                         // denormalized userId for fast queries
  revieweeName: varchar("revieweeName", { length: 200 }),        // denormalized name for display
  reviewType: varchar("reviewType", { length: 50 }).notNull(),
  organization: varchar("organization", { length: 200 }),
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  examDos: varchar("examDos", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 100 }),
  facilityLocation: varchar("facilityLocation", { length: 200 }),
  performingSonographer: varchar("performingSonographer", { length: 200 }),
  interpretingPhysician: varchar("interpretingPhysician", { length: 200 }),
  referringPhysician: varchar("referringPhysician", { length: 200 }),
  examType: varchar("examType", { length: 50 }),
  examScope: varchar("examScope", { length: 50 }),
  stressType: varchar("stressType", { length: 100 }),
  examIndication: text("examIndication"),
  indicationAppropriateness: varchar("indicationAppropriateness", { length: 300 }),
  demographicsAccurate: varchar("demographicsAccurate", { length: 300 }),
  protocolViews: text("protocolViews"),
  protocolViewsOther: varchar("protocolViewsOther", { length: 300 }),
  gainSettings: varchar("gainSettings", { length: 50 }),
  gainSettingsOther: varchar("gainSettingsOther", { length: 200 }),
  depthSettings: varchar("depthSettings", { length: 50 }),
  depthSettingsOther: varchar("depthSettingsOther", { length: 200 }),
  focalZoneSettings: varchar("focalZoneSettings", { length: 50 }),
  focalZoneDeficiencies: varchar("focalZoneDeficiencies", { length: 200 }),
  colorizeSettings: varchar("colorizeSettings", { length: 50 }),
  colorizeSettingsOther: varchar("colorizeSettingsOther", { length: 200 }),
  zoomSettings: varchar("zoomSettings", { length: 50 }),
  zoomSettingsOther: varchar("zoomSettingsOther", { length: 200 }),
  ecgDisplay: varchar("ecgDisplay", { length: 50 }),
  ecgDisplayDeficiencies: varchar("ecgDisplayDeficiencies", { length: 200 }),
  contrastUseAppropriate: varchar("contrastUseAppropriate", { length: 200 }),
  contrastSettingsAppropriate: varchar("contrastSettingsAppropriate", { length: 10 }),
  onAxisImaging: varchar("onAxisImaging", { length: 100 }),
  effortSuboptimalViews: varchar("effortSuboptimalViews", { length: 20 }),
  measurements2dComplete: varchar("measurements2dComplete", { length: 100 }),
  measurements2dAccurate: varchar("measurements2dAccurate", { length: 20 }),
  psaxLvComplete: varchar("psaxLvComplete", { length: 100 }),
  ventricularFunctionAccurate: varchar("ventricularFunctionAccurate", { length: 20 }),
  efMeasurementsAccurate: varchar("efMeasurementsAccurate", { length: 20 }),
  simpsonsEfAccurate: varchar("simpsonsEfAccurate", { length: 20 }),
  laVolumeAccurate: varchar("laVolumeAccurate", { length: 20 }),
  dopplerMeasurementsComplete: varchar("dopplerMeasurementsComplete", { length: 100 }),
  dopplerMeasurementsAccurate: varchar("dopplerMeasurementsAccurate", { length: 50 }),
  dopplerVentricularFunction: varchar("dopplerVentricularFunction", { length: 50 }),
  dopplerWaveformSettings: varchar("dopplerWaveformSettings", { length: 50 }),
  dopplerMeasurementAccuracy: varchar("dopplerMeasurementAccuracy", { length: 50 }),
  forwardFlowSpectrum: varchar("forwardFlowSpectrum", { length: 20 }),
  pwDopplerPlacement: varchar("pwDopplerPlacement", { length: 20 }),
  cwDopplerPlacement: varchar("cwDopplerPlacement", { length: 20 }),
  spectralEnvelopePeaks: varchar("spectralEnvelopePeaks", { length: 20 }),
  colorFlowInterrogation: varchar("colorFlowInterrogation", { length: 20 }),
  colorDopplerIasIvs: varchar("colorDopplerIasIvs", { length: 20 }),
  diastolicFunctionEval: text("diastolicFunctionEval"),
  pulmonaryVeinInflow: varchar("pulmonaryVeinInflow", { length: 20 }),
  rightHeartFunctionEval: text("rightHeartFunctionEval"),
  tapseAccurate: varchar("tapseAccurate", { length: 20 }),
  tissueDopplerAdequate: varchar("tissueDopplerAdequate", { length: 20 }),
  dopplerWaveformSettingsPeer: varchar("dopplerWaveformSettingsPeer", { length: 50 }),
  dopplerSampleVolumesPeer: varchar("dopplerSampleVolumesPeer", { length: 50 }),
  aorticValveDoppler: varchar("aorticValveDoppler", { length: 20 }),
  lvotDopplerPlacement: varchar("lvotDopplerPlacement", { length: 20 }),
  pedoffCwUtilized: varchar("pedoffCwUtilized", { length: 50 }),
  pedoffCwEnvelope: varchar("pedoffCwEnvelope", { length: 50 }),
  pedoffCwLabelled: varchar("pedoffCwLabelled", { length: 50 }),
  mitralValveDoppler: varchar("mitralValveDoppler", { length: 20 }),
  mrEvaluationMethods: varchar("mrEvaluationMethods", { length: 100 }),
  pisaEroMeasurements: varchar("pisaEroMeasurements", { length: 50 }),
  tricuspidValveDoppler: varchar("tricuspidValveDoppler", { length: 20 }),
  pulmonicValveDoppler: varchar("pulmonicValveDoppler", { length: 20 }),
  aorticValvePeer: varchar("aorticValvePeer", { length: 50 }),
  mitralValvePeer: varchar("mitralValvePeer", { length: 50 }),
  tricuspidValvePeer: varchar("tricuspidValvePeer", { length: 50 }),
  pulmonicValvePeer: varchar("pulmonicValvePeer", { length: 50 }),
  diastologyPeer: varchar("diastologyPeer", { length: 50 }),
  rightHeartPeer: varchar("rightHeartPeer", { length: 50 }),
  additionalImagingMethods: text("additionalImagingMethods"),
  strainPerformed: varchar("strainPerformed", { length: 5 }),
  strainCorrect: varchar("strainCorrect", { length: 50 }),
  threeDPerformed: varchar("threeDPerformed", { length: 5 }),
  imageOptimizationSummary: varchar("imageOptimizationSummary", { length: 50 }),
  measurementAccuracySummary: varchar("measurementAccuracySummary", { length: 50 }),
  dopplerSettingsSummary: varchar("dopplerSettingsSummary", { length: 50 }),
  protocolSequenceFollowed: varchar("protocolSequenceFollowed", { length: 200 }),
  pathologyDocumented: varchar("pathologyDocumented", { length: 20 }),
  clinicalQuestionAnswered: varchar("clinicalQuestionAnswered", { length: 20 }),
  reportConcordant: varchar("reportConcordant", { length: 50 }),
  comparableToPreview: varchar("comparableToPreview", { length: 10 }),
  iacAcceptable: varchar("iacAcceptable", { length: 200 }),
  scanStartTime: varchar("scanStartTime", { length: 10 }),
  scanEndTime: varchar("scanEndTime", { length: 10 }),
  imagingTimeMinutes: int("imagingTimeMinutes"),
  scanningTimeType: varchar("scanningTimeType", { length: 20 }),
  qualityScore: int("qualityScore"),
  reviewComments: text("reviewComments"),
  reviewer: varchar("reviewer", { length: 200 }),
  reviewerEmail: varchar("reviewerEmail", { length: 200 }),
  notifyAdmin: varchar("notifyAdmin", { length: 5 }),
  notifySonographer: varchar("notifySonographer", { length: 5 }),
  // New Formsite fields
  // Page 3 — Basic Exam Quality
  mModeViewsObtained: varchar("mModeViewsObtained", { length: 50 }),          // AETTE, PETTE
  mModeViewsObtainedOther: varchar("mModeViewsObtainedOther", { length: 300 }),
  harmonicImagingAppropriate: varchar("harmonicImagingAppropriate", { length: 50 }),
  harmonicImagingOther: varchar("harmonicImagingOther", { length: 300 }),
  contrastUtilized: varchar("contrastUtilized", { length: 50 }),               // AETTE, PETTE, FE
  contrastUtilizedOther: varchar("contrastUtilizedOther", { length: 300 }),
  patientPositioned: varchar("patientPositioned", { length: 50 }),
  patientPositionedOther: varchar("patientPositionedOther", { length: 300 }),
  // Page 4 — Measurements
  psaxLvCompleteness: varchar("psaxLvCompleteness", { length: 100 }),          // AETTE, PETTE
  psaxLvCompletenessOther: varchar("psaxLvCompletenessOther", { length: 300 }),
  simpsonsEfObtained: varchar("simpsonsEfObtained", { length: 50 }),           // AETTE, PETTE
  simpsonsEfObtainedOther: varchar("simpsonsEfObtainedOther", { length: 300 }),
  biplaneLaVolume: varchar("biplaneLaVolume", { length: 50 }),                 // AETTE only
  biplaneLaVolumeOther: varchar("biplaneLaVolumeOther", { length: 300 }),
  // Page 5 — Doppler
  diastolicFunctionEvalOther: varchar("diastolicFunctionEvalOther", { length: 300 }),
  rightHeartFunctionEvalOther: varchar("rightHeartFunctionEvalOther", { length: 300 }),
  // Page 6 — Cardiac Evaluation
  pedoffCwUtilizedOther: varchar("pedoffCwUtilizedOther", { length: 300 }),
  pedoffCwEnvelopeOther: varchar("pedoffCwEnvelopeOther", { length: 300 }),
  pedoffCwLabelledOther: varchar("pedoffCwLabelledOther", { length: 300 }),
  pisaEroMeasurementsOther: varchar("pisaEroMeasurementsOther", { length: 300 }),
  additionalImagingMethodsOther: varchar("additionalImagingMethodsOther", { length: 300 }),
  strainCorrectOther: varchar("strainCorrectOther", { length: 300 }),
  // Page 7 — Review Summary notification fields
  notifyAdminEmail: varchar("notifyAdminEmail", { length: 200 }),
  notifyAdminComments: text("notifyAdminComments"),
  notifySonographerEmail: varchar("notifySonographerEmail", { length: 200 }),
  notifySonographerComments: text("notifySonographerComments"),

  // TEE-specific fields
  teeMeasurementsComplete: varchar("teeMeasurementsComplete", { length: 50 }),
  teeMeasurementsAccurate: varchar("teeMeasurementsAccurate", { length: 50 }),
  teeVentricularFunction: varchar("teeVentricularFunction", { length: 50 }),
  teeDopplerSettings: varchar("teeDopplerSettings", { length: 50 }),
  teeDopplerSampleVolumes: varchar("teeDopplerSampleVolumes", { length: 50 }),
  teeAorticValve: varchar("teeAorticValve", { length: 50 }),
  teeMitralValve: varchar("teeMitralValve", { length: 50 }),
  teeTricuspidValve: varchar("teeTricuspidValve", { length: 50 }),
  teePulmonicValve: varchar("teePulmonicValve", { length: 50 }),
  teeImageOptSummary: varchar("teeImageOptSummary", { length: 50 }),
  teeMeasurementSummary: varchar("teeMeasurementSummary", { length: 50 }),
  teeDopplerSummary: varchar("teeDopplerSummary", { length: 50 }),
  // Extended fields from IQR form (added to fix submission)
  stressStudyType: varchar("stressStudyType", { length: 100 }),
  demographicsExplain: text("demographicsExplain"),
  required2dViews: varchar("required2dViews", { length: 20 }),
  required2dViewsExplain: text("required2dViewsExplain"),
  imageOptimized: varchar("imageOptimized", { length: 20 }),
  imageOptimizedExplain: text("imageOptimizedExplain"),
  allMeasurementsObtained: varchar("allMeasurementsObtained", { length: 20 }),
  allMeasurementsExplain: text("allMeasurementsExplain"),
  measurements2dExplain: text("measurements2dExplain"),
  measurementPlacementSummary: varchar("measurementPlacementSummary", { length: 50 }),
  measurementPlacementExplain: text("measurementPlacementExplain"),
  ventricularFunctionExplain: text("ventricularFunctionExplain"),
  dopplerWaveformExplain: text("dopplerWaveformExplain"),
  forwardFlowExplain: text("forwardFlowExplain"),
  dopplerSampleVolumes: varchar("dopplerSampleVolumes", { length: 50 }),
  dopplerSampleVolumesExplain: text("dopplerSampleVolumesExplain"),
  spectralEnvelopeExplain: text("spectralEnvelopeExplain"),
  colorFlowExplain: text("colorFlowExplain"),
  colorDopplerExplain: text("colorDopplerExplain"),
  pulmonaryVeinInflowExplain: text("pulmonaryVeinInflowExplain"),
  tapseExplain: text("tapseExplain"),
  tissueDopplerExplain: text("tissueDopplerExplain"),
  aorticValveEval: varchar("aorticValveEval", { length: 50 }),
  aorticValveExplain: text("aorticValveExplain"),
  lvotSampleVolume: varchar("lvotSampleVolume", { length: 50 }),
  lvotSampleVolumeExplain: text("lvotSampleVolumeExplain"),
  mitralValveEval: varchar("mitralValveEval", { length: 50 }),
  mitralValveExplain: text("mitralValveExplain"),
  pisaEroEval: varchar("pisaEroEval", { length: 50 }),
  pisaEroExplain: text("pisaEroExplain"),
  tricuspidValveEval: varchar("tricuspidValveEval", { length: 50 }),
  tricuspidValveExplain: text("tricuspidValveExplain"),
  pulmonicValveEval: varchar("pulmonicValveEval", { length: 50 }),
  pulmonicValveExplain: text("pulmonicValveExplain"),
  images2dOptimized: varchar("images2dOptimized", { length: 50 }),
  images2dOptimizedExplain: text("images2dOptimizedExplain"),
  measurementsAccurateSummary: varchar("measurementsAccurateSummary", { length: 50 }),
  measurementsAccurateExplain: text("measurementsAccurateExplain"),
  dopplerSettingsExplain: text("dopplerSettingsExplain"),
  protocolSequence: varchar("protocolSequence", { length: 20 }),
  protocolSequenceExplain: text("protocolSequenceExplain"),
  pathologyDocumentedExplain: text("pathologyDocumentedExplain"),
  clinicalQuestionExplain: text("clinicalQuestionExplain"),
  concordantWithPhysician: varchar("concordantWithPhysician", { length: 20 }),
  concordantExplain: text("concordantExplain"),
  // Staff identifier fields for field visualization
  performingSonographerId: varchar("performingSonographerId", { length: 50 }),
  performingSonographerText: varchar("performingSonographerText", { length: 200 }),
  interpretingPhysicianId: varchar("interpretingPhysicianId", { length: 50 }),
  interpretingPhysicianText: varchar("interpretingPhysicianText", { length: 200 }),
  // Additional fields from form audit
  efMeasurementsExplain: text("efMeasurementsExplain"),
  ventricularFunction: varchar("ventricularFunction", { length: 20 }),
  pulmonaryVeinDoppler: varchar("pulmonaryVeinDoppler", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImageQualityReview = typeof imageQualityReviews.$inferSelect;
export type InsertImageQualityReview = typeof imageQualityReviews.$inferInsert;

// ─── Echo Correlation (QI Study Correlations) ───────────────────────────────
export const echoCorrelations = mysqlTable("echoCorrelations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  // Header
  organization: varchar("organization", { length: 255 }),
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 50 }),
  // Exam Info
  examType: varchar("examType", { length: 100 }),
  correlation1Type: varchar("correlation1Type", { length: 100 }),
  correlation1TypeOther: varchar("correlation1TypeOther", { length: 100 }),
  correlation2Type: varchar("correlation2Type", { length: 100 }),
  correlation2TypeOther: varchar("correlation2TypeOther", { length: 100 }),
  // Dates of Service
  originalExamDos: varchar("originalExamDos", { length: 20 }),
  correlation1Dos: varchar("correlation1Dos", { length: 20 }),
  correlation2Dos: varchar("correlation2Dos", { length: 20 }),
  // Findings stored as JSON strings
  originalFindings: text("originalFindings"),
  corr1Findings: text("corr1Findings"),
  corr2Findings: text("corr2Findings"),
  // Concordance results as JSON
  concordance1: text("concordance1"),
  concordance2: text("concordance2"),
  // Overall
  overallConcordanceRate: int("overallConcordanceRate"),
  varianceNotes: text("varianceNotes"),
  reviewerName: varchar("reviewerName", { length: 200 }),
  reviewerEmail: varchar("reviewerEmail", { length: 200 }),
  // Lab integration
  labId: int("labId"),
  revieweeId: varchar("revieweeId", { length: 255 }),
  revieweeName: varchar("revieweeName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EchoCorrelation = typeof echoCorrelations.$inferSelect;
export type InsertEchoCorrelation = typeof echoCorrelations.$inferInsert;

// ─── Physician Peer Reviews ─────────────────────────────────────────────────
// Mirrors the Formsite PhysVariabilityECHO form with Lab Admin staff linkage.
// revieweeLabMemberId → the Original Interpreting Physician (labMembers.id)
// reviewerLabMemberId → the Over-Reading Physician Reviewer (labMembers.id)
export const physicianPeerReviews = mysqlTable("physicianPeerReviews", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  labId: int("labId"),

  // ── Header ──────────────────────────────────────────────────────────────────
  facilityAccountNumber: varchar("facilityAccountNumber", { length: 50 }),
  organization: varchar("organization", { length: 255 }),
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 100 }),
  dob: varchar("dob", { length: 20 }),
  examDos: varchar("examDos", { length: 20 }),
  examType: varchar("examType", { length: 50 }),

  // ── Staff linkage ────────────────────────────────────────────────────────────
  revieweeLabMemberId: int("revieweeLabMemberId"),
  revieweeName: varchar("revieweeName", { length: 255 }),
  reviewerLabMemberId: int("reviewerLabMemberId"),
  reviewerName: varchar("reviewerName", { length: 255 }),
  qualityReviewAssignedBy: varchar("qualityReviewAssignedBy", { length: 255 }),
  reviewerEmail: varchar("reviewerEmail", { length: 255 }),

  // ── Stress-specific header ───────────────────────────────────────────────────
  postStressDopplerPerformed: varchar("postStressDopplerPerformed", { length: 10 }),

  // ── Adult TTE / Pediatric / Fetal shared findings ───────────────────────────
  situs: varchar("situs", { length: 100 }),
  cardiacPosition: varchar("cardiacPosition", { length: 100 }),
  leftHeart: varchar("leftHeart", { length: 100 }),
  rightHeart: varchar("rightHeart", { length: 100 }),
  efPercent: varchar("efPercent", { length: 50 }),
  lvWallThickness: varchar("lvWallThickness", { length: 100 }),
  ventricularSeptalDefect: varchar("ventricularSeptalDefect", { length: 100 }),
  atrialSeptalDefect: varchar("atrialSeptalDefect", { length: 100 }),
  patentForamenOvale: varchar("patentForamenOvale", { length: 100 }),
  lvChamberSize: varchar("lvChamberSize", { length: 100 }),
  laChamberSize: varchar("laChamberSize", { length: 100 }),
  rvChamberSize: varchar("rvChamberSize", { length: 100 }),
  raChamberSize: varchar("raChamberSize", { length: 100 }),
  regionalWallMotionAbnormalities: varchar("regionalWallMotionAbnormalities", { length: 200 }),
  aorticValve: varchar("aorticValve", { length: 100 }),
  mitralValve: varchar("mitralValve", { length: 100 }),
  tricuspidValve: varchar("tricuspidValve", { length: 100 }),
  pulmonicValve: varchar("pulmonicValve", { length: 100 }),
  aorticStenosis: varchar("aorticStenosis", { length: 100 }),
  aorticInsufficiency: varchar("aorticInsufficiency", { length: 100 }),
  mitralStenosis: varchar("mitralStenosis", { length: 100 }),
  mitralRegurgitation: varchar("mitralRegurgitation", { length: 100 }),
  tricuspidStenosis: varchar("tricuspidStenosis", { length: 100 }),
  tricuspidRegurgitation: varchar("tricuspidRegurgitation", { length: 100 }),
  pulmonicStenosis: varchar("pulmonicStenosis", { length: 100 }),
  pulmonicInsufficiency: varchar("pulmonicInsufficiency", { length: 100 }),
  rvspmm: varchar("rvspmm", { length: 50 }),
  pericardialEffusion: varchar("pericardialEffusion", { length: 100 }),

  // ── Pediatric/Congenital extra fields ────────────────────────────────────────
  peripheralPulmonaryStenosis: varchar("peripheralPulmonaryStenosis", { length: 100 }),
  pulmonaryVeins: varchar("pulmonaryVeins", { length: 100 }),
  coronaryAnatomy: varchar("coronaryAnatomy", { length: 100 }),
  aorticArch: varchar("aorticArch", { length: 100 }),
  greatVessels: varchar("greatVessels", { length: 100 }),
  pdaDuctalArch: varchar("pdaDuctalArch", { length: 100 }),
  conotruncalAnatomy: varchar("conotruncalAnatomy", { length: 100 }),

  // ── Stress Echo fields ───────────────────────────────────────────────────────
  restingEfPercent: varchar("restingEfPercent", { length: 50 }),
  postStressEfPercent: varchar("postStressEfPercent", { length: 50 }),
  restingRwma: varchar("restingRwma", { length: 200 }),
  postStressRwma: varchar("postStressRwma", { length: 200 }),
  responseToStress: varchar("responseToStress", { length: 100 }),
  stressAorticStenosis: varchar("stressAorticStenosis", { length: 100 }),
  stressAorticInsufficiency: varchar("stressAorticInsufficiency", { length: 100 }),
  stressMitralStenosis: varchar("stressMitralStenosis", { length: 100 }),
  stressMitralRegurgitation: varchar("stressMitralRegurgitation", { length: 100 }),
  stressTricuspidStenosis: varchar("stressTricuspidStenosis", { length: 100 }),
  stressTricuspidRegurgitation: varchar("stressTricuspidRegurgitation", { length: 100 }),
  stressPulmonicStenosis: varchar("stressPulmonicStenosis", { length: 100 }),
  stressPulmonicInsufficiency: varchar("stressPulmonicInsufficiency", { length: 100 }),
  stressRvspmm: varchar("stressRvspmm", { length: 50 }),

  // ── Fetal Echo fields ────────────────────────────────────────────────────────
  fetalBiometry: varchar("fetalBiometry", { length: 100 }),
  fetalPosition: varchar("fetalPosition", { length: 100 }),
  fetalHeartRateRhythm: varchar("fetalHeartRateRhythm", { length: 100 }),

  // ── Other findings (3 free-text) ─────────────────────────────────────────────
  otherFindings1: text("otherFindings1"),
  otherFindings2: text("otherFindings2"),
  otherFindings3: text("otherFindings3"),

  // ── Review comments ──────────────────────────────────────────────────────────
  reviewComments: text("reviewComments"),

  // ── Concordance / variability result ────────────────────────────────────────
  concordanceScore: int("concordanceScore"),
  discordanceFields: text("discordanceFields"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PhysicianPeerReview = typeof physicianPeerReviews.$inferSelect;
export type InsertPhysicianPeerReview = typeof physicianPeerReviews.$inferInsert;

// ─── Physician Notifications ──────────────────────────────────────────────────
// In-app notifications sent to physicians when a Physician Peer Review is submitted
export const physicianNotifications = mysqlTable("physicianNotifications", {
  id: int("id").primaryKey().autoincrement(),
  // The physician who receives the notification (FK → users.id)
  recipientUserId: int("recipientUserId").notNull(),
  // The lab member record for the physician (FK → labMembers.id), if linked
  recipientLabMemberId: int("recipientLabMemberId"),
  // The review that triggered this notification (FK → physicianPeerReviews.id); NULL for non-peer-review types (e.g. cohort_discussion)
  reviewId: int("reviewId"),
  // Notification type
  type: varchar("type", { length: 50 }).notNull().default("peer_review_result"),
  // Short title shown in the bell dropdown
  title: varchar("title", { length: 255 }).notNull(),
  // Full message body (includes concordance score, discordant fields, comments)
  message: text("message").notNull(),
  // Structured payload (JSON): { concordanceScore, discordantFields, reviewerName, examType, examDate }
  payload: text("payload"),
  // Whether the physician has read this notification
  isRead: boolean("isRead").notNull().default(false),
  // Whether the notification has been dismissed
  isDismissed: boolean("isDismissed").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
});
export type PhysicianNotification = typeof physicianNotifications.$inferSelect;
export type InsertPhysicianNotification = typeof physicianNotifications.$inferInsert;

// ─── Accreditation Readiness ──────────────────────────────────────────────────
// Stores per-lab IAC checklist progress (JSON blob of checked item IDs)
export const accreditationReadiness = mysqlTable("accreditationReadiness", {
  id: int("id").primaryKey().autoincrement(),
  labId: int("labId").notNull(),
  userId: int("userId").notNull(),
  // JSON: { [itemId: string]: boolean } — maps checklist item IDs to checked state
  checklistProgress: text("checklistProgress").notNull(),
  // JSON: { [itemId: string]: string } — optional notes per item
  itemNotes: text("itemNotes").notNull(),
  // Cached overall completion percentage (0-100)
  completionPct: int("completionPct").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AccreditationReadiness = typeof accreditationReadiness.$inferSelect;
export type InsertAccreditationReadiness = typeof accreditationReadiness.$inferInsert;

// ─── Case Mix Submissions ─────────────────────────────────────────────────────
// IAC-compliant case study submissions tracked per lab
export const caseMixSubmissions = mysqlTable("caseMixSubmissions", {
  id: int("id").primaryKey().autoincrement(),
  labId: int("labId").notNull(),
  submittedByUserId: int("submittedByUserId").notNull(),
  // Modality: ATTE | ATEE | STRESS | ACTE | PTTE | PTEE | FETAL
  modality: varchar("modality", { length: 20 }).notNull(),
  // IAC case type category
  caseType: varchar("caseType", { length: 80 }).notNull(),
  // De-identified study identifier (no PHI)
  studyIdentifier: varchar("studyIdentifier", { length: 100 }).notNull(),
  // Date of study
  studyDate: varchar("studyDate", { length: 20 }),
  // Sonographer lab member ID (FK → labMembers.id)
  sonographerLabMemberId: int("sonographerLabMemberId"),
  sonographerName: varchar("sonographerName", { length: 100 }),
  // Physician lab member ID (FK → labMembers.id)
  physicianLabMemberId: int("physicianLabMemberId"),
  physicianName: varchar("physicianName", { length: 100 }),
  // Whether this case is from the Technical Director (required by IAC)
  isTechDirectorCase: boolean("isTechDirectorCase").notNull().default(false),
  // Whether the Medical Director is represented in this case
  isMedDirectorCase: boolean("isMedDirectorCase").notNull().default(false),
  // Free-text notes
  notes: text("notes"),
  // Submission status: draft | submitted | accepted | rejected
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CaseMixSubmission = typeof caseMixSubmissions.$inferSelect;
export type InsertCaseMixSubmission = typeof caseMixSubmissions.$inferInsert;

// ─── Accreditation Readiness (Navigator / Free-Tier) ─────────────────────────
// Separate from the DIY Tool readiness — stored independently so paid features
// can be added to the DIY version without affecting the free Navigator version.
export const accreditationReadinessNavigator = mysqlTable("accreditationReadinessNavigator", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  // JSON: { [itemId: string]: boolean }
  checklistProgress: text("checklistProgress").notNull(),
  // JSON: { [itemId: string]: string }
  itemNotes: text("itemNotes").notNull(),
  // Cached overall completion percentage (0-100)
  completionPct: int("completionPct").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AccreditationReadinessNavigator = typeof accreditationReadinessNavigator.$inferSelect;
export type InsertAccreditationReadinessNavigator = typeof accreditationReadinessNavigator.$inferInsert;

// ─── User Roles (RBAC) ────────────────────────────────────────────────────────
// Multi-role assignment: a user can hold multiple app-level roles simultaneously.
// Roles:
//   user           — default on registration, basic access
//   premium_user   — access to premium navigator features
//   diy_admin      — Lab Admin who manages the DIY Accreditation Tool & assigns seats
//   diy_user       — seat-assigned user with DIY Accreditation Tool access
//   platform_admin — full platform management access (owner-level)
//   accreditation_manager — can manage all DIY orgs + full-service accounts; no other platform admin access
export const appRoleEnum = mysqlEnum("appRole", [
  "user",
  "premium_user",
  "diy_admin",
  "diy_user",
  "platform_admin",
  "accreditation_manager",
  "education_manager",
  "education_admin",
  "education_student",
  "platform_owner",
  "platform_moderator",
  "instructor",
  "team_admin",
  "affiliate",
]);

export const userRoles = mysqlTable("userRoles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager", "education_manager", "education_admin", "education_student", "platform_owner", "platform_moderator", "instructor", "team_admin", "affiliate"]).notNull(),
  // For diy_user: which lab subscription granted this seat
  grantedByLabId: int("grantedByLabId"),
  // Who assigned this role (platform_admin or diy_admin userId)
  assignedByUserId: int("assignedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ─── CME Hub: Thinkific Course Cache ─────────────────────────────────────────
// Cached copy of Thinkific product catalog (synced every 6 hours).
// Only non-hidden, published, non-archived products are stored here.
export const cmeCoursesCache = mysqlTable("cmeCoursesCache", {
  id: int("id").primaryKey().autoincrement(),
  // Thinkific product ID (used for deep-link URLs and enrollment lookups)
  thinkificProductId: int("thinkificProductId").notNull().unique(),
  // Thinkific course ID (different from product ID)
  thinkificCourseId: int("thinkificCourseId"),
  name: varchar("name", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 20 }),
  cardImageUrl: text("cardImageUrl"),
  instructorNames: text("instructorNames"),
  hasCertificate: boolean("hasCertificate").default(false).notNull(),
  // Raw Thinkific status fields (for reference)
  thinkificStatus: varchar("thinkificStatus", { length: 20 }),
  // JSON array of Thinkific collection IDs this product belongs to
  collectionIds: text("collectionIds"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  /** ID of the matching native LMS course, if one exists */
  nativeLmsCourseId: int("nativeLmsCourseId"),
});
export type CmeCourseCache = typeof cmeCoursesCache.$inferSelect;
export type InsertCmeCourseCache = typeof cmeCoursesCache.$inferInsert;

// ─── CME Hub: Course Metadata ─────────────────────────────────────────────────
// Admin-managed CME credit metadata not stored in Thinkific.
// One row per Thinkific product — upserted by platform_admin via the CME Hub admin panel.
export const cmeCourseMeta = mysqlTable("cmeCourseMeta", {
  id: int("id").primaryKey().autoincrement(),
  thinkificProductId: int("thinkificProductId").notNull().unique(),
  // Credit hours (e.g. 2.5 stored as "2.5")
  creditHours: varchar("creditHours", { length: 10 }),
  // Credit type: SDMS, AMA_PRA_1, ANCC, etc.
  creditType: mysqlEnum("creditType", ["SDMS", "AMA_PRA_1", "ANCC", "OTHER"]),
  // Specialty category for filtering
  specialty: varchar("specialty", { length: 100 }),
  // Accreditation body name
  accreditationBody: varchar("accreditationBody", { length: 100 }),
  // Whether to show in the public catalog (admin override)
  isVisible: boolean("isVisible").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedByUserId: int("updatedByUserId"),
});
export type CmeCourseMeta = typeof cmeCourseMeta.$inferSelect;
export type InsertCmeCourseMeta = typeof cmeCourseMeta.$inferInsert;

// ─── CME Hub: Enrollment Cache ────────────────────────────────────────────────
// Per-user enrollment progress cached from Thinkific.
// Keyed by (userId, thinkificProductId) — refreshed on-demand when user visits CME Hub.
export const cmeEnrollmentCache = mysqlTable("cmeEnrollmentCache", {
  id: int("id").primaryKey().autoincrement(),
  // iHeartEcho user ID
  userId: int("userId").notNull(),
  // Thinkific user ID (resolved by email match)
  thinkificUserId: int("thinkificUserId"),
  // Thinkific product ID
  thinkificProductId: int("thinkificProductId").notNull(),
  thinkificCourseId: int("thinkificCourseId"),
  courseName: varchar("courseName", { length: 300 }),
  percentCompleted: varchar("percentCompleted", { length: 10 }),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  startedAt: timestamp("startedAt"),
  expiryDate: timestamp("expiryDate"),
  expired: boolean("expired").default(false).notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type CmeEnrollmentCache = typeof cmeEnrollmentCache.$inferSelect;
export type InsertCmeEnrollmentCache = typeof cmeEnrollmentCache.$inferInsert;

// ─── Daily QuickFire: Questions ───────────────────────────────────────────────
// Individual questions for the Daily QuickFire engine.
// Types: scenario (text-only MCQ), image (image + MCQ), quickReview (flashcard).
export const quickfireQuestions = mysqlTable("quickfireQuestions", {
  id: int("id").primaryKey().autoincrement(),
  // Human-readable question ID, e.g. QID-0001. Auto-assigned on creation, unique, never reused.
  qid: varchar("qid", { length: 20 }).unique(),
  type: mysqlEnum("type", ["scenario", "image", "quickReview", "connect", "identifier", "order"]).notNull(),
  question: text("question").notNull(),
  // JSON: string[] — answer choices (for scenario/image types)
  options: text("options"),
  // Index into options array (0-based) for the correct answer
  correctAnswer: int("correctAnswer"),
  // Explanation shown after answering
  explanation: text("explanation"),
  // For quickReview: the "back" of the flashcard
  reviewAnswer: text("reviewAnswer"),
  // For image type: CDN URL of the echo image
  imageUrl: text("imageUrl"),
  // For video type: CDN URL of the echo video/clip
  videoUrl: text("videoUrl"),
  // For connect type: JSON array of {left: string, right: string} pairs
  pairs: text("pairs"),
  // For identifier type: JSON array of {x: number, y: number, label: string, radius?: number} markers
  markers: text("markers"),
  // For order type: JSON array of strings in the correct order
  orderedItems: text("orderedItems"),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("intermediate").notNull(),
  // JSON: string[] — topic tags (e.g. ["AS", "LV function", "TEE"])
  tags: text("tags"),
  // Brand this question belongs to (aaus = general ultrasound, iheartecho = echo-specific)
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  // Specialty category for flashcard filtering (AAUS + iHE values combined)
  echoCategory: mysqlEnum("echoCategory", [
    // AAUS categories
    "abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo",
    "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd",
    "pocus", "physics", "thyroid", "scrotum", "breast", "msk",
    // iHeartEcho categories
    "acs", "adult", "pediatric_congenital", "fetal", "general"
  ]).default("abdominal"),
  // Broad clinical category for admin filtering (AAUS + iHE categories combined)
  category: mysqlEnum("category", [
    // AAUS categories
    "Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester",
    "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics",
    // iHeartEcho categories
    "ACS", "Adult Echo", "Pediatric Echo", "ECG", "General"
  ]).default("Abdominal"),
  // Whether this question is active and eligible for daily sets
  isActive: boolean("isActive").default(true).notNull(),
  // Soft-delete: set when question is deleted from the bank. Permanently purged after 30 days.
  deletedAt: timestamp("deletedAt"),
  createdByUserId: int("createdByUserId"),
  // User-submission fields
  submitterName: varchar("submitterName", { length: 200 }),
  submitterLinkedIn: varchar("submitterLinkedIn", { length: 500 }),
  submittedByUserId: int("submittedByUserId"),
  // Submission workflow: 'draft' = admin-created, 'pending_review' = user-submitted awaiting approval, 'approved' = live, 'rejected' = declined
  submissionStatus: mysqlEnum("submissionStatus", ["draft", "pending_review", "approved", "rejected"]).default("draft").notNull(),
  // Points awarded to submitter when question is approved (true = already awarded)
  submissionPointsAwarded: boolean("submissionPointsAwarded").default(false).notNull(),
  // Admin rejection reason shown to submitter
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuickfireQuestion = typeof quickfireQuestions.$inferSelect;
export type InsertQuickfireQuestion = typeof quickfireQuestions.$inferInsert;

// ─── Daily QuickFire: Daily Sets ──────────────────────────────────────────────
// One row per calendar date — defines the set of questions for that day.
export const quickfireDailySets = mysqlTable("quickfireDailySets", {
  id: int("id").primaryKey().autoincrement(),
  // YYYY-MM-DD date string (UTC)
  setDate: varchar("setDate", { length: 10 }).notNull(),
  // Brand this daily set belongs to
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  // JSON: number[] — ordered list of quickfireQuestion IDs
  questionIds: text("questionIds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuickfireDailySet = typeof quickfireDailySets.$inferSelect;
export type InsertQuickfireDailySet = typeof quickfireDailySets.$inferInsert;

// ─── Daily QuickFire: User Attempts ──────────────────────────────────────────
// One row per user per question per day attempt.
export const quickfireAttempts = mysqlTable("quickfireAttempts", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  // YYYY-MM-DD of the daily set this attempt belongs to
  setDate: varchar("setDate", { length: 10 }).notNull(),
  // For MCQ: index of selected option; for quickReview: null (self-assessed)
  selectedAnswer: int("selectedAnswer"),
  // For quickReview: user self-assessed as correct
  selfMarkedCorrect: boolean("selfMarkedCorrect"),
  isCorrect: boolean("isCorrect"),
  // Time taken in milliseconds
  timeMs: int("timeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuickfireAttempt = typeof quickfireAttempts.$inferSelect;
export type InsertQuickfireAttempt = typeof quickfireAttempts.$inferInsert;

// ─── Case Library: Cases ─────────────────────────────────────────────────────
// Educational echo cases submitted by users or admins.
// User-submitted cases require admin approval before appearing in the library.
export const echoLibraryCases = mysqlTable("echoLibraryCases", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 300 }).notNull(),
  summary: text("summary").notNull(),
  // Full clinical details / history
  clinicalHistory: text("clinicalHistory"),
  // Final diagnosis / key finding
  diagnosis: varchar("diagnosis", { length: 300 }),
  // Teaching points (JSON: string[])
  teachingPoints: text("teachingPoints"),
  // Brand this case belongs to
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  modality: mysqlEnum("modality", [
    // AAUS modalities
    "Abdominal", "Vascular", "OB/Gyn", "MSK", "POCUS", "Thyroid", "Breast", "Renal", "Fetal Echo", "Other",
    // iHeartEcho modalities
    "TTE", "TEE", "ICE", "Stress", "Pediatric", "Fetal", "HOCM", "ECG"
  ]).notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("intermediate").notNull(),
  // JSON: string[] — topic tags
  tags: text("tags"),
  // Approval workflow
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  // Whether submitted directly by an admin (auto-approved)
  isAdminSubmission: boolean("isAdminSubmission").default(false).notNull(),
  submittedByUserId: int("submittedByUserId").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  rejectionReason: text("rejectionReason"),
  // HIPAA acknowledgement: user confirmed no PHI at submission time
  hipaaAcknowledged: boolean("hipaaAcknowledged").default(false).notNull(),
  // Optional credit fields — submitter can request attribution shown on the case
  submitterCreditName: varchar("submitterCreditName", { length: 200 }),
  submitterLinkedIn: varchar("submitterLinkedIn", { length: 500 }),
  // View / engagement counts
  viewCount: int("viewCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EchoLibraryCase = typeof echoLibraryCases.$inferSelect;
export type InsertEchoLibraryCase = typeof echoLibraryCases.$inferInsert;

// ─── Case Library: Media ─────────────────────────────────────────────────────
// Images and video clips attached to a case.
export const echoLibraryCaseMedia = mysqlTable("echoLibraryCaseMedia", {
  id: int("id").primaryKey().autoincrement(),
  caseId: int("caseId").notNull(),
  type: mysqlEnum("type", ["image", "video"]).notNull(),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  caption: varchar("caption", { length: 300 }),
  // Display order within the case
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EchoLibraryCaseMedia = typeof echoLibraryCaseMedia.$inferSelect;
export type InsertEchoLibraryCaseMedia = typeof echoLibraryCaseMedia.$inferInsert;

// ─── Case Library: Questions ─────────────────────────────────────────────────
// MCQ questions embedded within a case for self-assessment.
export const echoLibraryCaseQuestions = mysqlTable("echoLibraryCaseQuestions", {
  id: int("id").primaryKey().autoincrement(),
  caseId: int("caseId").notNull(),
  question: text("question").notNull(),
  // JSON: string[] — answer choices
  options: text("options").notNull(),
  correctAnswer: int("correctAnswer").notNull(),
  explanation: text("explanation"),
  sortOrder: int("sortOrder").default(0).notNull(),
});
export type EchoLibraryCaseQuestion = typeof echoLibraryCaseQuestions.$inferSelect;
export type InsertEchoLibraryCaseQuestion = typeof echoLibraryCaseQuestions.$inferInsert;

// ─── Case Library: User Attempts ─────────────────────────────────────────────
// Tracks whether a user has completed a case and their score.
export const echoLibraryCaseAttempts = mysqlTable("echoLibraryCaseAttempts", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  caseId: int("caseId").notNull(),
  // JSON: { [questionId: number]: number } — selected answer per question
  answers: text("answers"),
  // Number of correct answers
  score: int("score").default(0).notNull(),
  totalQuestions: int("totalQuestions").default(0).notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});
export type EchoLibraryCaseAttempt = typeof echoLibraryCaseAttempts.$inferSelect;
export type InsertEchoLibraryCaseAttempt = typeof echoLibraryCaseAttempts.$inferInsert;

// ─── Daily QuickFire: Challenge Queue ───────────────────────────────────────
// A "challenge" is a named, curated set of questions that gets published on a
// specific date and archived after 24 hours. Admins build a priority queue of
// draft challenges; the scheduler picks the next one each midnight UTC.
export const quickfireChallenges = mysqlTable("quickfireChallenges", {
  id: int("id").primaryKey().autoincrement(),
  // Human-readable title shown to users (e.g. "HOCM Special — March 8")
  title: varchar("title", { length: 300 }).notNull(),
  // Optional description / teaser shown before the challenge starts
  description: text("description"),
  // JSON: number[] — ordered list of quickfireQuestion IDs in this challenge
  questionIds: text("questionIds").notNull(),
  // Admin-assigned priority — lower number = published first (1 = highest)
  priority: int("priority").default(100).notNull(),
  // Brand this challenge belongs to
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  // Category tag for filtering — determines which daily slot this challenge fills
  category: mysqlEnum("category", [
    // AAUS categories
    "Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester",
    "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics",
    // iHeartEcho categories
    "ACS", "Adult Echo", "Pediatric Echo", "ECG", "General"
  ]).default("Abdominal").notNull(),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("intermediate"),
  // Lifecycle status — queued = in the auto-publish queue, waiting for its turn; trash = soft-deleted (purged after 30 days)
  status: mysqlEnum("status", ["draft", "queued", "scheduled", "live", "archived", "trash"]).default("draft").notNull(),
  // Position in the category queue — lower = published first; null = not in queue
  queuePosition: int("queuePosition"),
  // UTC date this challenge went live — YYYY-MM-DD (set automatically on publish)
  publishDate: varchar("publishDate", { length: 10 }),
  // Exact UTC timestamp when the challenge became live
  publishedAt: timestamp("publishedAt"),
  // Exact UTC timestamp when the challenge was archived (24 h after publishedAt)
  archivedAt: timestamp("archivedAt"),
  // Soft-delete: set when moved to trash. Permanently purged after 30 days.
  trashedAt: timestamp("trashedAt"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuickfireChallenge = typeof quickfireChallenges.$inferSelect;
export type InsertQuickfireChallenge = typeof quickfireChallenges.$inferInsert;

// ─── ScanCoach WYSIWYG Overrides ──────────────────────────────────────────────
// Stores per-view content overrides set by platform admins via the WYSIWYG editor.
// Each row overrides one or more fields for a specific view within a ScanCoach module.
// The `module` field identifies which ScanCoach page (e.g. "tte", "tee", "ice", "uea", "strain").
// The `viewId` field matches the `id` field on the static view data in the page component.
// Image fields store S3 CDN URLs; text fields store plain strings or JSON arrays.
export const scanCoachOverrides = mysqlTable("scanCoachOverrides", {
  id: int("id").primaryKey().autoincrement(),
  // Which ScanCoach module: tte | tee | ice | uea | strain
  module: varchar("module", { length: 32 }).notNull(),
  // Matches the `id` field on the static view object (e.g. "me4c", "plax", "a4c")
  viewId: varchar("viewId", { length: 64 }).notNull(),
  // Human-readable view name (denormalised for display in the editor)
  viewName: varchar("viewName", { length: 128 }),
  // ── Image overrides ──────────────────────────────────────────────────────────
  // Clinical echo image (replaces echoImageUrl / imageUrl on the static view)
  echoImageUrl: text("echoImageUrl"),
  // Anatomy / diagram reference image
  anatomyImageUrl: text("anatomyImageUrl"),
  // Transducer / probe positioning image
  transducerImageUrl: text("transducerImageUrl"),
  // Second clinical image (for views with mediaPairs: 2, e.g. UE Aortic Arch SAX + LAX)
  anatomy2ImageUrl: text("anatomy2ImageUrl"),
  // Second reference/transducer image (paired with anatomy2ImageUrl)
  transducer2ImageUrl: text("transducer2ImageUrl"),
  // ── Text overrides (JSON arrays stored as text) ───────────────────────────────
  // Override for the view description paragraph
  description: text("description"),
  // JSON: string[] — override for howToGet steps
  howToGet: text("howToGet"),
  // JSON: string[] — override for tips
  tips: text("tips"),
  // JSON: string[] — override for pitfalls
  pitfalls: text("pitfalls"),
  // JSON: string[] — override for structures list
  structures: text("structures"),
  // JSON: string[] — override for measurements list
  measurements: text("measurements"),
  // JSON: string[] — override for criticalFindings list
  criticalFindings: text("criticalFindings"),
  // ── Additional text fields for view content ──────────────────────────────────
  // Probe / transducer positioning text (replaces static probe field)
  probe: text("probe"),
  // Key anatomy description text
  anatomy: text("anatomy"),
  // ── Editable section labels ──────────────────────────────────────────────────
  // Custom label for the clinical echo image section (default: "Clinical Echo")
  echoLabel: varchar("echoLabel", { length: 128 }),
  // Custom label for the probe positioning section (default: "Probe Positioning")
  probeLabel: varchar("probeLabel", { length: 128 }),
  // Custom label for the anatomy section (default: "Anatomy Reference")
  anatomyLabel: varchar("anatomyLabel", { length: 128 }),
  // Custom label for the transducer image section (default: "Transducer Position")
  transducerLabel: varchar("transducerLabel", { length: 128 }),
  // ── Multiple clinical echo images ───────────────────────────────────────────
  // JSON array of {url, fileKey, caption, sortOrder} objects.
  // When present, overrides the single echoImageUrl field for the gallery display.
  echoImages: text("echoImages"),
  // ── Additional educational media ─────────────────────────────────────────────
  // JSON array of AdditionalMedia objects: {id, url, fileKey, caption, mediaType, section, sortOrder}
  // section values: "echo" | "anatomy" | "transducer" | "tips" | "structures" | "measurements" | "howToGet" | "criticalFindings" | "general"
  additionalMedia: text("additionalMedia"),
  // ── Custom view flag ─────────────────────────────────────────────────────────
  // true = this row was created by admin as a new view (not in static data)
  isCustomView: boolean("isCustomView").default(false),
  // Sort order for custom views (0 = first)
  sortOrder: int("sortOrder").default(0),
  // ── Metadata ─────────────────────────────────────────────────────────────────
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScanCoachOverride = typeof scanCoachOverrides.$inferSelect;
export type InsertScanCoachOverride = typeof scanCoachOverrides.$inferInsert;

// ─── Webhook Events Log ────────────────────────────────────────────────────────
export const webhookEvents = mysqlTable("webhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  /** Source system — e.g. "thinkific" */
  source: varchar("source", { length: 64 }).notNull().default("thinkific"),
  /** Thinkific resource type — e.g. "order", "subscription" */
  resource: varchar("resource", { length: 64 }).notNull(),
  /** Thinkific action — e.g. "created", "cancelled" */
  action: varchar("action", { length: 64 }).notNull(),
  /** Email extracted from the payload (if available) */
  email: varchar("email", { length: 255 }),
  /** Product name from the payload */
  productName: varchar("productName", { length: 512 }),
  /** HTTP status code returned to Thinkific */
  httpStatus: int("httpStatus").notNull().default(200),
  /** Outcome: "granted" | "revoked" | "pending_created" | "ignored" | "error" */
  outcome: varchar("outcome", { length: 64 }).notNull().default("ignored"),
  /** Human-readable result message */
  message: text("message"),
  /** Full raw payload stored as JSON text for debugging */
  rawPayload: text("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// ─── ScanCoach Media ──────────────────────────────────────────────────────────
// Stores reference images and video clips for TEE/ICE ScanCoach views.
// Admins upload via the ScanCoach admin panel; users only see filled slots.

export const scanCoachMedia = mysqlTable("scanCoachMedia", {
  id: int("id").autoincrement().primaryKey(),
  /** View identifier matching TEEView.id in TEEIceScanCoach.tsx, e.g. "me-4c" */
  viewId: varchar("viewId", { length: 64 }).notNull(),
  /** "image" | "clip" */
  mediaType: mysqlEnum("mediaType", ["image", "clip"]).notNull().default("image"),
  /** Role of the media: clinical = real patient image, reference = diagram/schematic/annotated image, general = other */
  role: mysqlEnum("role", ["clinical", "reference", "general"]).notNull().default("general"),
  /** Public S3 URL */
  url: text("url").notNull(),
  /** S3 key for deletion */
  fileKey: text("fileKey").notNull(),
  /** Optional caption shown below the media */
  caption: varchar("caption", { length: 255 }),
  /** Sort order within a view (0 = primary) */
  sortOrder: int("sortOrder").default(0).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScanCoachMedia = typeof scanCoachMedia.$inferSelect;
export type InsertScanCoachMedia = typeof scanCoachMedia.$inferInsert;

// ─── Physician Over-Read Invitations ──────────────────────────────────────────
// Step 1 of the new physician peer review workflow:
//   Lab admin creates an invitation → physician receives email with a secure link
//   → physician completes the blind over-read form (no login required)
//   → results saved back to the lab account
//   → lab admin is notified to complete Step 2 (comparison)
export const physicianOverReadInvitations = mysqlTable("physicianOverReadInvitations", {
  id: int("id").primaryKey().autoincrement(),
  // The lab that owns this invitation
  labId: int("labId").notNull(),
  // The lab admin who created the invitation
  createdByUserId: int("createdByUserId").notNull(),
  // Exam header info (set by lab admin when creating the invitation)
  examIdentifier: varchar("examIdentifier", { length: 100 }).notNull(),
  examDos: varchar("examDos", { length: 20 }),
  examType: varchar("examType", { length: 50 }).notNull(),
  postStressDopplerPerformed: varchar("postStressDopplerPerformed", { length: 10 }),
  originalInterpretingPhysician: varchar("originalInterpretingPhysician", { length: 255 }),
  // Optional PACS / image-viewer link sent to the physician so they can access echo images
  pacsImageUrl: varchar("pacsImageUrl", { length: 2048 }),
  // Physician reviewer info
  reviewerName: varchar("reviewerName", { length: 255 }),
  reviewerEmail: varchar("reviewerEmail", { length: 320 }).notNull(),
  // Secure token for the physician to access the form (no login required)
  accessToken: varchar("accessToken", { length: 128 }).notNull().unique(),
  accessTokenExpiry: timestamp("accessTokenExpiry"),
  // Invitation lifecycle
  status: mysqlEnum("status", ["pending", "opened", "completed", "expired"]).default("pending").notNull(),
  emailSentAt: timestamp("emailSentAt"),
  openedAt: timestamp("openedAt"),
  completedAt: timestamp("completedAt"),
  // The resulting over-read record (FK → physicianOverReadSubmissions.id)
  submissionId: int("submissionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PhysicianOverReadInvitation = typeof physicianOverReadInvitations.$inferSelect;
export type InsertPhysicianOverReadInvitation = typeof physicianOverReadInvitations.$inferInsert;

// ─── Physician Over-Read Submissions (Step 1 results) ─────────────────────────
// Stores the physician's blind over-read findings submitted via the invitation link.
// These are later used to prepopulate the "Over-Read" column in Step 2.
export const physicianOverReadSubmissions = mysqlTable("physicianOverReadSubmissions", {
  id: int("id").primaryKey().autoincrement(),
  // FK → physicianOverReadInvitations.id
  invitationId: int("invitationId").notNull(),
  labId: int("labId").notNull(),
  // Header
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 100 }),
  examDos: varchar("examDos", { length: 20 }),
  examType: varchar("examType", { length: 50 }),
  postStressDopplerPerformed: varchar("postStressDopplerPerformed", { length: 10 }),
  originalInterpretingPhysician: varchar("originalInterpretingPhysician", { length: 255 }),
  overReadingPhysicianName: varchar("overReadingPhysicianName", { length: 255 }),
  // ── Adult TTE / TEE / Pediatric shared findings ──────────────────────────────
  situs: varchar("situs", { length: 100 }),
  cardiacPosition: varchar("cardiacPosition", { length: 100 }),
  leftHeart: varchar("leftHeart", { length: 100 }),
  rightHeart: varchar("rightHeart", { length: 100 }),
  efPercent: varchar("efPercent", { length: 50 }),
  lvWallThickness: varchar("lvWallThickness", { length: 100 }),
  ventricularSeptalDefect: varchar("ventricularSeptalDefect", { length: 200 }),
  atrialSeptalDefect: varchar("atrialSeptalDefect", { length: 200 }),
  patentForamenOvale: varchar("patentForamenOvale", { length: 200 }),
  lvChamberSize: varchar("lvChamberSize", { length: 100 }),
  laChamberSize: varchar("laChamberSize", { length: 100 }),
  rvChamberSize: varchar("rvChamberSize", { length: 100 }),
  raChamberSize: varchar("raChamberSize", { length: 100 }),
  regionalWallMotionAbnormalities: varchar("regionalWallMotionAbnormalities", { length: 500 }),
  aorticValve: varchar("aorticValve", { length: 100 }),
  mitralValve: varchar("mitralValve", { length: 100 }),
  tricuspidValve: varchar("tricuspidValve", { length: 100 }),
  pulmonicValve: varchar("pulmonicValve", { length: 100 }),
  aorticStenosis: varchar("aorticStenosis", { length: 100 }),
  aorticInsufficiency: varchar("aorticInsufficiency", { length: 100 }),
  mitralStenosis: varchar("mitralStenosis", { length: 100 }),
  mitralRegurgitation: varchar("mitralRegurgitation", { length: 100 }),
  tricuspidStenosis: varchar("tricuspidStenosis", { length: 100 }),
  tricuspidRegurgitation: varchar("tricuspidRegurgitation", { length: 100 }),
  pulmonicStenosis: varchar("pulmonicStenosis", { length: 100 }),
  pulmonicInsufficiency: varchar("pulmonicInsufficiency", { length: 100 }),
  rvspmm: varchar("rvspmm", { length: 50 }),
  pericardialEffusion: varchar("pericardialEffusion", { length: 100 }),
  // ── Pediatric/Congenital extra ────────────────────────────────────────────────
  peripheralPulmonaryStenosis: varchar("peripheralPulmonaryStenosis", { length: 100 }),
  pulmonaryVeins: varchar("pulmonaryVeins", { length: 100 }),
  coronaryAnatomy: varchar("coronaryAnatomy", { length: 100 }),
  aorticArch: varchar("aorticArch", { length: 100 }),
  greatVessels: varchar("greatVessels", { length: 100 }),
  pdaDuctalArch: varchar("pdaDuctalArch", { length: 100 }),
  conotruncalAnatomy: varchar("conotruncalAnatomy", { length: 100 }),
  // ── Stress Echo ───────────────────────────────────────────────────────────────
  restingEfPercent: varchar("restingEfPercent", { length: 50 }),
  postStressEfPercent: varchar("postStressEfPercent", { length: 50 }),
  restingRwma: varchar("restingRwma", { length: 500 }),
  postStressRwma: varchar("postStressRwma", { length: 500 }),
  responseToStress: varchar("responseToStress", { length: 100 }),
  stressAorticStenosis: varchar("stressAorticStenosis", { length: 100 }),
  stressAorticInsufficiency: varchar("stressAorticInsufficiency", { length: 100 }),
  stressMitralStenosis: varchar("stressMitralStenosis", { length: 100 }),
  stressMitralRegurgitation: varchar("stressMitralRegurgitation", { length: 100 }),
  stressTricuspidStenosis: varchar("stressTricuspidStenosis", { length: 100 }),
  stressTricuspidRegurgitation: varchar("stressTricuspidRegurgitation", { length: 100 }),
  stressPulmonicStenosis: varchar("stressPulmonicStenosis", { length: 100 }),
  stressPulmonicInsufficiency: varchar("stressPulmonicInsufficiency", { length: 100 }),
  stressRvspmm: varchar("stressRvspmm", { length: 50 }),
  // ── Fetal Echo ────────────────────────────────────────────────────────────────
  fetalBiometry: varchar("fetalBiometry", { length: 100 }),
  fetalPosition: varchar("fetalPosition", { length: 100 }),
  fetalHeartRateRhythm: varchar("fetalHeartRateRhythm", { length: 100 }),
  // ── Other / comments ─────────────────────────────────────────────────────────
  otherFindings1: text("otherFindings1"),
  otherFindings2: text("otherFindings2"),
  otherFindings3: text("otherFindings3"),
  reviewComments: text("reviewComments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PhysicianOverReadSubmission = typeof physicianOverReadSubmissions.$inferSelect;
export type InsertPhysicianOverReadSubmission = typeof physicianOverReadSubmissions.$inferInsert;

// ─── Physician Comparison Reviews (Step 2) ────────────────────────────────────
// Lab admin completes Step 2 after receiving the physician's over-read (Step 1).
// The "Over-Read" column is prepopulated from the Step 1 submission.
// The "Original Read" column is entered by the lab admin.
// Concordance score and discordant fields are computed on save.
export const physicianComparisonReviews = mysqlTable("physicianComparisonReviews", {
  id: int("id").primaryKey().autoincrement(),
  labId: int("labId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  // FK → physicianOverReadInvitations.id (links back to Step 1)
  invitationId: int("invitationId"),
  // FK → physicianOverReadSubmissions.id (the over-read data)
  overReadSubmissionId: int("overReadSubmissionId"),
  // Header
  overReadingPhysician: varchar("overReadingPhysician", { length: 255 }),
  originalReadingPhysician: varchar("originalReadingPhysician", { length: 255 }),
  dateReviewCompleted: varchar("dateReviewCompleted", { length: 20 }),
  examDos: varchar("examDos", { length: 20 }),
  examIdentifier: varchar("examIdentifier", { length: 100 }),
  examType: varchar("examType", { length: 50 }),
  // ── Original Read findings (entered by lab admin in Step 2) ──────────────────
  // These mirror the over-read fields from Step 1 for side-by-side comparison
  origSitus: varchar("origSitus", { length: 100 }),
  origCardiacPosition: varchar("origCardiacPosition", { length: 100 }),
  origLeftHeart: varchar("origLeftHeart", { length: 100 }),
  origRightHeart: varchar("origRightHeart", { length: 100 }),
  origEfPercent: varchar("origEfPercent", { length: 50 }),
  origLvWallThickness: varchar("origLvWallThickness", { length: 100 }),
  origVentricularSeptalDefect: varchar("origVentricularSeptalDefect", { length: 200 }),
  origAtrialSeptalDefect: varchar("origAtrialSeptalDefect", { length: 200 }),
  origPatentForamenOvale: varchar("origPatentForamenOvale", { length: 200 }),
  origLvChamberSize: varchar("origLvChamberSize", { length: 100 }),
  origLaChamberSize: varchar("origLaChamberSize", { length: 100 }),
  origRvChamberSize: varchar("origRvChamberSize", { length: 100 }),
  origRaChamberSize: varchar("origRaChamberSize", { length: 100 }),
  origRegionalWallMotionAbnormalities: varchar("origRegionalWallMotionAbnormalities", { length: 500 }),
  origAorticValve: varchar("origAorticValve", { length: 100 }),
  origMitralValve: varchar("origMitralValve", { length: 100 }),
  origTricuspidValve: varchar("origTricuspidValve", { length: 100 }),
  origPulmonicValve: varchar("origPulmonicValve", { length: 100 }),
  origAorticStenosis: varchar("origAorticStenosis", { length: 100 }),
  origAorticInsufficiency: varchar("origAorticInsufficiency", { length: 100 }),
  origMitralStenosis: varchar("origMitralStenosis", { length: 100 }),
  origMitralRegurgitation: varchar("origMitralRegurgitation", { length: 100 }),
  origTricuspidStenosis: varchar("origTricuspidStenosis", { length: 100 }),
  origTricuspidRegurgitation: varchar("origTricuspidRegurgitation", { length: 100 }),
  origPulmonicStenosis: varchar("origPulmonicStenosis", { length: 100 }),
  origPulmonicInsufficiency: varchar("origPulmonicInsufficiency", { length: 100 }),
  origRvspmm: varchar("origRvspmm", { length: 50 }),
  origPericardialEffusion: varchar("origPericardialEffusion", { length: 100 }),
  // Pediatric extra
  origPeripheralPulmonaryStenosis: varchar("origPeripheralPulmonaryStenosis", { length: 100 }),
  origPulmonaryVeins: varchar("origPulmonaryVeins", { length: 100 }),
  origCoronaryAnatomy: varchar("origCoronaryAnatomy", { length: 100 }),
  origAorticArch: varchar("origAorticArch", { length: 100 }),
  origGreatVessels: varchar("origGreatVessels", { length: 100 }),
  origPdaDuctalArch: varchar("origPdaDuctalArch", { length: 100 }),
  origConotruncalAnatomy: varchar("origConotruncalAnatomy", { length: 100 }),
  // Stress
  origRestingEfPercent: varchar("origRestingEfPercent", { length: 50 }),
  origPostStressEfPercent: varchar("origPostStressEfPercent", { length: 50 }),
  origRestingRwma: varchar("origRestingRwma", { length: 500 }),
  origPostStressRwma: varchar("origPostStressRwma", { length: 500 }),
  origResponseToStress: varchar("origResponseToStress", { length: 100 }),
  origStressAorticStenosis: varchar("origStressAorticStenosis", { length: 100 }),
  origStressAorticInsufficiency: varchar("origStressAorticInsufficiency", { length: 100 }),
  origStressMitralStenosis: varchar("origStressMitralStenosis", { length: 100 }),
  origStressMitralRegurgitation: varchar("origStressMitralRegurgitation", { length: 100 }),
  origStressTricuspidStenosis: varchar("origStressTricuspidStenosis", { length: 100 }),
  origStressTricuspidRegurgitation: varchar("origStressTricuspidRegurgitation", { length: 100 }),
  origStressPulmonicStenosis: varchar("origStressPulmonicStenosis", { length: 100 }),
  origStressPulmonicInsufficiency: varchar("origStressPulmonicInsufficiency", { length: 100 }),
  origStressRvspmm: varchar("origStressRvspmm", { length: 50 }),
  // Fetal
  origFetalBiometry: varchar("origFetalBiometry", { length: 100 }),
  origFetalPosition: varchar("origFetalPosition", { length: 100 }),
  origFetalHeartRateRhythm: varchar("origFetalHeartRateRhythm", { length: 100 }),
  // ── Concordance result ────────────────────────────────────────────────────────
  concordanceScore: int("concordanceScore"),
  // JSON array of field names that differ between over-read and original read
  discordantFields: text("discordantFields"),
  reviewComments: text("reviewComments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PhysicianComparisonReview = typeof physicianComparisonReviews.$inferSelect;
export type InsertPhysicianComparisonReview = typeof physicianComparisonReviews.$inferInsert;

// ─── Case View Events ─────────────────────────────────────────────────────────
// Lightweight event log: one row per case view, used for weekly trend analytics.
// viewedAt is indexed for efficient range queries.
export const caseViewEvents = mysqlTable("caseViewEvents", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
});
export type CaseViewEvent = typeof caseViewEvents.$inferSelect;

// ─── User Case Views (distinct cases opened per user, for access gating) ────
export const userCaseViews = mysqlTable(
  "userCaseViews",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    caseId: int("caseId").notNull(),
    firstViewedAt: timestamp("firstViewedAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("userCaseViews_userId_caseId_uniq").on(t.userId, t.caseId),
  })
);
export type UserCaseView = typeof userCaseViews.$inferSelect;

// ─── Possible Case Studies (IAC Submission Candidates) ───────────────────────
// Tracks echo cases identified during quality reviews as potential IAC case
// submissions. Each record gets a unique human-readable case study ID.
export const possibleCaseStudies = mysqlTable("possibleCaseStudies", {
  id: int("id").autoincrement().primaryKey(),
  // Unique human-readable ID, e.g. "CS-2026-001"
  caseStudyId: varchar("caseStudyId", { length: 20 }).notNull().unique(),
  // Source quality review (optional link back to the IQR)
  sourceIqrId: int("sourceIqrId"),
  // Exam info
  examType: varchar("examType", { length: 20 }),         // AETTE, AETEE, AE_STRESS, PETTE, PETEE, FE
  examDate: varchar("examDate", { length: 20 }),
  patientMrn: varchar("patientMrn", { length: 50 }),     // optional / de-identified
  diagnosis: text("diagnosis"),
  clinicalNotes: text("clinicalNotes"),
  // Staff
  sonographerName: varchar("sonographerName", { length: 150 }),
  sonographerEmail: varchar("sonographerEmail", { length: 200 }),
  interpretingPhysicianName: varchar("interpretingPhysicianName", { length: 150 }),
  interpretingPhysicianEmail: varchar("interpretingPhysicianEmail", { length: 200 }),
  // Accreditation tracking
  accreditationType: varchar("accreditationType", { length: 100 }),  // e.g. "Adult Echo", "Pediatric/Fetal"
  submissionStatus: mysqlEnum("submissionStatus", ["identified", "under_review", "submitted", "accepted"]).default("identified").notNull(),
  submissionNotes: text("submissionNotes"),
  // IAC role flags — IAC requires specific counts of TD and MD cases
  isTechnicalDirectorCase: boolean("isTechnicalDirectorCase").default(false).notNull(),
  isMedicalDirectorCase: boolean("isMedicalDirectorCase").default(false).notNull(),
  // Lab linkage
  labId: int("labId"),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PossibleCaseStudy = typeof possibleCaseStudies.$inferSelect;
export type InsertPossibleCaseStudy = typeof possibleCaseStudies.$inferInsert;

// ─── DIY Accreditation: Organizations ────────────────────────────────────────
// One Organization per lab/clinic that subscribes to a DIY Accreditation tier.
// Created at registration or when a user purchases a DIY plan.
// All DIY data (subscriptions, members, seat allotments) is scoped to an org.
export const diyOrganizations = mysqlTable("diyOrganizations", {
  id: int("id").autoincrement().primaryKey(),
  // The owner/billing user who registered the org (SuperAdmin seat)
  // For shell orgs created by Accreditation Managers, this is the manager's userId
  ownerUserId: int("ownerUserId").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  facilityType: varchar("facilityType", { length: 100 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  zip: varchar("zip", { length: 20 }),
  country: varchar("country", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  website: varchar("website", { length: 255 }),
  contactName: varchar("contactName", { length: 200 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  notes: text("notes"),
  // Accreditation types the lab is seeking (JSON array: "adult_echo" | "pediatric_fetal_echo")
  accreditationTypes: text("accreditationTypes"),
  // Flag: created as a shell org by an Accreditation Manager (no user accounts)
  isShellOrg: boolean("isShellOrg").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiyOrganization = typeof diyOrganizations.$inferSelect;
export type InsertDiyOrganization = typeof diyOrganizations.$inferInsert;

// ─── DIY Accreditation: Subscriptions ────────────────────────────────────────
// One active subscription per organization.
// Tracks the tier, seat allotments, and payment metadata.
//
// Tiers and seat allotments:
//   starter       — 5 seats: 1 Lab Admin + 4 DIY Members
//   professional  — 15 seats: 2 Lab Admins + 13 DIY Members
//   advanced      — 50 seats: 5 Lab Admins + 45 DIY Members
//   partner       — unlimited: up to 10 Lab Admins + unlimited DIY Members
//
// SuperAdmin:
//   Each organization has exactly 1 SuperAdmin (the ownerUserId on diyOrganizations).
//   The SuperAdmin occupies 1 of the Lab Admin seats for their tier.
//   SuperAdmin can manage all org settings, billing, and seat assignments.
//
// Concierge add-on:
//   Available only as an add-on to an active subscription.
//   Tracked via hasConcierge flag + conciergeGrantedAt timestamp.
export const diySubscriptions = mysqlTable("diySubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  // Billing tier
  plan: mysqlEnum("plan", ["starter", "professional", "advanced", "partner", "consulting_client"]).notNull(),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "canceled", "paused"]).default("trialing").notNull(),
  // Seat allotments (derived from plan, stored for fast enforcement)
  totalSeats: int("totalSeats").notNull(),        // total seats (Lab Admin + DIY Member)
  labAdminSeats: int("labAdminSeats").notNull(),  // max Lab Admin seats (incl. SuperAdmin)
  memberSeats: int("memberSeats").notNull(),      // max DIY Member seats
  isUnlimitedMembers: boolean("isUnlimitedMembers").default(false).notNull(),
  // Concierge add-on ($4,997 one-time, only available with active subscription)
  hasConcierge: boolean("hasConcierge").default(false).notNull(),
  conciergeGrantedAt: timestamp("conciergeGrantedAt"),
  conciergeStripePaymentId: varchar("conciergeStripePaymentId", { length: 128 }),
  // Thinkific checkout tracking
  thinkificProductId: int("thinkificProductId"),
  thinkificOrderId: int("thinkificOrderId"),
  // Stripe (for Concierge and future direct billing)
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  // Billing cycle
  billingCycleStart: timestamp("billingCycleStart"),
  billingCycleEnd: timestamp("billingCycleEnd"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEndsAt: timestamp("trialEndsAt"),
  canceledAt: timestamp("canceledAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiySubscription = typeof diySubscriptions.$inferSelect;
export type InsertDiySubscription = typeof diySubscriptions.$inferInsert;

// ─── DIY Accreditation: Org Members ──────────────────────────────────────────
// Each row represents one seat assignment within an organization.
// diyRole:
//   super_admin  — 1 per org, the ownerUserId; occupies 1 Lab Admin seat
//   lab_admin    — manages workflows, policies, staff; has premium app access
//   diy_member   — participates in case review and workflow tasks; DIY-only access
//
// Seat enforcement rules (checked on every invite/assignment):
//   - Count active lab_admin rows (incl. super_admin) ≤ labAdminSeats
//   - Count active diy_member rows ≤ memberSeats (unless isUnlimitedMembers)
//   - Total active rows ≤ totalSeats (unless isUnlimitedMembers)
export const diyOrgMembers = mysqlTable("diyOrgMembers", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  subscriptionId: int("subscriptionId").notNull(),
  userId: int("userId"),                              // null until invite accepted
  inviteEmail: varchar("inviteEmail", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  credentials: varchar("credentials", { length: 200 }),
  // DIY-specific role within the organization
  diyRole: mysqlEnum("diyRole", ["super_admin", "lab_admin", "diy_member"]).notNull(),
  // Permissions snapshot (denormalized for fast gating checks)
  canManageWorkflows: boolean("canManageWorkflows").default(false).notNull(),
  canUploadPolicies: boolean("canUploadPolicies").default(false).notNull(),
  canAssignTasks: boolean("canAssignTasks").default(false).notNull(),
  canManageStaff: boolean("canManageStaff").default(false).notNull(),
  canViewAnalytics: boolean("canViewAnalytics").default(false).notNull(),
  canViewPolicyBuilder: boolean("canViewPolicyBuilder").default(false).notNull(),
  canViewCaseStudies: boolean("canViewCaseStudies").default(false).notNull(),
  canViewReadiness: boolean("canViewReadiness").default(false).notNull(),
  // Invite lifecycle
  inviteStatus: mysqlEnum("inviteStatus", ["pending", "accepted", "declined", "revoked"]).default("pending").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }),
  invitedByUserId: int("invitedByUserId"),
  joinedAt: timestamp("joinedAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiyOrgMember = typeof diyOrgMembers.$inferSelect;
export type InsertDiyOrgMember = typeof diyOrgMembers.$inferInsert;

// ─── DIY Accreditation: Concierge Purchases ──────────────────────────────────
// Tracks individual Concierge add-on purchases (Stripe one-time payment).
// A notification is sent to the owner when a purchase is processed.
export const diyConciergePurchases = mysqlTable("diyConciergePurchases", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  subscriptionId: int("subscriptionId").notNull(),
  purchaserUserId: int("purchaserUserId"),
  purchaserEmail: varchar("purchaserEmail", { length: 320 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  amountCents: int("amountCents").default(499700).notNull(), // $4,997.00
  status: mysqlEnum("status", ["pending", "complete", "refunded"]).default("pending").notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DiyConciergePurchase = typeof diyConciergePurchases.$inferSelect;
export type InsertDiyConciergePurchase = typeof diyConciergePurchases.$inferInsert;

// ─── Quality Meetings ─────────────────────────────────────────────────────────
// Meetings live inside the DIY Accreditation Tool under Lab Admin.

export const qualityMeetings = mysqlTable("qualityMeetings", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  meetingType: mysqlEnum("meetingType", [
    "quality_assurance",
    "peer_review",
    "accreditation",
    "staff_education",
    "policy_review",
    "other",
  ]).default("quality_assurance").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  location: varchar("location", { length: 255 }), // room name
  meetingLink: varchar("meetingLink", { length: 1024 }), // Zoom/Teams URL
  agenda: text("agenda"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  minutesHtml: text("minutesHtml"),          // final rich-text meeting minutes
  minutesFinalized: boolean("minutesFinalized").default(false).notNull(),
  minutesFinalizedAt: timestamp("minutesFinalizedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QualityMeeting = typeof qualityMeetings.$inferSelect;
export type InsertQualityMeeting = typeof qualityMeetings.$inferInsert;

export const meetingAttendees = mysqlTable("meetingAttendees", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  userId: int("userId"),                     // null = external invitee
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: varchar("role", { length: 128 }),    // e.g. "Sonographer", "Cardiologist"
  rsvpStatus: mysqlEnum("rsvpStatus", ["pending", "accepted", "declined"]).default("pending").notNull(),
  attendanceStatus: mysqlEnum("attendanceStatus", ["unknown", "present", "absent", "excused"]).default("unknown").notNull(),
  inviteSentAt: timestamp("inviteSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeetingAttendee = typeof meetingAttendees.$inferSelect;
export type InsertMeetingAttendee = typeof meetingAttendees.$inferInsert;

export const meetingRecordings = mysqlTable("meetingRecordings", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),  // S3 key
  fileUrl: text("fileUrl").notNull(),                       // S3 public URL
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSizeBytes: bigint("fileSizeBytes", { mode: "number" }),
  durationSeconds: int("durationSeconds"),
  transcriptionStatus: mysqlEnum("transcriptionStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeetingRecording = typeof meetingRecordings.$inferSelect;
export type InsertMeetingRecording = typeof meetingRecordings.$inferInsert;

export const meetingTranscripts = mysqlTable("meetingTranscripts", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  recordingId: int("recordingId").notNull(),
  fullText: text("fullText").notNull(),
  language: varchar("language", { length: 16 }),
  durationSeconds: int("durationSeconds"),
  segmentsJson: text("segmentsJson"),   // JSON array of Whisper segments with timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeetingTranscript = typeof meetingTranscripts.$inferSelect;
export type InsertMeetingTranscript = typeof meetingTranscripts.$inferInsert;

export const meetingMinutesDrafts = mysqlTable("meetingMinutesDrafts", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  generatedByUserId: int("generatedByUserId").notNull(),
  minutesHtml: text("minutesHtml").notNull(),
  promptUsed: text("promptUsed"),
  isAiGenerated: boolean("isAiGenerated").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeetingMinutesDraft = typeof meetingMinutesDrafts.$inferSelect;
export type InsertMeetingMinutesDraft = typeof meetingMinutesDrafts.$inferInsert;

// ─── Accreditation Form Builder ──────────────────────────────────────────────

/**
 * Top-level form template definitions.
 * Each template represents a versioned, editable accreditation review form.
 */
export const accreditationFormTemplates = mysqlTable("accreditationFormTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  formType: varchar("formType", { length: 100 }).notNull(), // e.g. "image_quality", "peer_review", "physician_peer_review"
  version: int("version").default(1).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  hostDomain: varchar("hostDomain", { length: 255 }).default("app.allaboutultrasound.com"),
  themeSettings: longtext("themeSettings"),
  importedFromUrl: varchar("importedFromUrl", { length: 1000 }),
  successMessage: longtext("successMessage"),
  successRedirectUrl: varchar("successRedirectUrl", { length: 500 }),
  defaultSuccessModuleId: int("defaultSuccessModuleId"),
  passingScorePercent: int("passingScorePercent"),
  // Stripe checkout settings
  stripeEnabled: boolean("stripeEnabled").default(false).notNull(),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeAmount: int("stripeAmount"), // in cents
  stripeCheckoutMode: varchar("stripeCheckoutMode", { length: 20 }).default("payment"),
  stripeSuccessUrl: varchar("stripeSuccessUrl", { length: 500 }),
  stripeCancelUrl: varchar("stripeCancelUrl", { length: 500 }),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AccreditationFormTemplate = typeof accreditationFormTemplates.$inferSelect;
export type InsertAccreditationFormTemplate = typeof accreditationFormTemplates.$inferInsert;

/**
 * Sections within a form template (ordered groups of items).
 */
export const accreditationFormSections = mysqlTable("accreditationFormSections", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isCollapsible: boolean("isCollapsible").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AccreditationFormSection = typeof accreditationFormSections.$inferSelect;
export type InsertAccreditationFormSection = typeof accreditationFormSections.$inferInsert;

/**
 * Individual form items (questions/fields) within a section.
 *
 * itemType:
 *   text       — short single-line text input
 *   textarea   — multi-line plain text
 *   email      — email input with optional routing rules
 *   richtext   — WYSIWYG rich text editor (TipTap) with image/video/HTML support
 *   radio      — single-choice radio buttons
 *   checkbox   — multi-choice checkboxes
 *   select     — dropdown select
 *   scale      — numeric rating scale
 *   heading    — visual section heading (non-input)
 *   info       — informational rich text block (non-input)
 *
 * Extended columns:
 *   richTextContent   — stored HTML for richtext/info items
 *   emailRoutingRules — JSON [{label, conditionItemId, conditionValue, routeTo}]
 *   placeholder       — placeholder text for text/email inputs
 *   validationRegex   — optional client-side validation pattern
 */
export const accreditationFormItems = mysqlTable("accreditationFormItems", {
  id: int("id").autoincrement().primaryKey(),
  sectionId: int("sectionId").notNull(),
  templateId: int("templateId").notNull(), // denormalized for fast queries
  label: text("label").notNull(),
  helpText: text("helpText"),
  itemType: mysqlEnum("itemType", ["text", "textarea", "email", "richtext", "radio", "checkbox", "select", "scale", "heading", "info", "hidden"]).notNull(),
  isRequired: boolean("isRequired").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  scaleMin: int("scaleMin"),
  scaleMax: int("scaleMax"),
  scaleMinLabel: varchar("scaleMinLabel", { length: 100 }),
  scaleMaxLabel: varchar("scaleMaxLabel", { length: 100 }),
  scoreWeight: int("scoreWeight").default(1).notNull(),
  richTextContent: longtext("richTextContent"),
  emailRoutingRules: text("emailRoutingRules"),
  placeholder: varchar("placeholder", { length: 300 }),
  validationRegex: varchar("validationRegex", { length: 500 }),
  extraConfig: longtext("extraConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AccreditationFormItem = typeof accreditationFormItems.$inferSelect;
export type InsertAccreditationFormItem = typeof accreditationFormItems.$inferInsert;

/**
 * Answer options for radio / checkbox / select items.
 * Each option can carry a quality score value.
 */
export const accreditationFormOptions = mysqlTable("accreditationFormOptions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  value: varchar("value", { length: 200 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  qualityScore: int("qualityScore").default(0).notNull(), // 0-100 score contribution when this option is selected
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AccreditationFormOption = typeof accreditationFormOptions.$inferSelect;
export type InsertAccreditationFormOption = typeof accreditationFormOptions.$inferInsert;

/**
 * Branching / conditional display rules.
 * "Show item [targetItemId] only when item [conditionItemId] has value [conditionValue]"
 */
export const accreditationFormBranchRules = mysqlTable("accreditationFormBranchRules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  ruleLabel: varchar("ruleLabel", { length: 255 }).default(""),
  targetItemId: int("targetItemId").notNull(),   // the item to show/hide/require
  targetType: varchar("targetType", { length: 20 }).notNull().default("item"),
  conditionItemId: int("conditionItemId").notNull(), // legacy single-condition field
  conditionValue: varchar("conditionValue", { length: 500 }).notNull(), // legacy single-condition value
  operator: varchar("operator", { length: 30 }).notNull().default("equals"),
  logicOperator: varchar("logicOperator", { length: 10 }).notNull().default("all"),
  conditions: longtext("conditions"), // JSON array of {conditionItemId, conditionValue, operator}
  action: mysqlEnum("action", ["show", "hide", "require", "unrequire"]).default("show").notNull(),
  isEnabled: boolean("isEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AccreditationFormBranchRule = typeof accreditationFormBranchRules.$inferSelect;
export type InsertAccreditationFormBranchRule = typeof accreditationFormBranchRules.$inferInsert;

/**
 * Organization-based visibility rules.
 * Controls which form items/sections are shown to specific accreditation organizations.
 *
 * ruleType:
 *   - "item"    => applies to a single form item
 *   - "section" => applies to an entire section
 *
 * action:
 *   - "show_only_for" => item/section is ONLY visible to the listed org(s)
 *   - "hide_for"      => item/section is HIDDEN for the listed org(s), visible to all others
 *
 * orgIds: JSON array of diyOrganization IDs, e.g. [1, 5, 12]
 */
export const accreditationFormOrgVisibilityRules = mysqlTable("accreditationFormOrgVisibilityRules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  ruleType: mysqlEnum("ruleType", ["item", "section"]).notNull(),
  targetId: int("targetId").notNull(),
  action: mysqlEnum("action", ["show_only_for", "hide_for"]).notNull(),
  orgIds: text("orgIds").notNull(),
  label: varchar("label", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AccreditationFormOrgVisibilityRule = typeof accreditationFormOrgVisibilityRules.$inferSelect;
export type InsertAccreditationFormOrgVisibilityRule = typeof accreditationFormOrgVisibilityRules.$inferInsert;

export const accreditationFormTemplateAssignments = mysqlTable("accreditationFormTemplateAssignments", {
  id: int("id").autoincrement().primaryKey(),
  formType: varchar("formType", { length: 100 }).notNull(),
  templateId: int("templateId").notNull(),
  orgId: int("orgId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AccreditationFormTemplateAssignment = typeof accreditationFormTemplateAssignments.$inferSelect;
export type InsertAccreditationFormTemplateAssignment = typeof accreditationFormTemplateAssignments.$inferInsert;

export const accreditationFormSubmissions = mysqlTable("accreditationFormSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  formType: varchar("formType", { length: 100 }).notNull(),
  submittedByUserId: int("submittedByUserId").notNull(),
  orgId: int("orgId"),
  reviewTargetType: varchar("reviewTargetType", { length: 100 }),
  reviewTargetId: int("reviewTargetId"),
  responses: longtext("responses").notNull(),
  qualityScore: int("qualityScore").default(0).notNull(),
  maxPossibleScore: int("maxPossibleScore").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("submitted").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AccreditationFormSubmission = typeof accreditationFormSubmissions.$inferSelect;
export type InsertAccreditationFormSubmission = typeof accreditationFormSubmissions.$inferInsert;

// ─── Accreditation Form Success Modules ──────────────────────────────────────
/**
 * Per-form success modules for accreditation/DIY forms.
 * Mirrors generalFormSuccessModules but scoped to accreditationFormTemplates.
 */
export const accreditationFormSuccessModules = mysqlTable("accreditationFormSuccessModules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  moduleType: mysqlEnum("moduleType", ["inline_message", "full_page", "redirect_url"]).notNull(),
  inlineContent: longtext("inlineContent"),
  pageContent: longtext("pageContent"),
  redirectUrl: varchar("redirectUrl", { length: 2000 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AccreditationFormSuccessModule = typeof accreditationFormSuccessModules.$inferSelect;
export type InsertAccreditationFormSuccessModule = typeof accreditationFormSuccessModules.$inferInsert;

export const accreditationFormSuccessRoutingRules = mysqlTable("accreditationFormSuccessRoutingRules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  ruleLabel: varchar("ruleLabel", { length: 255 }).default(""),
  successModuleId: int("successModuleId").notNull(),
  logicOperator: varchar("logicOperator", { length: 10 }).notNull().default("all"),
  conditions: longtext("conditions").notNull(),
  grantAccessActions: longtext("grantAccessActions"), // JSON: [{productType, productId}]
  // Per-rule Stripe checkout action
  stripeEnabled: boolean("stripeEnabled").notNull().default(false),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeAmount: int("stripeAmount"),
  stripeCheckoutMode: varchar("stripeCheckoutMode", { length: 20 }).default("payment"),
  stripeSuccessUrl: varchar("stripeSuccessUrl", { length: 2000 }),
  stripeCancelUrl: varchar("stripeCancelUrl", { length: 2000 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isEnabled: boolean("isEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AccreditationFormSuccessRoutingRule = typeof accreditationFormSuccessRoutingRules.$inferSelect;
export type InsertAccreditationFormSuccessRoutingRule = typeof accreditationFormSuccessRoutingRules.$inferInsert;

// ── Flashcard guest (unauthenticated) daily usage tracking ───────────────────
// Replaces in-memory Map so counts survive server restarts.
export const flashcardGuestDailyUsage = mysqlTable(
  "flashcardGuestDailyUsage",
  {
    id: int("id").autoincrement().primaryKey(),
    ipHash: varchar("ipHash", { length: 64 }).notNull(),
    dateStr: varchar("dateStr", { length: 10 }).notNull(),
    viewCount: int("viewCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({
    uniqIpDate: uniqueIndex("uniqIpDate").on(t.ipHash, t.dateStr),
  })
);
export type FlashcardGuestDailyUsage = typeof flashcardGuestDailyUsage.$inferSelect;

// ─── Accreditation Manager: Managed (Full-Service) Accounts ──────────────────
// Full-service (non-DIY) accreditation accounts managed by platform_admin or
// accreditation_manager. These are facilities that do not self-administer via
// the DIY tool — instead, an Accreditation Manager handles all form submissions,
// reporting, and task assignment on their behalf.
export const managedAccounts = mysqlTable("managedAccounts", {
  id: int("id").autoincrement().primaryKey(),
  // Facility info
  facilityName: varchar("facilityName", { length: 255 }).notNull(),
  facilityType: varchar("facilityType", { length: 100 }), // e.g. "Hospital", "Outpatient", "Mobile"
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  country: varchar("country", { length: 100 }).default("USA"),
  phone: varchar("phone", { length: 30 }),
  website: varchar("website", { length: 255 }),
  // Primary contact
  contactName: varchar("contactName", { length: 150 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactTitle: varchar("contactTitle", { length: 100 }),
  // Accreditation details
  accreditationTypes: text("accreditationTypes"), // JSON array e.g. ["Adult Echo","Pediatric/Fetal"]
  accreditationBody: varchar("accreditationBody", { length: 100 }), // e.g. "IAC", "ICAEL", "ACR"
  currentAccreditationStatus: mysqlEnum("currentAccreditationStatus", [
    "not_started", "in_progress", "submitted", "accredited", "expired", "suspended",
  ]).default("not_started").notNull(),
  accreditationExpiry: timestamp("accreditationExpiry"),
  notes: longtext("notes"),
  // Assigned manager
  assignedManagerId: int("assignedManagerId"), // userId of the accreditation_manager or platform_admin
  // Metadata
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ManagedAccount = typeof managedAccounts.$inferSelect;
export type InsertManagedAccount = typeof managedAccounts.$inferInsert;

// ─── Accreditation Manager: Task Assignments ─────────────────────────────────
// Tasks assigned by a platform_admin or accreditation_manager to a user (or
// external contact) for a specific managed account or DIY org. Triggers an
// email notification to the assignee.
export const accreditationTasks = mysqlTable("accreditationTasks", {
  id: int("id").autoincrement().primaryKey(),
  // Scope: either a managed account or a DIY org (one must be set)
  managedAccountId: int("managedAccountId"),
  diyOrgId: int("diyOrgId"),
  // Task details
  title: varchar("title", { length: 255 }).notNull(),
  description: longtext("description"),
  taskType: mysqlEnum("taskType", [
    "image_quality_review",
    "peer_review",
    "echo_correlation",
    "case_mix_submission",
    "readiness_checklist",
    "document_upload",
    "facility_information",
    "general",
  ]).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  dueDate: timestamp("dueDate"),
  // Assignment
  assignedToUserId: int("assignedToUserId"), // null if assigned to external email only
  assignedToEmail: varchar("assignedToEmail", { length: 320 }), // for external contacts
  assignedToName: varchar("assignedToName", { length: 150 }),
  assignedByUserId: int("assignedByUserId").notNull(),
  // Status tracking
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "overdue", "cancelled"]).default("pending").notNull(),
  completedAt: timestamp("completedAt"),
  completionNotes: longtext("completionNotes"),
  // Email notification tracking
  emailSentAt: timestamp("emailSentAt"),
  emailReminderSentAt: timestamp("emailReminderSentAt"),
  emailStatus: mysqlEnum("emailStatus", ["not_sent", "sent", "delivered", "failed"]).default("not_sent").notNull(),
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AccreditationTask = typeof accreditationTasks.$inferSelect;
export type InsertAccreditationTask = typeof accreditationTasks.$inferInsert;

// ─── Platform Email Templates ────────────────────────────────────────────────────────────────────────────────

export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  createdByUserId: int("createdByUserId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  // Rich HTML body (from TipTap editor)
  htmlBody: longtext("htmlBody").notNull(),
  // Optional plain-text version
  previewText: varchar("previewText", { length: 300 }),
  // Blocks JSON for the visual editor
  blocksJson: longtext("blocksJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─── Platform Email Campaigns ────────────────────────────────────────────────────────────────────────────────

export const emailCampaigns = mysqlTable("emailCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  sentByUserId: int("sentByUserId").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlBody: longtext("htmlBody").notNull(),
  previewText: varchar("previewText", { length: 300 }),
  // Audience filter snapshot (JSON)
  // { interests: string[], roles: string[], subscriptionType: string, specificEmails: string[] }
  audienceFilter: text("audienceFilter").notNull(),
  // Resolved recipient count at send time
  recipientCount: int("recipientCount").default(0).notNull(),
  // Status: draft | scheduled | sending | sent | failed
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "failed"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  // If set, the campaign will be sent at this time by the scheduler cron job
  scheduledAt: timestamp("scheduledAt"),
  errorMessage: text("errorMessage"),
  // Blocks JSON for the visual editor
  blocksJson: longtext("blocksJson"),
  // Sender profile override
  senderProfileId: int("senderProfileId"),
  fromName: varchar("fromName", { length: 200 }),
  fromEmail: varchar("fromEmail", { length: 300 }),
  // Per-campaign header customization
  headerTitle: varchar("headerTitle", { length: 300 }),
  headerSubtext: varchar("headerSubtext", { length: 500 }),
  headerColor: varchar("headerColor", { length: 20 }),
  headerEnabled: boolean("headerEnabled").default(true),
  // Engagement metrics
  openCount: int("openCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;

/** Per-recipient open/click/unsubscribe events for campaign analytics */
export const emailCampaignEvents = mysqlTable("emailCampaignEvents", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId"),
  recipientKey: varchar("recipientKey", { length: 128 }).notNull(),
  eventType: mysqlEnum("eventType", ["open", "click", "unsubscribe"]).notNull(),
  metadata: text("metadata"),
  country: varchar("country", { length: 100 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailCampaignEvent = typeof emailCampaignEvents.$inferSelect;
export type InsertEmailCampaignEvent = typeof emailCampaignEvents.$inferInsert;

// ─── EducatorAssist Platform ──────────────────────────────────────────────────
//
// Roles:
//   education_manager  — assigned by platform_admin; cross-org visibility into all educator orgs
//   education_admin    — the end-user "Educator" who owns an org and builds content
//   education_student  — learner enrolled in an educator org
//
// Subscription tiers (stored on educatorOrgs.tier):
//   individual    — $59.97/mo, 1 educator, 50 learners
//   school        — $299–$399/mo, 3 educators, 250 students
//   hospital      — $599–$999/mo, 5 educators, 500 staff
//   enterprise    — $1,999–$4,999/mo, unlimited educators, multi-site
//
// Visibility gate:
//   All /educator-assist marketing pages and /educator-admin / /educator-student routes
//   are gated behind platform_admin (or education_manager) until the platform admin
//   flips the `educatorPlatformVisible` flag in the platform settings table.
//   This flag is the single toggle to make EducatorAssist publicly visible.

// ─── Platform Feature Flags ───────────────────────────────────────────────────
// One row, keyed by name. Used to toggle platform-wide features.
export const platformFeatureFlags = mysqlTable("platformFeatureFlags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  // JSON value — can be boolean, string, number, or object
  value: text("value").notNull(),
  description: text("description"),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlatformFeatureFlag = typeof platformFeatureFlags.$inferSelect;
export type InsertPlatformFeatureFlag = typeof platformFeatureFlags.$inferInsert;

// ─── Educator Organisations ───────────────────────────────────────────────────
export const educatorOrgs = mysqlTable("educatorOrgs", {
  id: int("id").autoincrement().primaryKey(),
  // Org name (e.g. "St. Mary's Echo Training Program")
  name: varchar("name", { length: 300 }).notNull(),
  // Short slug for URL-friendly references
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  // Subscription tier
  tier: mysqlEnum("tier", ["individual", "school", "hospital", "enterprise"]).notNull().default("individual"),
  // Billing status
  billingStatus: mysqlEnum("billingStatus", ["active", "trial", "past_due", "cancelled", "pending"]).notNull().default("trial"),
  // Seat limits (null = unlimited for enterprise)
  maxEducators: int("maxEducators"),
  maxStudents: int("maxStudents"),
  // Org branding
  logoUrl: text("logoUrl"),
  bannerUrl: text("bannerUrl"),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  // Contact info
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactName: varchar("contactName", { length: 200 }),
  // Institution type
  institutionType: mysqlEnum("institutionType", ["individual", "school_university", "hospital_echo_lab", "health_system", "other"]).default("individual"),
  // Multi-site support (enterprise)
  isMultiSite: boolean("isMultiSite").default(false).notNull(),
  // Custom branding / white-label (enterprise)
  isWhiteLabel: boolean("isWhiteLabel").default(false).notNull(),
  // Assigned education_manager (platform-level oversight)
  assignedManagerId: int("assignedManagerId"),
  // Owner user (the primary education_admin who created the org)
  ownerUserId: int("ownerUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorOrg = typeof educatorOrgs.$inferSelect;
export type InsertEducatorOrg = typeof educatorOrgs.$inferInsert;

// ─── Educator Org Members ─────────────────────────────────────────────────────
// Tracks all users belonging to an educator org with their role within that org.
export const educatorOrgMembers = mysqlTable("educatorOrgMembers", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  // Role within this specific org
  orgRole: mysqlEnum("orgRole", ["education_admin", "education_student"]).notNull(),
  // Enrollment status
  status: mysqlEnum("status", ["active", "inactive", "pending", "suspended"]).notNull().default("pending"),
  // Invite token (for email-based enrollment)
  inviteToken: varchar("inviteToken", { length: 128 }),
  inviteEmail: varchar("inviteEmail", { length: 320 }),
  inviteExpiry: timestamp("inviteExpiry"),
  inviteAcceptedAt: timestamp("inviteAcceptedAt"),
  // Who added this member
  addedByUserId: int("addedByUserId"),
  joinedAt: timestamp("joinedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorOrgMember = typeof educatorOrgMembers.$inferSelect;
export type InsertEducatorOrgMember = typeof educatorOrgMembers.$inferInsert;

// ─── Educator Courses / Modules ───────────────────────────────────────────────
// A "course" is the top-level container. Modules are ordered sections within a course.
export const educatorCourses = mysqlTable("educatorCourses", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: longtext("description"),
  // Cover image
  coverImageUrl: text("coverImageUrl"),
  // Category alignment (mirrors quickfire categories)
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics", "Adult Echo", "Pediatric Echo", "ACS", "ECG", "General"]).default("Abdominal"),
  // Status
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  // Ordering within the org
  sortOrder: int("sortOrder").default(0).notNull(),
  // Estimated duration in minutes
  estimatedMinutes: int("estimatedMinutes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorCourse = typeof educatorCourses.$inferSelect;
export type InsertEducatorCourse = typeof educatorCourses.$inferInsert;

// ─── Course Modules ───────────────────────────────────────────────────────────
export const educatorModules = mysqlTable("educatorModules", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // Module type determines what content it holds
  moduleType: mysqlEnum("moduleType", ["lesson", "case_study", "challenge", "quiz", "flashcard_deck", "presentation", "protocol_library"]).notNull().default("lesson"),
  // Rich text lesson content (for type=lesson)
  content: longtext("content"),
  // Reference to existing platform content (for case_study, challenge, quiz, flashcard_deck)
  // JSON: { type: "case"|"challenge"|"quiz"|"flashcard", ids: number[] }
  linkedContentIds: text("linkedContentIds"),
  // For presentations: JSON array of slide objects
  presentationData: longtext("presentationData"),
  // Ordering within the course
  sortOrder: int("sortOrder").default(0).notNull(),
  // Estimated duration in minutes
  estimatedMinutes: int("estimatedMinutes"),
  // Whether this module is required for course completion
  isRequired: boolean("isRequired").default(true).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorModule = typeof educatorModules.$inferSelect;
export type InsertEducatorModule = typeof educatorModules.$inferInsert;

// ─── Assignments ──────────────────────────────────────────────────────────────
// An assignment links a course (or specific module) to a student or group of students.
export const educatorAssignments = mysqlTable("educatorAssignments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  assignedByUserId: int("assignedByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // What is being assigned
  courseId: int("courseId"),
  moduleId: int("moduleId"), // if assigning a specific module only
  // Assignment target: individual student or whole org (group)
  targetType: mysqlEnum("targetType", ["individual", "group", "org_wide"]).notNull().default("individual"),
  // JSON array of userId ints for individual/group targets
  targetUserIds: text("targetUserIds"),
  // Due date
  dueAt: timestamp("dueAt"),
  // Grading
  passingScore: int("passingScore"), // percentage 0-100
  maxAttempts: int("maxAttempts").default(3).notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorAssignment = typeof educatorAssignments.$inferSelect;
export type InsertEducatorAssignment = typeof educatorAssignments.$inferInsert;

// ─── Student Progress ─────────────────────────────────────────────────────────
// Tracks each student's progress through modules and assignments.
export const educatorStudentProgress = mysqlTable("educatorStudentProgress", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  courseId: int("courseId"),
  moduleId: int("moduleId"),
  assignmentId: int("assignmentId"),
  // Progress state
  status: mysqlEnum("status", ["not_started", "in_progress", "completed", "failed"]).notNull().default("not_started"),
  // Score (percentage 0-100, null if not scored)
  score: int("score"),
  // Attempt number
  attemptNumber: int("attemptNumber").default(1).notNull(),
  // Time spent in seconds
  timeSpentSeconds: int("timeSpentSeconds").default(0).notNull(),
  // Completion timestamp
  completedAt: timestamp("completedAt"),
  // Detailed result data (JSON: quiz answers, case responses, etc.)
  resultData: longtext("resultData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorStudentProgress = typeof educatorStudentProgress.$inferSelect;
export type InsertEducatorStudentProgress = typeof educatorStudentProgress.$inferInsert;

// ─── Competencies ─────────────────────────────────────────────────────────────
// Competency framework: defines skills/competencies that can be tracked per student.
export const educatorCompetencies = mysqlTable("educatorCompetencies", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // Category alignment
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics", "Adult Echo", "Pediatric Echo", "ACS", "ECG", "General"]).default("Abdominal"),
  // Difficulty level: 1=Novice, 2=Advanced Beginner, 3=Competent, 4=Proficient, 5=Expert
  maxLevel: int("maxLevel").default(5).notNull(),
  // Whether this competency is required for certification/completion
  isRequired: boolean("isRequired").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorCompetency = typeof educatorCompetencies.$inferSelect;
export type InsertEducatorCompetency = typeof educatorCompetencies.$inferInsert;

// ─── Student Competency Records ───────────────────────────────────────────────
// Tracks each student's achieved level for each competency.
export const educatorStudentCompetencies = mysqlTable("educatorStudentCompetencies", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  competencyId: int("competencyId").notNull(),
  // Current achieved level (1-5)
  achievedLevel: int("achievedLevel").notNull().default(0),
  // Assessor notes
  notes: text("notes"),
  // Who assessed/updated this record
  assessedByUserId: int("assessedByUserId"),
  assessedAt: timestamp("assessedAt"),
  // Evidence links (JSON array of URLs or module IDs)
  evidenceData: text("evidenceData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorStudentCompetency = typeof educatorStudentCompetencies.$inferSelect;
export type InsertEducatorStudentCompetency = typeof educatorStudentCompetencies.$inferInsert;

// ─── Educator Quizzes ─────────────────────────────────────────────────────────
// Custom quizzes created by educators (separate from Daily Challenge questions).
export const educatorQuizzes = mysqlTable("educatorQuizzes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // Time limit in minutes (null = no limit)
  timeLimitMinutes: int("timeLimitMinutes"),
  // Passing score percentage
  passingScore: int("passingScore").default(70).notNull(),
  // Shuffle questions
  shuffleQuestions: boolean("shuffleQuestions").default(false).notNull(),
  // Show correct answers after submission
  showAnswers: boolean("showAnswers").default(true).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorQuiz = typeof educatorQuizzes.$inferSelect;
export type InsertEducatorQuiz = typeof educatorQuizzes.$inferInsert;

// ─── Quiz Questions ───────────────────────────────────────────────────────────
export const educatorQuizQuestions = mysqlTable("educatorQuizQuestions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  orgId: int("orgId").notNull(),
  // Question text (rich HTML)
  question: longtext("question").notNull(),
  // JSON array of option strings
  options: text("options").notNull(),
  correctAnswer: int("correctAnswer").notNull(),
  explanation: longtext("explanation"),
  // Optional image/video URL
  mediaUrl: text("mediaUrl"),
  mediaType: mysqlEnum("mediaType", ["image", "video", "gif"]),
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).default("intermediate"),
  points: int("points").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EducatorQuizQuestion = typeof educatorQuizQuestions.$inferSelect;
export type InsertEducatorQuizQuestion = typeof educatorQuizQuestions.$inferInsert;

// ─── Quiz Attempts ────────────────────────────────────────────────────────────
export const educatorQuizAttempts = mysqlTable("educatorQuizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  assignmentId: int("assignmentId"),
  attemptNumber: int("attemptNumber").default(1).notNull(),
  // JSON: { questionId: number, selectedAnswer: number, isCorrect: boolean }[]
  answers: longtext("answers"),
  score: int("score"), // percentage 0-100
  passed: boolean("passed"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  timeSpentSeconds: int("timeSpentSeconds"),
});
export type EducatorQuizAttempt = typeof educatorQuizAttempts.$inferSelect;
export type InsertEducatorQuizAttempt = typeof educatorQuizAttempts.$inferInsert;

// ─── Educator Presentations ───────────────────────────────────────────────────
// Slide-based presentations created by educators.
export const educatorPresentations = mysqlTable("educatorPresentations", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // JSON array of slide objects { id, title, content, imageUrl, notes }
  slidesData: longtext("slidesData"),
  // Cover image
  coverImageUrl: text("coverImageUrl"),
  // Category alignment
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics", "Adult Echo", "Pediatric Echo", "ACS", "ECG", "General"]).default("Abdominal").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorPresentation = typeof educatorPresentations.$inferSelect;
export type InsertEducatorPresentation = typeof educatorPresentations.$inferInsert;

// ─── Educator Announcements ───────────────────────────────────────────────────
// Org-wide or course-level announcements from educators to students.
export const educatorAnnouncements = mysqlTable("educatorAnnouncements", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("courseId"), // null = org-wide
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  content: longtext("content").notNull(),
  // Pinned announcements appear at the top
  isPinned: boolean("isPinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorAnnouncement = typeof educatorAnnouncements.$inferSelect;
export type InsertEducatorAnnouncement = typeof educatorAnnouncements.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// TEACH — Instructor presentation & media workspace
// ═══════════════════════════════════════════════════════════════════════════════
// Shared by LMS Instructors and EducatorAssist™ educators.
// Files are stored in the media repository under Teach/user-{userId}/.
// EducatorAssist™ subscription platform remains gated by educatorPlatformVisible.

export const teachMaterials = mysqlTable("teach_materials", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  /** lms_instructor = commercial LMS instructor; educator_assist = EducatorAssist™ org educator */
  ownerContext: mysqlEnum("owner_context", ["lms_instructor", "educator_assist"]).notNull().default("lms_instructor"),
  lmsInstructorId: int("lms_instructor_id"),
  educatorOrgId: int("educator_org_id"),
  materialType: mysqlEnum("material_type", ["presentation", "media", "document"]).notNull().default("media"),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  /** Link to mediaAssets row when uploaded file is in the Teach folder */
  mediaAssetId: int("media_asset_id"),
  /** JSON slide array for presentation type: { id, title, content, imageUrl, notes }[] */
  slidesData: longtext("slides_data"),
  /** S3 URL to slides JSON when the payload exceeds the DB column limit (>10 MB) */
  slidesDataUrl: text("slides_data_url"),
  /** Applied slide master template */
  slideMasterId: int("slide_master_id"),
  /** When true, master layout is locked; content edits only */
  masterForced: boolean("master_forced").default(false).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  /** Folder organisation — FK to teach_folders.id; null = root */
  folderId: int("folder_id"),
  /** Cached folder name for display without a join */
  folderName: varchar("folder_name", { length: 300 }),
  /** When set, the file is in the trash; auto-purged after 30 days */
  trashedAt: timestamp("trashed_at"),
  /** userId who trashed the file */
  trashedBy: int("trashed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TeachMaterial = typeof teachMaterials.$inferSelect;
export type InsertTeachMaterial = typeof teachMaterials.$inferInsert;

/** Folder hierarchy for TEACH materials (per-user; admins can see all) */
export const teachFolders = mysqlTable("teach_folders", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  /** null = top-level folder */
  parentId: int("parent_id"),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TeachFolder = typeof teachFolders.$inferSelect;

export const teachSlideMasters = mysqlTable("teach_slide_masters", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  /** JSON array of master layout slides with placeholders */
  masterSlidesData: longtext("master_slides_data").notNull(),
  /** Available to all TEACH users when true */
  isGlobal: boolean("is_global").default(false).notNull(),
  /** Admin default master forced onto presentations without an explicit master */
  isDefaultForced: boolean("is_default_forced").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TeachSlideMaster = typeof teachSlideMasters.$inferSelect;
export type InsertTeachSlideMaster = typeof teachSlideMasters.$inferInsert;

export const teachMaterialPermissions = mysqlTable("teach_material_permissions", {
  id: int("id").autoincrement().primaryKey(),
  materialId: int("material_id").notNull(),
  granteeUserId: int("grantee_user_id").notNull(),
  canView: boolean("can_view").default(true).notNull(),
  canPresent: boolean("can_present").default(false).notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  canManage: boolean("can_manage").default(false).notNull(),
  canCopy: boolean("can_copy").default(false).notNull(),
  canDownload: boolean("can_download").default(false).notNull(),
  grantedByUserId: int("granted_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TeachMaterialPermission = typeof teachMaterialPermissions.$inferSelect;
export type InsertTeachMaterialPermission = typeof teachMaterialPermissions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// SONOQUIZ — Live Kahoot-Style Quiz Platform
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SonoQuiz Quizzes ─────────────────────────────────────────────────────────
// A quiz is a reusable collection of questions that can be hosted as a live session.
export const sonoQuizzes = mysqlTable("sonoQuizzes", {
  id: int("id").autoincrement().primaryKey(),
  createdByUserId: int("createdByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // Time limit per question in seconds (null = no limit, default 20s)
  timeLimitSeconds: int("timeLimitSeconds").default(20).notNull(),
  // Background music track key (null = no music)
  musicTrack: varchar("musicTrack", { length: 100 }),
  // Visual theme: "teal" | "dark" | "ocean" | "sunset" | "neon"
  theme: varchar("theme", { length: 50 }).default("teal").notNull(),
  // Cover image URL (CDN)
  coverImageUrl: text("coverImageUrl"),
  // Category tag
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics", "Adult Echo", "Pediatric Echo", "ACS", "ECG", "General"]).default("General").notNull(),
  // Number of questions (denormalized for quick display)
  questionCount: int("questionCount").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SonoQuiz = typeof sonoQuizzes.$inferSelect;
export type InsertSonoQuiz = typeof sonoQuizzes.$inferInsert;

// ─── SonoQuiz Questions ───────────────────────────────────────────────────────
export const sonoQuizQuestions = mysqlTable("sonoQuizQuestions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  // Question text
  question: longtext("question").notNull(),
  // JSON array of 2–4 option strings: ["Option A", "Option B", ...]
  options: text("options").notNull(),
  // 0-indexed correct answer
  correctAnswer: int("correctAnswer").notNull(),
  // Optional explanation shown after answer reveal
  explanation: longtext("explanation"),
  // Media attached to the question
  mediaUrl: text("mediaUrl"),
  mediaType: mysqlEnum("mediaType", ["image", "video", "gif"]),
  // Per-question time override (null = use quiz default)
  timeLimitSeconds: int("timeLimitSeconds"),
  // Points awarded for correct answer (speed bonus applied on top)
  points: int("points").default(100).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SonoQuizQuestion = typeof sonoQuizQuestions.$inferSelect;
export type InsertSonoQuizQuestion = typeof sonoQuizQuestions.$inferInsert;

// ─── SonoQuiz Live Sessions ───────────────────────────────────────────────────
// A session is a single live run of a quiz hosted by an educator.
export const sonoQuizSessions = mysqlTable("sonoQuizSessions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  hostUserId: int("hostUserId").notNull(),
  // 6-character uppercase join code (e.g. "SONO42")
  joinCode: varchar("joinCode", { length: 10 }).notNull().unique(),
  // Session state machine
  status: mysqlEnum("status", ["lobby", "active", "paused", "ended"]).default("lobby").notNull(),
  // Index of the currently active question (null = lobby/ended)
  currentQuestionIndex: int("currentQuestionIndex"),
  // When the current question was revealed (for timer calculation)
  questionStartedAt: timestamp("questionStartedAt"),
  // Whether to allow anonymous participants (no login required)
  allowAnonymous: boolean("allowAnonymous").default(true).notNull(),
  // Whether to show the leaderboard between questions
  showLeaderboard: boolean("showLeaderboard").default(true).notNull(),
  // Snapshot of quiz settings at session start
  quizSnapshot: longtext("quizSnapshot"),
  participantCount: int("participantCount").default(0).notNull(),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SonoQuizSession = typeof sonoQuizSessions.$inferSelect;
export type InsertSonoQuizSession = typeof sonoQuizSessions.$inferInsert;

// ─── SonoQuiz Participants ────────────────────────────────────────────────────
export const sonoQuizParticipants = mysqlTable("sonoQuizParticipants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  // Null for anonymous participants
  userId: int("userId"),
  // Fun ultrasound-themed anonymous name (e.g. "SonoNinja42")
  displayName: varchar("displayName", { length: 100 }).notNull(),
  // Avatar emoji or color index for visual differentiation
  avatarSeed: varchar("avatarSeed", { length: 50 }),
  // Cumulative score across all questions answered
  totalScore: int("totalScore").default(0).notNull(),
  // Rank at end of session (1 = winner)
  finalRank: int("finalRank"),
  isActive: boolean("isActive").default(true).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});
export type SonoQuizParticipant = typeof sonoQuizParticipants.$inferSelect;
export type InsertSonoQuizParticipant = typeof sonoQuizParticipants.$inferInsert;

// ─── SonoQuiz Answers ─────────────────────────────────────────────────────────
export const sonoQuizAnswers = mysqlTable("sonoQuizAnswers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  participantId: int("participantId").notNull(),
  questionId: int("questionId").notNull(),
  // 0-indexed selected answer (-1 = no answer / timed out)
  selectedAnswer: int("selectedAnswer").notNull().default(-1),
  isCorrect: boolean("isCorrect").default(false).notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  // How fast they answered (ms from question reveal)
  responseTimeMs: int("responseTimeMs"),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});
export type SonoQuizAnswer = typeof sonoQuizAnswers.$inferSelect;
export type InsertSonoQuizAnswer = typeof sonoQuizAnswers.$inferInsert;

// ─── App Settings (key-value store for platform-wide config) ──────────────────
export const appSettings = mysqlTable("appSettings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Navigator Overrides ──────────────────────────────────────────────────────
// Stores admin-editable checklist items, reference values, and exam tips
// for each Navigator module/section. When a row exists for a module, the
// Navigator page uses the DB data instead of the static code defaults.
export const navigatorOverrides = mysqlTable("navigatorOverrides", {
  id: int("id").primaryKey().autoincrement(),
  // Navigator module key (e.g. "abdominal", "venous", "carotid", "msk")
  module: varchar("module", { length: 64 }).notNull(),
  // Section/view name within the module (e.g. "Liver", "Shoulder")
  sectionName: varchar("sectionName", { length: 128 }).notNull(),
  // Probe/approach description for this section
  probe: text("probe"),
  // JSON array of checklist items: { id, label, detail, critical, sortOrder }
  items: text("items"),
  // JSON array of clinical images: { url, fileKey, caption, sortOrder }
  images: text("images"),
  // Sort order of this section within the module (0 = first)
  sortOrder: int("sortOrder").default(0),
  // Metadata
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type NavigatorOverride = typeof navigatorOverrides.$inferSelect;
export type InsertNavigatorOverride = typeof navigatorOverrides.$inferInsert;

// ─── Media Repository ─────────────────────────────────────────────────────────

/**
 * media_assets — one row per logical media file.
 * The "current" version is determined by the highest versionNumber in media_versions.
 * The slug is stable and used in all public/embed URLs.
 */
export const mediaAssets = mysqlTable("mediaAssets", {
  id: int("id").primaryKey().autoincrement(),
  // URL-safe unique identifier — used in /media/:slug and embed URLs
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // Broad media category for UI filtering
  mediaType: mysqlEnum("mediaType", [
    "image", "video", "audio", "document", "html", "scorm", "zip", "lms", "other"
  ]).notNull().default("other"),
  // MIME type of the current version (e.g. "video/mp4", "application/zip")
  mimeType: varchar("mimeType", { length: 128 }),
  // "public" — anyone with the link; "private" — email invite only
  access: mysqlEnum("access", ["public", "private"]).notNull().default("private"),
  // Optional comma-separated tags for search/filter
  tags: text("tags"),
  // Optional folder/category path (e.g. "Courses/Abdominal", "Marketing")
  folder: varchar("folder", { length: 255 }),
  // Thumbnail URL (auto-generated for images; manually set for video/other)
  thumbnailUrl: text("thumbnailUrl"),
  // Brand tag — which app uploaded this asset ("aaus" or "iheartecho")
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus"),
  // Soft-delete
  deletedAt: timestamp("deletedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

/**
 * media_versions — immutable upload history for each asset.
 * Re-uploading creates a new row; the highest versionNumber is "current".
 */
export const mediaVersions = mysqlTable("mediaVersions", {
  id: int("id").primaryKey().autoincrement(),
  assetId: int("assetId").notNull(),
  versionNumber: int("versionNumber").notNull().default(1),
  // S3 object key (used for deletion / presigned access)
  s3Key: text("s3Key").notNull(),
  // Public or presigned CDN URL
  s3Url: text("s3Url").notNull(),
  // Original file name as uploaded
  fileName: varchar("fileName", { length: 255 }),
  // File size in bytes
  fileSize: bigint("fileSize", { mode: "number" }),
  mimeType: varchar("mimeType", { length: 128 }),
  // Optional admin note about this version
  notes: text("notes"),
  // SCORM: R2 prefix where extracted files are stored (e.g. "scorm-extracted/my-slug-abc123/")
  scormExtractedPrefix: text("scormExtractedPrefix"),
  // SCORM: relative path to the launch HTML file within the extracted package
  scormLaunchFile: varchar("scormLaunchFile", { length: 512 }),
  // SCORM: extraction job status — pending | processing | done | failed
  scormExtractionStatus: varchar("scormExtractionStatus", { length: 20 }).default("pending"),
  // SCORM: error message if extraction failed
  scormExtractionError: text("scormExtractionError"),
  // SCORM: timestamp when extraction started (used to detect stalled jobs)
  scormExtractionStartedAt: timestamp("scormExtractionStartedAt"),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MediaVersion = typeof mediaVersions.$inferSelect;
export type InsertMediaVersion = typeof mediaVersions.$inferInsert;

/**
 * media_access_grants — per-email invite tokens for private assets.
 * A valid (non-expired, non-revoked) grant allows the holder to view/embed the asset.
 */
export const mediaAccessGrants = mysqlTable("mediaAccessGrants", {
  id: int("id").primaryKey().autoincrement(),
  assetId: int("assetId").notNull(),
  // Email address the invite was sent to
  email: varchar("email", { length: 320 }).notNull(),
  // Opaque token embedded in the access URL
  token: varchar("token", { length: 128 }).notNull().unique(),
  // NULL = never expires
  expiresAt: timestamp("expiresAt"),
  // Timestamp of first use (for audit)
  firstUsedAt: timestamp("firstUsedAt"),
  // Admin can revoke by setting this
  revokedAt: timestamp("revokedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MediaAccessGrant = typeof mediaAccessGrants.$inferSelect;
export type InsertMediaAccessGrant = typeof mediaAccessGrants.$inferInsert;

/**
 * media_view_events — one row per view/play of a media asset.
 * Recorded by the embed/serve endpoint on every request.
 */
export const mediaViewEvents = mysqlTable("mediaViewEvents", {
  id: int("id").primaryKey().autoincrement(),
  assetId: int("assetId").notNull(),
  // Grant used for this view (NULL for public assets)
  grantId: int("grantId"),
  // Viewer email (from grant, if available)
  viewerEmail: varchar("viewerEmail", { length: 320 }),
  // Referrer URL (where the embed was hosted)
  referer: text("referer"),
  // Viewer IP (hashed for privacy)
  ipHash: varchar("ipHash", { length: 64 }),
  // "embed" | "direct"
  viewType: mysqlEnum("viewType", ["embed", "direct"]).notNull().default("direct"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MediaViewEvent = typeof mediaViewEvents.$inferSelect;
export type InsertMediaViewEvent = typeof mediaViewEvents.$inferInsert;

// ─── Media Folders ────────────────────────────────────────────────────────────
export const mediaFolders = mysqlTable("media_folders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  parentId: int("parent_id"),
  sortOrder: int("sort_order").default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});


// ─── LMS — Education Library ──────────────────────────────────────────────────

export const lmsCourses = mysqlTable("lms_courses", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  coverImageUrl: text("cover_image_url"),
  status: mysqlEnum("status", ["draft", "public", "hidden", "private", "archived"]).default("draft").notNull(),
  type: mysqlEnum("type", ["course", "quiz", "download", "cohort", "workshop"]).default("course").notNull(),
  // Cohort-specific: close enrollment after this date (null = always open)
  enrollmentCloseDate: timestamp("enrollment_close_date"),
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  price: int("price").default(0).notNull(), // cents — used for one_time and payment_plan total
  isFree: boolean("is_free").default(false).notNull(),
  bundleOnly: boolean("bundle_only").default(false).notNull(), // if true, cannot be purchased standalone
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Extended pricing model
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time").notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  // Free trial before subscription
  trialDays: int("trialDays"), // NULL = no trial
  // Access duration after enrollment (NULL = lifetime)
  accessDurationDays: int("accessDurationDays"), // e.g. 30, 90, 365
  // Payment plan: down payment (cents) + N installments of installmentAmount (cents)
  downPayment: int("down_payment").default(0), // cents
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0), // cents per installment
  installmentIntervalDays: int("installment_interval_days").default(30), // days between installments
  // Stripe IDs for subscription/payment-plan products (created on first checkout)
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  // SEO / landing page
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  // Completion certificate
  hasCertificate: boolean("has_certificate").default(false).notNull(),
  certificateTemplateId: int("certificate_template_id"), // FK to lms_certificate_templates.id (null = default template)
  // Featured: admin-selectable to show on LMS home page
  isFeatured: boolean("is_featured").default(false).notNull(),
  // Drip: unlock all immediately (false) or by schedule (true)
  isDrip: boolean("is_drip").default(false).notNull(),
  // Show instructor profile card in the lesson player right panel
  showInstructor: boolean("show_instructor").default(false).notNull(),
  // Hide the progress bar/percentage from students in the course player and overview
  hideProgress: boolean("hide_progress").default(false).notNull(),
  // Show in Education Library — admin toggle to include/exclude from the public library
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  // Block editor content for the Course Overview page (JSON array of Block objects)
  // courseOverviewTopBlocks: shown ABOVE the progress bar
  // courseOverviewBlocks: shown BETWEEN progress bar and curriculum (middle zone)
  // courseOverviewBottomBlocks: shown BELOW the curriculum outline
  courseOverviewTopBlocks: longtext("course_overview_top_blocks"),
  courseOverviewBlocks: longtext("course_overview_blocks"),
  courseOverviewBottomBlocks: longtext("course_overview_bottom_blocks"),
  // Send a welcome/enrollment confirmation email to the student when they enroll in this course
  // Can be overridden per-course; also subject to the platform-wide enrollmentEmailEnabled setting
  sendEnrollmentEmail: boolean("send_enrollment_email").default(true).notNull(),

  // ── After Purchase Settings ──────────────────────────────────────────────────
  // Custom thank-you page: when true, show a page-builder page after purchase
  customThankYouEnabled: boolean("custom_thank_you_enabled").default(false).notNull(),
  // JSON array of Block objects for the custom thank-you page
  customThankYouBlocks: longtext("custom_thank_you_blocks"),
  // Post-purchase redirect URL — overrides thank-you page if set
  postPurchaseRedirectUrl: varchar("post_purchase_redirect_url", { length: 1024 }),
  // Welcome email settings (separate from enrollment confirmation)
  welcomeEmailEnabled: boolean("welcome_email_enabled").default(true).notNull(),
  welcomeEmailSubject: varchar("welcome_email_subject", { length: 500 }),
  welcomeEmailBody: longtext("welcome_email_body"),
  // Upsell offer shown on the thank-you page
  // Hide additional pricing options on the landing page (secondary pricing options block hidden)
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  upsellEnabled: boolean("upsell_enabled").default(false).notNull(),
  upsellCourseId: int("upsell_course_id"),
  upsellProductType: varchar("upsell_product_type", { length: 20 }).$type<"course" | "quiz" | "webinar" | "download" | "membership">(),
  upsellProductId: int("upsell_product_id"),
  upsellHeadline: varchar("upsell_headline", { length: 500 }),
  upsellDescription: text("upsell_description"),
  // Completion actions
  completionRedirectUrl: varchar("completion_redirect_url", { length: 1024 }),
  completionEmailEnabled: boolean("completion_email_enabled").default(false).notNull(),
  completionEmailSubject: varchar("completion_email_subject", { length: 500 }),
  completionEmailBody: longtext("completion_email_body"),

  // Course color scheme — applied to player sidebar, overview curriculum, landing page curriculum block
  // primaryColor: main brand color (buttons, active states, section headers)
  // accentColor: secondary/highlight color
  // gradientFrom/gradientTo: gradient start/end colors (used for section headers, progress bars)
  // gradientDirection: CSS gradient direction (e.g. "to right", "135deg")
  primaryColor: varchar("primary_color", { length: 20 }).default("#179ca3"),
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),
  gradientFrom: varchar("gradient_from", { length: 20 }).default("#179ca3"),
  gradientTo: varchar("gradient_to", { length: 20 }).default("#0d9488"),
  gradientDirection: varchar("gradient_direction", { length: 30 }).default("135deg"),
  thumbnailUrl: text("thumbnail_url"),
  // Custom text labels — JSON object overriding default terminology per-course
  // e.g. { lesson: "Lecture", section: "Unit", markComplete: "Mark Complete", nextLesson: "Next Lesson", ... }
  customLabels: longtext("custom_labels"),
  // Course-level default: show Mark Complete button on all lessons (can be overridden per lesson)
  // 1 = show (default), 0 = hide
  defaultMarkComplete: int("default_mark_complete").default(1).notNull(),
  // Course player UI theme: 'light' (default) or 'dark'
  playerTheme: mysqlEnum("player_theme", ["light", "dark"]).default("light").notNull(),
  // Group purchase: allow bulk seat purchases for teams/organizations
  allowGroupPurchase: boolean("allow_group_purchase").default(true).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  // Display order in the public Education Library (0 = unset/default, positive = explicit position)
  libraryOrder: int("library_order").default(0).notNull(),
  // Per-course publish domain override (null = use global coursePublishDomain from platform_settings)
  publishDomain: varchar("publish_domain", { length: 255 }),
  // Multi-cohort mode: when true, live sessions/assignments/recordings are scoped per cohort group
  multiCohortMode: boolean("multi_cohort_mode").default(false).notNull(),
  // Course-level waitlist settings (cohort/workshop type courses only)
  waitlistEnabled: boolean("waitlist_enabled").default(false).notNull(),
  waitlistHeading: varchar("waitlist_heading", { length: 500 }),
  waitlistBody: longtext("waitlist_body"),
  waitlistCtaLabel: varchar("waitlist_cta_label", { length: 255 }),
  waitlistCtaUrl: varchar("waitlist_cta_url", { length: 2048 }),
  waitlistRedirectUrl: varchar("waitlist_redirect_url", { length: 2048 }),
  waitlistSuccessMessage: longtext("waitlist_success_message"),
  // Block editor content for the Course Player right sidebar (shown below the instructor section)
  playerSidebarBlocks: longtext("player_sidebar_blocks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCourse = typeof lmsCourses.$inferSelect;
export type InsertLmsCourse = typeof lmsCourses.$inferInsert;

// Saved checkout page templates (admin-created, reusable across courses)
export const lmsCheckoutTemplates = mysqlTable("lms_checkout_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: longtext("config").notNull(), // JSON string of CheckoutPageConfig
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCheckoutTemplate = typeof lmsCheckoutTemplates.$inferSelect;

export const lmsSections = mysqlTable("lms_sections", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  dripDays: int("drip_days").default(0).notNull(), // days after enrollment to unlock the whole section
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsSection = typeof lmsSections.$inferSelect;

export const lmsLessons = mysqlTable("lms_lessons", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id"), // direct course reference (sectionId optional for top-level lessons)
  sectionId: int("section_id"), // nullable — top-level lessons have no section
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["video", "text", "quiz", "download", "embed", "video_text"]).default("text").notNull(),
  content: longtext("content"), // rich text HTML or markdown
  videoContent: longtext("video_content"), // rich text below the video for video_text lessons
  embedUrl: varchar("embed_url", { length: 500 }), // iframe src for embed lessons
  mediaAssetId: int("media_asset_id"), // FK to mediaAssets
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(), // kept for backward compat; derived from previewMode
  // Three-state preview mode:
  //   'none'                        = enrolled users only (default)
  //   'preview'                     = free preview, always visible to non-enrolled users
  //   'preview_hide_after_purchase' = free preview for non-enrolled, hidden once user purchases
  previewMode: mysqlEnum("preview_mode", ["none", "preview", "preview_hide_after_purchase"]).default("none").notNull(),
  dripDays: int("drip_days").default(0).notNull(), // days after enrollment to unlock
  durationMinutes: int("duration_minutes"),
  requireVideoCompletion: int("require_video_completion").default(0).notNull(), // 1 = must watch video before marking complete
  // null = inherit from course default, 0 = hide, 1 = show
  requireManualComplete: int("require_manual_complete"), // null = inherit from course (default)
  // Lesson Effects
  effectEnabled: boolean("effect_enabled").default(false),
  effectTrigger: varchar("effect_trigger", { length: 20 }).default("lesson_start"),
  effectBannerText: varchar("effect_banner_text", { length: 500 }),
  effectBannerBgColor: varchar("effect_banner_bg_color", { length: 20 }),
  effectBannerTextColor: varchar("effect_banner_text_color", { length: 20 }),
  effectSound: varchar("effect_sound", { length: 50 }),
  effectSoundUrl: varchar("effect_sound_url", { length: 500 }),
  effectConfetti: boolean("effect_confetti").default(false),
  effectConfettiColors: varchar("effect_confetti_colors", { length: 500 }),
  // Confetti mode: 'fall' = gentle falling confetti, 'cannon' = burst from sides
  effectConfettiMode: mysqlEnum("effect_confetti_mode", ["fall", "cannon"]).default("fall"),
  // Banner display duration in seconds (default 5)
  effectBannerDuration: int("effect_banner_duration").default(5),
  // Page builder blocks for rich lesson content (JSON array of Block objects)
  contentBlocks: longtext("content_blocks"),
  // Lesson learning objectives shown in "In This Lesson" panel (JSON array of strings)
  learningObjectives: longtext("learning_objectives"),
  // Override course-level showInstructor: null = inherit from course, true = always show, false = always hide
  showInstructor: mysqlEnum("show_instructor", ["inherit", "show", "hide"]).default("inherit").notNull(),
  // Prerequisite gate: when true, this lesson acts as a gate — all subsequent lessons in the course
  // are locked until this lesson is completed (or at minimum opened, if no Mark Complete button).
  isPrerequisite: boolean("is_prerequisite").default(false).notNull(),
  // Legacy: kept for DB compatibility but no longer used in logic
  prerequisiteLessonId: int("prerequisite_lesson_id"),
  // Live meeting link (Zoom/Teams) — shown as "Join Live" button on enrolled course overview only
  meetingLink: varchar("meeting_link", { length: 1024 }),
  // Scheduled start/end times for the live session (UTC ms). Join Live button appears 15 min before
  // liveStartAt and hides after liveEndAt (or 3 hours after liveStartAt if liveEndAt is not set).
  liveStartAt: bigint("live_start_at", { mode: "number" }),
  liveEndAt: bigint("live_end_at", { mode: "number" }),
  // Comments: when true, enrolled students can post comments on this lesson
  commentsEnabled: boolean("comments_enabled").default(false).notNull(),
  // Per-lesson publish status: 'published' = visible to enrolled learners (default), 'draft' = hidden from learners even if course is published
  lessonStatus: mysqlEnum("lesson_status", ["published", "draft"]).default("published").notNull(),
  // Show/hide native video controls (play, pause, seek, volume) for video/embed/video_text lessons. Default true.
  showVideoControls: boolean("show_video_controls").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLesson = typeof lmsLessons.$inferSelect;

// ── Curriculum Embed Visibility Overrides ────────────────────────────────────
// Controls which sections and lessons are hidden from the public embed widget.
// This does NOT affect the actual Thinkific course or enrolled student access —
// it only filters what appears in the embeddable curriculum accordion/CTA card.
export const curriculumEmbedVisibility = mysqlTable(
  "curriculum_embed_visibility",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("course_id").notNull(),
    itemType: mysqlEnum("item_type", ["section", "lesson"]).notNull(),
    itemId: int("item_id").notNull(), // lmsSections.id or lmsLessons.id
    hidden: boolean("hidden").default(true).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    uniqCev: uniqueIndex("uq_cev_course_item").on(t.courseId, t.itemType, t.itemId),
  })
);
export type CurriculumEmbedVisibility = typeof curriculumEmbedVisibility.$inferSelect;

// ── Section Templates ─────────────────────────────────────────────────────────
// A section template stores a section title + all its lessons (as a JSON snapshot)
// so admins can reuse common module structures across courses.
export const lmsSectionTemplates = mysqlTable("lms_section_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // template display name
  description: text("description"), // optional description
  sectionTitle: varchar("section_title", { length: 255 }).notNull(), // default section title when imported
  // JSON snapshot of lessons: array of { title, type, content, embedUrl, dripDays, requireVideoCompletion, requireManualComplete, durationMinutes, contentBlocks, learningObjectives }
  lessonsJson: longtext("lessons_json").notNull(),
  lessonCount: int("lesson_count").default(0).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsSectionTemplate = typeof lmsSectionTemplates.$inferSelect;

export const lmsQuizzes = mysqlTable("lms_quizzes", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  passingScore: int("passing_score").default(70).notNull(), // percentage
  allowRetakes: boolean("allow_retakes").default(true).notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(true).notNull(),
  requirePassingToProgress: boolean("require_passing_to_progress").default(false).notNull(),
  randomizeQuestions: boolean("randomize_questions").default(false).notNull(),
  randomizeAnswers: boolean("randomize_answers").default(false).notNull(),
  useQuestionGroups: boolean("use_question_groups").default(false).notNull(),
  questionBankFolderId: int("question_bank_folder_id"),
  // Result visibility toggles
  showGroupNames: boolean("show_group_names").default(true).notNull(),
  showPerQuestionResult: boolean("show_per_question_result").default(true).notNull(),
  showOnlyPercentage: boolean("show_only_percentage").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuiz = typeof lmsQuizzes.$inferSelect;

export const lmsQuizQuestions = mysqlTable("lms_quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  question: text("question").notNull(),
  type: mysqlEnum("type", ["mcq", "truefalse", "multiselect", "hotspot", "matching"]).default("mcq").notNull(),
  options: text("options"), // JSON array of strings or {text,imageUrl?,videoUrl?} objects
  correctAnswer: varchar("correct_answer", { length: 255 }).notNull(),
  /** For multiselect: JSON array of correct answer indices. For hotspot: JSON {x,y,radius}. */
  correctAnswers: text("correct_answers"),
  explanation: text("explanation"),
  questionImageUrl: text("question_image_url"),
  questionVideoUrl: text("question_video_url"),
  /** Hotspot: JSON array of { id, x, y, radius, label, isCorrect } */
  hotspotMarkers: text("hotspot_markers"),
  /** Matching: JSON array of { id, left, right } */
  matchingPairs: text("matching_pairs"),
  feedbackImageUrl: text("feedback_image_url"),
  feedbackVideoUrl: text("feedback_video_url"),
  position: int("position").default(0).notNull(),
});
export type LmsQuizQuestion = typeof lmsQuizQuestions.$inferSelect;

export const lmsEnrollments = mysqlTable("lms_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  progressPct: int("progress_pct").default(0).notNull(),
  groupId: int("group_id"),
  affiliateCode: varchar("affiliate_code", { length: 64 }),
  orderId: int("order_id"),
  // Enrollment type: 'full' = paid/full access, 'free_preview' = free preview only (limited to preview lessons)
  enrollmentType: mysqlEnum("enrollment_type", ["full", "free_preview"]).default("full").notNull(),
  /** When set, enrollment is inactive after this time (Thinkific expiry, membership period end) */
  accessExpiresAt: timestamp("access_expires_at"),
  source: varchar("source", { length: 32 }).default("manual").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsEnrollment = typeof lmsEnrollments.$inferSelect;

export const lmsLessonProgress = mysqlTable("lms_lesson_progress", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  completedAt: timestamp("completed_at"),
  quizScore: int("quiz_score"), // percentage if quiz lesson
  quizPassed: boolean("quiz_passed"),
  attempts: int("attempts").default(0).notNull(),
});
export type LmsLessonProgress = typeof lmsLessonProgress.$inferSelect;

export const lmsGroups = mysqlTable("lms_groups", {
  id: int("id").autoincrement().primaryKey(),
  /** Legacy single-course field — kept for backward compat, new teams use lmsGroupCourses */
  courseId: int("course_id"),
  name: varchar("name", { length: 255 }).notNull(),
  /** Legacy total seats — new teams track seats per course in lmsGroupCourses */
  seats: int("seats").default(1).notNull(),
  managerId: int("manager_id"), // FK to users — the group manager (legacy)
  /** Team admin user ID — has team-admin role, can manage this team only */
  teamAdminId: int("team_admin_id"),
  /** Organisation / institution name */
  orgName: varchar("org_name", { length: 255 }),
  /** Team admin contact email */
  adminEmail: varchar("admin_email", { length: 320 }),
  /** Team admin contact phone */
  adminPhone: varchar("admin_phone", { length: 50 }),
  /** Organisation website */
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  // Stripe order that created this group (set after webhook fulfillment)
  orderId: int("order_id"),
  /** How this group was created — used for admin filtering */
  source: mysqlEnum("source", ["stripe_checkout", "free_enrollment", "admin_created"]).default("admin_created"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroup = typeof lmsGroups.$inferSelect;

/** Per-course seat allocation for a team (replaces single courseId+seats on lmsGroups) */
export const lmsGroupCourses = mysqlTable("lms_group_courses", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  courseId: int("course_id").notNull(),
  seats: int("seats").default(1).notNull(),
  /** Stripe order that added this course allocation */
  orderId: int("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroupCourse = typeof lmsGroupCourses.$inferSelect;

export const lmsGroupSeats = mysqlTable("lms_group_seats", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  memberName: varchar("member_name", { length: 255 }), // optional display name
  status: mysqlEnum("status", ["pending", "active", "revoked"]).default("pending").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  enrollmentId: int("enrollment_id"), // set when user accepts and enrolls
  inviteToken: varchar("invite_token", { length: 128 }),
  acceptedAt: timestamp("accepted_at"),
  lastInviteSentAt: timestamp("last_invite_sent_at"),
});
export type LmsGroupSeat = typeof lmsGroupSeats.$inferSelect;

export const lmsInstructors = mysqlTable("lms_instructors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"), // optional link to app user account
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  bio: longtext("bio"),
  avatarUrl: text("avatar_url"),
  website: varchar("website", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsInstructor = typeof lmsInstructors.$inferSelect;

export const lmsCourseInstructors = mysqlTable("lms_course_instructors", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  revenueSharePct: int("revenue_share_pct").default(0).notNull(), // 0-100
  isPrimary: boolean("is_primary").default(false).notNull(),
});
export type LmsCourseInstructor = typeof lmsCourseInstructors.$inferSelect;

// Per-lesson instructor override — when set, these instructors are shown instead of course-level instructors
export const lmsLessonInstructors = mysqlTable("lms_lesson_instructors", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  position: int("position").default(0).notNull(),
});
export type LmsLessonInstructor = typeof lmsLessonInstructors.$inferSelect;
export type InsertLmsLessonInstructor = typeof lmsLessonInstructors.$inferInsert;

export const lmsAffiliates = mysqlTable("lms_affiliates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"), // optional link to app user
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  code: varchar("code", { length: 64 }).notNull().unique(),
  commissionPct: int("commission_pct").default(10).notNull(), // percentage
  isActive: boolean("is_active").default(true).notNull(),
  totalEarned: int("total_earned").default(0).notNull(), // cents
  totalPaid: int("total_paid").default(0).notNull(), // cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsAffiliate = typeof lmsAffiliates.$inferSelect;

export const lmsAffiliateConversions = mysqlTable("lms_affiliate_conversions", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull(),
  enrollmentId: int("enrollment_id"), // nullable for non-LMS conversions (e.g. digital downloads)
  orderId: int("order_id"), // nullable for non-LMS conversions
  digitalPurchaseId: int("digital_purchase_id"), // for digital download conversions
  conversionType: varchar("conversion_type", { length: 32 }).default("lms_course"), // lms_course | digital_download
  saleAmount: int("sale_amount").notNull(), // cents
  commissionAmount: int("commission_amount").notNull(), // cents
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsAffiliateConversion = typeof lmsAffiliateConversions.$inferSelect;

export const lmsLandingPages = mysqlTable("lms_landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull().unique(),
  heroTitle: varchar("hero_title", { length: 255 }),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  bodyContent: longtext("body_content"), // rich text HTML
  ctaText: varchar("cta_text", { length: 128 }).default("Enroll Now"),
  whatYouLearn: longtext("what_you_learn"), // rich text
  requirements: longtext("requirements"), // rich text
  isCustom: boolean("is_custom").default(false).notNull(),
  blocks: longtext("blocks"), // JSON array of page builder blocks
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),
  // Per-funnel publish domain override (null = use global funnelPublishDomain)
  publishDomain: varchar("publish_domain", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLandingPage = typeof lmsLandingPages.$inferSelect;

export const lmsOrders = mysqlTable("lms_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  amount: int("amount").notNull(), // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  affiliateId: int("affiliate_id"),
  groupId: int("group_id"),
  seats: int("seats").default(1).notNull(), // for group purchases
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsOrder = typeof lmsOrders.$inferSelect;

// ─── LMS Page Templates ───────────────────────────────────────────────────────

export const lmsPageTemplates = mysqlTable("lms_page_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: mysqlEnum("template_type", ["page", "block"]).notNull().default("page"),
  blockType: varchar("block_type", { length: 64 }),
  blocks: longtext("blocks").notNull(), // JSON array of Block objects
  thumbnailUrl: text("thumbnail_url"),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type LmsPageTemplate = typeof lmsPageTemplates.$inferSelect;
export type NewLmsPageTemplate = typeof lmsPageTemplates.$inferInsert;

// ─── LMS Certificate Templates ───────────────────────────────────────────────

export const lmsCertificateTemplates = mysqlTable("lms_certificate_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Visual design
  backgroundImageUrl: text("background_image_url"),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#189aa1").notNull(),
  accentColor: varchar("accent_color", { length: 20 }).default("#c9a84c").notNull(),
  textColor: varchar("text_color", { length: 20 }).default("#0e1e2e").notNull(),
  fontFamily: varchar("font_family", { length: 100 }).default("Helvetica").notNull(),
  // Signature block
  signatureName: varchar("signature_name", { length: 200 }),
  signatureTitle: varchar("signature_title", { length: 200 }),
  signatureImageUrl: text("signature_image_url"),
  // Footer / legal text
  footerText: text("footer_text"),
  // Organization name shown on the certificate
  organizationName: varchar("organization_name", { length: 200 }).default("All About Ultrasound").notNull(),
  // Layout variant: classic | modern | minimal
  layout: mysqlEnum("layout", ["classic", "modern", "minimal"]).default("classic").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCertificateTemplate = typeof lmsCertificateTemplates.$inferSelect;
export type InsertLmsCertificateTemplate = typeof lmsCertificateTemplates.$inferInsert;

// ─── LMS Certificates ─────────────────────────────────────────────────────────

export const lmsCertificates = mysqlTable("lms_certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  certificateUrl: text("certificate_url").notNull(),
  templateId: int("template_id"), // FK to lms_certificate_templates.id (null = legacy/default)
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});
export type LmsCertificate = typeof lmsCertificates.$inferSelect;

// ─── LMS Lesson Notes ─────────────────────────────────────────────────────────

export const lmsLessonNotes = mysqlTable("lms_lesson_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  note: longtext("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLessonNote = typeof lmsLessonNotes.$inferSelect;

// ─── LMS Lesson Bookmarks ─────────────────────────────────────────────────────

export const lmsLessonBookmarks = mysqlTable("lms_lesson_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsLessonBookmark = typeof lmsLessonBookmarks.$inferSelect;

// ─── LMS Collections ─────────────────────────────────────────────────────────
export const lmsCollections = mysqlTable("lms_collections", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  label: varchar("label", { length: 100 }),
  color: varchar("color", { length: 20 }).default("#189aa1"),
  coverImageUrl: text("cover_image_url"),
  position: int("position").default(0).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  // URL slug — used to create shareable direct links to this collection in the Education Library
  // e.g. /education-library?collection=workshops
  // null = no shareable URL (collection only accessible via the filter tab)
  slug: varchar("slug", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCollection = typeof lmsCollections.$inferSelect;

export const lmsCollectionCourses = mysqlTable("lms_collection_courses", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collection_id").notNull(),
  courseId: int("course_id").notNull(),
  position: int("position").default(0).notNull(),
});
export type LmsCollectionCourse = typeof lmsCollectionCourses.$inferSelect;

/** Generic multi-type collection items — supports all content types */
export const lmsCollectionItems = mysqlTable("lms_collection_items", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collection_id").notNull(),
  /** Content type: course, quiz, webinar, download, bundle, membership, physical, workshop */
  itemType: mysqlEnum("item_type", ["course", "quiz", "webinar", "download", "bundle", "membership", "physical", "workshop"]).notNull(),
  itemId: int("item_id").notNull(),
  position: int("position").default(0).notNull(),
});
export type LmsCollectionItem = typeof lmsCollectionItems.$inferSelect;

// ─── Digital Downloads (File Repository) ────────────────────────────────────
export const digitalProducts = mysqlTable("digital_products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  thumbnailUrl: text("thumbnail_url"),
  price: int("price").default(0).notNull(), // cents
  isFree: boolean("is_free").default(false).notNull(),
  bundleOnly: boolean("bundle_only").default(false).notNull(), // if true, cannot be purchased standalone
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  // Landing page content
  landingHeadline: varchar("landing_headline", { length: 500 }),
  landingBody: longtext("landing_body"),
  landingFeatures: longtext("landing_features"), // JSON array of feature strings
  landingBlocks: longtext("landing_blocks"), // JSON array of page builder blocks
  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  // Link Preview / OG overrides
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),
  // After Purchase Workflow — JSON array of workflow action objects
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  // Member access page content blocks — shown above and below the file download list
  memberPageBlocksAbove: longtext("member_page_blocks_above"), // JSON array of page-builder blocks
  memberPageBlocksBelow: longtext("member_page_blocks_below"), // JSON array of page-builder blocks
  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  // Show in Education Library — admin toggle to include/exclude from the public library
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  // Stats
  downloadCount: int("download_count").default(0).notNull(),
  /** Default max downloads per file per order (NULL = unlimited) */
  maxDownloadsPerFile: int("max_downloads_per_file").default(3),
  /** Default days until purchase access expires (NULL = no expiry) */
  defaultAccessDays: int("default_access_days"),
  // Display order in the public Education Library (0 = unset/default, positive = explicit position)
  libraryOrder: int("library_order").default(0).notNull(),
  // Brand association — which brand this download belongs to
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  // Per-download publish domain override (null = use global downloadPublishDomain)
  publishDomain: varchar("publish_domain", { length: 255 }),
  // Stripe product/price IDs — auto-synced on save
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type DigitalProduct = typeof digitalProducts.$inferSelect;

export const digitalProductFiles = mysqlTable("digital_product_files", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  fileSize: int("file_size").default(0).notNull(), // bytes
  mimeType: varchar("mime_type", { length: 100 }),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DigitalProductFile = typeof digitalProductFiles.$inferSelect;

export const digitalPurchases = mysqlTable("digital_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  amount: int("amount"),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  status: mysqlEnum("status", ["open", "expired", "revoked", "refunded"]).default("open").notNull(),
  /** Max downloads per file for this order (NULL = unlimited) */
  maxDownloadsPerFile: int("max_downloads_per_file").default(3),
  accessExpiresAt: timestamp("access_expires_at"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});
export type DigitalPurchase = typeof digitalPurchases.$inferSelect;

// ─── Digital Download Events (Analytics) ────────────────────────────────────
export const digitalDownloadEvents = mysqlTable("digital_download_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  fileId: int("file_id").notNull(),
  purchaseId: int("purchase_id"),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 500 }),
});
export type DigitalDownloadEvent = typeof digitalDownloadEvents.$inferSelect;

/** Order activity log — payment, email, per-file downloads with IP */
export const digitalPurchaseActivity = mysqlTable("digital_purchase_activity", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchase_id").notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  message: text("message").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  fileId: int("file_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DigitalPurchaseActivity = typeof digitalPurchaseActivity.$inferSelect;

// ─── Digital Bundles ────────────────────────────────────────────────────────
export const digitalBundles = mysqlTable("digital_bundles", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  thumbnailUrl: text("thumbnail_url"),
  originalPrice: int("original_price").default(0).notNull(), // cents
  discountPrice: int("discount_price").default(0).notNull(), // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  libraryOrder: int("library_order").default(0).notNull(),
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  // After Purchase Workflow — JSON array of workflow action objects
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type DigitalBundle = typeof digitalBundles.$inferSelect;

export const digitalBundleItems = mysqlTable("digital_bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundle_id").notNull(),
  productId: int("product_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type DigitalBundleItem = typeof digitalBundleItems.$inferSelect;

export const digitalBundlePurchases = mysqlTable("digital_bundle_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  bundleId: int("bundle_id").notNull(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  purchaseType: mysqlEnum("purchase_type", ["one_time", "subscription"]).default("one_time").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 50 }),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  accessExpiresAt: timestamp("access_expires_at"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});
export type DigitalBundlePurchase = typeof digitalBundlePurchases.$inferSelect;

// ─── Order Bumps ────────────────────────────────────────────────────────────
export const orderBumps = mysqlTable("order_bumps", {
  id: int("id").autoincrement().primaryKey(),
  // Standalone mode — not tied to a specific trigger purchase (direct-link only)
  isStandalone: boolean("is_standalone").default(false).notNull(),
  // Presentation mode — widget (inline at checkout) or landing_page (full page at /order-bump/{slug})
  presentationMode: mysqlEnum("presentation_mode", ["widget", "landing_page"]).default("widget").notNull(),
  slug: varchar("slug", { length: 255 }), // URL slug for landing page mode
  // Full block-builder JSON for landing page mode
  pageBlocks: longtext("page_blocks"), // JSON array of blocks
  // Conditional branching — show only if user has/has not purchased specific products
  conditionType: mysqlEnum("condition_type", ["none", "has_purchased", "has_not_purchased"]).default("none").notNull(),
  conditionProductType: mysqlEnum("condition_product_type", ["course", "quiz", "download", "bundle", "physical"]),
  conditionProductId: int("condition_product_id"),
  // The trigger product — when a user buys this, the bump is offered (nullable for standalone)
  triggerType: mysqlEnum("trigger_type", ["course", "quiz", "download", "bundle", "physical", "cohort", "webinar", "membership", "workshop"]).notNull().default("course"),
  triggerProductId: int("trigger_product_id").default(0).notNull(),
  // Conditional: if set, only show this bump when the user is purchasing this specific pricing option
  // null = show for ALL pricing options of the trigger product
  triggerPricingOptionId: int("trigger_pricing_option_id"),
  // The bump offer — what product is being offered as the bump
  bumpType: mysqlEnum("bump_type", ["course", "quiz", "download", "bundle", "physical", "cohort", "webinar", "membership", "workshop"]).notNull().default("download"),
  bumpProductId: int("bump_product_id").default(0).notNull(),
  // Bump mode: addon = add bump to existing order; upgrade = replace trigger product with bump (no charge for original)
  bumpMode: mysqlEnum("bump_mode", ["addon", "upgrade"]).default("addon").notNull(),
  // When to show the bump
  timing: mysqlEnum("timing", ["before_checkout", "after_checkout", "direct_link"]).default("after_checkout").notNull(),
  // Pricing
  bumpPrice: int("bump_price").default(0).notNull(), // cents — special bump price (0 = use product's normal price)
  discountLabel: varchar("discount_label", { length: 255 }), // e.g. "50% OFF — Today Only!"
  // Landing page content (mini page builder)
  headline: varchar("headline", { length: 500 }),
  subheadline: varchar("subheadline", { length: 500 }),
  bodyHtml: longtext("body_html"), // rich text description of the bump offer
  imageUrl: text("image_url"),
  ctaText: varchar("cta_text", { length: 100 }).default("Add to Order").notNull(),
  ctaColor: varchar("cta_color", { length: 20 }).default("#179ca3").notNull(),
  skipText: varchar("skip_text", { length: 100 }).default("No thanks, continue").notNull(),
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  // Stats
  impressions: int("impressions").default(0).notNull(),
  conversions: int("conversions").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OrderBump = typeof orderBumps.$inferSelect;
export type InsertOrderBump = typeof orderBumps.$inferInsert;

// ─── Order Bump Conversions (tracking) ──────────────────────────────────────
export const orderBumpConversions = mysqlTable("order_bump_conversions", {
  id: int("id").autoincrement().primaryKey(),
  bumpId: int("bump_id").notNull(),
  userId: int("user_id").notNull(),
  // The original purchase that triggered the bump
  triggerOrderType: mysqlEnum("trigger_order_type", ["course", "download", "bundle"]).notNull(),
  triggerOrderId: int("trigger_order_id"), // lms_orders.id or digital_purchases.id
  // The bump purchase
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  bumpAmount: int("bump_amount").default(0).notNull(), // cents actually charged
  status: mysqlEnum("status", ["pending", "completed", "declined"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrderBumpConversion = typeof orderBumpConversions.$inferSelect;


// ─── Standalone Funnels (ClickFunnels-style) ─────────────────────────────────

export const funnels = mysqlTable("funnels", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "active", "archived", "paused"]).default("draft").notNull(),
  // SEO / Settings
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  thankYouUrl: text("thank_you_url"),
  // Template used to create this funnel
  templateName: varchar("template_name", { length: 100 }),
  // Global settings
  accentColor: varchar("accent_color", { length: 20 }).default("#179ca3"),
  bgColor: varchar("bg_color", { length: 20 }).default("#ffffff"),
  logoUrl: text("logo_url"),
  // Analytics
  totalViews: int("total_views").default(0).notNull(),
  totalConversions: int("total_conversions").default(0).notNull(),
  totalRevenue: int("total_revenue").default(0).notNull(), // cents
  sortOrder: int("sort_order").default(0).notNull(),
  // Domain/subdomain this funnel is published on (null = use default app domain)
  customDomain: varchar("custom_domain", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

export const funnelPages = mysqlTable("funnel_pages", {
  id: int("id").autoincrement().primaryKey(),
  funnelId: int("funnel_id").notNull(),
  // Page type determines behavior
  pageType: mysqlEnum("page_type", ["landing", "checkout", "upsell", "downsell", "thank_you", "custom"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(), // e.g. "main", "checkout", "thank-you"
  // Page builder blocks (same format as LandingPageBuilder)
  blocks: longtext("blocks"), // JSON array of Block[]
  // Page connections (ClickFunnels-style linking)
  nextPageId: int("next_page_id"), // the next page in the funnel flow
  // Product attachment (optional — for checkout/upsell pages)
  productType: mysqlEnum("product_type", ["course", "download", "bundle", "physical", "custom"]),
  productId: int("product_id"),
  customPrice: int("custom_price"), // cents — override product price
  customPriceLabel: varchar("custom_price_label", { length: 100 }),
  // Order bump attachment (optional — for checkout pages)
  orderBumpId: int("order_bump_id"),
  // Sort order within funnel
  sortOrder: int("sort_order").default(0).notNull(),
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(), // hide from funnel sequence but keep accessible via direct URL
  isStandaloneLanding: boolean("is_standalone_landing").default(false).notNull(), // serve as standalone landing page at /p/{slug}
  showNavigationButton: boolean("show_navigation_button").default(false).notNull(), // show auto-connect "Continue to..." button at bottom of page
  // SEO / Link Preview overrides
  seoTitle: varchar("seo_title", { length: 255 }), // overrides <title> and og:title
  seoDescription: text("seo_description"),          // overrides meta description and og:description
  seoImage: varchar("seo_image", { length: 512 }),   // overrides og:image URL
  // Analytics
  views: int("views").default(0).notNull(),
  conversions: int("conversions").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FunnelPage = typeof funnelPages.$inferSelect;
export type InsertFunnelPage = typeof funnelPages.$inferInsert;

// ─── Funnel Leads (Lead Capture) ──────────────────────────────────────────────
export const funnelLeads = mysqlTable("funnel_leads", {
  id: int("id").autoincrement().primaryKey(),
  funnelId: int("funnel_id").notNull(),
  funnelPageId: int("funnel_page_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  customFields: longtext("custom_fields"), // JSON for any extra form fields
  userId: int("user_id"), // if the lead is a logged-in user
  source: varchar("source", { length: 100 }), // e.g. "funnel", "landing_page"
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: varchar("referrer", { length: 2048 }),
  timezone: varchar("timezone", { length: 100 }),
  sourcePage: varchar("source_page", { length: 2048 }),
  tags: varchar("tags", { length: 500 }),
  campaignId: int("campaign_id"), // linked email campaign (optional)
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FunnelLead = typeof funnelLeads.$inferSelect;
export type InsertFunnelLead = typeof funnelLeads.$inferInsert;

// ─── Funnel Templates (user-saved) ────────────────────────────────────────────
export const funnelTemplates = mysqlTable("funnel_templates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pagesJson: longtext("pages_json").notNull(), // JSON array of page definitions with blocks
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),
  bgColor: varchar("bg_color", { length: 20 }).default("#f8fafc"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type FunnelTemplate = typeof funnelTemplates.$inferSelect;


// ─── Account Sharing Monitoring ───────────────────────────────────────────────

export const ipAccessLogs = mysqlTable("ip_access_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // IPv6 max length
  userAgent: text("user_agent"),
  contentType: mysqlEnum("content_type", ["course", "download", "paid_content"]).notNull(),
  contentId: int("content_id"), // course_id, product_id, etc.
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});
export type IpAccessLog = typeof ipAccessLogs.$inferSelect;

export const sharingAbuseFlags = mysqlTable("sharing_abuse_flags", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["flagged", "confirmed", "dismissed", "warned"]).default("flagged").notNull(),
  distinctIpCount: int("distinct_ip_count").default(0).notNull(),
  ipAddresses: longtext("ip_addresses"), // JSON array of IPs with timestamps
  detectionReason: text("detection_reason"),
  alertSentAt: timestamp("alert_sent_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: int("reviewed_by"), // admin user ID
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SharingAbuseFlag = typeof sharingAbuseFlags.$inferSelect;

// ─── User Analytics Events ──────────────────────────────────────────────────

/** One row per login session */
export const userLoginEvents = mysqlTable("user_login_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  country: varchar("country", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserLoginEvent = typeof userLoginEvents.$inferSelect;
export type InsertUserLoginEvent = typeof userLoginEvents.$inferInsert;

/** One row per page navigation (route change) */
export const userPageViewEvents = mysqlTable("user_page_view_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),           // null = anonymous
  sessionId: varchar("session_id", { length: 64 }),
  path: varchar("path", { length: 512 }).notNull(),
  referrer: varchar("referrer", { length: 512 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  durationMs: int("duration_ms"),   // time on page before next navigation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserPageViewEvent = typeof userPageViewEvents.$inferSelect;
export type InsertUserPageViewEvent = typeof userPageViewEvents.$inferInsert;

/** Unified activity log — captures ALL user actions with IP, user agent, and metadata */
export const userActivityLogs = mysqlTable("user_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(), // 'login'|'page_view'|'video_play'|'video_complete'|'quiz_attempt'|'quiz_pass'|'quiz_fail'|'course_enroll'|'course_complete'|'lesson_complete'|'purchase'|'download'|'iframe_view'|'module_complete'
  description: varchar("description", { length: 512 }).notNull(),
  path: varchar("path", { length: 512 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  metadata: json("metadata"),  // flexible JSON for event-specific data
  courseId: int("course_id"),  // for course/lesson-related events
  lessonId: int("lesson_id"),  // for lesson-related events
  contentTitle: varchar("content_title", { length: 512 }), // human-readable title for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogs.$inferInsert;

/** One row per LMS lesson video play / progress milestone */
export const lmsVideoEvents = mysqlTable("lms_video_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(), // 'play'|'pause'|'complete'|'seek'|'progress'
  positionSec: int("position_sec").default(0).notNull(),      // playback position
  durationSec: int("duration_sec").default(0).notNull(),      // total video length
  percentWatched: int("percent_watched").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsVideoEvent = typeof lmsVideoEvents.$inferSelect;
export type InsertLmsVideoEvent = typeof lmsVideoEvents.$inferInsert;

/** One row per quiz attempt (full attempt record with answers) */
export const lmsQuizAttempts = mysqlTable("lms_quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  score: int("score").notNull(),          // percentage 0-100
  passed: boolean("passed").notNull(),
  totalQuestions: int("total_questions").notNull(),
  correctAnswers: int("correct_answers").notNull(),
  timeTakenSec: int("time_taken_sec"),
  answersJson: longtext("answers_json"),  // JSON array of {questionId, selectedAnswer, correct}
  selectedQuestionIds: text("selected_question_ids"), // JSON array of question bank IDs used in this attempt
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuizAttempt = typeof lmsQuizAttempts.$inferSelect;
export type InsertLmsQuizAttempt = typeof lmsQuizAttempts.$inferInsert;

// ─── Brand Memberships (Multi-Tenant Premium) ────────────────────────────────
// Tracks per-brand premium subscriptions. A user can have separate premium status
// for AAUS (UltrasoundAssist) and iHeartEcho (EchoAssist).
export const brandMemberships = mysqlTable("brandMemberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brand: varchar("brand", { length: 32 }).notNull(), // "aaus" | "iheartecho"
  tier: varchar("tier", { length: 32 }).notNull().default("free"), // "free" | "premium"
  status: varchar("status", { length: 32 }).notNull().default("active"), // "active" | "cancelled" | "expired"
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  source: varchar("source", { length: 64 }), // "stripe" | "admin" | "thinkific" | "promo"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandMembership = typeof brandMemberships.$inferSelect;
export type InsertBrandMembership = typeof brandMemberships.$inferInsert;

// ─── Leaderboard & Points ─────────────────────────────────────────────────────
export const userPointsLog = mysqlTable("userPointsLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  points: int("points").notNull(),
  activityType: mysqlEnum("activityType", [
    "daily_challenge_correct",
    "daily_challenge_streak",
    "case_submission",
    "case_approved",
    "flashcard_session",
    "flashcard_card_viewed",
    "admin_adjustment",
  ]).notNull(),
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 64 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserPointsLog = typeof userPointsLog.$inferSelect;
export type InsertUserPointsLog = typeof userPointsLog.$inferInsert;

export const userPointsTotals = mysqlTable("userPointsTotals", {
  userId: int("userId").primaryKey(),
  totalPoints: int("totalPoints").default(0).notNull(),
  challengePoints: int("challengePoints").default(0).notNull(),
  casePoints: int("casePoints").default(0).notNull(),
  flashcardPoints: int("flashcardPoints").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserPointsTotals = typeof userPointsTotals.$inferSelect;

// ─── Accreditation Navigator Checklist ────────────────────────────────────────
export const accreditationChecklist = mysqlTable("accreditationChecklist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accreditationType: varchar("accreditationType", { length: 32 }).notNull(),
  sectionKey: varchar("sectionKey", { length: 128 }).notNull(),
  checked: boolean("checked").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AccreditationChecklist = typeof accreditationChecklist.$inferSelect;
export type InsertAccreditationChecklist = typeof accreditationChecklist.$inferInsert;

// ─── SoundBytes Micro-Lessons ─────────────────────────────────────────────────
export const soundBytes = mysqlTable("soundbytes", {
  id: int("id").autoincrement().primaryKey(),
  // Brand this SoundByte belongs to
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("iheartecho").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  category: mysqlEnum("category", [
    "abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "thyroid",
    "scrotum", "breast", "venous", "arterial", "abdominal_vascular",
    "extracranial_carotid", "intracranial_tcd", "msk", "pocus", "physics",
    "fetal_echo", "acs", "adult_echo", "pediatric_echo", "ecg", "general",
  ]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  durationSeconds: int("durationSeconds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SoundByte = typeof soundBytes.$inferSelect;
export type InsertSoundByte = typeof soundBytes.$inferInsert;

export const soundByteViews = mysqlTable("soundByteViews", {
  id: int("id").autoincrement().primaryKey(),
  soundByteId: int("soundByteId").notNull(),
  userId: int("userId"),
  watchedSeconds: int("watchedSeconds").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SoundByteView = typeof soundByteViews.$inferSelect;
export type InsertSoundByteView = typeof soundByteViews.$inferInsert;

export const soundByteDiscussions = mysqlTable("soundByteDiscussions", {
  id: int("id").autoincrement().primaryKey(),
  soundByteId: int("soundByteId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
export type SoundByteDiscussion = typeof soundByteDiscussions.$inferSelect;
export type InsertSoundByteDiscussion = typeof soundByteDiscussions.$inferInsert;

export const soundByteDiscussionReplies = mysqlTable("soundByteDiscussionReplies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  discussionId: int("discussionId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type SoundByteDiscussionReply = typeof soundByteDiscussionReplies.$inferSelect;
export type InsertSoundByteDiscussionReply = typeof soundByteDiscussionReplies.$inferInsert;

// ─── A/B Test Events ──────────────────────────────────────────────────────────
export const abTestEvents = mysqlTable("abTestEvents", {
  id: int("id").autoincrement().primaryKey(),
  testId: varchar("testId", { length: 64 }).notNull(),
  variant: varchar("variant", { length: 16 }).notNull(),
  event: mysqlEnum("event", ["impression", "click"]).notNull(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  meta: text("meta"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type AbTestEvent = typeof abTestEvents.$inferSelect;
export type InsertAbTestEvent = typeof abTestEvents.$inferInsert;

// ─── Menu Link Config ─────────────────────────────────────────────────────────
export const menuLinkConfig = mysqlTable("menuLinkConfig", {
  key: varchar("key", { length: 64 }).primaryKey(),
  url: text("url").notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MenuLinkConfig = typeof menuLinkConfig.$inferSelect;
export type InsertMenuLinkConfig = typeof menuLinkConfig.$inferInsert;

// ─── Site Pages (multi-domain CMS) ───────────────────────────────────────────
export const sitePages = mysqlTable(
  "site_pages",
  {
    id: int("id").autoincrement().primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    pageKind: mysqlEnum("page_kind", [
      "standard",
      "home",
      "legal_privacy",
      "legal_terms",
      "error_404",
      "login",
      "sales",
      "system",
    ])
      .notNull()
      .default("standard"),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    blocks: longtext("blocks"),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    seoImage: varchar("seo_image", { length: 512 }),
    parentPageId: int("parent_page_id"),
    navSortOrder: int("nav_sort_order").default(0).notNull(),
    showInHeaderNav: boolean("show_in_header_nav").default(false).notNull(),
    showInSidebarNav: boolean("show_in_sidebar_nav").default(false).notNull(),
    showInProfileNav: boolean("show_in_profile_nav").default(false).notNull(),
    isHiddenFromNav: boolean("is_hidden_from_nav").default(true).notNull(),
    isHomePage: boolean("is_home_page").default(false).notNull(),
    externalUrl: varchar("external_url", { length: 512 }),
    createdByUserId: int("created_by_user_id"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    domainSlugUnique: uniqueIndex("site_pages_domain_slug").on(t.domain, t.slug),
  }),
);
export type SitePage = typeof sitePages.$inferSelect;
export type InsertSitePage = typeof sitePages.$inferInsert;

export const siteNavMenus = mysqlTable(
  "site_nav_menus",
  {
    id: int("id").autoincrement().primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    menuKey: mysqlEnum("menu_key", ["header", "sidebar", "profile", "footer"]).notNull(),
    itemsJson: longtext("items_json").notNull().default("[]"),
    updatedByUserId: int("updated_by_user_id"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    domainMenuUnique: uniqueIndex("site_nav_menus_domain_key").on(t.domain, t.menuKey),
  }),
);
export type SiteNavMenu = typeof siteNavMenus.$inferSelect;
export type InsertSiteNavMenu = typeof siteNavMenus.$inferInsert;

// ─── Navigator Protocol Overrides ─────────────────────────────────────────────
export const navigatorProtocolOverrides = mysqlTable("navigatorProtocolOverrides", {
  id: int("id").autoincrement().primaryKey(),
  module: varchar("module", { length: 64 }).notNull(),
  sectionId: varchar("sectionId", { length: 128 }).notNull(),
  sectionTitle: varchar("sectionTitle", { length: 256 }).notNull(),
  probeNote: text("probeNote"),
  items: text("items").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type NavigatorProtocolOverride = typeof navigatorProtocolOverrides.$inferSelect;
export type InsertNavigatorProtocolOverride = typeof navigatorProtocolOverrides.$inferInsert;

// ─── Media Access Rules (iHeartEcho) ──────────────────────────────────────────
export const mediaAccessRules = mysqlTable("mediaAccessRules", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  accessToken: varchar("accessToken", { length: 128 }).notNull(),
  grantedByUserId: int("grantedByUserId").notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MediaAccessRule = typeof mediaAccessRules.$inferSelect;
export type InsertMediaAccessRule = typeof mediaAccessRules.$inferInsert;

export const mediaAccessLogs = mysqlTable("mediaAccessLogs", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  versionId: int("versionId"),
  accessType: mysqlEnum("accessType", ["serve", "embed"]).notNull(),
  accessRuleId: int("accessRuleId"),
  userId: int("userId"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  referer: text("referer"),
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});
export type MediaAccessLog = typeof mediaAccessLogs.$inferSelect;
export type InsertMediaAccessLog = typeof mediaAccessLogs.$inferInsert;

// ─── Upload Jobs (async chunked upload assembly) ──────────────────────────────
export const uploadJobs = mysqlTable("uploadJobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: mysqlEnum("status", ["pending", "processing", "done", "error"]).default("pending").notNull(),
  resultUrl: text("resultUrl"),
  resultFileKey: text("resultFileKey"),
  resultFileName: text("resultFileName"),
  resultMimeType: text("resultMimeType"),
  resultSizeBytes: bigint("resultSizeBytes", { mode: "number" }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UploadJob = typeof uploadJobs.$inferSelect;
export type InsertUploadJob = typeof uploadJobs.$inferInsert;

// ─── Educator Templates ───────────────────────────────────────────────────────
export const educatorTemplates = mysqlTable("educatorTemplates", {
  id: int("id").autoincrement().primaryKey(),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  ardmsCategory: mysqlEnum("ardmsCategory", ["Adult Echo", "Pediatric Echo", "Fetal Echo", "General Ultrasound", "Vascular Ultrasound", "General"]).notNull().default("Adult Echo"),
  contentType: mysqlEnum("contentType", ["presentation", "quiz", "flashcard_deck", "case_study", "protocol_guide", "study_guide"]).notNull().default("presentation"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  mimeType: varchar("mimeType", { length: 100 }),
  slidesData: longtext("slidesData"),
  contentData: longtext("contentData"),
  coverImageUrl: text("coverImageUrl"),
  tags: text("tags"),
  estimatedMinutes: int("estimatedMinutes"),
  viewCount: int("viewCount").default(0).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  isViewOnly: boolean("isViewOnly").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EducatorTemplate = typeof educatorTemplates.$inferSelect;
export type InsertEducatorTemplate = typeof educatorTemplates.$inferInsert;

// ─── Funnel Branch Rules ──────────────────────────────────────────────────────
// Each rule belongs to a funnel page and defines: IF (conditions match) THEN go to (targetPageId or targetUrl)
// Rules are evaluated in priority order; the first matching rule wins.
// If no rule matches, the page's default nextPageId is used.
export const funnelBranchRules = mysqlTable("funnel_branch_rules", {
  id: int("id").autoincrement().primaryKey(),
  funnelPageId: int("funnel_page_id").notNull(),      // the page this rule belongs to
  name: varchar("name", { length: 255 }).notNull().default("Untitled Rule"),
  priority: int("priority").default(0).notNull(),      // lower = evaluated first
  // How to combine conditions: "all" = AND, "any" = OR
  matchMode: mysqlEnum("match_mode", ["all", "any"]).default("all").notNull(),
  // Where to send the visitor when this rule matches
  targetPageId: int("target_page_id"),                 // go to another funnel page
  targetUrl: varchar("target_url", { length: 2048 }), // or go to an external URL
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FunnelBranchRule = typeof funnelBranchRules.$inferSelect;
export type InsertFunnelBranchRule = typeof funnelBranchRules.$inferInsert;

// Each condition belongs to a rule and tests one variable against a value
export const funnelBranchConditions = mysqlTable("funnel_branch_conditions", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  // Variable being tested
  variable: mysqlEnum("variable", [
    "product_purchased",
    "order_bump_selected",
    "email_contains",
    "email_domain",
    "purchase_price",
    "source_url",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "date_range",
    "day_of_week",
    "hour_of_day",
    "country",
    "device_type",
    "custom_field",
  ]).notNull(),
  // Operator
  operator: mysqlEnum("operator", [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "greater_than",
    "less_than",
    "between",
    "in_list",
    "not_in_list",
    "is_set",
    "is_not_set",
  ]).notNull(),
  // Value to compare against (serialized as string; complex values use "|" as separator)
  value: varchar("value", { length: 1024 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FunnelBranchCondition = typeof funnelBranchConditions.$inferSelect;
export type InsertFunnelBranchCondition = typeof funnelBranchConditions.$inferInsert;

// ─── Platform Settings ────────────────────────────────────────────────────────
// Singleton table (always exactly one row, id=1).
// Stores platform-wide configuration toggles and defaults.

export const platformSettings = mysqlTable("platform_settings", {
  id: int("id").primaryKey().default(1),
  // ── Email / Notification toggles ──
  // Master switch: if false, no enrollment emails are sent regardless of per-course setting
  enrollmentEmailEnabled: boolean("enrollment_email_enabled").default(true).notNull(),
  // Custom subject line override (null = use the default template subject)
  enrollmentEmailSubject: varchar("enrollment_email_subject", { length: 255 }),
  // Optional custom intro paragraph prepended to the enrollment email body (plain text / HTML)
  enrollmentEmailIntro: text("enrollment_email_intro"),
    // ── Custom domains list (JSON array of domain strings) ──
  // e.g. ["app.allaboutultrasound.com", "iheartecho.com", "courses.mysite.com"]
  // Used by funnel domain selector to populate available domains dynamically
  customDomains: text("custom_domains"),
  // ── Publish domains per content type ──
  // Which custom domain funnels/downloads/products are published on (null = use app subdomain)
  funnelPublishDomain: varchar("funnel_publish_domain", { length: 255 }),
  downloadPublishDomain: varchar("download_publish_domain", { length: 255 }),
  productPublishDomain: varchar("product_publish_domain", { length: 255 }),
  coursePublishDomain: varchar("course_publish_domain", { length: 255 }),
  formPublishDomain: varchar("form_publish_domain", { length: 255 }),
  // ── Legal / Checkout URLs ──
  termsUrl: varchar("terms_url", { length: 500 }),
  privacyUrl: varchar("privacy_url", { length: 500 }),
  /** JSON snapshot for SCORM health email dedup: { unhealthyAssetIds, lastAlertAt } */
  scormHealthSnapshot: text("scorm_health_snapshot"),
  /** Optional override for SCORM health alert emails (else owner / SCORM_HEALTH_ALERT_EMAIL env) */
  scormHealthAlertEmail: varchar("scorm_health_alert_email", { length: 320 }),
  // ── Default brand for ambiguous domains ──
  // When a request hostname doesn't match any known brand domain, use this brand as fallback.
  // Valid values: 'aaus' | 'iheartecho' (defaults to 'aaus' if not set)
  defaultBrand: varchar("default_brand", { length: 32 }).default("aaus"),
  // ── Future platform-wide toggles go here ──
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PlatformSettings = typeof platformSettings.$inferSelect;

// ─── LMS Pricing Options ──────────────────────────────────────────────────────
// Secondary pricing options for courses/products (payment plans, group rates, etc.)
// Each course has one primary price (on lmsCourses) plus N secondary options here.
// The CTA on the landing page defaults to the primary price but allows selection.

export const lmsPricingOptions = mysqlTable("lms_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  // Display label shown to students (e.g. "3-Month Payment Plan", "Group Rate")
  label: varchar("label", { length: 255 }).notNull(),
  // Optional sub-label / description shown below the label (e.g. "3 × $99/month")
  sublabel: varchar("sublabel", { length: 500 }),
  // Pricing type for this option
  pricingType: mysqlEnum("pricing_type", ["one_time", "subscription", "payment_plan", "free"]).default("one_time").notNull(),
  // Price in cents (total for payment_plan, per-period for subscription, full for one_time)
  price: int("price").default(0).notNull(),
  // Stripe Price ID — if set, used directly; otherwise a price is created on-the-fly
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  // Subscription interval (only for pricingType=subscription)
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  // Payment plan fields (only for pricingType=payment_plan)
  downPayment: int("down_payment").default(0), // cents — charged immediately
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0), // cents per installment
  installmentIntervalDays: int("installment_interval_days").default(30),
  // Custom CTA button text override (null = use default "Enroll Now" / "Buy Now")
  ctaLabel: varchar("cta_label", { length: 100 }),
  // Optional external URL — if set, the CTA button links here instead of triggering Stripe checkout
  ctaUrl: varchar("cta_url", { length: 2048 }),
  // Sort order in the pricing options list (lower = shown first)
  sortOrder: int("sort_order").default(0).notNull(),
  // Whether this option is currently shown on the landing page
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type LmsPricingOption = typeof lmsPricingOptions.$inferSelect;

// ─── Physical Products ────────────────────────────────────────────────────────
// A "product" is a physical (or external) item that can be sold on the platform.
// It mirrors the digitalProducts structure but has no downloadable file requirement.
// Supports native Stripe checkout (with shipping address) and Shopify embeds/URLs.

export const physicalProducts = mysqlTable("physical_products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  brand: mysqlEnum("brand", ["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),       // Rich text product description
  details: longtext("details"),               // Rich text product details / specs
  thumbnailUrl: text("thumbnail_url"),
  // Pricing
  price: int("price").default(0).notNull(),   // cents — primary / default price
  compareAtPrice: int("compare_at_price"),    // cents — original/crossed-out price
  isFree: boolean("is_free").default(false).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Checkout mode
  checkoutMode: mysqlEnum("checkout_mode", ["native", "shopify", "external"]).default("native").notNull(),
  // Shopify integration
  shopifyProductUrl: text("shopify_product_url"),   // Paste a Shopify product URL
  shopifyEmbedCode: longtext("shopify_embed_code"), // Paste a Shopify Buy Button embed
  shopifyProductId: varchar("shopify_product_id", { length: 255 }),
  // External checkout URL (for non-Shopify external links)
  externalCheckoutUrl: text("external_checkout_url"),
  // Shipping
  requiresShipping: boolean("requires_shipping").default(true).notNull(),
  shippingCountries: text("shipping_countries"),   // JSON array of ISO country codes; null = worldwide
  // Status / visibility
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  // Landing page content (page builder — same structure as digitalProducts)
  landingHeadline: varchar("landing_headline", { length: 500 }),
  landingBody: longtext("landing_body"),
  landingFeatures: longtext("landing_features"),   // JSON array of feature strings
  landingBlocks: longtext("landing_blocks"),        // JSON array of page builder blocks
  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  // Link Preview / OG overrides
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),
  // After Purchase Workflow — JSON array of workflow action objects
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  // BookVault print-on-demand integration
  bookvaultEnabled: boolean("bookvault_enabled").default(false).notNull(),
  bookvaultIsbn: varchar("bookvault_isbn", { length: 32 }),
  // Printful print-on-demand integration
  printfulEnabled: boolean("printful_enabled").default(false).notNull(),
  printfulStoreId: int("printful_store_id"),
  printfulSyncProductId: int("printful_sync_product_id"),
  printfulSyncVariantId: int("printful_sync_variant_id"),
  // Checkout page builder config (JSON)
  checkoutPageConfig: longtext("checkout_page_config"),
  // Stats
  orderCount: int("order_count").default(0).notNull(),
  // Per-product publish domain override (null = use global productPublishDomain)
  publishDomain: varchar("publish_domain", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PhysicalProduct = typeof physicalProducts.$inferSelect;
export type InsertPhysicalProduct = typeof physicalProducts.$inferInsert;

// Multiple pricing options per product (mirrors lmsPricingOptions)
export const physicalProductPricingOptions = mysqlTable("physical_product_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sublabel: varchar("sublabel", { length: 500 }),
  pricingType: mysqlEnum("pricing_type", ["one_time", "free"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(), // cents
  compareAtPrice: int("compare_at_price"),  // cents
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  ctaLabel: varchar("cta_label", { length: 100 }),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PhysicalProductPricingOption = typeof physicalProductPricingOptions.$inferSelect;

// Orders for physical products (native Stripe checkout)
export const physicalProductOrders = mysqlTable("physical_product_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  pricingOptionId: int("pricing_option_id"),
  amountPaid: int("amount_paid").default(0).notNull(), // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  // Shipping address (required for native physical checkout)
  shippingName: varchar("shipping_name", { length: 255 }),
  shippingLine1: varchar("shipping_line1", { length: 255 }),
  shippingLine2: varchar("shipping_line2", { length: 255 }),
  shippingCity: varchar("shipping_city", { length: 100 }),
  shippingState: varchar("shipping_state", { length: 100 }),
  shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
  shippingCountry: varchar("shipping_country", { length: 10 }),
  // Fulfillment
  fulfillmentStatus: mysqlEnum("fulfillment_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending").notNull(),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  trackingCarrier: varchar("tracking_carrier", { length: 100 }),
  // BookVault print-on-demand fulfillment
  bookvaultDocRef: varchar("bookvault_doc_ref", { length: 64 }),
  bookvaultPodRef: varchar("bookvault_pod_ref", { length: 64 }),
  bookvaultStatus: varchar("bookvault_status", { length: 64 }),
  bookvaultError: text("bookvault_error"),
  bookvaultSubmittedAt: timestamp("bookvault_submitted_at"),
  printfulOrderId: varchar("printful_order_id", { length: 64 }),
  printfulStatus: varchar("printful_status", { length: 64 }),
  printfulError: text("printful_error"),
  printfulSubmittedAt: timestamp("printful_submitted_at"),
  notes: text("notes"),
  orderedAt: timestamp("ordered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PhysicalProductOrder = typeof physicalProductOrders.$inferSelect;
export type InsertPhysicalProductOrder = typeof physicalProductOrders.$inferInsert;

// ─── Funnel / Embedded Checkout Block Purchases ───────────────────────────────
// Records every completed payment from any embedded_checkout or checkout_form block
// across all page builders (funnels, landing pages, product pages, LMS lessons).
export const funnelPurchases = mysqlTable("funnel_purchases", {
  id: int("id").autoincrement().primaryKey(),
  // Who paid
  userId: int("user_id"), // null if guest checkout
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  // What was purchased
  productName: varchar("product_name", { length: 500 }).notNull(),
  productType: mysqlEnum("product_type", ["course", "download", "physical", "membership", "bundle", "other"]).default("other").notNull(),
  // Order bumps (JSON array of {title, price})
  orderBumps: longtext("order_bumps"),
  // Amounts
  amountPaid: int("amount_paid").notNull(), // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Stripe refs
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  // Source context
  sourceType: mysqlEnum("source_type", ["funnel", "landing_page", "product_page", "lms_lesson", "other"]).default("other").notNull(),
  sourceFunnelId: int("source_funnel_id"),
  sourceFunnelPageId: int("source_funnel_page_id"),
  sourceLandingPageId: int("source_landing_page_id"),
  sourceLmsLessonId: int("source_lms_lesson_id"),
  // Shipping address (only for physical products)
  shippingName: varchar("shipping_name", { length: 255 }),
  shippingLine1: varchar("shipping_line1", { length: 255 }),
  shippingLine2: varchar("shipping_line2", { length: 255 }),
  shippingCity: varchar("shipping_city", { length: 100 }),
  shippingState: varchar("shipping_state", { length: 100 }),
  shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
  shippingCountry: varchar("shipping_country", { length: 10 }),
  // Status
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FunnelPurchase = typeof funnelPurchases.$inferSelect;
export type InsertFunnelPurchase = typeof funnelPurchases.$inferInsert;

// ─── General Form Builder ─────────────────────────────────────────────────────
// A general-purpose form builder (separate from the DIY Accreditation form builder).
// Supports: public URL with editable slug, embed code, branding/theme, optional score,
// import by URL, analytics, conditional branching, and Stripe payments.

export const generalFormTemplates = mysqlTable("generalFormTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  formType: varchar("formType", { length: 100 }).notNull().default("general"),
  status: mysqlEnum("status", ["open", "closed", "draft"]).default("draft").notNull(),
  publicSlug: varchar("publicSlug", { length: 200 }).unique(),
  isPublic: boolean("isPublic").default(false).notNull(),
  scoreEnabled: boolean("scoreEnabled").default(false).notNull(),
  scoreLabel: varchar("scoreLabel", { length: 100 }).default("Score"),
  themeSettings: longtext("themeSettings"),
  successMessage: text("successMessage"),
  successRedirectUrl: varchar("successRedirectUrl", { length: 500 }),
  defaultSuccessModuleId: int("defaultSuccessModuleId"),
  passingScorePercent: int("passingScorePercent"),
  notifyEmail: varchar("notifyEmail", { length: 255 }),
  openAt: timestamp("openAt"),
  closeAt: timestamp("closeAt"),
  maxSubmissions: int("maxSubmissions"),
  importedFromUrl: varchar("importedFromUrl", { length: 1000 }),
  stripeEnabled: boolean("stripeEnabled").default(false).notNull(),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeAmount: int("stripeAmount"),
  hostDomain: varchar("hostDomain", { length: 255 }).default("app.allaboutultrasound.com"),
  // Display mode: classic (single page), typeform (welcome + page-by-page), paginated (page-by-page no welcome), inline (no header)
  displayMode: mysqlEnum("displayMode", ["classic", "typeform", "paginated", "inline"]).default("classic").notNull(),
  welcomeTitle: varchar("welcomeTitle", { length: 300 }),
  welcomeSubtitle: text("welcomeSubtitle"),
  welcomeButtonText: varchar("welcomeButtonText", { length: 100 }),
  welcomeImageUrl: text("welcomeImageUrl"),
  submitButtonText: varchar("submitButtonText", { length: 100 }),
  createdByUserId: int("createdByUserId"),
  emailListId: int("emailListId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type GeneralFormTemplate = typeof generalFormTemplates.$inferSelect;
export type InsertGeneralFormTemplate = typeof generalFormTemplates.$inferInsert;

export const generalFormSections = mysqlTable("generalFormSections", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isCollapsible: boolean("isCollapsible").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormSection = typeof generalFormSections.$inferSelect;
export type InsertGeneralFormSection = typeof generalFormSections.$inferInsert;

export const generalFormItems = mysqlTable("generalFormItems", {
  id: int("id").autoincrement().primaryKey(),
  sectionId: int("sectionId").notNull(),
  templateId: int("templateId").notNull(),
  itemType: varchar("itemType", { length: 50 }).notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  helpText: text("helpText"),
  placeholder: varchar("placeholder", { length: 300 }),
  isRequired: boolean("isRequired").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  scoreWeight: int("scoreWeight").default(0).notNull(),
  richTextContent: longtext("richTextContent"),
  validationRegex: varchar("validationRegex", { length: 500 }),
  minValue: int("minValue"),
  maxValue: int("maxValue"),
  extraConfig: longtext("extraConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormItem = typeof generalFormItems.$inferSelect;
export type InsertGeneralFormItem = typeof generalFormItems.$inferInsert;

export const generalFormOptions = mysqlTable("generalFormOptions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  label: varchar("label", { length: 300 }).notNull(),
  value: varchar("value", { length: 300 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  scoreValue: int("scoreValue").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormOption = typeof generalFormOptions.$inferSelect;
export type InsertGeneralFormOption = typeof generalFormOptions.$inferInsert;

export const generalFormBranchRules = mysqlTable("generalFormBranchRules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  ruleLabel: varchar("ruleLabel", { length: 255 }).default(""),
  targetType: varchar("targetType", { length: 20 }).notNull().default("item"),
  targetId: int("targetId").notNull(),
  // action: show | hide | skip_to | require | unrequire | set_value
  action: varchar("action", { length: 20 }).notNull().default("show"),
  setValue: varchar("setValue", { length: 500 }).default(""),
  logicOperator: varchar("logicOperator", { length: 10 }).notNull().default("any"),
  conditions: longtext("conditions").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  isEnabled: boolean("isEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormBranchRule = typeof generalFormBranchRules.$inferSelect;
export type InsertGeneralFormBranchRule = typeof generalFormBranchRules.$inferInsert;


export const generalFormSuccessModules = mysqlTable("generalFormSuccessModules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  moduleType: mysqlEnum("moduleType", ["inline_message", "full_page", "redirect_url"]).notNull(),
  inlineContent: longtext("inlineContent"),
  pageContent: longtext("pageContent"),
  redirectUrl: varchar("redirectUrl", { length: 2000 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type GeneralFormSuccessModule = typeof generalFormSuccessModules.$inferSelect;
export type InsertGeneralFormSuccessModule = typeof generalFormSuccessModules.$inferInsert;

export const generalFormSuccessRoutingRules = mysqlTable("generalFormSuccessRoutingRules", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  ruleLabel: varchar("ruleLabel", { length: 255 }).default(""),
  successModuleId: int("successModuleId").notNull(),
  logicOperator: varchar("logicOperator", { length: 10 }).notNull().default("all"),
  conditions: longtext("conditions").notNull(),
  grantAccessActions: longtext("grantAccessActions"),
  // Per-rule Stripe checkout action
  stripeEnabled: boolean("stripeEnabled").notNull().default(false),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeAmount: int("stripeAmount"),
  stripeCheckoutMode: varchar("stripeCheckoutMode", { length: 20 }).default("payment"),
  stripeSuccessUrl: varchar("stripeSuccessUrl", { length: 2000 }),
  stripeCancelUrl: varchar("stripeCancelUrl", { length: 2000 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isEnabled: boolean("isEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormSuccessRoutingRule = typeof generalFormSuccessRoutingRules.$inferSelect;
export type InsertGeneralFormSuccessRoutingRule = typeof generalFormSuccessRoutingRules.$inferInsert;

export const generalFormSubmissions = mysqlTable("generalFormSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  submittedByUserId: int("submittedByUserId"),
  responses: longtext("responses").notNull(),
  score: int("score").default(0).notNull(),
  maxScore: int("maxScore").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("submitted").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripePaymentStatus: varchar("stripePaymentStatus", { length: 50 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 500 }),
  referrer: varchar("referrer", { length: 500 }),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type GeneralFormSubmission = typeof generalFormSubmissions.$inferSelect;
export type InsertGeneralFormSubmission = typeof generalFormSubmissions.$inferInsert;

export const generalFormEmbedWidgets = mysqlTable("generalFormEmbedWidgets", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  widgetKey: varchar("widgetKey", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull().default("Default Widget"),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  displayType: mysqlEnum("displayType", ["inline", "popup", "slide_in"]).default("inline").notNull(),
  settingsJson: longtext("settingsJson").notNull(),
  domainMode: mysqlEnum("domainMode", ["all", "allowlist"]).default("all").notNull(),
  allowedDomains: longtext("allowedDomains"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type GeneralFormEmbedWidget = typeof generalFormEmbedWidgets.$inferSelect;
export type InsertGeneralFormEmbedWidget = typeof generalFormEmbedWidgets.$inferInsert;

export const generalFormEmbedAnalytics = mysqlTable("generalFormEmbedAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  widgetId: int("widgetId"),
  eventType: varchar("eventType", { length: 40 }).notNull(),
  triggerSource: varchar("triggerSource", { length: 80 }),
  deviceType: varchar("deviceType", { length: 20 }),
  hostDomain: varchar("hostDomain", { length: 255 }),
  sessionKey: varchar("sessionKey", { length: 64 }),
  metadataJson: longtext("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GeneralFormEmbedAnalytic = typeof generalFormEmbedAnalytics.$inferSelect;
export type InsertGeneralFormEmbedAnalytic = typeof generalFormEmbedAnalytics.$inferInsert;

// ─── Form Progress / Drop-off Tracking ───────────────────────────────────────
export const generalFormProgressEvents = mysqlTable("general_form_progress_events", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  templateId: int("template_id").notNull(),
  userId: int("user_id"),
  fieldId: int("field_id"),
  pageIndex: smallint("page_index").default(0).notNull(),
  eventType: mysqlEnum("event_type", ["session_start", "field_view", "field_answer", "page_advance", "form_submit", "form_abandon"]).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type GeneralFormProgressEvent = typeof generalFormProgressEvents.$inferSelect;
export type InsertGeneralFormProgressEvent = typeof generalFormProgressEvents.$inferInsert;

// ─── Block Templates (shared across all page editors) ─────────────────────────
export const blockTemplates = mysqlTable("blockTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  blockType: varchar("blockType", { length: 80 }).notNull(), // e.g. "text", "image", "lesson_quiz"
  blockData: longtext("blockData").notNull(), // JSON of the block's data object
  tags: varchar("tags", { length: 500 }), // comma-separated tags for search
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlockTemplate = typeof blockTemplates.$inferSelect;
export type InsertBlockTemplate = typeof blockTemplates.$inferInsert;

// ─── Thinkific Course Importer ────────────────────────────────────────────────
export const lmsThinkificImports = mysqlTable("lms_thinkific_imports", {
  id: int("id").autoincrement().primaryKey(),
  thinkificCourseId: int("thinkific_course_id").notNull(),
  thinkificCourseName: varchar("thinkific_course_name", { length: 255 }).notNull(),
  thinkificSlug: varchar("thinkific_slug", { length: 255 }),
  lmsCourseId: int("lms_course_id"),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).default("pending").notNull(),
  importedByUserId: int("imported_by_user_id").notNull(),
  sectionsImported: int("sections_imported").default(0).notNull(),
  lessonsImported: int("lessons_imported").default(0).notNull(),
  enrollmentsPending: int("enrollments_pending").default(0).notNull(),
  enrollmentsActivated: int("enrollments_activated").default(0).notNull(),
  errorMessage: text("error_message"),
  importLog: longtext("import_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsThinkificImport = typeof lmsThinkificImports.$inferSelect;

export const lmsPendingEnrollments = mysqlTable("lms_pending_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("import_id").notNull(),
  lmsCourseId: int("lms_course_id").notNull(),
  thinkificUserId: int("thinkific_user_id"),
  thinkificEmail: varchar("thinkific_email", { length: 255 }).notNull(),
  thinkificName: varchar("thinkific_name", { length: 255 }),
  lmsUserId: int("lms_user_id"),
  thinkificEnrolledAt: timestamp("thinkific_enrolled_at"),
  thinkificCompletedAt: timestamp("thinkific_completed_at"),
  thinkificProgressPct: int("thinkific_progress_pct").default(0),
  status: mysqlEnum("status", ["pending", "activated", "skipped"]).default("pending").notNull(),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsPendingEnrollment = typeof lmsPendingEnrollments.$inferSelect;

// --- LMS Archive (30-day soft-delete) ---
export const lmsArchive = mysqlTable("lms_archive", {
  id: int("id").autoincrement().primaryKey(),
  itemType: mysqlEnum("item_type", ["course", "quiz", "download", "product", "bundle"]).notNull(),
  originalId: int("original_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  snapshot: longtext("snapshot").notNull(),
  deletedByUserId: int("deleted_by_user_id").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  purgeAt: timestamp("purge_at").notNull(),
});
export type LmsArchiveItem = typeof lmsArchive.$inferSelect;

// --- Cross-Domain SSO Tokens ---
export const ssoTokens = mysqlTable("sso_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: int("user_id").notNull(),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SsoToken = typeof ssoTokens.$inferSelect;

// ─── Lesson Comments ─────────────────────────────────────────────────────────
export const lessonComments = mysqlTable("lesson_comments", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull(),
  userId: int("user_id").notNull(),
  content: text("content").notNull(),
  // Reply threading: null = top-level comment, non-null = reply to that comment id
  parentId: int("parent_id"),
  // Soft delete: set by admin, comment hidden from students but preserved in DB
  deletedAt: timestamp("deleted_at"),
  deletedByAdminId: int("deleted_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LessonComment = typeof lessonComments.$inferSelect;
export type InsertLessonComment = typeof lessonComments.$inferInsert;

// ─── Auto-Login Tokens (post-purchase one-time login) ────────────────────────
export const autoLoginTokens = mysqlTable("auto_login_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: int("user_id").notNull(),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  redirectUrl: text("redirect_url"), // where to send the user after login
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AutoLoginToken = typeof autoLoginTokens.$inferSelect;

// ─── Coupon Metadata ─────────────────────────────────────────────────────────
// Stores product targeting and subscription duration alongside Stripe coupon IDs.
// Stripe coupons don't natively support internal product restrictions, so we
// keep a local shadow record keyed by stripe_coupon_id.
export const couponMetadata = mysqlTable("coupon_metadata", {
  id: int("id").autoincrement().primaryKey(),
  stripeCouponId: varchar("stripe_coupon_id", { length: 255 }).notNull().unique(),
  // "site_wide" = applies to everything; "specific" = restricted to productKeys below
  scope: varchar("scope", { length: 32 }).notNull().default("site_wide"),
  // JSON array of product keys like ["course:42", "download:7", "product:3", "bundle:1", "membership:2"]
  productKeys: text("product_keys"),
  // Stripe coupon duration: "once" | "forever" | "repeating"
  duration: varchar("duration", { length: 32 }).notNull().default("once"),
  // Only used when duration = "repeating"
  durationInMonths: int("duration_in_months"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Date.now()),
});

// ─── Free Preview Enrollments ─────────────────────────────────────────────────
// Tracks visitors who register to access free-preview lessons on a course.
// A record is created before the user has a full account (guest registration).
// If the visitor later creates an account the userId can be linked.
export const freePreviewEnrollments = mysqlTable("free_preview_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  // The course they registered to preview
  courseId: int("course_id").notNull(),
  // Optional: linked user account (set if they are already logged in or sign up later)
  userId: int("user_id"),
  // Guest registration fields (always captured)
  email: varchar("email", { length: 320 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  // Source / campaign tracking
  source: varchar("source", { length: 128 }), // e.g. "course_landing", "funnel", "email_link"
  utmSource: varchar("utm_source", { length: 128 }),
  utmMedium: varchar("utm_medium", { length: 128 }),
  utmCampaign: varchar("utm_campaign", { length: 128 }),
  // Access token used to grant preview access without full login
  accessToken: varchar("access_token", { length: 128 }).notNull().unique(),
  // When the preview access expires (default 7 days from registration)
  accessExpiresAt: timestamp("access_expires_at").notNull(),
  // Whether they have been sent a follow-up email
  followUpSentAt: timestamp("follow_up_sent_at"),
  // Admin notes / tags
  tags: text("tags"), // JSON array of strings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FreePreviewEnrollment = typeof freePreviewEnrollments.$inferSelect;
export type NewFreePreviewEnrollment = typeof freePreviewEnrollments.$inferInsert;

// ─── Webinars ─────────────────────────────────────────────────────────────────

export const webinars = mysqlTable("webinars", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  brand: mysqlEnum("brand", ["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound").notNull(),
  description: longtext("description"),
  coverImage: text("cover_image"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  type: mysqlEnum("type", ["live", "prerecorded"]).default("live").notNull(),
  status: mysqlEnum("status", ["draft", "published", "ended"]).default("draft").notNull(),
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  durationMinutes: int("duration_minutes").default(60),
  meetingUrl: text("meeting_url"),
  replayUrl: text("replay_url"),
  replayEnabled: boolean("replay_enabled").default(true).notNull(),
  accessType: mysqlEnum("access_type", ["free", "paid", "restricted"]).default("free").notNull(),
  // Sort order for public community listing (lower = first)
  sortOrder: int("sort_order").default(0).notNull(),
  // Icon image URL (separate from coverImage — shown as community avatar/icon)
  iconImage: text("icon_image"),
  // JSON array of course/product IDs that grant automatic access to this community
  linkedAccessItems: longtext("linked_access_items"),
  pricingOptions: longtext("pricing_options"),
  // Structured pricing (mirrors lmsCourses)
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(),
  isFree: boolean("is_free").default(false).notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  trialDays: int("trial_days"),
  downPayment: int("down_payment").default(0),
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0),
  installmentIntervalDays: int("installment_interval_days").default(30),
  landingPageBlocks: longtext("landing_page_blocks"),
  hostName: varchar("host_name", { length: 200 }),
  hostTitle: varchar("host_title", { length: 200 }),
  hostAvatar: text("host_avatar"),
  maxAttendees: int("max_attendees"),
  // Teachific-style extended fields
  videoSource: mysqlEnum("video_source", ["upload","youtube","vimeo","zoom","teams","embed"]).default("youtube"),
  videoUrl: text("video_url"),
  videoFileUrl: text("video_file_url"),
  videoFileKey: text("video_file_key"),
  meetingId: varchar("meeting_id", { length: 128 }),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  replayDelayMinutes: int("replay_delay_minutes").default(0),
  aiViewersEnabled: boolean("ai_viewers_enabled").default(false),
  aiViewersMin: int("ai_viewers_min").default(50),
  aiViewersMax: int("ai_viewers_max").default(300),
  aiViewersPeakAt: int("ai_viewers_peak_at").default(30),
  salesPageBlocksJson: json("sales_page_blocks_json"),
  thumbnailUrl: text("thumbnail_url"),
  requireRegistration: boolean("require_registration").default(true),
  registrationFormFields: json("registration_form_fields"),
  postWebinarAction: mysqlEnum("post_webinar_action", ["product","url","thankyou","none"]).default("none"),
  postWebinarProductId: int("post_webinar_product_id"),
  postWebinarUrl: text("post_webinar_url"),
  postWebinarMessage: text("post_webinar_message"),
  postWebinarDelaySeconds: int("post_webinar_delay_seconds").default(0),
  publishDomain: varchar("publish_domain", { length: 255 }),
  playerPageBlocks: longtext("player_page_blocks"),
  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  // After Purchase Workflow — JSON array of workflow action objects
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  // Stripe product/price IDs — auto-synced on save
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Webinar = typeof webinars.$inferSelect;
export type NewWebinar = typeof webinars.$inferInsert;

export const webinarRegistrations = mysqlTable("webinar_registrations", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinar_id").notNull(),
  userId: int("user_id").notNull(),
  pricingOptionId: varchar("pricing_option_id", { length: 64 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 128 }),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  attendedAt: timestamp("attended_at"),
  watchedReplayAt: timestamp("watched_replay_at"),
  attended: boolean("attended").default(false).notNull(),
  convertedAt: timestamp("converted_at"),
  watchedSeconds: int("watched_seconds").default(0),
  firstName: varchar("first_name", { length: 128 }),
  lastName: varchar("last_name", { length: 128 }),
  email: varchar("email", { length: 255 }),
  accessExpiresAt: timestamp("access_expires_at"),
});
export type WebinarRegistration = typeof webinarRegistrations.$inferSelect;

export const webinarComments = mysqlTable("webinar_comments", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinar_id").notNull(),
  userId: int("user_id").notNull(),
  parentId: int("parent_id"),
  body: longtext("body").notNull(),
  isLive: boolean("is_live").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WebinarComment = typeof webinarComments.$inferSelect;

export const webinarSessions = mysqlTable("webinar_sessions", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinar_id").notNull(),
  registrationId: int("registration_id"),
  sessionToken: varchar("session_token", { length: 128 }).notNull().unique(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  watchedSeconds: int("watched_seconds").default(0),
  peakViewerCount: int("peak_viewer_count").default(0),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
});
export type WebinarSession = typeof webinarSessions.$inferSelect;

export const webinarFunnelSteps = mysqlTable("webinar_funnel_steps", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinar_id").notNull(),
  stepOrder: int("step_order").default(0),
  stepType: mysqlEnum("step_type", ["registration","confirmation","reminder","watch","offer","thankyou"]).notNull(),
  title: varchar("title", { length: 255 }),
  pageBlocksJson: json("page_blocks_json"),
  emailSubject: varchar("email_subject", { length: 255 }),
  emailBody: text("email_body"),
  triggerType: mysqlEnum("trigger_type", ["immediate","delay","scheduled"]).default("immediate"),
  triggerDelayMinutes: int("trigger_delay_minutes").default(0),
  isActive: boolean("is_active").default(true),
});
export type WebinarFunnelStep = typeof webinarFunnelSteps.$inferSelect;

// ─── Bundles ──────────────────────────────────────────────────────────────────

export const bundles = mysqlTable("bundles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  brand: mysqlEnum("brand", ["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound").notNull(),
  description: longtext("description"),
  coverImage: text("cover_image"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  accessType: mysqlEnum("access_type", ["free", "paid"]).default("paid").notNull(),
  pricingOptions: longtext("pricing_options"),
  // Structured pricing (mirrors lmsCourses)
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(),
  isFree: boolean("is_free").default(false).notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  trialDays: int("trial_days"),
  downPayment: int("down_payment").default(0),
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0),
  installmentIntervalDays: int("installment_interval_days").default(30),
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  landingPageBlocks: longtext("landing_page_blocks"),
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  hidePricingOptions: int("hide_pricing_options").default(0).notNull(),
  // Whether to collect a shipping address at Stripe checkout (for bundles with physical items)
  collectShippingAddress: boolean("collect_shipping_address").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Bundle = typeof bundles.$inferSelect;
export type NewBundle = typeof bundles.$inferInsert;

export const bundleItems = mysqlTable("bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundle_id").notNull(),
  itemType: mysqlEnum("item_type", ["course", "quiz", "download", "product", "webinar"]).notNull(),
  itemId: int("item_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type BundleItem = typeof bundleItems.$inferSelect;

// Multiple named pricing tiers per bundle (mirrors lmsPricingOptions)
export const bundlePricingOptions = mysqlTable("bundle_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundle_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sublabel: varchar("sublabel", { length: 500 }),
  pricingType: mysqlEnum("pricing_type", ["one_time", "subscription", "payment_plan", "free"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(), // cents
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  downPayment: int("down_payment").default(0),
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0),
  installmentIntervalDays: int("installment_interval_days").default(30),
  ctaLabel: varchar("cta_label", { length: 100 }),
  ctaUrl: varchar("cta_url", { length: 2048 }),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BundlePricingOption = typeof bundlePricingOptions.$inferSelect;

export const bundleEnrollments = mysqlTable("bundle_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundle_id").notNull(),
  userId: int("user_id").notNull(),
  pricingOptionId: varchar("pricing_option_id", { length: 64 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 128 }),
  accessExpiresAt: timestamp("access_expires_at"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
});
export type BundleEnrollment = typeof bundleEnrollments.$inferSelect;

// ─── Memberships ──────────────────────────────────────────────────────────────

export const membershipPlans = mysqlTable("membership_plans", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  brand: mysqlEnum("brand", ["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound").notNull(),
  description: longtext("description"),
  coverImage: text("cover_image"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  iconImage: text("icon_image"),
  accentColor: varchar("accent_color", { length: 32 }).default("#189aa1"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  billingInterval: mysqlEnum("billing_interval", ["monthly", "annual", "lifetime", "one_time"]).default("monthly").notNull(),
  price: int("price").default(0).notNull(),
  compareAtPrice: int("compare_at_price"),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  stripeProductId: varchar("stripe_product_id", { length: 128 }),
  stripePriceId: varchar("stripe_price_id", { length: 128 }),
  features: longtext("features"),
  /** JSON array of feature bullet strings shown on sales page */
  featureBullets: longtext("feature_bullets"),
  landingPageBlocks: longtext("landing_page_blocks"),
  /** Member-facing page blocks (shown after purchase) */
  memberPageBlocks: longtext("member_page_blocks"),
  trialDays: int("trial_days").default(0),
  sortOrder: int("sort_order").default(0).notNull(),
  publishDomain: varchar("publish_domain", { length: 255 }),
  /** JSON: { maxMembers, requireApproval, welcomeEmailSubject, welcomeEmailBody } */
  settings: longtext("settings"),
  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),
  // After Purchase Workflow — JSON array of workflow action objects
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type NewMembershipPlan = typeof membershipPlans.$inferInsert;

export const membershipPlanAccess = mysqlTable("membership_plan_access", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("plan_id").notNull(),
  itemType: mysqlEnum("item_type", ["course", "quiz", "bundle", "community", "webinar", "download", "product", "all_courses", "all_downloads", "ultrasoundassist_free", "ultrasoundassist_premium", "echoassist_free", "echoassist_premium"]).notNull(),
  itemId: int("item_id"),
  /** Human-readable label override */
  label: varchar("label", { length: 255 }),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type MembershipPlanAccess = typeof membershipPlanAccess.$inferSelect;

export const membershipSubscriptions = mysqlTable("membership_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("plan_id").notNull(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "trialing", "past_due"]).default("active").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 128 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
  currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type MembershipSubscription = typeof membershipSubscriptions.$inferSelect;

export const membershipDiscountCodes = mysqlTable("membership_discount_codes", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("plan_id"),
  /** null = applies to all plans */
  code: varchar("code", { length: 64 }).notNull().unique(),
  discountType: mysqlEnum("discount_type", ["percent", "fixed"]).default("percent").notNull(),
  discountValue: int("discount_value").notNull(),
  maxUses: int("max_uses"),
  usedCount: int("used_count").default(0).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  isActive: boolean("is_active").default(true).notNull(),
  stripePromotionCodeId: varchar("stripe_promotion_code_id", { length: 128 }),
  stripeCouponId: varchar("stripe_coupon_id", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type MembershipDiscountCode = typeof membershipDiscountCodes.$inferSelect;
export type NewMembershipDiscountCode = typeof membershipDiscountCodes.$inferInsert;

// ─── Communities ──────────────────────────────────────────────────────────────

export const communities = mysqlTable("communities", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  brand: mysqlEnum("brand", ["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound").notNull(),
  description: longtext("description"),
  coverImage: text("cover_image"),
  logoImage: text("logo_image"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  privacy: mysqlEnum("privacy", ["public", "private", "paid", "invite_only", "course_gated"]).default("public").notNull(),
  accessType: mysqlEnum("access_type", ["free", "paid", "restricted", "invite_only", "course_gated", "linked"]).default("free").notNull(),
  /** Thinkific source: 'thinkific_community' | 'thinkific_space' | null for native */
  thinkificSourceType: mysqlEnum("thinkific_source_type", ["thinkific_community", "thinkific_space"]),
  /** Thinkific community ID this was imported from */
  thinkificCommunityId: varchar("thinkific_community_id", { length: 64 }),
  /** Thinkific space ID (when sourceType = thinkific_space) */
  thinkificSpaceId: varchar("thinkific_space_id", { length: 64 }),
  pricingOptions: longtext("pricing_options"),
  landingPageBlocks: longtext("landing_page_blocks"),
  pageBlocks: longtext("page_blocks"),
  accentColor: varchar("accent_color", { length: 32 }).default("#189aa1"),
  sortOrder: int("sort_order").default(0).notNull(),
  iconImage: text("icon_image"),
  linkedAccessItems: longtext("linked_access_items"),
  // ─── Branding / UI Editor fields ─────────────────────────────────────────
  bannerImage: text("banner_image"),
  welcomeMessage: text("welcome_message"),
  headerStyle: varchar("header_style", { length: 32 }).default("banner"),
  layoutStyle: varchar("layout_style", { length: 32 }).default("sidebar"),
  primaryColor: varchar("primary_color", { length: 32 }),
  secondaryColor: varchar("secondary_color", { length: 32 }),
  backgroundColor: varchar("background_color", { length: 32 }),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;

export const communityMembers = mysqlTable("community_members", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["admin", "moderator", "member"]).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  pricingOptionId: varchar("pricing_option_id", { length: 64 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 128 }),
  approvedToPost: boolean("approved_to_post").default(true).notNull(),
  // pending = awaiting admin approval (for restricted communities)
  memberStatus: mysqlEnum("member_status", ["pending", "approved", "rejected"]).default("approved").notNull(),
  // For admin-profile posts: which admin profile this member is linked to
  adminProfileId: int("admin_profile_id"),
});
export type CommunityMember = typeof communityMembers.$inferSelect;

export const communityChannels = mysqlTable("community_channels", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["discussion", "announcements", "resources"]).default("discussion").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityChannel = typeof communityChannels.$inferSelect;

export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channel_id").notNull(),
  communityId: int("community_id").notNull(),
  userId: int("user_id").notNull(),
  // If posted as an admin profile, this overrides the display name/avatar
  adminProfileId: int("admin_profile_id"),
  // If posted as a global posting alias, this overrides the display name/avatar
  aliasId: int("alias_id"),
  title: varchar("title", { length: 255 }),
  body: longtext("body").notNull(),
  attachments: longtext("attachments"),
  postType: mysqlEnum("post_type", ["text", "image", "video", "poll", "case_study"]).default("text").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  commentCount: int("comment_count").default(0).notNull(),
  reactionCount: int("reaction_count").default(0).notNull(),
  viewCount: int("view_count").default(0).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CommunityPost = typeof communityPosts.$inferSelect;

export const communityPostComments = mysqlTable("community_post_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  parentId: int("parent_id"),
  /** If posted as a global posting alias, this overrides the display name/avatar */
  aliasId: int("alias_id"),
  body: longtext("body").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("approved").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CommunityPostComment = typeof communityPostComments.$inferSelect;

export const communityPostReactions = mysqlTable("community_post_reactions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
});
export type CommunityPostReaction = typeof communityPostReactions.$inferSelect;

export const communityDMs = mysqlTable("community_dms", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  fromUserId: int("from_user_id").notNull(),
  toUserId: int("to_user_id").notNull(),
  body: longtext("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityDM = typeof communityDMs.$inferSelect;

// ─── Lesson Templates ─────────────────────────────────────────────────────────

export const lessonTemplates = mysqlTable("lesson_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  lessonType: varchar("lesson_type", { length: 64 }).default("video").notNull(),
  blocks: longtext("blocks"),
  coverImage: text("cover_image"),
  tags: text("tags"),
  createdByAdminId: int("created_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LessonTemplate = typeof lessonTemplates.$inferSelect;

// ─── Question Bank ─────────────────────────────────────────────────────────────
// Central repository of reusable quiz questions with tagging support.
// Questions are auto-saved here when created via the quiz builder or AI generator.
// Media: questionImageUrl / questionVideoUrl attach to the question stem.
// Options are stored as JSON array of objects: { text, imageUrl?, videoUrl? }
// Quiz-level settings (randomizeQuestions, randomizeAnswers) live on lms_quizzes.

export const questionBankFolders = mysqlTable("question_bank_folders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  parentId: int("parent_id"),
  color: varchar("color", { length: 32 }).default("#179ca3").notNull(),
  sharedInSonoQuiz: boolean("shared_in_sono_quiz").default(false).notNull(),
  createdByAdminId: int("created_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type QuestionBankFolder = typeof questionBankFolders.$inferSelect;

export const questionBank = mysqlTable("question_bank", {
  id: int("id").autoincrement().primaryKey(),
  question: longtext("question").notNull(),
  type: mysqlEnum("type", ["mcq", "truefalse", "multiselect", "hotspot", "matching"]).default("mcq").notNull(),
  // JSON array of { text: string, imageUrl?: string, videoUrl?: string }
  options: longtext("options"),
  correctAnswer: varchar("correct_answer", { length: 500 }).notNull(),
  /** For multiselect: JSON array of correct answer indices. For hotspot: JSON {x,y,radius}. For matching: not used (use matchingPairs) */
  correctAnswers: text("correct_answers"),
  explanation: longtext("explanation"),
  // Media attached to the question stem
  questionImageUrl: text("question_image_url"),
  questionVideoUrl: text("question_video_url"),
  /** Hotspot: JSON array of { id, x, y, radius, label, isCorrect } */
  hotspotMarkers: text("hotspot_markers"),
  /** Matching: JSON array of { id, left, right } */
  matchingPairs: text("matching_pairs"),
  /** Feedback media */
  feedbackImageUrl: text("feedback_image_url"),
  feedbackVideoUrl: text("feedback_video_url"),
  // Source tracking
  sourceQuizId: int("source_quiz_id"), // FK → lms_quizzes.id (if created via quiz builder)
  sourceQuizQuestionId: int("source_quiz_question_id"), // FK → lms_quiz_questions.id
  folderId: int("folder_id"), // FK → question_bank_folders.id
  createdByAdminId: int("created_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type QuestionBankItem = typeof questionBank.$inferSelect;

export const questionBankTags = mysqlTable("question_bank_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#179ca3").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type QuestionBankTag = typeof questionBankTags.$inferSelect;

export const questionBankTagMap = mysqlTable("question_bank_tag_map", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("question_id").notNull(), // FK → question_bank.id
  tagId: int("tag_id").notNull(),            // FK → question_bank_tags.id
});
export type QuestionBankTagMap = typeof questionBankTagMap.$inferSelect;

// ─── Community Extended Schema ────────────────────────────────────────────────

/** User follows another user */
export const communityFollows = mysqlTable("community_follows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("follower_id").notNull(),
  followingId: int("following_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityFollow = typeof communityFollows.$inferSelect;

/** User bookmarks a post */
export const communityBookmarks = mysqlTable("community_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  postId: int("post_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityBookmark = typeof communityBookmarks.$inferSelect;

/** Reactions on comments */
export const communityCommentReactions = mysqlTable("community_comment_reactions", {
  id: int("id").autoincrement().primaryKey(),
  commentId: int("comment_id").notNull(),
  userId: int("user_id").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
});
export type CommunityCommentReaction = typeof communityCommentReactions.$inferSelect;

/** Polls attached to posts */
export const communityPolls = mysqlTable("community_polls", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull().unique(),
  question: varchar("question", { length: 500 }).notNull(),
  options: longtext("options").notNull(), // JSON: string[]
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityPoll = typeof communityPolls.$inferSelect;

/** Poll votes */
export const communityPollVotes = mysqlTable("community_poll_votes", {
  id: int("id").autoincrement().primaryKey(),
  pollId: int("poll_id").notNull(),
  userId: int("user_id").notNull(),
  optionIndex: int("option_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityPollVote = typeof communityPollVotes.$inferSelect;

/** Hashtags */
export const communityHashtags = mysqlTable("community_hashtags", {
  id: int("id").autoincrement().primaryKey(),
  tag: varchar("tag", { length: 100 }).notNull().unique(),
  postCount: int("post_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityHashtag = typeof communityHashtags.$inferSelect;

/** Post ↔ hashtag junction */
export const communityPostHashtags = mysqlTable("community_post_hashtags", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  hashtagId: int("hashtag_id").notNull(),
});
export type CommunityPostHashtag = typeof communityPostHashtags.$inferSelect;

/** XP & gamification per user */
export const communityUserXP = mysqlTable("community_user_xp", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  totalXP: int("total_xp").default(0).notNull(),
  level: int("level").default(1).notNull(),
  streakDays: int("streak_days").default(0).notNull(),
  lastActivityDate: varchar("last_activity_date", { length: 10 }), // YYYY-MM-DD
  postsCount: int("posts_count").default(0).notNull(),
  commentsCount: int("comments_count").default(0).notNull(),
  reactionsGivenCount: int("reactions_given_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CommunityUserXP = typeof communityUserXP.$inferSelect;

/** XP event log */
export const communityXPEvents = mysqlTable("community_xp_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(), // "post","comment","reaction","login","poll_vote"
  xpAwarded: int("xp_awarded").notNull(),
  refId: int("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityXPEvent = typeof communityXPEvents.$inferSelect;

/** Badges */
export const communityBadges = mysqlTable("community_badges", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  iconEmoji: varchar("icon_emoji", { length: 8 }).default("🏅").notNull(),
  iconUrl: text("icon_url"),
  xpRequired: int("xp_required").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityBadge = typeof communityBadges.$inferSelect;

/** User badge awards */
export const communityUserBadges = mysqlTable("community_user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  badgeId: int("badge_id").notNull(),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
});
export type CommunityUserBadge = typeof communityUserBadges.$inferSelect;

/** In-app community notifications */
export const communityNotifications = mysqlTable("community_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  type: varchar("type", { length: 64 }).notNull(), // "reply","mention","reaction","follow","announcement"
  actorId: int("actor_id"),
  postId: int("post_id"),
  commentId: int("comment_id"),
  communityId: int("community_id"),
  body: text("body"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityNotification = typeof communityNotifications.$inferSelect;

/** DM conversations (thread between 2 users) */
export const communityDMConversations = mysqlTable("community_dm_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userAId: int("user_a_id").notNull(),
  userBId: int("user_b_id").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  userAUnread: int("user_a_unread").default(0).notNull(),
  userBUnread: int("user_b_unread").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityDMConversation = typeof communityDMConversations.$inferSelect;

/** DM messages (linked to conversation) */
export const communityDMMessages = mysqlTable("community_dm_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  senderId: int("sender_id").notNull(),
  body: longtext("body").notNull(),
  attachmentUrl: text("attachment_url"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityDMMessage = typeof communityDMMessages.$inferSelect;

/** Reported content */
export const communityReports = mysqlTable("community_reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporter_id").notNull(),
  targetType: mysqlEnum("target_type", ["post", "comment", "user", "dm_message"]).notNull(),
  targetId: int("target_id").notNull(),
  communityId: int("community_id"),
  reason: varchar("reason", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "dismissed"]).default("pending").notNull(),
  reviewedByAdminId: int("reviewed_by_admin_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityReport = typeof communityReports.$inferSelect;

/** Extra columns on communityPosts: postType, pollId, viewCount, isLocked, isHidden */
// NOTE: These are added via ALTER TABLE below — the base table is already in the DB.
// We extend the TypeScript type via a separate view/helper; actual columns added via SQL migration.

// ─── Access Token IP Tracking ─────────────────────────────────────────────────
// Tracks each use of a persistent access token (from purchase/access emails).
// Used to detect IP abuse: >3 distinct IPs in 24h revokes the token and flags the account.

export const accessTokenUses = mysqlTable("access_token_uses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  userAgent: text("user_agent"),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});
export type AccessTokenUse = typeof accessTokenUses.$inferSelect;

// ─── IP Security Flags ────────────────────────────────────────────────────────
// Records security events for admin review (e.g. access token IP abuse).

export const ipSecurityFlags = mysqlTable("ip_security_flags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  flagType: varchar("flag_type", { length: 64 }).notNull(), // e.g. "access_token_ip_abuse"
  details: text("details"), // JSON with context (IPs, timestamps, etc.)
  resolvedAt: timestamp("resolved_at"),
  resolvedByAdminId: int("resolved_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IpSecurityFlag = typeof ipSecurityFlags.$inferSelect;

// ─── Media Upload Sessions (R2 Multipart Upload Tracking) ─────────────────────
// Tracks in-progress chunked uploads using R2 multipart upload.
// State is stored in the DB so it survives server/sandbox restarts.
export const mediaUploadSessions = mysqlTable("media_upload_sessions", {
  id: int("id").autoincrement().primaryKey(),
  uploadId: varchar("upload_id", { length: 64 }).notNull().unique(),
  r2UploadId: text("r2_upload_id").notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  totalChunks: int("total_chunks").notNull(),
  // JSON array of { partNumber, etag } objects for completed parts
  completedParts: text("completed_parts").notNull(),
  // Metadata for final asset creation
  fileName: varchar("file_name", { length: 512 }).notNull(),
  fileSize: int("file_size").notNull().default(0),
  title: varchar("title", { length: 512 }),
  description: text("description"),
  tags: text("tags"),
  access: varchar("access", { length: 16 }).notNull().default("private"),
  notes: text("notes"),
  mediaType: varchar("media_type", { length: 32 }),
  folder: varchar("folder", { length: 128 }),
  brand: varchar("brand", { length: 32 }).notNull().default("aaus"),
  strategy: varchar("strategy", { length: 20 }).notNull().default("direct"),
  existingAssetId: int("existing_asset_id"),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
export type MediaUploadSession = typeof mediaUploadSessions.$inferSelect;

// ─── LMS Cohort Sessions & Assignments ───────────────────────────────────────

export const lmsCohortSessions = mysqlTable("lms_cohort_sessions", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sessionDate: timestamp("session_date").notNull(),
  durationMinutes: int("duration_minutes").default(60).notNull(),
  meetingUrl: text("meeting_url"),
  recordingUrl: text("recording_url"),
  // draft = not yet visible to students; published = visible; cancelled = cancelled
  status: mysqlEnum("status", ["draft", "published", "cancelled"]).default("draft").notNull(),
  // IANA timezone string for this session (e.g. "America/New_York", "Europe/London")
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  // ── Recurrence ──────────────────────────────────────────────────────────────
  // recurrenceRule: weekly | biweekly | monthly | null (one-off)
  recurrenceRule: mysqlEnum("recurrence_rule", ["weekly", "biweekly", "monthly"]),
  // Comma-separated days of week for custom recurrence: "0,1,2,3,4,5,6" (0=Sun)
  recurrenceDaysOfWeek: varchar("recurrence_days_of_week", { length: 20 }),
  recurrenceInterval: int("recurrence_interval").default(1), // multiplier (reserved for future use)
  recurrenceEndDate: timestamp("recurrence_end_date"),       // inclusive last occurrence date
  // Alternative to end date: stop after N occurrences
  recurrenceOccurrenceCount: int("recurrence_occurrence_count"),
  // parentSessionId links child instances back to the template/parent session
  parentSessionId: int("parent_session_id"),
  // Cohort group this session belongs to (null = shared across all groups / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortSession = typeof lmsCohortSessions.$inferSelect;
export type InsertLmsCohortSession = typeof lmsCohortSessions.$inferInsert;

export const lmsCohortAssignments = mysqlTable("lms_cohort_assignments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  contentBlocks: json("content_blocks").$type<any[]>(),  // page-builder blocks
  dueDate: timestamp("due_date"),
  maxPoints: int("max_points").default(100).notNull(),
  // text = typed submission; file = file upload; url = link submission; none = no submission required
  submissionType: mysqlEnum("submission_type", ["text", "file", "url", "none"]).default("none").notNull(),
  // draft = not yet visible; published = visible to enrolled students
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  position: int("position").default(0).notNull(),
  // Cohort group this assignment belongs to (null = shared / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortAssignment = typeof lmsCohortAssignments.$inferSelect;
export type InsertLmsCohortAssignment = typeof lmsCohortAssignments.$inferInsert;

// ─── Cohort Recordings ──────────────────────────────────────────────────────
export const lmsCohortRecordings = mysqlTable("lms_cohort_recordings", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  sessionId: int("session_id"),           // optional link to a live session
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: int("duration_seconds"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  showControls: boolean("show_controls").default(true).notNull(),
  position: int("position").default(0).notNull(),
  // Cohort group this recording belongs to (null = shared / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortRecording = typeof lmsCohortRecordings.$inferSelect;
export type InsertLmsCohortRecording = typeof lmsCohortRecordings.$inferInsert;

// ─── Cohort Resources (My Cohort → Resources tab) ─────────────────────────────
export const lmsCohortResources = mysqlTable("lms_cohort_resources", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  /** null = entire course (all cohorts, including future); set = this cohort group only */
  cohortGroupId: int("cohort_group_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cardImageUrl: text("card_image_url"),
  actionType: mysqlEnum("action_type", ["link", "download"]).default("link").notNull(),
  linkUrl: text("link_url"),
  downloadSource: mysqlEnum("download_source", ["upload", "media_repo", "download_product"]),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 512 }),
  fileName: varchar("file_name", { length: 512 }),
  mediaAssetId: int("media_asset_id"),
  downloadProductId: int("download_product_id"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortResource = typeof lmsCohortResources.$inferSelect;
export type InsertLmsCohortResource = typeof lmsCohortResources.$inferInsert;

// ─── Cohort Assignment Submissions ───────────────────────────────────────────
export const lmsCohortSubmissions = mysqlTable("lms_cohort_submissions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignment_id").notNull(),
  userId: int("user_id").notNull(),
  // mirrors assignment submissionType
  submissionType: mysqlEnum("submission_type", ["text", "file", "url", "none"]).default("none").notNull(),
  textContent: text("text_content"),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 512 }),
  urlContent: text("url_content"),
  // pending = submitted, awaiting review; graded = instructor has reviewed
  status: mysqlEnum("status", ["pending", "graded"]).default("pending").notNull(),
  grade: decimal("grade", { precision: 6, scale: 2 }),  // optional numeric grade
  feedback: text("feedback"),    // optional instructor feedback
  gradedAt: bigint("graded_at", { mode: "number" }),
  gradedBy: int("graded_by"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortSubmission = typeof lmsCohortSubmissions.$inferSelect;
export type InsertLmsCohortSubmission = typeof lmsCohortSubmissions.$inferInsert;

// ─── Media Upload Folders & Responses ────────────────────────────────────────
export const mediaUploadFolders = mysqlTable("media_upload_folders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MediaUploadFolder = typeof mediaUploadFolders.$inferSelect;
export type InsertMediaUploadFolder = typeof mediaUploadFolders.$inferInsert;

export const mediaUploadResponses = mysqlTable("media_upload_responses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  blockId: varchar("block_id", { length: 128 }),   // block ID from page builder
  pageId: varchar("page_id", { length: 128 }),      // page/funnel/course slug or ID
  pageType: varchar("page_type", { length: 64 }),   // landing|funnel|lesson|cohort_assignment|other
  folderId: int("folder_id"),
  fileUrl: varchar("file_url", { length: 1024 }).notNull(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  fileName: varchar("file_name", { length: 512 }),
  mimeType: varchar("mime_type", { length: 128 }),
  fileSize: int("file_size"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MediaUploadResponse = typeof mediaUploadResponses.$inferSelect;
export type InsertMediaUploadResponse = typeof mediaUploadResponses.$inferInsert;

// ─── Community Admin Profiles ──────────────────────────────────────────────────
// Admins can create multiple posting profiles (e.g., "Support", "Admin", "Lara")
// and choose which profile to post as in the community.
export const communityAdminProfiles = mysqlTable("community_admin_profiles", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CommunityAdminProfile = typeof communityAdminProfiles.$inferSelect;
export type InsertCommunityAdminProfile = typeof communityAdminProfiles.$inferInsert;

// ─── LMS Cohort Groups ─────────────────────────────────────────────────────────
// Multiple cohort groups under one parent cohort course (e.g., "June 2026", "January 2027")
// Each group has its own page content, enrollment list, and sessions.
export const lmsCohortGroups = mysqlTable("lms_cohort_groups", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(), // FK to lms_courses.id (type = 'cohort')
  name: varchar("name", { length: 255 }).notNull(), // e.g. "June 2026 Cohort"
  slug: varchar("slug", { length: 255 }).notNull(), // URL-safe identifier
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  enrollmentCloseDate: timestamp("enrollment_close_date"),
  maxStudents: int("max_students"), // null = unlimited
  location: varchar("location", { length: 300 }), // e.g. "Dallas, TX" or "Online"
  durationHours: int("duration_hours"), // total hours for the cohort program
  status: mysqlEnum("status", ["draft", "open", "active", "completed", "archived"]).default("draft").notNull(),
  // Page builder blocks for this specific cohort group's overview page
  pageBlocks: longtext("page_blocks"),
  // Full page builder blocks for this specific cohort group's detail page
  landingBlocks: longtext("landing_blocks"),
  // Landing page link override — which cohort to feature on the course landing page
  isFeaturedOnLanding: boolean("is_featured_on_landing").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  // How many days students retain access from group start date (null = indefinite)
  accessDurationDays: int("access_duration_days"),
  // Waitlist settings
  waitlistEnabled: boolean("waitlist_enabled").default(false).notNull(),
  waitlistHeading: varchar("waitlist_heading", { length: 500 }),
  waitlistBody: longtext("waitlist_body"),
  waitlistCtaLabel: varchar("waitlist_cta_label", { length: 255 }),
  waitlistCtaUrl: varchar("waitlist_cta_url", { length: 2048 }),
  waitlistRedirectUrl: varchar("waitlist_redirect_url", { length: 2048 }),
  waitlistSuccessMessage: longtext("waitlist_success_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortGroup = typeof lmsCohortGroups.$inferSelect;
export type InsertLmsCohortGroup = typeof lmsCohortGroups.$inferInsert;

// ─── LMS Cohort Group Enrollments ─────────────────────────────────────────────
// Links a student enrollment to a specific cohort group within a course.
export const lmsCohortGroupEnrollments = mysqlTable("lms_cohort_group_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  enrollmentId: int("enrollment_id").notNull(), // FK to lms_enrollments.id
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export type LmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferSelect;
export type InsertLmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferInsert;

// ─── Cohort Waitlist Entries ──────────────────────────────────────────────────
export const cohortWaitlistEntries = mysqlTable("cohort_waitlist_entries", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  courseId: int("course_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CohortWaitlistEntry = typeof cohortWaitlistEntries.$inferSelect;

// ─── Cohort Group Messages ────────────────────────────────────────────────────
export const lmsCohortMessages = mysqlTable("lms_cohort_messages", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  courseId: int("course_id").notNull(),
  userId: int("user_id").notNull(),
  body: longtext("body"),
  // JSON array of { url, mimeType, fileName } objects
  mediaUrls: json("media_urls").$type<{ url: string; mimeType: string; fileName: string }[]>(),
  isAdminPost: boolean("is_admin_post").default(false).notNull(),
  // If posted as a global posting alias, this overrides the display name/avatar
  aliasId: int("alias_id"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortMessage = typeof lmsCohortMessages.$inferSelect;
export type InsertLmsCohortMessage = typeof lmsCohortMessages.$inferInsert;

// Cohort group staff (admins/moderators per cohort group)
export const lmsCohortStaff = mysqlTable("lms_cohort_staff", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  courseId: int("course_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("moderator"), // 'admin' | 'moderator'
  canManageDiscussions: boolean("can_manage_discussions").default(true).notNull(),
  canAddSessions: boolean("can_add_sessions").default(false).notNull(),
  canAddAssignments: boolean("can_add_assignments").default(false).notNull(),
  canAddRecordings: boolean("can_add_recordings").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortStaff = typeof lmsCohortStaff.$inferSelect;
export type InsertLmsCohortStaff = typeof lmsCohortStaff.$inferInsert;

// Ultrasound interests (managed by admin, brand-filtered)
export const lmsInterests = mysqlTable("lms_interests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("general"), // 'general' | 'echo' | 'both'
  // brandFilter: 'aaus' = general ultrasound only, 'iheartecho' = echo only, 'both' = all brands
  brandFilter: varchar("brand_filter", { length: 20 }).notNull().default("both"),
  iconEmoji: varchar("icon_emoji", { length: 10 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsInterest = typeof lmsInterests.$inferSelect;
export type InsertLmsInterest = typeof lmsInterests.$inferInsert;

// User interests (many-to-many)
export const userInterests = mysqlTable("user_interests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  interestId: int("interest_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = typeof userInterests.$inferInsert;

// ─── Email Send Log ───────────────────────────────────────────────────────────
// Logs every email sent to a user — both transactional (magic link, welcome,
// certificate, enrollment confirmation) and campaign emails.
// This powers the per-user Communications tab in AdminUserDetailPage and the
// platform-wide Communications panel in MembersHub.
export const emailSendLog = mysqlTable("email_send_log", {
  id: int("id").autoincrement().primaryKey(),
  // Recipient — userId may be null for non-registered recipients (funnel leads)
  userId: int("user_id"),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  // Email type: 'magic_link' | 'welcome' | 'certificate' | 'enrollment' | 'campaign' | 'password_reset' | 'invite' | 'other'
  emailType: varchar("email_type", { length: 50 }).notNull().default("other"),
  subject: varchar("subject", { length: 500 }).notNull(),
  // Optional: link back to the campaign that triggered this send
  campaignId: int("campaign_id"),
  // Status: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked'
  status: mysqlEnum("status", ["sent", "failed", "bounced", "opened", "clicked"]).default("sent").notNull(),
  // Optional metadata (JSON): e.g. { courseId, courseTitle, certUrl }
  metadata: text("metadata"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EmailSendLog = typeof emailSendLog.$inferSelect;
export type InsertEmailSendLog = typeof emailSendLog.$inferInsert;

// ─── User Email Aliases ───────────────────────────────────────────────────────
// Allows a user to log in with multiple email addresses.
// The primary email is always stored on users.email; aliases are secondary.
// Magic links are ALWAYS sent to users.email (primary), never to an alias.
export const userEmailAliases = mysqlTable("user_email_aliases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  // Optional human label, e.g. "Work email" or "Old Thinkific account"
  label: varchar("label", { length: 100 }),
  // Source of the alias: 'admin_added' | 'account_merge'
  source: mysqlEnum("source", ["admin_added", "account_merge"]).default("admin_added").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UserEmailAlias = typeof userEmailAliases.$inferSelect;
export type InsertUserEmailAlias = typeof userEmailAliases.$inferInsert;

// ─── Instructor Course Permissions ───────────────────────────────────────────
// Tracks which courses an instructor can edit and whether they can self-publish
// or require platform admin approval before publishing.
export const instructorCoursePermissions = mysqlTable("instructor_course_permissions", {
  id: int("id").autoincrement().primaryKey(),
  instructorId: int("instructor_id").notNull(),   // users.id
  courseId: int("course_id").notNull(),            // lms_courses.id
  // true = instructor can publish directly; false = requires admin approval
  canSelfPublish: boolean("can_self_publish").default(false).notNull(),
  grantedByAdminId: int("granted_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorCoursePermission = typeof instructorCoursePermissions.$inferSelect;
export type InsertInstructorCoursePermission = typeof instructorCoursePermissions.$inferInsert;

// ─── Instructor Publish Requests ─────────────────────────────────────────────
// When an instructor without self-publish permission wants to publish a course,
// they submit a request here. Admins approve or reject it.
export const instructorPublishRequests = mysqlTable("instructor_publish_requests", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  note: text("note"),
  reviewNote: text("review_note"),
  reviewedByAdminId: int("reviewed_by_admin_id"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});
export type InstructorPublishRequest = typeof instructorPublishRequests.$inferSelect;
export type InsertInstructorPublishRequest = typeof instructorPublishRequests.$inferInsert;

// ─── Affiliate Course Overrides ───────────────────────────────────────────────
// Per-course affiliate settings: enable/disable affiliate tracking and set a
// course-specific commission % that overrides the affiliate's default rate.
export const affiliateCourseSettings = mysqlTable("affiliate_course_settings", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull().unique(),
  affiliateEnabled: boolean("affiliate_enabled").default(false).notNull(),
  // Override commission % for this course (null = use affiliate's default)
  commissionPctOverride: int("commission_pct_override"), // 0-100, null = use affiliate default
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AffiliateCourseSettings = typeof affiliateCourseSettings.$inferSelect;

// ─── Affiliate Links ──────────────────────────────────────────────────────────
// Unique tracking links per affiliate per course (or site-wide).
// Clicking a link sets a cookie; checkout attributes the sale to this link.
export const affiliateLinks = mysqlTable("affiliate_links", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull(),
  courseId: int("course_id"), // null = site-wide link
  slug: varchar("slug", { length: 128 }).notNull().unique(), // e.g. "john-echo-course"
  // Full destination URL (landing page or checkout). Generated on creation.
  destinationUrl: text("destination_url").notNull(),
  clicks: int("clicks").default(0).notNull(),
  conversions: int("conversions").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AffiliateLink = typeof affiliateLinks.$inferSelect;

// ─── Affiliate Click Events ───────────────────────────────────────────────────
// One row per unique click on an affiliate link (for analytics).
export const affiliateClicks = mysqlTable("affiliate_clicks", {
  id: int("id").autoincrement().primaryKey(),
  linkId: int("link_id").notNull(),
  affiliateId: int("affiliate_id").notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: varchar("user_agent", { length: 512 }),
  referrer: varchar("referrer", { length: 512 }),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
});

// ─── Payout Requests ─────────────────────────────────────────────────────────
// Affiliates and instructors request payouts here.
// Admins approve and mark as paid; payment is processed externally or via Stripe.
export const payoutRequests = mysqlTable("payout_requests", {
  id: int("id").autoincrement().primaryKey(),
  // Who is requesting: affiliate or instructor (via lmsAffiliates or users)
  requestorType: mysqlEnum("requestor_type", ["affiliate", "instructor"]).notNull(),
  affiliateId: int("affiliate_id"),   // set when requestorType = 'affiliate'
  instructorUserId: int("instructor_user_id"), // set when requestorType = 'instructor'
  amountCents: int("amount_cents").notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Payment method chosen by the requestor
  paymentMethod: mysqlEnum("payment_method", ["stripe", "paypal", "ach"]).notNull(),
  // Payment details (email for PayPal, account info for ACH, Stripe account ID)
  paymentDetails: text("payment_details"), // JSON: { paypal_email, ach_routing, ach_account, stripe_account_id }
  status: mysqlEnum("status", ["pending", "approved", "paid", "rejected"]).default("pending").notNull(),
  adminNote: text("admin_note"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  paidAt: timestamp("paid_at"),
  reviewedByAdminId: int("reviewed_by_admin_id"),
});
export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type InsertPayoutRequest = typeof payoutRequests.$inferInsert;

// ─── Instructor Revenue Share Config ─────────────────────────────────────────
// Per-instructor payment preferences for revenue share payouts.
export const instructorPayoutConfig = mysqlTable("instructor_payout_config", {
  id: int("id").autoincrement().primaryKey(),
  instructorUserId: int("instructor_user_id").notNull().unique(),
  preferredMethod: mysqlEnum("preferred_method", ["stripe", "paypal", "ach"]).notNull().default("paypal"),
  // JSON blob: { paypal_email, ach_routing, ach_account, stripe_account_id }
  paymentDetails: text("payment_details"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorPayoutConfig = typeof instructorPayoutConfig.$inferSelect;

// ─── Affiliate Course Access ──────────────────────────────────────────────────
// Controls which affiliates can promote which affiliate-enabled courses.
// Admins grant/revoke access per affiliate per course.
// If no row exists for a (affiliateId, courseId) pair, the affiliate cannot
// generate a link for that course even if the course has affiliateEnabled=true.
export const affiliateCourseAccess = mysqlTable("affiliate_course_access", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull(),
  courseId: int("course_id").notNull(),
  // Override commission % for this specific affiliate+course (null = use course override or affiliate default)
  commissionPctOverride: int("commission_pct_override"), // 0-100
  grantedByAdminId: int("granted_by_admin_id"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"), // null = active, set = revoked
});
export type AffiliateCourseAccess = typeof affiliateCourseAccess.$inferSelect;

// ─── Global Form Style/Branding Theme ────────────────────────────────────────
// Single-row settings table (id=1 always). Stores the default theme JSON that
// is pre-populated when a new form is created and can be loaded into any form's
// Style/Branding tab as a starting point.
export const globalFormTheme = mysqlTable("global_form_theme", {
  id: int("id").autoincrement().primaryKey(),
  themeSettings: text("theme_settings"), // JSON blob matching DEFAULT_THEME shape
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type GlobalFormTheme = typeof globalFormTheme.$inferSelect;

// ─── Google Sheets Integration (per-form) ────────────────────────────────────
// Stores per-form Google OAuth credentials and sheet connection details.
// The admin enters their own Google Client ID/Secret in the form's Integrations
// tab, authorises via OAuth, and submissions are appended to the chosen sheet.
export const googleFormIntegrations = mysqlTable("googleFormIntegrations", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull().unique(),          // FK → generalFormTemplates.id
  // OAuth app credentials entered by the form builder
  googleClientId: varchar("googleClientId", { length: 500 }),
  googleClientSecret: varchar("googleClientSecret", { length: 500 }),
  // Tokens obtained after OAuth consent
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: bigint("tokenExpiresAt", { mode: "number" }), // unix ms
  connectedEmail: varchar("connectedEmail", { length: 255 }),   // Google account email
  // Sheet configuration
  spreadsheetId: varchar("spreadsheetId", { length: 255 }),
  spreadsheetName: varchar("spreadsheetName", { length: 500 }),
  sheetTabName: varchar("sheetTabName", { length: 255 }).default("Form Responses"),
  headersInitialised: boolean("headersInitialised").default(false).notNull(),
  // Toggle
  isEnabled: boolean("isEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleFormIntegration = typeof googleFormIntegrations.$inferSelect;
export type InsertGoogleFormIntegration = typeof googleFormIntegrations.$inferInsert;

// ─── General Form Webhooks ─────────────────────────────────────────────────────
export const generalFormWebhooks = mysqlTable("generalFormWebhooks", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  webhookUrl: varchar("webhookUrl", { length: 1000 }),
  secret: varchar("secret", { length: 255 }),        // HMAC signing secret
  events: varchar("events", { length: 255 }).default("submission"), // "submission" | "submission,partial"
  isEnabled: boolean("isEnabled").default(false).notNull(),
  lastTriggeredAt: bigint("lastTriggeredAt", { mode: "number" }),
  lastStatus: varchar("lastStatus", { length: 50 }), // "success" | "error"
  lastStatusCode: int("lastStatusCode"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GeneralFormWebhook = typeof generalFormWebhooks.$inferSelect;
export type InsertGeneralFormWebhook = typeof generalFormWebhooks.$inferInsert;

// ─── Email Sender Profiles ─────────────────────────────────────────────────────
export const emailSenderProfiles = mysqlTable("emailSenderProfiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 300 }).notNull(),
  replyTo: varchar("replyTo", { length: 300 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailSenderProfile = typeof emailSenderProfiles.$inferSelect;
export type InsertEmailSenderProfile = typeof emailSenderProfiles.$inferInsert;

// ─── Email Lists ───────────────────────────────────────────────────────────────
export const emailLists = mysqlTable("emailLists", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  subscriberCount: int("subscriberCount").default(0).notNull(),
  webhookToken: varchar("webhookToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailList = typeof emailLists.$inferSelect;
export type InsertEmailList = typeof emailLists.$inferInsert;

// ─── Email List Subscribers ────────────────────────────────────────────────────
export const emailListSubscribers = mysqlTable("emailListSubscribers", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(),
  email: varchar("email", { length: 300 }).notNull(),
  name: varchar("name", { length: 300 }),
  userId: int("userId"),
  source: varchar("source", { length: 100 }),
  sourceId: varchar("sourceId", { length: 100 }),
  status: varchar("status", { length: 50 }).default("subscribed").notNull(),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribedAt"),
  metadata: text("metadata"),
});
export type EmailListSubscriber = typeof emailListSubscribers.$inferSelect;
export type InsertEmailListSubscriber = typeof emailListSubscribers.$inferInsert;

// ─── Lead Capture Widgets ──────────────────────────────────────────────────────
export const leadCaptureWidgets = mysqlTable("leadCaptureWidgets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  headline: varchar("headline", { length: 500 }).default("Stay in the loop").notNull(),
  subtext: varchar("subtext", { length: 1000 }),
  emailPlaceholder: varchar("emailPlaceholder", { length: 200 }).default("Enter your email").notNull(),
  namePlaceholder: varchar("namePlaceholder", { length: 200 }).default("Your name (optional)"),
  buttonText: varchar("buttonText", { length: 200 }).default("Subscribe").notNull(),
  buttonColor: varchar("buttonColor", { length: 20 }).default("#189aa1").notNull(),
  buttonTextColor: varchar("buttonTextColor", { length: 20 }).default("#ffffff").notNull(),
  bgColor: varchar("bgColor", { length: 20 }).default("#f0fbfc").notNull(),
  textColor: varchar("textColor", { length: 20 }).default("#0e1e2e").notNull(),
  borderRadius: int("borderRadius").default(8).notNull(),
  showNameField: boolean("showNameField").default(false).notNull(),
  listId: int("listId"),
  embedCode: text("embedCode"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeadCaptureWidget = typeof leadCaptureWidgets.$inferSelect;
export type InsertLeadCaptureWidget = typeof leadCaptureWidgets.$inferInsert;


// ─── Thinkific Community Sync ──────────────────────────────────────────────────

/**
 * Thinkific sync metadata on the communities table is added via migration SQL.
 * This table tracks per-community sync state for the Thinkific GraphQL import.
 */
export const thinkificCommunitySyncState = mysqlTable("thinkific_community_sync_state", {
  id: int("id").autoincrement().primaryKey(),
  /** Local community ID this sync state belongs to */
  communityId: int("community_id").notNull().unique(),
  /** Thinkific community ID (numeric string, e.g. "1200") */
  thinkificCommunityId: varchar("thinkific_community_id", { length: 64 }),
  /** Thinkific space ID — set when this community was created from a Thinkific space */
  thinkificSpaceId: varchar("thinkific_space_id", { length: 64 }),
  /** GraphQL cursor for the next page of posts to fetch */
  syncCursor: varchar("sync_cursor", { length: 255 }),
  /** Whether ongoing sync is enabled */
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
  /** Timestamp of last successful sync */
  lastSyncedAt: bigint("last_synced_at", { mode: "number" }),
  /** Total posts synced from Thinkific */
  totalPostsSynced: int("total_posts_synced").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ThinkificCommunitySyncState = typeof thinkificCommunitySyncState.$inferSelect;

/**
 * Links a community to one or more LMS courses for enrollment-gated access.
 * Users enrolled in any linked course automatically gain community access.
 */
export const communityCourseLinkages = mysqlTable("community_course_linkages", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  /** LMS course ID from the lmsCourses table */
  lmsCourseId: int("lms_course_id").notNull(),
  /** Thinkific course ID for cross-referencing enrollment data */
  thinkificCourseId: varchar("thinkific_course_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityCourseLinkage = typeof communityCourseLinkages.$inferSelect;

/**
 * Invite tokens for private/invite-only communities.
 */
export const communityInvites = mysqlTable("community_invites", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Email this invite was sent to (optional — null = generic link) */
  email: varchar("email", { length: 255 }),
  /** User who accepted the invite */
  usedByUserId: int("used_by_user_id"),
  usedAt: bigint("used_at", { mode: "number" }),
  /** Unix ms expiry — null = never expires */
  expiresAt: bigint("expires_at", { mode: "number" }),
  /** Max number of uses — null = unlimited */
  maxUses: int("max_uses"),
  useCount: int("use_count").default(0).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CommunityInvite = typeof communityInvites.$inferSelect;

/**
 * Tracks which Thinkific post IDs have been imported so we can upsert without duplicates.
 */
export const thinkificPostImports = mysqlTable("thinkific_post_imports", {
  id: int("id").autoincrement().primaryKey(),
  /** Thinkific post ID (string from GraphQL) */
  thinkificPostId: varchar("thinkific_post_id", { length: 64 }).notNull().unique(),
  /** Local community post ID */
  localPostId: int("local_post_id").notNull(),
  /** Local community ID */
  communityId: int("community_id").notNull(),
  /** Thinkific depth: 0=post, 1=reply, 2=reply-to-reply */
  depth: int("depth").default(0).notNull(),
  /** For replies: the local post ID of the parent */
  parentLocalPostId: int("parent_local_post_id"),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ThinkificPostImport = typeof thinkificPostImports.$inferSelect;

// ─── Instructor Analytics Permissions ────────────────────────────────────────
// Admin-controlled table that determines which analytics metrics each instructor
// can see in their Instructor Portal dashboard. Each row enables one metric for
// one instructor. If no rows exist for an instructor, they see no analytics.
// Metrics: enrollments, revenue, completion_rate, avg_progress, lesson_stats, monthly_chart
export const instructorAnalyticsPermissions = mysqlTable("instructor_analytics_permissions", {
  id: int("id").autoincrement().primaryKey(),
  // The user account ID of the instructor (users.id, role must include "instructor")
  instructorUserId: int("instructor_user_id").notNull(),
  // Which metric is enabled for this instructor
  metric: mysqlEnum("metric", [
    "enrollments",
    "revenue",
    "completion_rate",
    "avg_progress",
    "lesson_stats",
    "monthly_chart",
  ]).notNull(),
  // Optionally restrict to a specific course (null = applies to all their courses)
  courseId: int("course_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorAnalyticsPermission = typeof instructorAnalyticsPermissions.$inferSelect;
export type InsertInstructorAnalyticsPermission = typeof instructorAnalyticsPermissions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// CAREER NETWORK MODULE
// ─────────────────────────────────────────────────────────────────────────────

/** Job categories / tags */
export const jobCategories = mysqlTable("job_categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 20 }).default("#0d9488"),
  icon: varchar("icon", { length: 50 }),
  description: text("description"),
  sortOrder: int("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type JobCategory = typeof jobCategories.$inferSelect;
export type InsertJobCategory = typeof jobCategories.$inferInsert;

/** Keyword-based auto-categorization rules */
export const jobCategoryRules = mysqlTable("job_category_rules", {
  id: int("id").primaryKey().autoincrement(),
  categoryId: int("category_id").notNull(),
  keywords: text("keywords").notNull(), // JSON array of keyword strings
  matchField: varchar("match_field", { length: 20 }).default("both").notNull(), // "title" | "description" | "both"
  priority: int("priority").default(0).notNull(), // higher = checked first
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type JobCategoryRule = typeof jobCategoryRules.$inferSelect;
export type InsertJobCategoryRule = typeof jobCategoryRules.$inferInsert;

/** RSS feeds and web URLs to scrape for job postings */
export const jobSources = mysqlTable("job_sources", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["rss", "url"]).notNull().default("rss"),
  url: text("url").notNull(),
  categoryId: int("category_id"),
  isActive: boolean("is_active").default(true),
  lastFetchedAt: timestamp("last_fetched_at"),
  fetchIntervalHours: int("fetch_interval_hours").default(6),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  totalFetched: int("total_fetched").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type JobSource = typeof jobSources.$inferSelect;
export type InsertJobSource = typeof jobSources.$inferInsert;

/** Individual job postings (scraped or internal) */
export const jobs = mysqlTable("jobs", {
  id: int("id").primaryKey().autoincrement(),
  sourceId: int("source_id"),
  externalId: varchar("external_id", { length: 500 }),
  title: varchar("title", { length: 500 }).notNull(),
  company: varchar("company", { length: 300 }).notNull(),
  companyLogoUrl: text("company_logo_url"),
  location: varchar("location", { length: 300 }),
  locationType: mysqlEnum("location_type", ["remote", "onsite", "hybrid"]).default("onsite"),
  employmentType: mysqlEnum("employment_type", ["full_time", "part_time", "contract", "per_diem", "travel", "prn"]).default("full_time"),
  description: longtext("description"),
  descriptionHtml: longtext("description_html"),
  applyUrl: text("apply_url"),
  applyEmail: varchar("apply_email", { length: 300 }),
  salary: varchar("salary", { length: 200 }),
  salaryMin: int("salary_min"),
  salaryMax: int("salary_max"),
  salaryCurrency: varchar("salary_currency", { length: 10 }).default("USD"),
  salaryPeriod: mysqlEnum("salary_period", ["hourly", "daily", "weekly", "annual"]).default("annual"),
  categoryId: int("category_id"),
  tags: text("tags"),
  status: mysqlEnum("status", ["active", "expired", "draft", "closed"]).default("active"),
  isInternal: boolean("is_internal").default(false),
  isFeatured: boolean("is_featured").default(false),
  isHidden: boolean("is_hidden").default(false).notNull(), // admin-hidden from public listing
  blockedFromSource: boolean("blocked_from_source").default(false).notNull(), // block re-import of this externalId
  postedById: int("posted_by_id"),
  employerId: int("employer_id"), // FK to employer_profiles.id — null for scraped jobs
  expiresAt: timestamp("expires_at"),
  publishedAt: timestamp("published_at").defaultNow(),
  viewCount: int("view_count").default(0),
  applyCount: int("apply_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/** Candidate profiles */
export const candidateProfiles = mysqlTable("candidate_profiles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().unique(),
  headline: varchar("headline", { length: 300 }),
  bio: text("bio"),
  location: varchar("location", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  yearsExperience: int("years_experience"),
  specialties: text("specialties"),
  certifications: text("certifications"),
  availability: mysqlEnum("availability", ["immediately", "2_weeks", "1_month", "3_months", "not_looking"]).default("not_looking"),
  desiredSalary: varchar("desired_salary", { length: 100 }),
  desiredLocationType: mysqlEnum("desired_location_type", ["remote", "onsite", "hybrid", "any"]).default("any"),
  isPublic: boolean("is_public").default(false),
  openToTravel: boolean("open_to_travel").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export type InsertCandidateProfile = typeof candidateProfiles.$inferInsert;

/** Resumes attached to candidate profiles */
export const resumes = mysqlTable("resumes", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 500 }),
  content: longtext("content"),
  contentJson: longtext("content_json"),
  isAiGenerated: boolean("is_ai_generated").default(false),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = typeof resumes.$inferInsert;

/** Job applications (for internal postings) */
export const jobApplications = mysqlTable("job_applications", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("job_id").notNull(),
  userId: int("user_id").notNull(),
  resumeId: int("resume_id"),
  coverLetter: text("cover_letter"),
  status: mysqlEnum("status", ["submitted", "reviewing", "interview", "offer", "rejected", "withdrawn"]).default("submitted"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = typeof jobApplications.$inferInsert;

/** Career Network page settings */
export const careerNetworkSettings = mysqlTable("career_network_settings", {
  id: int("id").primaryKey().autoincrement(),
  heroTitle: varchar("hero_title", { length: 300 }).default("Ultrasound Career Network"),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  featuredBannerHtml: longtext("featured_banner_html"),
  seoTitle: varchar("seo_title", { length: 300 }),
  seoDescription: text("seo_description"),
  pageIntro: longtext("page_intro"),
  rightSideHtml: longtext("right_side_html"),
  bottomHtml: longtext("bottom_html"),
  headerBadgeHtml: text("header_badge_html"),
  showCandidateProfiles: boolean("show_candidate_profiles").default(true),
  allowGuestApply: boolean("allow_guest_apply").default(false),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CareerNetworkSettings = typeof careerNetworkSettings.$inferSelect;

/** Employer profiles — companies that post jobs and browse candidates */
export const employerProfiles = mysqlTable("employer_profiles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  companyLogoUrl: text("company_logo_url"),
  website: varchar("website", { length: 500 }),
  description: longtext("description"),
  location: varchar("location", { length: 200 }),
  companySize: varchar("company_size", { length: 50 }), // e.g. "1-10", "11-50", "51-200", "201-500", "500+"
  industry: varchar("industry", { length: 100 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmployerProfile = typeof employerProfiles.$inferSelect;
export type InsertEmployerProfile = typeof employerProfiles.$inferInsert;

/** Employer subscriptions — tracks plan (job_post credit or unlimited monthly) */
export const employerSubscriptions = mysqlTable("employer_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  employerId: int("employer_id").notNull(),
  plan: varchar("plan", { length: 50 }).notNull(), // "job_post" | "unlimited"
  status: varchar("status", { length: 50 }).notNull().default("active"), // "active" | "cancelled" | "expired"
  jobCredits: int("job_credits").default(0), // for job_post plan: number of remaining posts
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmployerSubscription = typeof employerSubscriptions.$inferSelect;
export type InsertEmployerSubscription = typeof employerSubscriptions.$inferInsert;

// ─── Pending Fulfillments (retry queue for failed webhook fulfillments) ────────
// When a Stripe webhook fires and the fulfillment logic fails (DB error, timeout, etc.),
// the payment is recorded here so a background job can retry. On success the status
// becomes "completed"; after max retries (3) with exponential backoff, the status
// becomes "failed" so an admin can retry. This is the safety net that ensures
// no student ever loses access due to a transient DB error or webhook failure.
export const pendingFulfillments = mysqlTable("pending_fulfillments", {
  id: int("id").primaryKey().autoincrement(),
  // Stripe payment intent ID — unique identifier for this payment
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
  // Resolved user ID (may be null if auto-account creation failed)
  userId: int("user_id"),
  // Buyer email — always present even if userId is null
  email: varchar("email", { length: 320 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  // Product info
  productName: varchar("product_name", { length: 500 }).notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(), // course | download | physical | membership | bundle | other
  productId: int("product_id"), // download/physical/bundle product ID
  courseId: int("course_id"), // LMS course to enroll in
  fulfillmentBrand: varchar("fulfillment_brand", { length: 20 }), // aaus | iheartecho | both
  additionalAccessJson: text("additional_access_json"), // JSON array of bonus access items
  // Amount paid (stored in dollars, NOT cents)
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // Fulfillment status
  status: mysqlEnum("status", ["pending", "completed", "failed"]).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  // Fulfillment result notes (what was actually granted)
  fulfillmentNotes: text("fulfillment_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PendingFulfillment = typeof pendingFulfillments.$inferSelect;
export type InsertPendingFulfillment = typeof pendingFulfillments.$inferInsert;

// ─── Default Team Pricing Tiers ───────────────────────────────────────────
/** Volume discount tiers for a course — "X+ seats = Y% off primary price".
 *  Each tier generates its own Stripe Payment Link (per-seat price).
 *  These are defaults that can be overridden by content-block group pricing. */
export const lmsDefaultTeamTiers = mysqlTable("lms_default_team_tiers", {
  id: int("id").autoincrement().primaryKey(),
  /** The course/quiz/cohort/download this tier applies to */
  courseId: int("course_id").notNull(),
  /** Minimum number of seats to qualify for this tier */
  minSeats: int("min_seats").notNull().default(2),
  /** Discount percentage off the primary course price (0–100) */
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  /** Cached Stripe Price ID for the per-seat price at this tier */
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  /** Cached Stripe Payment Link ID for this tier */
  stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 255 }),
  /** Cached Stripe Payment Link URL for quick copy */
  stripePaymentLinkUrl: varchar("stripe_payment_link_url", { length: 1024 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsDefaultTeamTier = typeof lmsDefaultTeamTiers.$inferSelect;
export type InsertLmsDefaultTeamTier = typeof lmsDefaultTeamTiers.$inferInsert;

// ─── Team Managers ────────────────────────────────────────────────────────
/**
 * Up to 5 managers per team (lmsGroups row).
 * Managers do NOT consume a seat by default; hasSeat=true means they also
 * occupy one of the group's paid seats and get course access like a regular member.
 * Managers can: assign/revoke seats, resend invites, view team analytics.
 */
export const lmsGroupManagers = mysqlTable("lms_group_managers", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  /** Resolved user ID once the manager accepts the invite and logs in */
  userId: int("user_id"),
  /** Email address the invite was sent to */
  email: varchar("email", { length: 320 }).notNull(),
  /** Display name (optional, filled from user profile on accept) */
  managerName: varchar("manager_name", { length: 255 }),
  /** Whether this manager also occupies a paid seat in the group */
  hasSeat: boolean("has_seat").default(false).notNull(),
  /** pending = invite sent, active = accepted, revoked = removed */
  status: mysqlEnum("status", ["pending", "active", "revoked"]).default("pending").notNull(),
  /** One-time token for the invite email */
  inviteToken: varchar("invite_token", { length: 128 }),
  acceptedAt: timestamp("accepted_at"),
  lastInviteSentAt: timestamp("last_invite_sent_at"),
  /** Admin user who added this manager */
  addedByUserId: int("added_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroupManager = typeof lmsGroupManagers.$inferSelect;
export type InsertLmsGroupManager = typeof lmsGroupManagers.$inferInsert;

// ─── SDMS CME Credit Integration ─────────────────────────────────────────────

/** Eligible activity types for SDMS CME credit */
export const sdmsCmeActivityTypeEnum = [
  "course",
  "cohort",
  "webinar",
  "replay_course",
  "live_event",
  "standalone_cme",
] as const;
export type SdmsCmeActivityType = (typeof sdmsCmeActivityTypeEnum)[number];

export const sdmsCmeCreditCategoryEnum = [
  "AB_CME",
  "AE_CME",
  "BR_CME",
  "FE_CME",
  "MSK_CME",
  "OB_CME",
  "OT_CME",
  "PE_CME",
  "PS_CME",
  "SPI_CME",
  "VT_CME",
] as const;
export type SdmsCmeCreditCategory = (typeof sdmsCmeCreditCategoryEnum)[number];

export const sdmsCmeFormKindEnum = [
  "post_test",
  "evaluation",
  "combined",
  "attestation",
] as const;
export type SdmsCmeFormKind = (typeof sdmsCmeFormKindEnum)[number];

/** Per-activity SDMS CME configuration (one row per activity) */
export const sdmsCmeConfigs = mysqlTable(
  "sdmsCmeConfigs",
  {
    id: int("id").autoincrement().primaryKey(),
    activityType: mysqlEnum("activityType", sdmsCmeActivityTypeEnum).notNull(),
    activityId: int("activityId").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    approvalId: varchar("approvalId", { length: 64 }),
    activityTitle: varchar("activityTitle", { length: 500 }),
    activityStartDate: varchar("activityStartDate", { length: 32 }),
    activityEndDate: varchar("activityEndDate", { length: 32 }),
    cmeCreditAmount: varchar("cmeCreditAmount", { length: 16 }).default("0.00"),
    cmeCreditCategory: mysqlEnum("cmeCreditCategory", sdmsCmeCreditCategoryEnum).default("SPI_CME"),
    speakerStatusDefault: varchar("speakerStatusDefault", { length: 1 }).default("N"),
    apiUsername: varchar("apiUsername", { length: 255 }),
    /** AES-256-GCM encrypted SDMS API password — never returned to client */
    apiPasswordEncrypted: text("apiPasswordEncrypted"),
    formTemplateId: int("formTemplateId"),
    formKind: mysqlEnum("formKind", sdmsCmeFormKindEnum).default("combined"),
    passingScorePercent: varchar("passingScorePercent", { length: 8 }).default("70"),
    submissionDeadlineDays: varchar("submissionDeadlineDays", { length: 8 }).default("90"),
    resubmissionEnabled: boolean("resubmissionEnabled").default(true).notNull(),
    /** JSON field mapping: SDMS field name → form item id (string keys) */
    formFieldMapping: longtext("formFieldMapping"),
    /** Page builder blocks for learner-facing CME module */
    moduleBlocks: longtext("moduleBlocks"),
    cmeSectionId: int("cmeSectionId"),
    cmeLessonId: int("cmeLessonId"),
    cmeInstructions: longtext("cmeInstructions"),
    sdmsBaseUrl: varchar("sdmsBaseUrl", { length: 500 }),
    createdByUserId: int("createdByUserId"),
    updatedByUserId: int("updatedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    uniqActivity: uniqueIndex("idx_sdms_cme_config_activity").on(t.activityType, t.activityId),
  })
);
export type SdmsCmeConfig = typeof sdmsCmeConfigs.$inferSelect;
export type InsertSdmsCmeConfig = typeof sdmsCmeConfigs.$inferInsert;

/** Learner CME completion + SDMS submission state */
export const sdmsCmeCompletions = mysqlTable("sdmsCmeCompletions", {
  id: int("id").autoincrement().primaryKey(),
  configId: int("configId").notNull(),
  userId: int("userId").notNull(),
  activityType: mysqlEnum("activityType", sdmsCmeActivityTypeEnum).notNull(),
  activityId: int("activityId").notNull(),
  formSubmissionId: int("formSubmissionId"),
  formScore: varchar("formScore", { length: 16 }),
  formMaxScore: varchar("formMaxScore", { length: 16 }),
  formScorePercent: varchar("formScorePercent", { length: 16 }),
  passStatus: mysqlEnum("passStatus", ["pending", "passed", "failed", "override_pass", "override_fail"]).default("pending").notNull(),
  manualOverrideNotes: text("manualOverrideNotes"),
  manualOverrideByUserId: int("manualOverrideByUserId"),
  dateCompleted: varchar("dateCompleted", { length: 32 }),
  /** Captured learner SDMS payload fields (all strings) */
  learnerPayload: longtext("learnerPayload"),
  sdmsSubmissionStatus: mysqlEnum("sdmsSubmissionStatus", [
    "not_submitted",
    "pending",
    "success",
    "failed",
    "timeout",
  ]).default("not_submitted").notNull(),
  sdmsResponseCode: varchar("sdmsResponseCode", { length: 16 }),
  sdmsResponseMessage: text("sdmsResponseMessage"),
  sdmsResponseRaw: longtext("sdmsResponseRaw"),
  certificateUrl: text("certificateUrl"),
  certificateId: varchar("certificateId", { length: 128 }),
  lastSubmissionAttemptAt: timestamp("lastSubmissionAttemptAt"),
  retryCount: int("retryCount").default(0).notNull(),
  lastSubmittedBy: mysqlEnum("lastSubmittedBy", ["system", "admin"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SdmsCmeCompletion = typeof sdmsCmeCompletions.$inferSelect;
export type InsertSdmsCmeCompletion = typeof sdmsCmeCompletions.$inferInsert;

/** Full audit log for every SDMS API attempt */
export const sdmsCmeSubmissionLogs = mysqlTable("sdmsCmeSubmissionLogs", {
  id: int("id").autoincrement().primaryKey(),
  completionId: int("completionId"),
  userId: int("userId").notNull(),
  activityType: mysqlEnum("activityType", sdmsCmeActivityTypeEnum).notNull(),
  activityId: int("activityId").notNull(),
  approvalId: varchar("approvalId", { length: 64 }),
  payloadSent: longtext("payloadSent").notNull(),
  apiResponse: longtext("apiResponse"),
  responseCode: varchar("responseCode", { length: 16 }),
  status: mysqlEnum("status", ["success", "failed", "timeout", "simulated_success", "simulated_failure", "validation_error"]).notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  triggeredBy: mysqlEnum("triggeredBy", ["system", "admin"]).default("system").notNull(),
  errorMessage: text("errorMessage"),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SdmsCmeSubmissionLog = typeof sdmsCmeSubmissionLogs.$inferSelect;
export type InsertSdmsCmeSubmissionLog = typeof sdmsCmeSubmissionLogs.$inferInsert;

// ─── Marketing Site (staging replica of public website) ─────────────────────

export const marketingSiteSettings = mysqlTable("marketingSiteSettings", {
  id: int("id").autoincrement().primaryKey(),
  siteKey: varchar("siteKey", { length: 64 }).notNull().unique(),
  hostDomain: varchar("hostDomain", { length: 255 }).notNull(),
  sourceDomain: varchar("sourceDomain", { length: 255 }).notNull().default("www.allaboutultrasound.com"),
  siteName: varchar("siteName", { length: 255 }).notNull().default("All About Ultrasound"),
  isStaging: boolean("isStaging").default(true).notNull(),
  navJson: longtext("navJson"),
  footerJson: longtext("footerJson"),
  headerBlocks: longtext("headerBlocks"),
  footerBlocks: longtext("footerBlocks"),
  faviconUrl: varchar("faviconUrl", { length: 512 }),
  globalCss: longtext("globalCss"),
  stagingBannerText: varchar("stagingBannerText", { length: 500 }).default("Staging Preview — Not Live"),
  lastImportAt: timestamp("lastImportAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingSiteSetting = typeof marketingSiteSettings.$inferSelect;

export const marketingSitePages = mysqlTable("marketingSitePages", {
  id: int("id").autoincrement().primaryKey(),
  siteKey: varchar("siteKey", { length: 64 }).notNull().default("aau-staging"),
  path: varchar("path", { length: 500 }).notNull(),
  title: varchar("title", { length: 500 }),
  pageType: mysqlEnum("pageType", ["page", "blog_post", "redirect"]).default("page").notNull(),
  blocks: longtext("blocks"),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  seoImage: varchar("seoImage", { length: 512 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  redirectUrl: varchar("redirectUrl", { length: 1000 }),
  isPublished: boolean("isPublished").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  importStatus: mysqlEnum("importStatus", ["pending", "imported", "failed"]).default("pending").notNull(),
  importError: text("importError"),
  linkAuditJson: longtext("linkAuditJson"),
  importedAt: timestamp("importedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MarketingSitePage = typeof marketingSitePages.$inferSelect;
export type InsertMarketingSitePage = typeof marketingSitePages.$inferInsert;

// ─── Cohort Recording Progress ────────────────────────────────────────────────
/** One row per user per recording — tracks watch progress for cohort replays */
export const lmsCohortRecordingProgress = mysqlTable("lms_cohort_recording_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  recordingId: int("recording_id").notNull(),
  courseId: int("course_id").notNull(),
  positionSec: int("position_sec").default(0).notNull(),
  durationSec: int("duration_sec").default(0).notNull(),
  percentWatched: int("percent_watched").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  playCount: int("play_count").default(0).notNull(),
  firstPlayedAt: timestamp("first_played_at"),
  lastPlayedAt: timestamp("last_played_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortRecordingProgress = typeof lmsCohortRecordingProgress.$inferSelect;
export type InsertLmsCohortRecordingProgress = typeof lmsCohortRecordingProgress.$inferInsert;

// ─── Community Workflow Rules ─────────────────────────────────────────────────
/**
 * Admin-configurable rules that automatically add users to a community when
 * a trigger event occurs (e.g. course purchase, webinar registration, signup).
 */
export const communityWorkflowRules = mysqlTable("community_workflow_rules", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("community_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  triggerType: mysqlEnum("trigger_type", [
    "any_signup",
    "any_purchase",
    "course_enrollment",
    "webinar_registration",
    "download_purchase",
    "bundle_purchase",
    "brand_membership",
    "membership_subscription",
  ]).notNull(),
  entityId: int("entity_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CommunityWorkflowRule = typeof communityWorkflowRules.$inferSelect;
export type InsertCommunityWorkflowRule = typeof communityWorkflowRules.$inferInsert;

// ── Embeddable Widgets ──────────────────────────────────────────────────────
export const embedWidgets = mysqlTable("embed_widgets", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  subtitle: varchar("subtitle", { length: 500 }),
  layout: mysqlEnum("layout", ["grid", "carousel", "list"]).default("grid").notNull(),
  theme: mysqlEnum("theme", ["light", "dark", "brand"]).default("light").notNull(),
  cardStyle: mysqlEnum("card_style", ["standard", "compact", "minimal"]).default("standard").notNull(),
  showPrice: boolean("show_price").default(true).notNull(),
  showEnrollButton: boolean("show_enroll_button").default(true).notNull(),
  showCourseDetails: boolean("show_course_details").default(false).notNull(),
  buttonText: varchar("button_text", { length: 100 }).default("Enroll Now"),
  buttonUrl: varchar("button_url", { length: 500 }),
  maxCards: int("max_cards").default(6).notNull(),
  items: longtext("items").notNull().default("[]"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmbedWidget = typeof embedWidgets.$inferSelect;
export type InsertEmbedWidget = typeof embedWidgets.$inferInsert;

// ─── Global Posting Aliases ──────────────────────────────────────────────────
// Allows admins to post community posts and cohort discussion messages as a
// named alias (e.g., "All About Ultrasound Support") instead of their personal
// account. Aliases are global — not scoped to a specific community or course.
export const postingAliases = mysqlTable("posting_aliases", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PostingAlias = typeof postingAliases.$inferSelect;
export type InsertPostingAlias = typeof postingAliases.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// Workshop Product Type
// A Workshop is a course-like product with optional curriculum, physical-product
// style landing page, and cohort-style scheduled instances.  Each instance can
// be individually made available for purchase on the sales page; it falls off
// automatically once its salesCloseDate passes (or, if not set, once the
// workshop start date has passed).
// ─────────────────────────────────────────────────────────────────────────────

export const workshops = mysqlTable("workshops", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  coverImageUrl: text("cover_image_url"),
  thumbnailUrl: text("thumbnail_url"),

  // Status / visibility
  status: mysqlEnum("status", ["draft", "public", "hidden", "private", "archived"]).default("draft").notNull(),

  // Brand
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),

  // Pricing (per-instance can override)
  price: int("price").default(0).notNull(),           // cents — default price
  compareAtPrice: int("compare_at_price"),             // cents — crossed-out price
  isFree: boolean("is_free").default(false).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  pricingType: mysqlEnum("pricing_type", ["free", "one_time"]).default("one_time").notNull(),

  // Curriculum toggle — when false, no curriculum tab is shown
  curriculumEnabled: boolean("curriculum_enabled").default(true).notNull(),

  // Landing page blocks (page builder JSON)
  landingBlocks: longtext("landing_blocks"),
  landingHeadline: varchar("landing_headline", { length: 500 }),
  landingBody: longtext("landing_body"),

  // SEO
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),

  // After-purchase settings
  customThankYouEnabled: boolean("custom_thank_you_enabled").default(false).notNull(),
  customThankYouBlocks: longtext("custom_thank_you_blocks"),
  postPurchaseRedirectUrl: varchar("post_purchase_redirect_url", { length: 1024 }),
  welcomeEmailEnabled: boolean("welcome_email_enabled").default(true).notNull(),
  welcomeEmailSubject: varchar("welcome_email_subject", { length: 500 }),
  welcomeEmailBody: longtext("welcome_email_body"),

  // Hide additional pricing options on the landing page
  hidePricingOptions: boolean("hide_pricing_options").default(false).notNull(),

  // Color scheme (mirrors lmsCourses)
  primaryColor: varchar("primary_color", { length: 20 }).default("#179ca3"),
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),

  // Education Library
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  libraryOrder: int("library_order").default(0).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),

  // Per-product publish domain override
  publishDomain: varchar("publish_domain", { length: 255 }),

  // After-purchase workflow (JSON array of workflow action objects)
  afterPurchaseWorkflow: longtext("after_purchase_workflow"),
  // Checkout page builder config (JSON)
  checkoutPageConfig: longtext("checkout_page_config"),

  // Waiting list settings
  waitlistEnabled: boolean("waitlist_enabled").default(false).notNull(),
  waitlistHeading: varchar("waitlist_heading", { length: 500 }),
  waitlistBody: longtext("waitlist_body"),
  waitlistCtaLabel: varchar("waitlist_cta_label", { length: 255 }),
  waitlistCtaUrl: varchar("waitlist_cta_url", { length: 2048 }),
  waitlistRedirectUrl: varchar("waitlist_redirect_url", { length: 2048 }),
  waitlistContentBlocks: longtext("waitlist_content_blocks"),
  waitlistSuccessMessage: longtext("waitlist_success_message"),

  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Workshop = typeof workshops.$inferSelect;
export type InsertWorkshop = typeof workshops.$inferInsert;

export const workshopWaitlistEntries = mysqlTable("workshop_waitlist_entries", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: int("workshop_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type WorkshopWaitlistEntry = typeof workshopWaitlistEntries.$inferSelect;

// ─── Workshop Instances ───────────────────────────────────────────────────────
// Each instance represents one scheduled run of the workshop (a specific date,
// location, and optionally a different price).
export const workshopInstances = mysqlTable("workshop_instances", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: int("workshop_id").notNull(),

  title: varchar("title", { length: 255 }).notNull(),          // e.g. "Dallas — June 2025"
  description: text("description"),

  // Schedule
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York").notNull(),
  durationMinutes: int("duration_minutes").default(480).notNull(), // default 8h

  // Location
  locationType: mysqlEnum("location_type", ["in_person", "virtual", "hybrid"]).default("in_person").notNull(),
  venueName: varchar("venue_name", { length: 255 }),
  venueAddress: text("venue_address"),
  venueCity: varchar("venue_city", { length: 100 }),
  venueState: varchar("venue_state", { length: 100 }),
  venueCountry: varchar("venue_country", { length: 100 }),
  meetingUrl: text("meeting_url"),                              // for virtual/hybrid

  // Capacity
  capacity: int("capacity"),                                    // null = unlimited
  enrolledCount: int("enrolled_count").default(0).notNull(),

  // Pricing override (null = use workshop default)
  price: int("price"),                                          // cents
  compareAtPrice: int("compare_at_price"),                      // cents
  stripePriceId: varchar("stripe_price_id", { length: 255 }),

  // Enrollment window
  // enrollmentCloseDate: if set, new enrollments are blocked after this date
  enrollmentCloseDate: timestamp("enrollment_close_date"),

  // Sales window
  // availableForPurchase: admin manually enables this instance on the sales page
  availableForPurchase: boolean("available_for_purchase").default(false).notNull(),
  // salesCloseDate: if set, instance drops off sales page at this time
  // if null, auto-closes when startDate passes
  salesCloseDate: timestamp("sales_close_date"),
  // salesOpenDate: optional — instance won't appear before this date
  salesOpenDate: timestamp("sales_open_date"),

  // Status
  status: mysqlEnum("status", ["draft", "published", "cancelled", "completed"]).default("draft").notNull(),

  // Stripe product/price for this specific instance
  stripeProductId: varchar("stripe_product_id", { length: 255 }),

    // Rich-text content for this instance (agenda, location notes, instructor bio, etc.)
  instanceContent: longtext("instance_content"),
  // Full page builder blocks for this specific instance's detail page
  landingBlocks: longtext("landing_blocks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WorkshopInstance = typeof workshopInstances.$inferSelect;
export type InsertWorkshopInstance = typeof workshopInstances.$inferInsert;

// ─── Workshop Resources ───────────────────────────────────────────────────────
// Downloadable/linkable resources shown on the Resources tab (per-workshop or
// per-instance).
export const workshopResources = mysqlTable("workshop_resources", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: int("workshop_id").notNull(),
  // null = shared across all instances; set = specific instance only
  instanceId: int("instance_id"),

  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cardImageUrl: text("card_image_url"),
  actionType: mysqlEnum("action_type", ["link", "download"]).default("link").notNull(),
  linkUrl: text("link_url"),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 512 }),
  fileName: varchar("file_name", { length: 512 }),
  status: mysqlEnum("status", ["draft", "published"]).default("published").notNull(),
  position: int("position").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WorkshopResource = typeof workshopResources.$inferSelect;
export type InsertWorkshopResource = typeof workshopResources.$inferInsert;

// ─── Workshop Enrollments ─────────────────────────────────────────────────────
// Tracks which users are enrolled in which workshop instance.
export const workshopEnrollments = mysqlTable("workshop_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: int("workshop_id").notNull(),
  instanceId: int("instance_id").notNull(),
  userId: int("user_id").notNull(),

  // Payment tracking
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  amountPaid: int("amount_paid").default(0).notNull(),          // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),

  // Status
  status: mysqlEnum("status", ["active", "cancelled", "refunded"]).default("active").notNull(),

  // Access
  accessGrantedAt: timestamp("access_granted_at").defaultNow().notNull(),
  accessExpiresAt: timestamp("access_expires_at"),               // null = no expiry

  // Attendance tracking
  attended: boolean("attended").default(false).notNull(),
  attendedAt: timestamp("attended_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WorkshopEnrollment = typeof workshopEnrollments.$inferSelect;
export type InsertWorkshopEnrollment = typeof workshopEnrollments.$inferInsert;

// ─── Workshop Pricing Options ─────────────────────────────────────────────────
// Multiple named pricing tiers per workshop (mirrors lmsPricingOptions).
export const workshopPricingOptions = mysqlTable("workshop_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  workshopId: int("workshop_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sublabel: varchar("sublabel", { length: 500 }),
  pricingType: mysqlEnum("pricing_type", ["one_time", "free"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(),                     // cents
  compareAtPrice: int("compare_at_price"),                      // cents
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  ctaLabel: varchar("cta_label", { length: 100 }),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WorkshopPricingOption = typeof workshopPricingOptions.$inferSelect;

// ─── Product Add-On Items ─────────────────────────────────────────────────────
// Universal "add-on" system: when a user purchases any product (source), they
// automatically receive access to one or more additional items (target).
// pricingOptionId IS NULL  → grant for ALL pricing options of this source product
// pricingOptionId IS NOT NULL → grant ONLY when that specific pricing option is selected
export const productAddonItems = mysqlTable("product_addon_items", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: varchar("source_type", { length: 30 })
    .$type<"course" | "download" | "webinar" | "bundle" | "membership" | "physical" | "workshop" | "cohort" | "quiz">()
    .notNull(),
  sourceId: int("source_id").notNull(),
  // null = applies to all pricing options; set to a pricing option ID to restrict
  pricingOptionId: int("pricing_option_id"),
  targetType: varchar("target_type", { length: 30 })
    .$type<"course" | "download" | "webinar" | "bundle" | "membership" | "physical" | "workshop" | "cohort" | "quiz">()
    .notNull(),
  targetId: int("target_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ProductAddonItem = typeof productAddonItems.$inferSelect;
export type InsertProductAddonItem = typeof productAddonItems.$inferInsert;

// ─── Standalone Quizzes ───────────────────────────────────────────────────────
// Quiz Creator tool: standalone quizzes and mock exams that wrap the question bank.
// quiz = immediate feedback per question; mock_exam = no feedback until submitted.

export const standaloneQuizzes = mysqlTable("standalone_quizzes", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: longtext("description"),
  type: mysqlEnum("type", ["quiz", "mock_exam"]).default("quiz").notNull(),
  passingScore: int("passing_score").default(70).notNull(),
  timeLimitMinutes: int("time_limit_minutes"),
  shuffleQuestions: boolean("shuffle_questions").default(false).notNull(),
  shuffleAnswers: boolean("shuffle_answers").default(false).notNull(),
  showResultsImmediately: boolean("show_results_immediately").default(true).notNull(),
  showResultsAfterDate: timestamp("show_results_after_date"),
  showExplanations: boolean("show_explanations").default(true).notNull(),
  allowRetakes: boolean("allow_retakes").default(true).notNull(),
  maxAttempts: int("max_attempts"),
  accessType: mysqlEnum("access_type", ["public", "enrolled", "members_only"]).default("enrolled").notNull(),
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  coverImageUrl: text("cover_image_url"),
  instructions: longtext("instructions"),
  sharedInSonoQuiz: boolean("shared_in_sono_quiz").default(false).notNull(),
  // Result visibility toggles
  showGroupNames: boolean("show_group_names").default(true).notNull(),
  showPerQuestionResult: boolean("show_per_question_result").default(true).notNull(),
  showOnlyPercentage: boolean("show_only_percentage").default(false).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type StandaloneQuiz = typeof standaloneQuizzes.$inferSelect;
export type InsertStandaloneQuiz = typeof standaloneQuizzes.$inferInsert;

// Junction table: which question_bank items are in a standalone quiz
export const standaloneQuizQuestions = mysqlTable("standalone_quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  questionBankId: int("question_bank_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  points: int("points").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type StandaloneQuizQuestion = typeof standaloneQuizQuestions.$inferSelect;

// Attempt: one per user per quiz attempt
export const standaloneQuizAttempts = mysqlTable("standalone_quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  userId: int("user_id").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  score: decimal("score", { precision: 5, scale: 2 }),
  passed: boolean("passed"),
  totalQuestions: int("total_questions").default(0).notNull(),
  correctAnswers: int("correct_answers").default(0).notNull(),
  totalPoints: int("total_points").default(0).notNull(),
  earnedPoints: int("earned_points").default(0).notNull(),
  timeSpentSeconds: int("time_spent_seconds"),
  attemptNumber: int("attempt_number").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type StandaloneQuizAttempt = typeof standaloneQuizAttempts.$inferSelect;

// Per-question answers within an attempt
export const standaloneQuizAttemptAnswers = mysqlTable("standalone_quiz_attempt_answers", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attempt_id").notNull(),
  questionId: int("question_id").notNull(), // FK → question_bank.id
  givenAnswer: longtext("given_answer"),    // JSON string
  isCorrect: boolean("is_correct"),
  timeSpentSeconds: int("time_spent_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type StandaloneQuizAttemptAnswer = typeof standaloneQuizAttemptAnswers.$inferSelect;

// ── Printful Integration ──────────────────────────────────────────────────────
// Caches synced products from Printful stores for storefront display.
export const printfulSyncProducts = mysqlTable("printful_sync_products", {
  id: int("id").autoincrement().primaryKey(),
  printfulProductId: int("printful_product_id").notNull(),
  storeId: int("store_id").notNull(),
  externalId: varchar("external_id", { length: 255 }),
  name: varchar("name", { length: 500 }).notNull(),
  thumbnailUrl: text("thumbnail_url"),
  variantCount: int("variant_count").default(0).notNull(),
  syncedVariantCount: int("synced_variant_count").default(0).notNull(),
  isIgnored: boolean("is_ignored").default(false).notNull(),
  retailPrice: varchar("retail_price", { length: 50 }),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  variantsJson: longtext("variants_json"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PrintfulSyncProductRow = typeof printfulSyncProducts.$inferSelect;

// ─── Quiz Question Groups ─────────────────────────────────────────────────────
// A quiz can have multiple question groups. Each group draws `displayCount`
// random questions from its pool on each attempt.
export const lmsQuizQuestionGroups = mysqlTable("lms_quiz_question_groups", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayCount: int("display_count").default(1).notNull(), // how many to show per attempt
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuizQuestionGroup = typeof lmsQuizQuestionGroups.$inferSelect;

// Maps question bank items to a question group
export const lmsQuizGroupQuestions = mysqlTable("lms_quiz_group_questions", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  questionBankId: int("question_bank_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuizGroupQuestion = typeof lmsQuizGroupQuestions.$inferSelect;

// ─── Team / University Subscriptions ─────────────────────────────────────────
// A team subscription gives a purchaser (adminUserId) a pool of seats that
// grant brand premium access to invited members.
//
// Pricing (per seat):
//   Monthly: $9.97/seat/month  (15% discount → ~$8.47/seat/month at 10+ seats)
//   Lifetime: $99.97/seat      (15% discount → ~$84.97/seat at 10+ seats)
//
// brand: "aaus" | "iheartecho" | "dual"
//   dual = grants premium on both brands
export const teamSubscriptions = mysqlTable("teamSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  orgName: varchar("orgName", { length: 200 }).notNull(),
  brand: mysqlEnum("brand", ["aaus", "iheartecho", "dual"]).notNull(),
  plan: mysqlEnum("plan", ["monthly", "lifetime"]).notNull(),
  seatCount: int("seatCount").notNull(),
  pricePerSeatCents: int("pricePerSeatCents").notNull(),
  discountPct: int("discountPct").default(0).notNull(),
  totalAmountCents: int("totalAmountCents").notNull(),
  status: mysqlEnum("status", ["active", "past_due", "canceled", "expired"]).default("active").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  canceledAt: timestamp("canceledAt"),
  expiresAt: timestamp("expiresAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeamSubscription = typeof teamSubscriptions.$inferSelect;
export type InsertTeamSubscription = typeof teamSubscriptions.$inferInsert;

// ─── Team Members ─────────────────────────────────────────────────────────────
// Each row is one seat assignment within a teamSubscription.
// When a member accepts their invite, brandMemberships rows are created/updated
// to grant them premium access on the subscription's brand(s).
export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  userId: int("userId"),
  inviteEmail: varchar("inviteEmail", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  inviteStatus: mysqlEnum("inviteStatus", ["pending", "accepted", "revoked"]).default("pending").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }),
  invitedByUserId: int("invitedByUserId"),
  joinedAt: timestamp("joinedAt"),
  grantedMembershipIds: text("grantedMembershipIds"),
  isActive: boolean("isActive").default(true).notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ─── ScanCoach CHD Images ─────────────────────────────────────────────────────
// Stores admin-uploaded images for Congenital Heart Defect views in the
// Fetal Echo ScanCoach (AAUS and iHeartEcho). Each row is one image slot
// for a specific CHD view. Admins can customize the label for each slot.

export const scanCoachChdImages = mysqlTable(
  "scanCoachChdImages",
  {
    id: int("id").primaryKey().autoincrement(),
    /** Module identifier: "fetal" (AAUS) or "fetal_ihe" (iHeartEcho) */
    module: varchar("module", { length: 50 }).notNull(),
    /** CHD view id matching ChdView.id in fetalChdData.ts, e.g. "chd_vsd" */
    chdId: varchar("chdId", { length: 100 }).notNull(),
    /** Image slot key matching ChdImageSlot.slotKey, e.g. "vsd_4cv_2d" */
    slotKey: varchar("slotKey", { length: 100 }).notNull(),
    /** Public S3 URL of the uploaded image */
    imageUrl: text("imageUrl"),
    /** S3 file key for deletion */
    fileKey: text("fileKey"),
    /** Admin-customizable label (falls back to ChdImageSlot.defaultLabel if null) */
    label: varchar("label", { length: 200 }),
    updatedAt: bigint("updatedAt", { mode: "number" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("scanCoachChdImages_module_chdId_slotKey").on(
      t.module,
      t.chdId,
      t.slotKey
    ),
  })
);
export type ScanCoachChdImage = typeof scanCoachChdImages.$inferSelect;
export type InsertScanCoachChdImage = typeof scanCoachChdImages.$inferInsert;

// ── Admin Notifications ───────────────────────────────────────────────────────
// Stores all admin-facing notifications (fulfillment events, alerts, system messages).
// Visible in Platform Admin → Notifications page.
export const adminNotifications = mysqlTable("admin_notifications", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 1200 }).notNull(),
  content: text("content").notNull(),
  /** Source tag for filtering: e.g. "lms_checkout", "membership", "physical_order", "system" */
  source: varchar("source", { length: 100 }).notNull().default("system"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = typeof adminNotifications.$inferInsert;
