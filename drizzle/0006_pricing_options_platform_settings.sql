-- Migration: lms_pricing_options table, platform_settings table, and send_enrollment_email column on lms_courses
-- Also adds course_overview_top_blocks and course_overview_bottom_blocks columns (from previous pending migration)

-- Add new columns to lms_courses (if not already present)
ALTER TABLE `lms_courses`
  ADD COLUMN IF NOT EXISTS `course_overview_top_blocks` LONGTEXT,
  ADD COLUMN IF NOT EXISTS `course_overview_bottom_blocks` LONGTEXT,
  ADD COLUMN IF NOT EXISTS `send_enrollment_email` BOOLEAN NOT NULL DEFAULT TRUE;

-- Platform settings singleton (id always = 1)
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `id` INT NOT NULL DEFAULT 1 PRIMARY KEY,
  `enrollment_email_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `enrollment_email_subject` VARCHAR(255),
  `enrollment_email_intro` TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert the singleton row if it doesn't exist
INSERT IGNORE INTO `platform_settings` (`id`) VALUES (1);

-- Secondary pricing options for courses
CREATE TABLE IF NOT EXISTS `lms_pricing_options` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `sublabel` VARCHAR(500),
  `pricing_type` ENUM('one_time','subscription','payment_plan','free') NOT NULL DEFAULT 'one_time',
  `price` INT NOT NULL DEFAULT 0,
  `stripe_price_id` VARCHAR(255),
  `subscription_interval` ENUM('monthly','quarterly','annual'),
  `down_payment` INT DEFAULT 0,
  `installment_count` INT DEFAULT 0,
  `installment_amount` INT DEFAULT 0,
  `installment_interval_days` INT DEFAULT 30,
  `cta_label` VARCHAR(100),
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pricing_options_course` (`course_id`)
);
