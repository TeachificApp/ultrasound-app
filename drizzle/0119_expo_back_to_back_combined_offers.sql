-- UltrasoundExpo™ and EchoExpo™ are independently purchasable, back-to-back events.
-- This migration is additive and idempotent: it preserves all existing event,
-- package, registration, and payment records.

SET @combined_package_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ultrasound_expo_packages'
    AND COLUMN_NAME = 'combined_with_package_id'
);
SET @combined_package_column_sql = IF(
  @combined_package_column_exists = 0,
  'ALTER TABLE `ultrasound_expo_packages` ADD COLUMN `combined_with_package_id` INT NULL AFTER `is_active`',
  'SELECT 1'
);
PREPARE combined_package_column_statement FROM @combined_package_column_sql;
EXECUTE combined_package_column_statement;
DEALLOCATE PREPARE combined_package_column_statement;

SET @combined_package_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ultrasound_expo_packages'
    AND INDEX_NAME = 'ultrasound_expo_packages_combined_with_idx'
);
SET @combined_package_index_sql = IF(
  @combined_package_index_exists = 0,
  'CREATE INDEX `ultrasound_expo_packages_combined_with_idx` ON `ultrasound_expo_packages` (`combined_with_package_id`)',
  'SELECT 1'
);
PREPARE combined_package_index_statement FROM @combined_package_index_sql;
EXECUTE combined_package_index_statement;
DEALLOCATE PREPARE combined_package_index_statement;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_checkout_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `vendor_application_id` INT NULL,
  `package_type` ENUM('registrant','exhibitor','sponsor') NOT NULL,
  `subtotal_cents` INT NOT NULL,
  `discount_cents` INT NOT NULL,
  `amount_cents` INT NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'usd',
  `stripe_session_id` VARCHAR(255) NULL,
  `stripe_payment_intent_id` VARCHAR(255) NULL,
  `payment_status` ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  `paid_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ultrasound_expo_checkout_groups_session_unique` (`stripe_session_id`),
  KEY `ultrasound_expo_checkout_groups_user_status_idx` (`user_id`, `payment_status`),
  KEY `ultrasound_expo_checkout_groups_vendor_application_idx` (`vendor_application_id`)
);

SET @registration_group_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ultrasound_expo_registrations'
    AND COLUMN_NAME = 'checkout_group_id'
);
SET @registration_group_column_sql = IF(
  @registration_group_column_exists = 0,
  'ALTER TABLE `ultrasound_expo_registrations` ADD COLUMN `checkout_group_id` INT NULL AFTER `vendor_application_id`',
  'SELECT 1'
);
PREPARE registration_group_column_statement FROM @registration_group_column_sql;
EXECUTE registration_group_column_statement;
DEALLOCATE PREPARE registration_group_column_statement;

SET @registration_group_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ultrasound_expo_registrations'
    AND INDEX_NAME = 'ultrasound_expo_registrations_checkout_group_idx'
);
SET @registration_group_index_sql = IF(
  @registration_group_index_exists = 0,
  'CREATE INDEX `ultrasound_expo_registrations_checkout_group_idx` ON `ultrasound_expo_registrations` (`checkout_group_id`)',
  'SELECT 1'
);
PREPARE registration_group_index_statement FROM @registration_group_index_sql;
EXECUTE registration_group_index_statement;
DEALLOCATE PREPARE registration_group_index_statement;

-- The standalone UltrasoundExpo™ program runs immediately before EchoExpo™.
-- EchoExpo™ remains January 14–16, 2028 and remains an independent event.
UPDATE `ultrasound_expo_events`
SET
  `starts_at` = '2028-01-11 12:00:00',
  `ends_at` = '2028-01-13 14:00:00',
  `description` = 'UltrasoundExpo™ is the national ultrasound experience for education, innovation, ScanLabs, exhibits, and connection. It is held immediately before the standalone EchoExpo™ cardiac ultrasound event; attendees and exhibitors may choose either event or both.'
WHERE `slug` = 'ultrasoundexpo-2028';

UPDATE `ultrasound_expo_events`
SET `description` = 'EchoExpo™ by iHeartEcho™ is the standalone cardiac ultrasound and echocardiography event held immediately after UltrasoundExpo™. It features focused cardiac education, Echo Games, Echo Skills, CME hands-on workshops, and its own dedicated exhibit hall.'
WHERE `slug` = 'echoexpo-2028';
