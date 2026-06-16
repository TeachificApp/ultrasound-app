-- Digital download access control, IP tracking, and order activity (FetchApp-style)

ALTER TABLE `digital_purchases`
  ADD COLUMN `amount` INT NULL DEFAULT NULL AFTER `stripe_checkout_session_id`,
  ADD COLUMN `currency` VARCHAR(8) NOT NULL DEFAULT 'usd' AFTER `amount`,
  ADD COLUMN `status` ENUM('open','expired','revoked','refunded') NOT NULL DEFAULT 'open' AFTER `currency`,
  ADD COLUMN `max_downloads_per_file` INT NULL DEFAULT 3 COMMENT 'NULL = unlimited per file' AFTER `status`,
  ADD COLUMN `access_expires_at` TIMESTAMP NULL DEFAULT NULL AFTER `max_downloads_per_file`;

ALTER TABLE `digital_products`
  ADD COLUMN `max_downloads_per_file` INT NULL DEFAULT 3 COMMENT 'Default per-order limit; NULL = unlimited' AFTER `download_count`,
  ADD COLUMN `default_access_days` INT NULL DEFAULT NULL COMMENT 'Days until order expires; NULL = no expiry' AFTER `max_downloads_per_file`;

ALTER TABLE `digital_download_events`
  ADD COLUMN `purchase_id` INT NULL DEFAULT NULL AFTER `file_id`,
  ADD COLUMN `ip_address` VARCHAR(64) NULL DEFAULT NULL AFTER `downloaded_at`,
  ADD COLUMN `user_agent` VARCHAR(500) NULL DEFAULT NULL AFTER `ip_address`;

CREATE INDEX `idx_digital_download_events_purchase` ON `digital_download_events` (`purchase_id`, `file_id`);
CREATE INDEX `idx_digital_purchases_status` ON `digital_purchases` (`status`, `purchased_at`);

CREATE TABLE IF NOT EXISTS `digital_purchase_activity` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `event_type` VARCHAR(32) NOT NULL,
  `message` TEXT NOT NULL,
  `ip_address` VARCHAR(64) NULL,
  `file_id` INT NULL,
  `metadata` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dpa_purchase_created` (`purchase_id`, `created_at`)
);
