import type { EmailRecipient, SendEmailOptions } from "./email/types";

/** Receives a token-free operational purchase receipt for every access grant. */
export const PURCHASE_ACCESS_ADMIN_EMAIL = "admin@allaboutultrasound.com";

const ADMIN_RECIPIENT: EmailRecipient = {
  name: "AAUS Admin",
  email: PURCHASE_ACCESS_ADMIN_EMAIL,
};

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsEqual(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeEmailAddress(a) === normalizeEmailAddress(b);
}

export function resolvePurchaseAccessRecipients(opts: {
  learner: EmailRecipient;
  payeeEmail?: string | null;
  payeeName?: string | null;
}): { learner: EmailRecipient; payee: EmailRecipient | null } {
  const payeeEmail = opts.payeeEmail?.trim();
  if (!payeeEmail || emailsEqual(payeeEmail, opts.learner.email)) {
    return { learner: opts.learner, payee: null };
  }
  const payeeName = opts.payeeName?.trim() || payeeEmail.split("@")[0] || "Purchaser";
  return {
    learner: opts.learner,
    payee: { name: payeeName, email: payeeEmail },
  };
}

export async function resolvePurchaseEmailTargets(opts: {
  userId: number;
  checkoutEmail?: string | null;
  checkoutName?: string | null;
}): Promise<{ to: EmailRecipient; payee: EmailRecipient | null }> {
  const { getUserById } = await import("../db");
  const user = await getUserById(opts.userId);
  const learnerEmail = user?.email?.trim();
  if (learnerEmail) {
    const learner: EmailRecipient = {
      name: user!.name?.trim() || learnerEmail.split("@")[0] || "Learner",
      email: learnerEmail,
    };
    const { payee } = resolvePurchaseAccessRecipients({
      learner,
      payeeEmail: opts.checkoutEmail,
      payeeName: opts.checkoutName,
    });
    return { to: learner, payee };
  }

  const checkoutEmail = opts.checkoutEmail?.trim();
  if (!checkoutEmail) {
    return { to: { name: "Customer", email: "" }, payee: null };
  }
  return {
    to: {
      name: opts.checkoutName?.trim() || checkoutEmail.split("@")[0] || "Customer",
      email: checkoutEmail,
    },
    payee: null,
  };
}

export type PurchaseAccessEmailOptions = SendEmailOptions & {
  purchaseAccess?: {
    payee?: EmailRecipient | null;
    userId?: number | null;
    contentTitle?: string | null;
    amountCents?: number | null;
    currency?: string | null;
  };
};

