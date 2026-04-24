import {
  boolean,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
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
  // The review that triggered this notification (FK → physicianPeerReviews.id)
  reviewId: int("reviewId").notNull(),
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
]);

export const userRoles = mysqlTable("userRoles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager", "education_manager", "education_admin", "education_student"]).notNull(),
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
  // AAUS specialty category for flashcard filtering
  echoCategory: mysqlEnum("echoCategory", ["abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo", "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd", "pocus", "physics", "thyroid", "scrotum", "breast", "msk"]).default("abdominal"),
  // Broad clinical category for admin filtering (AAUS categories)
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal"),
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
  setDate: varchar("setDate", { length: 10 }).notNull().unique(),
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
  modality: mysqlEnum("modality", ["Abdominal", "Vascular", "OB/Gyn", "MSK", "POCUS", "Thyroid", "Breast", "Renal", "Fetal Echo", "Other"]).notNull(),
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
  // Category tag for filtering — determines which daily slot this challenge fills
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal").notNull(),
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
  itemType: mysqlEnum("itemType", ["text", "textarea", "email", "richtext", "radio", "checkbox", "select", "scale", "heading", "info"]).notNull(),
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
  targetItemId: int("targetItemId").notNull(),   // the item to show/hide
  conditionItemId: int("conditionItemId").notNull(), // the item whose value is checked
  conditionValue: varchar("conditionValue", { length: 500 }).notNull(), // the value that triggers visibility
  action: mysqlEnum("action", ["show", "hide"]).default("show").notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;

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
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal"),
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
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal"),
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
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal").notNull(),
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
  category: mysqlEnum("category", ["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics", "General"]).default("General").notNull(),
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
  status: mysqlEnum("status", ["draft", "public", "hidden", "private"]).default("draft").notNull(),
  type: mysqlEnum("type", ["course", "quiz", "download"]).default("course").notNull(),
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  price: int("price").default(0).notNull(), // cents — used for one_time and payment_plan total
  isFree: boolean("is_free").default(false).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Extended pricing model
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan"]).default("one_time").notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
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
  // Completion certificate
  hasCertificate: boolean("has_certificate").default(false).notNull(),
  // Drip: unlock all immediately (false) or by schedule (true)
  isDrip: boolean("is_drip").default(false).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCourse = typeof lmsCourses.$inferSelect;
export type InsertLmsCourse = typeof lmsCourses.$inferInsert;

export const lmsSections = mysqlTable("lms_sections", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
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
  isPreview: boolean("is_preview").default(false).notNull(), // visible without enrollment (login required)
  dripDays: int("drip_days").default(0).notNull(), // days after enrollment to unlock
  durationMinutes: int("duration_minutes"),
  requireVideoCompletion: int("require_video_completion").default(0).notNull(), // 1 = must watch video before marking complete
  requireManualComplete: int("require_manual_complete").default(0).notNull(), // 1 = show Mark Complete button
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLesson = typeof lmsLessons.$inferSelect;

export const lmsQuizzes = mysqlTable("lms_quizzes", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  passingScore: int("passing_score").default(70).notNull(), // percentage
  allowRetakes: boolean("allow_retakes").default(true).notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuiz = typeof lmsQuizzes.$inferSelect;

export const lmsQuizQuestions = mysqlTable("lms_quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  question: text("question").notNull(),
  type: mysqlEnum("type", ["mcq", "truefalse"]).default("mcq").notNull(),
  options: text("options"), // JSON array of strings
  correctAnswer: varchar("correct_answer", { length: 255 }).notNull(),
  explanation: text("explanation"),
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
  courseId: int("course_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  seats: int("seats").default(1).notNull(),
  managerId: int("manager_id"), // FK to users — the group manager
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroup = typeof lmsGroups.$inferSelect;

export const lmsGroupSeats = mysqlTable("lms_group_seats", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  enrollmentId: int("enrollment_id"), // set when user accepts and enrolls
  inviteToken: varchar("invite_token", { length: 128 }),
  acceptedAt: timestamp("accepted_at"),
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
  enrollmentId: int("enrollment_id").notNull(),
  orderId: int("order_id").notNull(),
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
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  affiliateId: int("affiliate_id"),
  groupId: int("group_id"),
  seats: int("seats").default(1).notNull(), // for group purchases
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsOrder = typeof lmsOrders.$inferSelect;
