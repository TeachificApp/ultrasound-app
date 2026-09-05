-- Run against production MySQL if Quiz Creator shows "Failed query" on standalone_quizzes.
-- Safe to re-run: uses IF NOT EXISTS / idempotent enum updates where supported.

ALTER TABLE `standalone_quizzes`
  ADD COLUMN IF NOT EXISTS `read_aloud_enabled` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `standalone_quizzes`
  ADD COLUMN IF NOT EXISTS `read_aloud_voice` ENUM('female', 'male') NOT NULL DEFAULT 'female';

ALTER TABLE `standalone_quizzes`
  ADD COLUMN IF NOT EXISTS `account_fields` LONGTEXT NULL;

ALTER TABLE `standalone_quizzes`
  MODIFY COLUMN `type` ENUM('quiz','mock_exam','flashcards') NOT NULL DEFAULT 'quiz';

ALTER TABLE `standalone_quiz_attempts`
  ADD COLUMN IF NOT EXISTS `account_field_values` LONGTEXT NULL;
