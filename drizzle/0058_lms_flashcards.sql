-- LMS Flashcards: additive Question Bank card fields, source tracking, and standalone deck type.
-- Existing quiz, mock exam, question, learner, and app-flashcard records remain unchanged.
ALTER TABLE `question_bank`
  MODIFY COLUMN `type` ENUM('mcq','truefalse','multiselect','hotspot','matching','flashcard') NOT NULL DEFAULT 'mcq';

ALTER TABLE `question_bank`
  ADD COLUMN IF NOT EXISTS `flashcard_front` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `flashcard_back` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `flashcard_hint` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `flashcard_back_image_url` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `source_quickfire_question_id` INT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `uq_question_bank_source_quickfire`
  ON `question_bank` (`source_quickfire_question_id`);

ALTER TABLE `standalone_quizzes`
  MODIFY COLUMN `type` ENUM('quiz','mock_exam','flashcards') NOT NULL DEFAULT 'quiz';
