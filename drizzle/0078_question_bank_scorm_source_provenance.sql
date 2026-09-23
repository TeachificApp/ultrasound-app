-- Durable iSpring/SCORM source identity for idempotent package reimports.
-- Additive only: existing Question Bank rows, media, folders, tags, and learner records are unchanged.
ALTER TABLE `question_bank`
  ADD COLUMN IF NOT EXISTS `scorm_source_asset_id` INT NULL,
  ADD COLUMN IF NOT EXISTS `scorm_source_question_id` VARCHAR(160) NULL;

CREATE INDEX `question_bank_scorm_source_idx`
  ON `question_bank` (`scorm_source_asset_id`, `scorm_source_question_id`);
