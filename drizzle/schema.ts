import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  membershipTier: mysqlEnum("membershipTier", ["free", "premium"]).default("free").notNull(),
  thinkificUserId: varchar("thinkificUserId", { length: 128 }),
  streakCount: int("streakCount").default(0).notNull(),
  totalPoints: int("totalPoints").default(0).notNull(),
  lastChallengeDate: varchar("lastChallengeDate", { length: 10 }),
  flashcardsToday: int("flashcardsToday").default(0).notNull(),
  flashcardsDate: varchar("flashcardsDate", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Flashcards
export const flashcards = mysqlTable("flashcards", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: mysqlEnum("category", [
    "abdominal",
    "pelvic_gyn",
    "obstetric_1st",
    "obstetric_2nd_3rd",
    "thyroid",
    "scrotum",
    "breast",
    "venous",
    "arterial",
    "abdominal_vascular",
    "extracranial_carotid",
    "intracranial_tcd",
    "msk",
    "pocus",
    "physics",
    "fetal_echo",
  ]).notNull(),
  difficulty: mysqlEnum("difficulty", ["basic", "intermediate", "advanced"]).default("basic").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Flashcard = typeof flashcards.$inferSelect;

// Cases
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(),
  category: mysqlEnum("category", [
    "abdominal",
    "pelvic_gyn",
    "obstetric_1st",
    "obstetric_2nd_3rd",
    "thyroid",
    "scrotum",
    "breast",
    "venous",
    "arterial",
    "abdominal_vascular",
    "extracranial_carotid",
    "intracranial_tcd",
    "msk",
    "pocus",
    "physics",
    "fetal_echo",
  ]).notNull(),
  caseType: mysqlEnum("caseType", ["image", "video", "scenario"]).default("scenario").notNull(),
  clinicalHistory: text("clinicalHistory"),
  findings: text("findings"),
  diagnosis: text("diagnosis"),
  teaching: text("teaching"),
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  submittedBy: int("submittedBy"),
  submitterName: text("submitterName"),
  submitterCredentials: text("submitterCredentials"),
  isPublished: boolean("isPublished").default(false).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  displayViewCount: int("displayViewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;

// SoundBytes
export const soundbytes = mysqlTable("soundbytes", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "abdominal",
    "pelvic_gyn",
    "obstetric_1st",
    "obstetric_2nd_3rd",
    "thyroid",
    "scrotum",
    "breast",
    "venous",
    "arterial",
    "abdominal_vascular",
    "extracranial_carotid",
    "intracranial_tcd",
    "msk",
    "pocus",
    "physics",
    "fetal_echo",
  ]).notNull(),
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  durationSeconds: int("durationSeconds"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SoundByte = typeof soundbytes.$inferSelect;

// Daily Challenges
export const dailyChallenges = mysqlTable("dailyChallenges", {
  id: int("id").autoincrement().primaryKey(),
  challengeDate: varchar("challengeDate", { length: 10 }).notNull().unique(),
  question: text("question").notNull(),
  optionA: text("optionA").notNull(),
  optionB: text("optionB").notNull(),
  optionC: text("optionC").notNull(),
  optionD: text("optionD").notNull(),
  correctAnswer: mysqlEnum("correctAnswer", ["A", "B", "C", "D"]).notNull(),
  explanation: text("explanation").notNull(),
  category: varchar("category", { length: 64 }),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyChallenge = typeof dailyChallenges.$inferSelect;

// Challenge Responses
export const challengeResponses = mysqlTable("challengeResponses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  challengeId: int("challengeId").notNull(),
  selectedAnswer: mysqlEnum("selectedAnswer", ["A", "B", "C", "D"]).notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  respondedAt: timestamp("respondedAt").defaultNow().notNull(),
});

export type ChallengeResponse = typeof challengeResponses.$inferSelect;

// Thinkific Webhook Events
export const thinkificWebhookEvents = mysqlTable("thinkificWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  thinkificUserId: varchar("thinkificUserId", { length: 128 }),
  userEmail: varchar("userEmail", { length: 320 }),
  payload: json("payload"),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});
