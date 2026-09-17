export const PREMIUM_TRIAL_DAYS = 3;
export const PREMIUM_TRIAL_LABEL = `${PREMIUM_TRIAL_DAYS}-day free trial`;
export const PREMIUM_TRIAL_CTA = `Start ${PREMIUM_TRIAL_LABEL}`;
export const PREMIUM_TRIAL_NOTICE = `${PREMIUM_TRIAL_LABEL} · Then $9.97/month unless cancelled`;

export function premiumTrialUpgradeLabel(price = "$9.97/month"): string {
  return `Start ${PREMIUM_TRIAL_LABEL} — then ${price}`;
}
