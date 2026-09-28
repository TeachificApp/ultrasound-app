-- Additive cohort drip release bases. Existing rows default to after enrollment.
ALTER TABLE `lms_cohort_assignments`
  ADD COLUMN `drip_release_mode` ENUM('after_enrollment','after_publish','after_cohort_start') NOT NULL DEFAULT 'after_enrollment',
  ADD COLUMN `published_at` TIMESTAMP NULL;

ALTER TABLE `lms_cohort_recordings`
  ADD COLUMN `drip_release_mode` ENUM('after_enrollment','after_publish','after_cohort_start') NOT NULL DEFAULT 'after_enrollment',
  ADD COLUMN `published_at` TIMESTAMP NULL;
