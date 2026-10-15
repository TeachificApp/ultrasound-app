import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { lmsCourses, digitalProducts, digitalBundles } from "../../drizzle/schema";
import { getOrCreateAccessToken } from "../db";
import {
  sendEnrollmentEmail,
  sendDownloadAccessEmail,
  sendBundleAccessEmail,
  sendQuizAccessEmail,
  learnOriginForBrand,
} from "./enrollmentEmail";
import { sendPurchaseNotificationOnce } from "./purchaseNotificationDelivery";
import { resolvePurchaseEmailTargets } from "./purchaseAccessEmailDelivery";
import { buildFunnelPurchaseConfirmationEmail } from "../_core/email";
import { sendEmail } from "../_core/email";
import { getEffectivePurchaseEmailOverride } from "./purchaseEmailOverride";

type FunnelAccessEmailInput = {
  checkoutSessionId: string;
  userId: number;
  learnerEmail: string;
  learnerName?: string | null;
  payerEmail?: string | null;
  payerName?: string | null;
  productName: string;
  productType: string;
  fulfillmentCourseId: number | null;
  fulfillmentDownloadId: number | null;
  fulfillmentBundleId: number | null;
  amountCents: number;
  brandMode?: string;
  cardLast4?: string | null;
  cardBrand?: string | null;
  bumpTitles?: string;
  bumpPrices?: string;
  setPasswordUrl?: string | null;
};

/**
 * One idempotent access email per funnel PaymentIntent, using product-specific templates when possible.
 */
