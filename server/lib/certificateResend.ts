/**
 * Re-send an existing certificate PDF email to the learner.
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { lmsCertificates, lmsCourses, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendCertificateEmail } from "./certificateEmail";

export async function resendCertificateEmail(
  userId: number,
  courseId: number,
): Promise<{ sent: boolean; certificateUrl: string | null }> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const [cert] = await db
    .select({
      id: lmsCertificates.id,
      certificateUrl: lmsCertificates.certificateUrl,
      issuedAt: lmsCertificates.issuedAt,
    })
    .from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId)))
    .limit(1);
  if (!cert?.certificateUrl) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No certificate found for this enrollment" });
  }

  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "User has no email address on file" });
  }

  const [course] = await db
    .select({
      title: lmsCourses.title,
      certificateTitleOverride: lmsCourses.certificateTitleOverride,
    })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

  const pdfRes = await fetch(cert.certificateUrl);
  if (!pdfRes.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Could not fetch certificate PDF (${pdfRes.status})`,
    });
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const legalName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const learnerName = legalName || user.displayName || user.name || "Learner";
  const courseTitle =
    (course.certificateTitleOverride && course.certificateTitleOverride.trim()) ||
    course.title;

  const sent = await sendCertificateEmail({
    to: { name: learnerName, email: user.email },
    courseTitle,
    certificateUrl: cert.certificateUrl,
    pdfBuffer,
    issuedAt: cert.issuedAt ? new Date(cert.issuedAt) : new Date(),
    userId,
  });

  return { sent, certificateUrl: cert.certificateUrl };
}
