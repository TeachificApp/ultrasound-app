-- Sync lms_cohort_groups schema on Railway MySQL after Manus TiDB mirror.
-- App startup also runs ensureLmsCohortGroupsSchema.ts (checks INFORMATION_SCHEMA first).

ALTER TABLE `lms_cohort_groups`
  MODIFY COLUMN `status` ENUM('draft','open','active','completed','archived','waitlist','presale') NOT NULL DEFAULT 'draft';

ALTER TABLE `lms_cohort_groups` ADD COLUMN `location` VARCHAR(300) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `duration_hours` INT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `landing_blocks` LONGTEXT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `access_duration_days` INT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_enabled` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_heading` VARCHAR(500) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_body` LONGTEXT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_cta_label` VARCHAR(255) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_cta_url` VARCHAR(2048) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_redirect_url` VARCHAR(2048) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `waitlist_success_message` LONGTEXT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `presale_welcome_body` LONGTEXT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `presale_welcome_media_url` TEXT NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;
