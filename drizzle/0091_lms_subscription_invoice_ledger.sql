-- Additive recurring LMS subscription invoice ledger.
-- Initial Checkout payments remain in lms_orders; each later Stripe-paid invoice
-- is mirrored once by its Stripe invoice ID for reconciliation and transaction history.
CREATE TABLE `lms_subscription_invoices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `order_id` INT NOT NULL,
  `stripe_subscription_id` VARCHAR(255) NOT NULL,
  `stripe_invoice_id` VARCHAR(255) NOT NULL,
  `stripe_payment_intent_id` VARCHAR(255) NULL,
  `amount_paid` INT NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'usd',
  `invoice_number` VARCHAR(255) NULL,
  `invoice_url` TEXT NULL,
  `description` VARCHAR(1024) NULL,
  `paid_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lms_subscription_invoices_stripe_invoice_unique` (`stripe_invoice_id`),
  KEY `lms_subscription_invoices_user_paid_idx` (`user_id`, `paid_at`),
  KEY `lms_subscription_invoices_order_idx` (`order_id`)
);
