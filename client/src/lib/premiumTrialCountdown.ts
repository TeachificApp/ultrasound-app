export type PremiumTrialStatus = {
  status?: string | null;
  trialEnd?: Date | string | number | null;
};

export type PremiumTrialCountdown = {
  endsAt: Date;
  remainingMs: number;
  isFinalDay: boolean;
};

function toFutureDate(value: PremiumTrialStatus["trialEnd"], now: number): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > now ? parsed : null;
}

/** Stripe's live status and trial end are the only client inputs used for the dashboard trial UI. */
export function getActivePremiumTrial(
  subscriptions: Array<PremiumTrialStatus | null | undefined> | null | undefined,
  now = Date.now(),
): PremiumTrialCountdown | null {
  for (const subscription of subscriptions ?? []) {
    // Dashboard membership records can represent a non-Stripe/free or legacy
    // membership. Those records have no live Stripe subscription payload.
    if (!subscription) continue;
    if (subscription.status !== "trialing") continue;
    const endsAt = toFutureDate(subscription.trialEnd, now);
    if (!endsAt) continue;
    const remainingMs = endsAt.getTime() - now;
    return {
      endsAt,
      remainingMs,
      isFinalDay: remainingMs <= 24 * 60 * 60 * 1000,
    };
  }
  return null;
}

export function formatPremiumTrialCountdown(remainingMs: number): string {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m`;
}

export function formatPremiumTrialEnd(value: Date | string | number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "the end of your trial";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const TRIAL_CANCELLATION_REASONS = [
  { value: "not_selected", label: "Prefer not to say" },
  { value: "too_expensive", label: "The membership price is outside my budget" },
  { value: "not_enough_time", label: "I did not have enough time to use it" },
  { value: "missing_features", label: "I need features or content that are not available" },
  { value: "technical_issue", label: "I encountered a technical issue" },
  { value: "found_an_alternative", label: "I found another resource" },
  { value: "other", label: "Other" },
] as const;

export type TrialCancellationReason = (typeof TRIAL_CANCELLATION_REASONS)[number]["value"];
