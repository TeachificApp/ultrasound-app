import { and, eq, inArray } from "drizzle-orm";
import {
  bundles,
  digitalBundles,
  digitalProducts,
  lmsCohortGroups,
  lmsCourses,
  membershipPlanAccess,
  membershipPlans,
  physicalProducts,
  webinars,
  workshops,
  workshopInstances,
} from "../../drizzle/schema";
import {
  renderBundleAccessEmail,
  renderDownloadAccessEmail,
  renderEnrollmentEmail,
  renderPurchaseAccessEmail,
  renderQuizAccessEmail,
  type RenderedPurchaseEmail,
} from "./enrollmentEmail";
import { buildFunnelPurchaseConfirmationEmail, buildPasswordResetEmail } from "../_core/email";
import { renderExistingBrandMembershipAccessEmail, renderNewBrandMembershipAccessEmail } from "./brandMembershipPurchaseEmail";
import { applyPurchaseEmailOverride, getEffectivePurchaseEmailOverride } from "./purchaseEmailOverride";
import { renderCurrentWorkshopSchedule } from "./workshopEmailSchedule";
import { renderCurrentWebinarSchedule } from "./webinarEmailSchedule";
import { renderCurrentCohortGroupSchedule } from "./cohortEmailSchedule";
import { renderTeamSubscriptionConfirmationEmail } from "./teamSubscriptionEmail";
import { TRANSACTIONAL_EMAIL_DEEP_TEAL } from "../../shared/transactionalEmailPalette";

export const PURCHASE_EMAIL_PREVIEW_SOURCES = [
  "course",
  "download",
  "digital_bundle",
  "canonical_bundle",
  "webinar",
  "cohort_group",
  "workshop_instance",
  "physical_product",
  "membership",
  "funnel_fallback",
  "brand_membership",
  "dual_membership",
  "free_purchase_account_setup",
  "team_subscription",
] as const;

export type PurchaseEmailPreviewSource = typeof PURCHASE_EMAIL_PREVIEW_SOURCES[number];

export type PurchaseEmailPreview = RenderedPurchaseEmail & {
  contentTitle: string;
  contentType: string;
  sampleRecipient: { name: string; email: string };
  accessLinkNotice: string;
};

const SAMPLE_RECIPIENT = { name: "Sample Learner", email: "sample.learner@example.com" };
const ACCESS_LINK_NOTICE = "This is a safe preview. It uses an illustrative destination link only; real purchase emails contain a recipient-specific automatic sign-in link and are sent only after a completed purchase.";

function purchaseBrand(value: string | null | undefined): "aaus" | "iheartecho" {
  return value === "iheartecho" ? "iheartecho" : "aaus";
}

function learnOrigin(brand: "aaus" | "iheartecho") {
  return brand === "iheartecho" ? "https://learn.iheartecho.com" : "https://learn.allaboutultrasound.com";
}

function appOrigin(brand: "aaus" | "iheartecho") {
  return brand === "iheartecho" ? "https://app.iheartecho.com" : "https://app.allaboutultrasound.com";
}

function result(contentTitle: string, contentType: string, rendered: RenderedPurchaseEmail): PurchaseEmailPreview {
  return { ...rendered, contentTitle, contentType, sampleRecipient: SAMPLE_RECIPIENT, accessLinkNotice: ACCESS_LINK_NOTICE };
}

/**
 * Renders the exact same template family and current saved copy used for a
 * future completed purchase. It intentionally never sends email, creates users,
 * creates access tokens, or writes to MySQL.
 */
