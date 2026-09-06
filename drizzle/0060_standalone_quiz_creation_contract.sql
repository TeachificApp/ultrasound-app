-- Align the standalone_quizzes table with the active Quiz Creator insert
-- contract. Both additions are additive and preserve all existing quiz,
-- question, attempt, and result records unchanged.
ALTER TABLE `standalone_quizzes`
  ADD COLUMN `allow_retakes_type` varchar(64) NULL DEFAULT NULL AFTER `allow_retakes`,
  ADD COLUMN `show_per_question_score` tinyint(1) NOT NULL DEFAULT 1 AFTER `show_group_names`;
