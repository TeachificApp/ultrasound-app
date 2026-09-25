-- Scheduled cohort-group and workshop-instance entitlement links.
-- Additive only: no existing learner, payment, resource, or schedule record is modified.
CREATE TABLE IF NOT EXISTS `scheduled_content_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `source_type` ENUM('cohort_group','workshop_instance') NOT NULL,
  `source_id` INT NOT NULL,
  `target_type` ENUM('course','download','webinar','workshop_instance') NOT NULL,
  `target_id` INT NOT NULL,
  `access_duration_days` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `scheduled_content_links_source_idx` (`source_type`, `source_id`, `sort_order`),
  INDEX `scheduled_content_links_target_idx` (`target_type`, `target_id`)
);
