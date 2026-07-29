import { getDb } from "./server/db";
import { issueCertificateIfEnabled } from "./server/routers/lmsHelpers";
import { lmsCertificates } from "./drizzle/schema";
import { and, eq } from "drizzle-orm";

const userId = 1, courseId = 420006, enrollmentId = 4320001;

const db = await getDb();
if (!db) { console.error("No DB"); process.exit(1); }

// Delete existing cert so it regenerates with the new title override
await db.delete(lmsCertificates).where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId)));
console.log("Deleted existing certificate");

// Re-issue — will use certificate_title_override from the course
await issueCertificateIfEnabled(db, enrollmentId, userId, courseId, "student");
console.log("Certificate re-issued with new title override");

process.exit(0);
