-- Per-content email copy overrides for future purchase confirmations.
-- Saving or applying this schema never sends email and does not alter prior purchases.
CREATE TABLE IF NOT EXISTS `purchase_email_overrides` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content_type` varchar(64) NOT NULL,
  `content_id` int NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `subject` varchar(500),
  `heading` varchar(500),
  `intro` text,
  `details_html` longtext,
  `created_by_user_id` int,
  `updated_by_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_email_override_content_unique` (`content_type`, `content_id`),
  KEY `purchase_email_override_enabled_idx` (`enabled`, `updated_at`)
);
