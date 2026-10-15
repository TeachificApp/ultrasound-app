import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveDashboardSubscriptionCancelledAt } from "../client/src/pages/StudentDashboardPage";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("purchase recipient and cancellation safeguards", () => {
  it("records the action date on paid course cancellation and exposes it to learners", () => {
    const schema = source("../drizzle/schema.ts");
    const dashboardRouter = source("./routers/dashboardRouter.ts");
    const dashboard = source("../client/src/pages/StudentDashboardPage.tsx");

    expect(schema).toContain('cancellationRequestedAt: timestamp("cancellation_requested_at")');
    expect(dashboardRouter).toContain('eventType: "subscription_cancelled"');
    expect(dashboardRouter).toContain("cancellationRequestedAt: requestedAt");
    expect(dashboardRouter).toContain("cancellationRequestedAt: lmsOrders.cancellationRequestedAt");
    expect(dashboard).toContain("Cancellation requested:");
  });

  it("only presents a historical cancellation date after access has ended", () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(resolveDashboardSubscriptionCancelledAt("sub_123", past)?.getTime()).toBe(past.getTime());
    expect(resolveDashboardSubscriptionCancelledAt("sub_123", future)).toBeNull();
    expect(resolveDashboardSubscriptionCancelledAt(null, past)).toBeNull();
  });

  it("collects recipient access on the payment page without a separate checkout step", () => {
    const checkout = source("../client/src/pages/Checkout.tsx");
    const workshopCheckout = source("../client/src/pages/WorkshopCheckout.tsx");
    const lms = source("./routers/lmsRouter.ts");
    const fulfillment = source("./lib/lmsCheckoutFulfillment.ts");
    const membershipFulfillment = source("./lib/membershipFulfillment.ts");

    expect(checkout).toContain("Will the learner use the same name and email as the payer?");
    expect(workshopCheckout).toContain("Will the learner use the same name and email as the payer?");
    expect(checkout).toContain("Yes, same learner");
    expect(checkout).toContain("No, another learner");
    expect(workshopCheckout).toContain("Yes, same learner");
    expect(workshopCheckout).toContain("No, another learner");
    expect(checkout).not.toContain("Continue to secure payment");
    expect(workshopCheckout).not.toContain("Continue to payment");
    expect(checkout).not.toContain("checkoutDetailsSubmitted");
    expect(workshopCheckout).not.toContain("checkoutDetailsSubmitted");
    expect(lms).toContain("recipientEmail: z.string().trim().email()");
    expect(lms).toContain("recipient_email");
    expect(fulfillment).toContain("meta.recipient_email ||");
    expect(membershipFulfillment).toContain("meta.recipient_email ||");
  });

  it("returns a verified account auto-login handoff after completed LMS checkout", () => {
    const lms = source("./routers/lmsRouter.ts");
    const completion = source("../client/src/pages/CheckoutComplete.tsx");
    expect(lms).toContain("let autoLoginUrl: string | null = null");
    expect(lms).toContain("generateAutoLoginToken(fulfilledUserId, destination)");
    expect(lms).toContain("autoLoginUrl,");
    expect(completion).toContain('"autoLoginUrl" in data');
  });

  it("records one access notification per checkout while allowing failed delivery to retry", () => {
    const schema = source("../drizzle/schema.ts");
    const delivery = source("./lib/purchaseNotificationDelivery.ts");
    const fulfillment = source("./lib/lmsCheckoutFulfillment.ts");

    expect(schema).toContain('purchase_notification_deliveries');
    expect(schema).toContain('purchase_notification_delivery_unique');
    expect(delivery).toContain("INSERT IGNORE INTO purchase_notification_deliveries");
    expect(delivery).toContain("status = 'failed'");
    expect(fulfillment).toContain("sendPurchaseNotificationOnce");
    expect(fulfillment).toContain('notificationType: "lms_access"');
    expect(fulfillment).not.toContain("course?.slug && (shouldRenew || isNewUser)");
  });

  it("sends confirmed access notices for webinar, workshop, download, bundle, and physical purchases", () => {
    const stripe = source("./webhooks/stripe.ts");

    expect(stripe).toContain('notificationType: "workshop_registration"');
    expect(stripe).toContain('notificationType: "webinar_registration"');
    expect(stripe).toContain('notificationType: "download_access"');
    expect(stripe).toContain('notificationType: "bundle_access"');
    expect(stripe).toContain('notificationType: "physical_order"');
    expect(stripe).toContain("resolveCheckoutRecipientUser(session, meta)");
    expect(stripe).toContain("sendPurchaseAccessEmail");
    expect(stripe).toContain("deliverFunnelPurchaseAccessEmail");
  });

  it("keeps bearer access links with the learner and sends token-free payer/admin receipts", () => {
    const delivery = source("./lib/purchaseAccessEmailDelivery.ts");
    expect(delivery).toContain("Purchase receipts deliberately contain no copied email body");
    expect(delivery).toContain("buildTokenFreeReceipt");
    expect(delivery).toContain("Only the learner receives the message containing the bearer access link");
    expect(delivery).toContain("PURCHASE_ACCESS_ADMIN_EMAIL");
  });

  it("keeps funnel setup in the single idempotent purchase email", () => {
    const stripe = source("./webhooks/stripe.ts");
    const funnelHelper = source("./lib/funnelPurchaseAccessEmail.ts");
    expect(stripe).toContain("newUserResetToken");
    expect(stripe).toContain("setPasswordUrl: newUserResetToken");
    expect(stripe).not.toContain("sent welcome email with access token");
    expect(funnelHelper).toContain("setPasswordUrl?: string | null");
  });

  it("retains payer identity separately from membership learner identity", () => {
    const membership = source("./lib/membershipFulfillment.ts");
    const router = source("./routers/membershipRouter.ts");
    expect(membership).toContain("payerEmail?: string | null");
    expect(membership).toContain("payerEmail: ctx.payerEmail");
    expect(router).toContain("payer_name: userName ??");
  });

  it("sends future workshop confirmations from the selected instance’s live logistics", () => {
    const stripe = source("./webhooks/stripe.ts");
    const workshops = source("../client/src/pages/admin/WorkshopsAdmin.tsx");
    const router = source("./routers/workshopRouter.ts");

    expect(stripe).toContain("renderCurrentWorkshopSchedule(instance)");
    expect(stripe).toContain('notificationType: "workshop_registration"');
    expect(stripe).toContain('contentType: "workshop_instance"');
    expect(stripe).not.toContain("isWorkshopConfirmationReady(instance)");
    expect(router).toContain("confirmationEmailApproved: z.boolean().default(false)");
    expect(workshops).toContain("Future paid registrations automatically receive a confirmation");
    expect(workshops).toContain("Saving an instance never sends or resends messages to existing registrants.");
  });

  it("routes a returning learner to owned access instead of creating another checkout", () => {
    const checkout = source("../client/src/pages/Checkout.tsx");
    const lms = source("./routers/lmsRouter.ts");
    const downloads = source("./routers/downloadsRouter.ts");
    const webinar = source("./routers/webinarRouter.ts");
    const workshop = source("./routers/workshopRouter.ts");
    const workshopCheckout = source("../client/src/pages/WorkshopCheckout.tsx");
    const webinarLanding = source("../client/src/pages/WebinarLanding.tsx");

    expect(checkout).toContain("Payer email");
    expect(checkout).toContain("payerEmail");
    expect(checkout).toContain("data.alreadyEnrolled || data.alreadyRegistered || data.alreadyPurchased");
    expect(lms).toContain("getActiveEnrollment(db, accessUser.id, course.id)");
    expect(lms).toContain("accessUrl: `/courses/${course.slug}/player`");
    expect(downloads).toContain("alreadyPurchased: true");
    expect(downloads).toContain("accessUrl: `/downloads/${product.slug}/files`");
    expect(webinar).toContain("alreadyRegistered: true");
    expect(webinar).toContain("accessUrl: `/webinar/${webinar.slug}`");
    expect(workshop).toContain('accessUrl: "/my-dashboard?tab=workshops"');
    expect(workshopCheckout).toContain("data.alreadyEnrolled && data.accessUrl");
    expect(workshopCheckout).toContain("Payer email");
    expect(webinarLanding).toContain('"Access Webinar"');
  });
  it("keeps the workshop image, selected session, policy, and registration form visible before email or after a checkout error", () => {
    const checkout = source("../client/src/pages/WorkshopCheckout.tsx");
    const workshopRouter = source("./routers/workshopRouter.ts");

    expect(checkout).toContain("workshopPresentationQuery");
    expect(checkout).toContain("const presentation = sessionMeta");
    expect(checkout).toContain("Secure checkout needs a refresh");
    expect(checkout).toContain("Try secure checkout again");
    expect(checkout).not.toContain("if (createSession.isError)");
    expect(workshopRouter).toContain("const checkoutTerms = resolveCheckoutTerms(workshop, platformCheckoutSettings)");
  });

});
