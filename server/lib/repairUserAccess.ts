import { getDb, getUserByEmail, regenerateAccessToken } from "../db";
import { diagnoseUserAccess } from "./userAccessDiagnosis";
import { sendEnrollmentEmailForUser } from "./enrollmentEmail";
import { ensureTransactionalEmailDelivery } from "./ensureTransactionalEmailDelivery";
import { clearSendGridSuppressionLists } from "./sendgridSuppressions";
import { ensureUserOpenId } from "./ensureUserOpenId";

export type RepairUserAccessResult = {
  email: string;
  userId: number;
  accessTokenRegenerated: boolean;
  enrollmentEmailsSent: number;
  sendGridCleared: boolean;
  openIdFixed: boolean;
};

/** Fix login/access for a student: SendGrid suppressions, openId, access token, enrollment emails. */
export async function repairUserAccess(
  email: string,
  options: { resendEnrollment?: boolean } = {},
): Promise<RepairUserAccessResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required");
  }

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const user = await getUserByEmail(normalized);
  if (!user) throw new Error(`User not found: ${normalized}`);

  await clearSendGridSuppressionLists(normalized);
  await ensureTransactionalEmailDelivery(normalized);

  const priorOpenId = user.openId;
  const openId = await ensureUserOpenId(db, user);
  const openIdFixed = priorOpenId !== openId;

  const accessToken = await regenerateAccessToken(user.id);

  let enrollmentEmailsSent = 0;
  const resendEnrollment = options.resendEnrollment !== false;
  if (resendEnrollment) {
    const diagnosis = await diagnoseUserAccess(db, normalized, accessToken);
    for (const enrollment of diagnosis.enrollments) {
      const sent = await sendEnrollmentEmailForUser({
        userId: user.id,
        courseId: enrollment.courseId,
        db,
      });
      if (sent) enrollmentEmailsSent += 1;
    }
  }

  return {
    email: normalized,
    userId: user.id,
    accessTokenRegenerated: true,
    enrollmentEmailsSent,
    sendGridCleared: true,
    openIdFixed,
  };
}