export async function withPurchaseAccessRecipients(
  base: SendEmailOptions,
  ctx: {
    userId?: number | null;
    checkoutEmail?: string | null;
    checkoutName?: string | null;
    contentTitle?: string | null;
    amountCents?: number | null;
    currency?: string | null;
  },
): Promise<SendEmailOptions> {
  if (ctx.userId) {
    const { to, payee } = await resolvePurchaseEmailTargets({
      userId: ctx.userId,
      checkoutEmail: ctx.checkoutEmail,
      checkoutName: ctx.checkoutName,
    });
    if (to.email) {
      return {
        ...base,
        to,
        purchaseAccess: {
          payee,
          userId: ctx.userId,
          contentTitle: ctx.contentTitle ?? null,
          amountCents: ctx.amountCents ?? null,
          currency: ctx.currency ?? null,
        },
        transactional: base.transactional ?? true,
      };
    }
  }
  return {
    ...base,
    purchaseAccess: {
      userId: ctx.userId ?? null,
      contentTitle: ctx.contentTitle ?? null,
      amountCents: ctx.amountCents ?? null,
      currency: ctx.currency ?? null,
    },
    transactional: base.transactional ?? true,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

/**
 * Purchase receipts deliberately contain no copied email body, destination, or
 * bearer token. A payer may be different from the enrolled learner, so an
 * access link must never be forwarded to the payer or an operational mailbox.
 */
function moneyLabel(amountCents?: number | null, currency?: string | null): string {
  if (!Number.isFinite(amountCents)) return "Not recorded";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format((amountCents as number) / 100);
  } catch {
    return `$${((amountCents as number) / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
  }
}

/**
 * Purchase receipts deliberately contain no copied email body, destination, or
 * bearer token. A payer may be different from the enrolled learner, so an
 * access link must never be forwarded to the payer or an operational mailbox.
 */
function buildTokenFreeReceipt(base: SendEmailOptions, to: EmailRecipient, isAdminReceipt = false): SendEmailOptions {
  const access = base.purchaseAccess;
  const productLabel = escapeHtml(access?.contentTitle?.trim() || base.subject.replace(/^(your|welcome to|purchase confirmed:?)/i, "").trim() || "your purchase");
  const recipientName = escapeHtml(to.name || "there");
  const learnerName = escapeHtml(base.to.name || "Learner");
  const learnerEmail = escapeHtml(base.to.email || "Not recorded");
  const pricePaid = escapeHtml(moneyLabel(access?.amountCents, access?.currency));
  const memberProfileUrl = access?.userId && Number.isInteger(access.userId) && access.userId > 0
    ? `https://app.allaboutultrasound.com/admin/users/${access.userId}`
    : null;
  const adminDetailRows = isAdminReceipt ? `
        <tr><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#64748b;width:38%;">Learner</td><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#0f172a;font-weight:600;">${learnerName}</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#64748b;">Learner email</td><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#0f172a;"><a href="mailto:${learnerEmail}" style="color:#0d9488;text-decoration:none;">${learnerEmail}</a></td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#64748b;">Registered content</td><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#0f172a;">${productLabel}</td></tr>
        <tr><td style="padding:9px 12px;color:#64748b;">Price paid</td><td style="padding:9px 12px;color:#0f172a;font-weight:700;">${pricePaid}</td></tr>
      ` : "";
  const adminProfileCta = isAdminReceipt && memberProfileUrl
    ? `<p style="margin:20px 0 0;"><a href="${memberProfileUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:11px 18px;border-radius:7px;text-decoration:none;font-weight:700;">Open Member Profile</a></p>`
    : "";
  const payeeDetailRows = !isAdminReceipt ? `
        <tr><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#64748b;width:38%;">Enrolled learner</td><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#0f172a;font-weight:600;">${learnerName}</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#64748b;">Item</td><td style="padding:9px 12px;border-bottom:1px solid #e5f0f1;color:#0f172a;">${productLabel}</td></tr>
        <tr><td style="padding:9px 12px;color:#64748b;">Amount paid</td><td style="padding:9px 12px;color:#0f172a;font-weight:700;">${pricePaid}</td></tr>
      ` : "";
  return {
    to,
    subject: `Purchase confirmation — ${base.subject}`,
    htmlBody: `<!doctype html><html><body style="margin:0;padding:24px;background:#f0fbfc;font-family:Arial,sans-serif;color:#334155;">
      <main style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
        <h2 style="margin:0 0 16px;color:#0e4a50;">Purchase confirmed</h2>
        <p>Hi ${recipientName},</p>
        ${isAdminReceipt ? `<p>A learner purchase has been completed and access has been prepared.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #dceff0;border-radius:8px;border-collapse:separate;border-spacing:0;margin:18px 0;background:#fbffff;">${adminDetailRows}</table>${adminProfileCta}` : `<p>A purchase has been completed for <strong>${productLabel}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #dceff0;border-radius:8px;border-collapse:separate;border-spacing:0;margin:18px 0;background:#fbffff;">${payeeDetailRows}</table>
        <p>The enrolled learner has received their secure access instructions separately.</p>`}
        <p style="margin:20px 0 0;font-size:12px;color:#64748b;">For privacy, this confirmation does not include any sign-in or access link.</p>
      </main>
    </body></html>`,
    previewText: isAdminReceipt
      ? `Purchase confirmed for ${base.to.name || "a learner"}: ${access?.contentTitle || "content"}.`
      : "Purchase confirmed. Secure access instructions were sent to the enrolled learner.",
    brandMode: base.brandMode,
    transactional: true,
  };
}
export async function deliverPurchaseAccessEmail(
  opts: PurchaseAccessEmailOptions,
  sendOnce: (opts: SendEmailOptions) => Promise<boolean>,
): Promise<boolean> {
  const { purchaseAccess, ...deliveryBase } = opts;
  // Keep non-secret operational metadata available while rendering the
  // administrator receipt, but never include it in the learner send payload.
  const base: SendEmailOptions = { ...deliveryBase, purchaseAccess };
  const payee = purchaseAccess?.payee ?? null;
  const transactional = deliveryBase.transactional ?? true;

  // Only the learner receives the message containing the bearer access link.
  const learnerDelivered = await sendOnce({ ...deliveryBase, transactional });

  // Payer and admin copies are separate, deliberately token-free confirmations.
  // They are best-effort and must not cause a retry that resends the learner link.
  const receiptRecipients = [
    ...(payee && !emailsEqual(payee.email, base.to.email) ? [payee] : []),
    ...(!emailsEqual(ADMIN_RECIPIENT.email, base.to.email) && !emailsEqual(ADMIN_RECIPIENT.email, payee?.email)
      ? [ADMIN_RECIPIENT]
      : []),
  ];
  await Promise.all(receiptRecipients.map(async (recipient) => {
    try {
      await sendOnce(buildTokenFreeReceipt(base, recipient, emailsEqual(recipient.email, ADMIN_RECIPIENT.email)));
    } catch (error) {
      console.error(`[purchaseAccessEmailDelivery] Receipt send failed for ${recipient.email}:`, error);
    }
  }));

  return learnerDelivered;
}
