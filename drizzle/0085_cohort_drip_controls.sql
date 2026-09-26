-- Additive cohort drip controls. Existing records remain available immediately.
ALTER TABLE `lms_cohort_assignments` ADD COLUMN `lesson_id` INT NULL;
ALTER TABLE `lms_cohort_assignments` ADD COLUMN `drip_days` INT NOT NULL DEFAULT 0;
ALTER TABLE `lms_cohort_recordings` ADD COLUMN `drip_days` INT NOT NULL DEFAULT 0;
ALTER TABLE `lms_cohort_groups` ADD COLUMN `recordings_enabled` BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX `lms_cohort_assignments_lesson_idx` ON `lms_cohort_assignments` (`lesson_id`);
