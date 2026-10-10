-- Railway MySQL is the sole production application database.
-- These additive tables preserve legacy production records that were absent from
-- the Railway schema. Every statement is idempotent and non-destructive.

CREATE TABLE IF NOT EXISTS `coupon_metadata` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `stripe_coupon_id` VARCHAR(255) NOT NULL,
  `scope` VARCHAR(32) NOT NULL DEFAULT 'site_wide',
  `product_keys` TEXT NULL,
  `duration` VARCHAR(32) NOT NULL DEFAULT 'once',
  `duration_in_months` INT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_metadata_stripe_coupon_id_unique` (`stripe_coupon_id`)
);

CREATE TABLE IF NOT EXISTS `lms_subscription_invoices` (
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

CREATE TABLE IF NOT EXISTS `survey_pulse_responses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `state` VARCHAR(2) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `credentials_json` TEXT NULL,
  `experience_band` VARCHAR(40) NOT NULL,
  `employment_setting` VARCHAR(100) NOT NULL,
  `employment_type` VARCHAR(50) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `annual_base_salary_cents` INT NOT NULL,
  `hourly_rate_cents` INT NULL,
  `weekly_hours` SMALLINT NULL,
  `call_responsibilities` BOOLEAN NOT NULL DEFAULT FALSE,
  `call_pay_type` VARCHAR(80) NULL,
  `additional_compensation_cents` INT NULL,
  `travel_assignment` BOOLEAN NOT NULL DEFAULT FALSE,
  `benefits_json` TEXT NULL,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_survey_pulse_state` (`state`),
  KEY `idx_survey_pulse_specialty` (`specialty`),
  KEY `idx_survey_pulse_submitted` (`submitted_at`)
);

CREATE TABLE IF NOT EXISTS `thinkificWebhookEvents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `eventType` VARCHAR(128) NOT NULL,
  `thinkificUserId` VARCHAR(128) NULL,
  `userEmail` VARCHAR(320) NULL,
  `payload` JSON NULL,
  `processedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `webhookEvents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `source` VARCHAR(64) NOT NULL DEFAULT 'thinkific',
  `stripeEventId` VARCHAR(128) NULL,
  `resource` VARCHAR(64) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NULL,
  `productName` VARCHAR(512) NULL,
  `httpStatus` INT NOT NULL DEFAULT 200,
  `outcome` VARCHAR(64) NOT NULL DEFAULT 'ignored',
  `message` TEXT NULL,
  `rawPayload` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_webhookEvents_stripeEventId` (`stripeEventId`)
);
