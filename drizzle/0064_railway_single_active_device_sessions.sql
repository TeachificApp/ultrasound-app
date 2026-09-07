-- Railway MySQL: non-admin one-active-device session policy.
-- This migration creates no user sessions and changes no existing user, quiz,
-- learner, payment, order, or revenue-share record.
CREATE TABLE `user_active_sessions` (
  `user_id` int NOT NULL,
  `session_id` varchar(96) NOT NULL,
  `device_hash` varchar(128) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
);

CREATE TABLE IF NOT EXISTS `sso_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(128) NOT NULL,
  `user_id` int NOT NULL,
  `session_id` varchar(96) NULL,
  `used_at` timestamp NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sso_tokens_token_unique` (`token`)
);

ALTER TABLE `sso_tokens`
  ADD COLUMN `session_id` varchar(96) NULL AFTER `user_id`;
