import type { EmailRecipient, SendEmailOptions } from "./email/types";

/** Receives a blind copy of every purchase / access-grant email. */
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

function mergeBcc(existing?: EmailRecipient[]): EmailRecipient[] {
  const out: EmailRecipient[] = [];
  const seen = new Set<string>();
  for (const r of [...(existing ?? []), ADMIN_RECIPIENT]) {
    const key = normalizeEmailAddress(r.email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export type PurchaseAccessEmailOptions = SendEmailOptions & {
  purchaseAccess?: {
    payee?: EmailRecipient | null;
  };
};

export async function withPurchaseAccessRecipients(
  base: SendEmailOptions,
  ctx: {
    userId?: number | null;
    checkoutEmail?: string | null;
    checkoutName?: string | null;
  },
): Promise<SendEmailOptions> {
  if (ctx.userId) {
    const { to, payee } = await resolvePurchaseEmailTargets({
      userId: ctx.userId,
      checkoutEmail: ctx.checkoutEmail,
      checkoutName: ctx.checkoutName,
    });
    if (to.email) {
      return { ...base, to, purchaseAccess: { payee }, transactional: base.transactional ?? true };
    }
  }
  return { ...base, purchaseAccess: {}, transactional: base.transactional ?? true };
}

export async function deliverPurchaseAccessEmail(
  opts: PurchaseAccessEmailOptions,
  sendOnce: (opts: SendEmailOptions) => Promise<boolean>,
): Promise<boolean> {
  const { purchaseAccess, ...base } = opts;
  const payee = purchaseAccess?.payee ?? null;
  const bcc = mergeBcc(base.bcc);
  const transactional = base.transactional ?? true;

  const primaryOk = await sendOnce({ ...base, bcc, transactional });

  let payeeOk = true;
  if (payee?.email && !emailsEqual(payee.email, base.to.email)) {
    payeeOk = await sendOnce({
      ...base,
      to: payee,
      bcc,
      transactional,
    });
  }

  return primaryOk && payeeOk;
}
