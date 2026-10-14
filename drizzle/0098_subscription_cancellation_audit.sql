-- Record the exact time a learner requested a subscription cancellation.
-- Additive-only migration; existing subscriptions remain unchanged.
ALTER TABLE `lms_orders`
  ADD COLUMN `cancellation_requested_at` timestamp NULL;

CREATE INDEX `lms_orders_cancellation_requested_idx`
  ON `lms_orders` (`cancellation_requested_at`);
