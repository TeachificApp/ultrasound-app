-- Preserve Stripe cancel_at_period_end for Brand Memberships without ending access early.
ALTER TABLE `brandMemberships`
  ADD COLUMN `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT FALSE AFTER `expiresAt`;
