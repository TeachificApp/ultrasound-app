-- Shareable Study Group invite links.
-- Additive only. Each link grants ordinary member access and can be revoked or replaced by a group administrator.

CREATE TABLE IF NOT EXISTS `study_group_share_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `token` VARCHAR(128) NOT NULL,
  `created_by_user_id` INT NOT NULL,
  `revoked_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_study_group_share_link_token` (`token`),
  KEY `idx_study_group_share_link_group_active` (`group_id`, `revoked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
