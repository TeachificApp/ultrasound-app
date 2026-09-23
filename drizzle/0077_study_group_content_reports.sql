-- Learner-reported private Study Group content, reviewed only by effective Platform Admins.
-- Additive and idempotent; no existing Study Group content or access is changed.
CREATE TABLE IF NOT EXISTS `study_group_content_reports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `reporter_user_id` INT NOT NULL,
  `content_type` ENUM('document', 'message', 'task', 'module') NOT NULL,
  `content_id` INT NOT NULL,
  `reason` VARCHAR(120) NOT NULL,
  `details` TEXT NULL,
  `status` ENUM('open', 'reviewing', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  `reviewed_by_user_id` INT NULL,
  `reviewed_at` TIMESTAMP NULL,
  `resolution_note` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_content_reports_group_status` (`group_id`, `status`),
  KEY `idx_study_group_content_reports_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
