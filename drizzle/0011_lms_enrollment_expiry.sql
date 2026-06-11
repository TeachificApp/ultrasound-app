-- Track enrollment access expiry (Thinkific imports, membership subscriptions)
ALTER TABLE `lms_enrollments`
  ADD COLUMN `access_expires_at` TIMESTAMP NULL DEFAULT NULL AFTER `enrollment_type`,
  ADD COLUMN `source` VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER `access_expires_at`,
  ADD COLUMN `stripe_subscription_id` VARCHAR(128) NULL DEFAULT NULL AFTER `source`;

CREATE INDEX `idx_lms_enrollments_user_course_active` ON `lms_enrollments` (`user_id`, `course_id`, `access_expires_at`);
