-- Retain Stripe-managed Premium Trial state for reliable admin and learner displays.
-- Existing memberships are non-trial unless a Stripe event or Checkout fulfillment marks them otherwise.
ALTER TABLE `brandMemberships`
  ADD COLUMN `isTrial` BOOLEAN NOT NULL DEFAULT FALSE AFTER `cancelAtPeriodEnd`;

ALTER TABLE `brandMemberships`
  ADD COLUMN `trialEndsAt` TIMESTAMP NULL AFTER `isTrial`;
