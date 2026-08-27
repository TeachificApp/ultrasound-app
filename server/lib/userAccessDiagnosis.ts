import { sql, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { users, userEmailAliases, ipSecurityFlags } from "../../drizzle/schema";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";
import { buildPersistentAccessUrl } from "./enrollmentEmail";
import { getSendGridSuppressionStatus, isSendGridDeliveryBlocked } from "./sendgridSuppressions";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type UserEnrollmentSummary = {
  enrollmentId: number;
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  courseType: string;
  enrolledAt: string | null;
  accessUrl: string | null;
};

export type UserAccessDiagnosis = {
  email: string;
  user: {
    id: number;
    email: string | null;
    name: string | null;
    openId: string | null;
    isPending: boolean;
    hasAccessToken: boolean;
    accessTokenRevoked: boolean;
  } | null;
  duplicateAccounts: Array<{ id: number; email: string | null; isPending: boolean; name: string | null }>;
  aliasOnOtherAccount: Array<{ aliasId: number; userId: number; primaryEmail: string | null }>;
  enrollments: UserEnrollmentSummary[];
  sendGridBlocked: boolean;
  ipSecurityFlags: Array<{ flagType: string; createdAt: string | null }>;
};

export async function diagnoseUserAccess(
  db: Db,
  email: string,
  accessToken?: string | null,
): Promise<UserAccessDiagnosis> {
  const normalized = email.trim().toLowerCase();

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      openId: users.openId,
      isPending: users.isPending,
      accessToken: users.accessToken,
    })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalized}`)
    .limit(1);

  let user = userRows[0];
  if (!user) {
    const aliasRows = extractExecuteRows<{ userId: number }>(
      await db.execute(sql`
        SELECT user_id AS userId FROM user_email_aliases
        WHERE LOWER(email) = ${normalized}
        LIMIT 1
      `),
    );
    if (aliasRows[0]) {
      const primary = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          openId: users.openId,
          isPending: users.isPending,
          accessToken: users.accessToken,
        })
        .from(users)
        .where(eq(users.id, aliasRows[0].userId))
        .limit(1);
      user = primary[0];
    }
  }

  const duplicateAccounts = extractExecuteRows<{
    id: number;
    email: string | null;
    isPending: boolean;
    name: string | null;
  }>(
    await db.execute(sql`
      SELECT id, email, isPending, name FROM users
      WHERE LOWER(email) = ${normalized}
         OR openId = ${`email:${normalized}`}
      ORDER BY id
    `),
  );

  const aliasOnOtherAccount = extractExecuteRows<{
    aliasId: number;
    userId: number;
    primaryEmail: string | null;
  }>(
    await db.execute(sql`
      SELECT a.id AS aliasId, a.user_id AS userId, u.email AS primaryEmail
      FROM user_email_aliases a
      INNER JOIN users u ON u.id = a.user_id
      WHERE LOWER(a.email) = ${normalized}
    `),
  );

  const ipFlags = user
    ? extractExecuteRows<{ flagType: string; createdAt: string | null }>(
        await db.execute(sql`
          SELECT flag_type AS flagType, created_at AS createdAt
          FROM ip_security_flags
          WHERE user_id = ${user.id}
          ORDER BY id DESC
          LIMIT 5
        `),
      )
    : [];

  const enrollments: UserEnrollmentSummary[] = user
    ? extractExecuteRows<{
        enrollmentId: number;
        courseId: number;
        courseTitle: string;
        courseSlug: string;
        courseType: string;
        enrolledAt: string | null;
      }>(
        await db.execute(sql`
          SELECT
            e.id AS enrollmentId,
            e.course_id AS courseId,
            c.title AS courseTitle,
            c.slug AS courseSlug,
            c.type AS courseType,
            e.enrolled_at AS enrolledAt
          FROM lms_enrollments e
          INNER JOIN lms_courses c ON c.id = e.course_id
          WHERE e.user_id = ${user.id}
          ORDER BY e.enrolled_at DESC
        `),
      ).map((row) => {
        const destination =
          row.courseType === "quiz"
            ? "https://app.allaboutultrasound.com/dashboard/my-content?tab=quizzes"
            : `https://learn.allaboutultrasound.com/courses/${row.courseSlug}/player`;
        return {
          ...row,
          accessUrl: accessToken
            ? buildPersistentAccessUrl(destination, accessToken)
            : null,
        };
      })
    : [];

  const suppression = await getSendGridSuppressionStatus(normalized);
  const sendGridBlocked = isSendGridDeliveryBlocked(suppression);

  return {
    email: normalized,
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          openId: user.openId,
          isPending: user.isPending,
          hasAccessToken: Boolean(user.accessToken),
          accessTokenRevoked: !user.accessToken && ipFlags.some((f) => f.flagType === "access_token_ip_abuse"),
        }
      : null,
    duplicateAccounts,
    aliasOnOtherAccount,
    enrollments,
    sendGridBlocked,
    ipSecurityFlags: ipFlags,
  };
}
