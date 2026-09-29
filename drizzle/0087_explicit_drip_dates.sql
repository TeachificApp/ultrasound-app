-- Additive explicit release dates for native lessons and cohort content.
-- Existing rows remain on their current day-based/default release behavior.
ALTER TABLE `lms_lessons`
  ADD COLUMN `drip_date` TIMESTAMP NULL AFTER `drip_days`;

ALTER TABLE `lms_cohort_assignments`
  ADD COLUMN `drip_date` TIMESTAMP NULL AFTER `drip_release_mode`;

ALTER TABLE `lms_cohort_recordings`
  MODIFY COLUMN `drip_release_mode` ENUM('after_enrollment','after_publish','after_cohort_start','specific_date') NOT NULL DEFAULT 'after_enrollment',
  ADD COLUMN `drip_date` TIMESTAMP NULL AFTER `drip_release_mode`;

ALTER TABLE `lms_cohort_assignments`
  MODIFY COLUMN `drip_release_mode` ENUM('after_enrollment','after_publish','after_cohort_start','specific_date') NOT NULL DEFAULT 'after_enrollment';
