-- Migration: Quiz Question Groups
-- Adds useQuestionGroups + questionBankFolderId to lms_quizzes,
-- selectedQuestionIds to lms_quiz_attempts,
-- and creates lms_quiz_question_groups + lms_quiz_group_questions tables.

ALTER TABLE `lms_quizzes`
  ADD COLUMN `use_question_groups` boolean NOT NULL DEFAULT false,
  ADD COLUMN `question_bank_folder_id` int;

ALTER TABLE `lms_quiz_attempts`
  ADD COLUMN `selected_question_ids` text;

CREATE TABLE IF NOT EXISTS `lms_quiz_question_groups` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `display_count` int NOT NULL DEFAULT 1,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `lms_quiz_group_questions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `group_id` int NOT NULL,
  `question_bank_id` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now())
);
