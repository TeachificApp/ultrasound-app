-- Railway MySQL standalone quiz creation contract alignment.
-- This is additive except for extending the existing type enum with `flashcards`.
ALTER TABLE `standalone_quizzes`
  ADD COLUMN IF NOT EXISTS `read_aloud_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `read_aloud_voice` ENUM('female','male') NOT NULL DEFAULT 'female',
  ADD COLUMN IF NOT EXISTS `allow_retakes_type` VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `show_per_question_score` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `account_fields` LONGTEXT NULL;

ALTER TABLE `standalone_quizzes`
  MODIFY COLUMN `type` ENUM('quiz','mock_exam','flashcards') NOT NULL DEFAULT 'quiz';