export async function deliverFunnelPurchaseAccessEmail(
  db: MySql2Database<typeof schema>,
  input: FunnelAccessEmailInput,
): Promise<void> {
  const notificationType = "lms_access" as const;
  await sendPurchaseNotificationOnce(db, {
    checkoutSessionId: input.checkoutSessionId,
    notificationType,
    send: async () => {
      const { to, payee } = await resolvePurchaseEmailTargets({
        userId: input.userId,
        checkoutEmail: input.payerEmail ?? input.learnerEmail,
        checkoutName: input.payerName ?? input.learnerName,
      });
      const accessToken = await getOrCreateAccessToken(input.userId).catch(() => null);

      if (input.fulfillmentCourseId) {
        const [course] = await db
          .select({
            title: lmsCourses.title,
            slug: lmsCourses.slug,
            type: lmsCourses.type,
            brand: lmsCourses.brand,
          })
          .from(lmsCourses)
          .where(eq(lmsCourses.id, input.fulfillmentCourseId))
          .limit(1);
        if (course?.slug) {
          const emailOverride = await getEffectivePurchaseEmailOverride(db, [{
            contentType: course.type === "quiz" ? "quiz" : course.type === "cohort" ? "cohort" : "course",
            contentId: input.fulfillmentCourseId,
          }]);
          if (course.type === "quiz") {
            return sendQuizAccessEmail({
              to,
              payee,
              forPurchase: true,
              quizTitle: course.title,
              courseSlug: course.slug,
              purchaseDetails: { userId: input.userId, amountCents: input.amountCents, contentTitle: course.title },
              customSubject: emailOverride?.subject,
              customHeading: emailOverride?.heading,
              customIntro: emailOverride?.intro,
              customDetailsHtml: emailOverride?.detailsHtml,
              accessToken,
              setPasswordUrl: input.setPasswordUrl,
              brand: course.brand,
            });
          }
          return sendEnrollmentEmail({
            to,
            payee,
            forPurchase: true,
            courseTitle: course.title,
            courseSlug: course.slug,
            purchaseDetails: { userId: input.userId, amountCents: input.amountCents, contentTitle: course.title },
            customSubject: emailOverride?.subject,
            customHeading: emailOverride?.heading,
            customIntro: emailOverride?.intro,
            customDetailsHtml: emailOverride?.detailsHtml,
            accessToken,
            setPasswordUrl: input.setPasswordUrl,
            brand: course.brand,
          });
        }
      }

      if (input.fulfillmentDownloadId) {
        const [product] = await db
          .select({ title: digitalProducts.title, slug: digitalProducts.slug, brand: digitalProducts.brand })
          .from(digitalProducts)
          .where(eq(digitalProducts.id, input.fulfillmentDownloadId))
          .limit(1);
        if (product) {
          const brand = product.brand === "iheartecho" ? "iheartecho" : "aaus";
          const emailOverride = await getEffectivePurchaseEmailOverride(db, [{ contentType: "download", contentId: input.fulfillmentDownloadId }]);
          return sendDownloadAccessEmail({
            to,
            payee,
            forPurchase: true,
            productTitle: product.title,
            productSlug: product.slug,
            purchaseDetails: { userId: input.userId, amountCents: input.amountCents, contentTitle: product.title },
            customSubject: emailOverride?.subject,
            customHeading: emailOverride?.heading,
            customIntro: emailOverride?.intro,
            customDetailsHtml: emailOverride?.detailsHtml,
            accessToken,
            setPasswordUrl: input.setPasswordUrl,
            brand,
          });
        }
      }

      if (input.fulfillmentBundleId) {
        const [bundle] = await db
          .select({ title: digitalBundles.title, slug: digitalBundles.slug, brand: digitalBundles.brand })
          .from(digitalBundles)
          .where(eq(digitalBundles.id, input.fulfillmentBundleId))
          .limit(1);
        if (bundle) {
          const emailOverride = await getEffectivePurchaseEmailOverride(db, [{ contentType: "bundle", contentId: input.fulfillmentBundleId }]);
          return sendBundleAccessEmail({
            to,
            payee,
            forPurchase: true,
            bundleTitle: bundle.title,
            bundleSlug: bundle.slug,
            purchaseDetails: { userId: input.userId, amountCents: input.amountCents, contentTitle: bundle.title },
            customSubject: emailOverride?.subject,
            customHeading: emailOverride?.heading,
            customIntro: emailOverride?.intro,
            customDetailsHtml: emailOverride?.detailsHtml,
            accessToken,
            setPasswordUrl: input.setPasswordUrl,
            brand: bundle.brand === "iheartecho" ? "iheartecho" : "aaus",
          });
        }
      }

      const brandMode = (input.brandMode === "iheartecho" ? "iheartecho" : "aaus") as "aaus" | "iheartecho";
      const learnBase = learnOriginForBrand(brandMode);
      const loginUrl = accessToken
        ? `${learnBase}/auth/access?token=${accessToken}&next=${encodeURIComponent(`${learnBase}/my-dashboard`)}`
        : `${learnBase}/my-dashboard`;
      const bumpTitleArr = input.bumpTitles ? input.bumpTitles.split("|") : [];
      const bumpPriceArr = input.bumpPrices ? input.bumpPrices.split("|").map(Number) : [];
      const bumpsForEmail = bumpTitleArr.map((t, i) => ({ title: t, price: bumpPriceArr[i] ?? 0 })).filter((b) => b.title);
      const firstName = input.learnerName?.split(" ")[0] || "there";
      const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
        firstName,
        productName: input.productName,
        amountPaid: input.amountCents,
        orderBumps: bumpsForEmail.length > 0 ? bumpsForEmail : undefined,
        loginUrl,
        brandMode,
        purchaseDate: new Date(),
        cardLast4: input.cardLast4 ?? undefined,
        cardBrand: input.cardBrand ?? undefined,
      });
      const passwordSetupHtml = input.setPasswordUrl
        ? `<div style="margin:16px 0;padding:14px 16px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 8px 8px 0;"><p style="margin:0 0 8px;font-weight:600;color:#9a3412;">Set your password to keep access</p><p style="margin:0 0 10px;font-size:13px;color:#7c2d12;">Your account was created automatically. Set a password so you can sign in again anytime.</p><a href="${input.setPasswordUrl}" style="color:#ea580c;font-weight:700;">Set My Password</a></div>`
        : "";
      const { withPurchaseAccessRecipients } = await import("./purchaseAccessEmailDelivery");
      return sendEmail(await withPurchaseAccessRecipients({
        to: { name: input.learnerName || firstName, email: input.learnerEmail },
        subject,
        htmlBody: htmlBody.replace("</body>", `${passwordSetupHtml}</body>`),
        previewText,
        brandMode: "combined",
      }, {
        userId: input.userId,
        checkoutEmail: input.payerEmail ?? input.learnerEmail,
        checkoutName: input.payerName ?? input.learnerName,
        contentTitle: input.productName,
        amountCents: input.amountCents,
      }));
    },
  });
}
