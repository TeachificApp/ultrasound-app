-- Organization Study Groups can own their TEACH live games without changing
-- existing TEACH, SonoQuiz, Question Bank, or learner records.
ALTER TABLE `sonoQuizzes`
  ADD COLUMN IF NOT EXISTS `studyGroupId` INT NULL AFTER `educatorOrgId`;

CREATE INDEX `idx_sono_quizzes_study_group_updated`
  ON `sonoQuizzes` (`studyGroupId`, `updatedAt`);