export async function renderCurrentPurchaseEmailPreview(
  db: any,
  input: { source: PurchaseEmailPreviewSource; contentId: number; contentType?: string },
): Promise<PurchaseEmailPreview> {
  if (input.source === "free_purchase_account_setup") {
    const brand = input.contentId === 2 ? "iheartecho" : "aaus";
    // Mirrors the free-order checkout's current reset-link destination.
    const baseUrl = brand === "iheartecho" ? "https://app.iheartecho.net" : appOrigin(brand);
    const email = buildPasswordResetEmail({
      firstName: SAMPLE_RECIPIENT.name,
      resetUrl: `${baseUrl}/auth/reset-password`,
      brandMode: brand,
    });
    return result(
      `Free purchase account setup — ${brand === "iheartecho" ? "iHeartEcho™" : "All About Ultrasound™"}`,
      "Account setup",
      { subject: "Your account is ready — set your password to access your purchase", htmlBody: email.htmlBody },
    );
  }
  if (input.source === "team_subscription") {
    const variants = {
      1: { brand: "aaus" as const, plan: "monthly" as const },
      2: { brand: "iheartecho" as const, plan: "monthly" as const },
      3: { brand: "both" as const, plan: "monthly" as const },
      4: { brand: "aaus" as const, plan: "lifetime" as const },
      5: { brand: "iheartecho" as const, plan: "lifetime" as const },
      6: { brand: "both" as const, plan: "lifetime" as const },
    } as const;
    const variant = variants[input.contentId as keyof typeof variants] ?? variants[1];
    const rendered = renderTeamSubscriptionConfirmationEmail({
      recipientName: SAMPLE_RECIPIENT.name,
      brand: variant.brand,
      plan: variant.plan,
      organizationName: "Sample Organization",
      seatCount: 10,
      discountPercent: 0,
      totalAmountCents: variant.plan === "monthly" ? 49000 : 249900,
      dashboardUrl: "https://app.allaboutultrasound.com/team/sample",
    });
    const brandLabel = variant.brand === "aaus" ? "UltrasoundAssist™" : variant.brand === "iheartecho" ? "EchoAssist™" : "Both apps";
    return result(`${brandLabel} Team/University — ${variant.plan}`, "Team subscription", rendered);
  }
  if (input.source === "funnel_fallback") {
    const rendered = buildFunnelPurchaseConfirmationEmail({
      firstName: SAMPLE_RECIPIENT.name,
      productName: "Sample purchase",
      amountPaid: 4900,
      loginUrl: "https://learn.allaboutultrasound.com/my-dashboard",
      brandMode: "aaus",
      purchaseDate: "2026-01-15T12:00:00.000Z",
    });
    return result("Generic funnel / embedded purchase fallback", "System fallback", rendered);
  }

  if (input.source === "brand_membership") {
    const brand = input.contentId > 2 ? "iheartecho" : "aaus";
    const isNewLearner = input.contentId % 2 === 1;
    const baseUrl = appOrigin(brand);
    const rendered = isNewLearner
      ? renderNewBrandMembershipAccessEmail({
          firstName: SAMPLE_RECIPIENT.name, brand, accessUrl: `${baseUrl}/my-dashboard`,
          setPasswordUrl: `${baseUrl}/reset-password`, isLifetime: false, isTrial: false,
        })
      : renderExistingBrandMembershipAccessEmail({
          firstName: SAMPLE_RECIPIENT.name, brand, accessUrl: `${baseUrl}/my-dashboard`, isLifetime: false, isTrial: false,
        });
    const brandTitle = brand === "iheartecho" ? "EchoAssist™" : "UltrasoundAssist™";
    return result(`${brandTitle} Premium — ${isNewLearner ? "new learner" : "existing learner"}`, "App membership", rendered);
  }

  if (input.source === "dual_membership") {
    const isNewLearner = input.contentId === 1;
    const planLabel = "All Access Dual Membership";
    const baseUrl = appOrigin("aaus");
    const accessUrl = `${baseUrl}/my-dashboard`;
    if (isNewLearner) {
      const reset = renderNewBrandMembershipAccessEmail({
        firstName: SAMPLE_RECIPIENT.name, brand: "aaus", accessUrl,
        setPasswordUrl: `${baseUrl}/auth/reset-password`, isLifetime: false, isTrial: false,
      });
      return result(`${planLabel} — new learner`, "Dual app membership", {
        ...reset,
        subject: `Your ${planLabel} is ready`,
        previewText: `Access your ${planLabel} on All About Ultrasound`,
        htmlBody: reset.htmlBody.replaceAll("UltrasoundAssist™ Premium Membership", planLabel),
      });
    }
    const rendered = renderExistingBrandMembershipAccessEmail({
      firstName: SAMPLE_RECIPIENT.name, brand: "aaus", accessUrl, isLifetime: false, isTrial: false,
    });
    return result(`${planLabel} — existing learner`, "Dual app membership", {
      ...rendered,
      subject: `Your ${planLabel} is ready`,
      previewText: `Access your ${planLabel} on All About Ultrasound`,
      htmlBody: rendered.htmlBody
        .replaceAll("UltrasoundAssist™ Premium Membership", planLabel)
        .replace("is now active and ready to use.", "is now active. You have premium access to both UltrasoundAssist™ and EchoAssist™."),
    });
  }

  if (input.source === "course") {
    const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type, creditHours: lmsCourses.creditHours, brand: lmsCourses.brand })
      .from(lmsCourses).where(eq(lmsCourses.id, input.contentId)).limit(1);
    if (!course) throw new Error("The selected course or quiz could not be found.");
    const contentType = input.contentType === "quiz" || course.type === "quiz" ? "quiz" : input.contentType === "cohort" ? "cohort" : "course";
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType, contentId: input.contentId }]);
    const brand = purchaseBrand(course.brand);
    if (contentType === "quiz") {
      return result(course.title, "Quiz", await renderQuizAccessEmail({
        to: SAMPLE_RECIPIENT, quizTitle: course.title, courseSlug: course.slug,
        customSubject: override?.subject, customHeading: override?.heading, customIntro: override?.intro, customDetailsHtml: override?.detailsHtml,
        brand,
      }));
    }
    return result(course.title, contentType === "cohort" ? "Cohort course" : "Course", await renderEnrollmentEmail({
      to: SAMPLE_RECIPIENT, courseTitle: course.title, courseSlug: course.slug, creditHours: course.creditHours,
      customSubject: override?.subject, customHeading: override?.heading, customIntro: override?.intro, customDetailsHtml: override?.detailsHtml,
      brand,
    }));
  }

  if (input.source === "download") {
    const [product] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug, brand: digitalProducts.brand })
      .from(digitalProducts).where(eq(digitalProducts.id, input.contentId)).limit(1);
    if (!product) throw new Error("The selected download could not be found.");
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "download", contentId: input.contentId }]);
    return result(product.title, "Download", await renderDownloadAccessEmail({
      to: SAMPLE_RECIPIENT, productTitle: product.title, productSlug: product.slug,
      customSubject: override?.subject, customHeading: override?.heading, customIntro: override?.intro, customDetailsHtml: override?.detailsHtml,
      brand: purchaseBrand(product.brand),
    }));
  }

  if (input.source === "digital_bundle") {
    const [bundle] = await db.select({ title: digitalBundles.title, slug: digitalBundles.slug, brand: digitalBundles.brand })
      .from(digitalBundles).where(eq(digitalBundles.id, input.contentId)).limit(1);
    if (!bundle) throw new Error("The selected digital bundle could not be found.");
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "bundle", contentId: input.contentId }]);
    return result(bundle.title, "Digital bundle", await renderBundleAccessEmail({
      to: SAMPLE_RECIPIENT, bundleTitle: bundle.title, bundleSlug: bundle.slug,
      customSubject: override?.subject, customHeading: override?.heading, customIntro: override?.intro, customDetailsHtml: override?.detailsHtml,
      brand: purchaseBrand(bundle.brand),
    }));
  }

  if (input.source === "canonical_bundle") {
    const [bundle] = await db.select({ title: bundles.title, slug: bundles.slug, brand: bundles.brand }).from(bundles).where(eq(bundles.id, input.contentId)).limit(1);
    if (!bundle) throw new Error("The selected bundle could not be found.");
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "bundle", contentId: input.contentId }]);
    const brand = purchaseBrand(bundle.brand);
    return result(bundle.title, "Bundle", await renderBundleAccessEmail({
      to: SAMPLE_RECIPIENT, bundleTitle: bundle.title, bundleSlug: bundle.slug,
      customSubject: override?.subject, customHeading: override?.heading, customIntro: override?.intro, customDetailsHtml: override?.detailsHtml,
      destinationUrl: `${learnOrigin(brand)}/bundles/${bundle.slug}`, brand,
    }));
  }

  if (input.source === "webinar") {
    const [webinar] = await db.select({ title: webinars.title, slug: webinars.slug, brand: webinars.brand, scheduledAt: webinars.scheduledAt, durationMinutes: webinars.durationMinutes, timezone: webinars.timezone, type: webinars.type, meetingUrl: webinars.meetingUrl })
      .from(webinars).where(eq(webinars.id, input.contentId)).limit(1);
    if (!webinar) throw new Error("The selected webinar could not be found.");
    const brand = purchaseBrand(webinar.brand);
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "webinar", contentId: input.contentId }]);
    const copy = applyPurchaseEmailOverride({
      subject: `You're registered: ${webinar.title}`,
      heading: "Your webinar registration is confirmed",
      intro: `you now have access to <strong style="color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">${webinar.title}</strong>.`,
    }, override);
    const detailsHtml = `${renderCurrentWebinarSchedule(webinar)}${copy.detailsHtml ?? ""}`;
    return result(webinar.title, "Webinar", await renderPurchaseAccessEmail({
      to: SAMPLE_RECIPIENT, subject: copy.subject, heading: copy.heading, intro: copy.intro, detailsHtml,
      accessLabel: "Open Webinar", destinationUrl: `${learnOrigin(brand)}/webinars/${webinar.slug}`, brand, brandMode: "combined",
    }));
  }

  if (input.source === "cohort_group") {
    const [group] = await db.select({
      name: lmsCohortGroups.name,
      startDate: lmsCohortGroups.startDate,
      endDate: lmsCohortGroups.endDate,
      location: lmsCohortGroups.location,
      courseId: lmsCohortGroups.courseId,
      courseTitle: lmsCourses.title,
      courseSlug: lmsCourses.slug,
      courseBrand: lmsCourses.brand,
      creditHours: lmsCourses.creditHours,
    }).from(lmsCohortGroups)
      .leftJoin(lmsCourses, eq(lmsCohortGroups.courseId, lmsCourses.id))
      .where(eq(lmsCohortGroups.id, input.contentId))
      .limit(1);
    if (!group?.courseTitle || !group.courseSlug) throw new Error("The selected cohort group could not be found.");
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "cohort", contentId: group.courseId }]);
    const copy = applyPurchaseEmailOverride({
      subject: `Welcome to ${group.courseTitle}`,
      heading: "Welcome — your cohort access is ready",
      intro: `you are enrolled in <strong style="color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">${group.courseTitle}</strong>.`,
    }, override);
    const brand = purchaseBrand(group.courseBrand);
    const detailsHtml = `${renderCurrentCohortGroupSchedule(group)}${copy.detailsHtml ?? ""}`;
    return result(`${group.courseTitle} — ${group.name}`, "Cohort group", await renderEnrollmentEmail({
      to: SAMPLE_RECIPIENT, courseTitle: group.courseTitle, courseSlug: group.courseSlug, creditHours: group.creditHours,
      customSubject: copy.subject, customHeading: copy.heading, customIntro: copy.intro, customDetailsHtml: detailsHtml,
      brand,
    }));
  }

  if (input.source === "workshop_instance") {
    const [instance] = await db.select({
      title: workshopInstances.title, workshopId: workshopInstances.workshopId, startDate: workshopInstances.startDate, endDate: workshopInstances.endDate, timezone: workshopInstances.timezone,
      locationType: workshopInstances.locationType, venueName: workshopInstances.venueName, venueCity: workshopInstances.venueCity, venueState: workshopInstances.venueState,
      workshopTitle: workshops.title, workshopSlug: workshops.slug, workshopBrand: workshops.brand,
    }).from(workshopInstances).leftJoin(workshops, eq(workshopInstances.workshopId, workshops.id)).where(eq(workshopInstances.id, input.contentId)).limit(1);
    if (!instance?.workshopTitle || !instance.workshopSlug) throw new Error("The selected workshop instance could not be found.");
    const override = await getEffectivePurchaseEmailOverride(db, [
      { contentType: "workshop_instance", contentId: input.contentId },
      { contentType: "workshop", contentId: instance.workshopId },
    ]);
    const copy = applyPurchaseEmailOverride({
      subject: `You're registered: ${instance.workshopTitle}`,
      heading: "Your workshop registration is confirmed",
      intro: `you are registered for <strong style="color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">${instance.workshopTitle}</strong>.`,
    }, override);
    const brand = purchaseBrand(instance.workshopBrand);
    const detailsHtml = `${renderCurrentWorkshopSchedule(instance)}${copy.detailsHtml ?? ""}`;
    return result(`${instance.workshopTitle} — ${instance.title}`, "Workshop instance", await renderPurchaseAccessEmail({
      to: SAMPLE_RECIPIENT, subject: copy.subject, heading: copy.heading, intro: copy.intro, detailsHtml,
      accessLabel: "View Workshop Details", destinationUrl: `${learnOrigin(brand)}/workshops/${instance.workshopSlug}`, brand, brandMode: "combined",
    }));
  }

  if (input.source === "physical_product") {
    const [product] = await db.select({ title: physicalProducts.title, brand: physicalProducts.brand }).from(physicalProducts)
      .where(eq(physicalProducts.id, input.contentId)).limit(1);
    if (!product) throw new Error("The selected physical product could not be found.");
    const brand = purchaseBrand(product.brand);
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "physical_product", contentId: input.contentId }]);
    const copy = applyPurchaseEmailOverride({
      subject: `Order confirmed: ${product.title}`,
      heading: "Your order is confirmed",
      intro: `your order for <strong style="color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">${product.title}</strong> has been received and is being processed.`,
    }, override);
    return result(product.title, "Physical product", await renderPurchaseAccessEmail({
      to: SAMPLE_RECIPIENT, subject: copy.subject, heading: copy.heading, intro: copy.intro, detailsHtml: copy.detailsHtml ?? undefined,
      accessLabel: "View My Orders", destinationUrl: `${appOrigin(brand)}/my-orders`, brand, brandMode: brand,
    }));
  }

  if (input.source === "membership") {
    const [plan] = await db.select({ title: membershipPlans.title, slug: membershipPlans.slug, brand: membershipPlans.brand }).from(membershipPlans)
      .where(eq(membershipPlans.id, input.contentId)).limit(1);
    if (!plan) throw new Error("The selected membership plan could not be found.");
    const brand = purchaseBrand(plan.brand);
    const override = await getEffectivePurchaseEmailOverride(db, [{ contentType: "membership", contentId: input.contentId }]);
    const copy = applyPurchaseEmailOverride({
      subject: `Your ${plan.title} membership is active`, heading: "Welcome — your membership is active",
      intro: `your membership for <strong style="color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};">${plan.title}</strong> is ready.`,
    }, override);
    const [primaryCourse] = await db.select({ slug: lmsCourses.slug })
      .from(membershipPlanAccess)
      .innerJoin(lmsCourses, eq(membershipPlanAccess.itemId, lmsCourses.id))
      .where(and(
        eq(membershipPlanAccess.planId, input.contentId),
        inArray(membershipPlanAccess.itemType, ["course", "quiz"]),
      ))
      .limit(1);
    const destinationUrl = primaryCourse?.slug
      ? `${learnOrigin(brand)}/courses/${primaryCourse.slug}/player`
      : `${appOrigin(brand)}/my-dashboard`;
    return result(plan.title, "Membership", await renderPurchaseAccessEmail({
      to: SAMPLE_RECIPIENT, subject: copy.subject, heading: copy.heading, intro: copy.intro, detailsHtml: copy.detailsHtml ?? undefined,
      accessLabel: primaryCourse?.slug ? "Start Learning" : "Open My Membership", destinationUrl, brand, brandMode: "combined",
    }));
  }

  throw new Error("This purchase email preview is not available for the selected content.");
}
