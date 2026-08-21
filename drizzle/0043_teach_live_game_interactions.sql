ALTER TABLE `sonoQuizzes`
  ADD COLUMN `isTeachGame` boolean NOT NULL DEFAULT false,
  ADD COLUMN `ownerContext` enum('platform','lms_instructor','educator_assist') NOT NULL DEFAULT 'platform',
  ADD COLUMN `educatorOrgId` int,
  ADD COLUMN `importSource` enum('manual','kahoot_xlsx') NOT NULL DEFAULT 'manual';

ALTER TABLE `sonoQuizQuestions`
  ADD COLUMN `interactionType` enum('multiple_choice','true_false','word_cloud','hotspot','puzzle') NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN `interactionConfig` longtext,
  ADD COLUMN `slideTitle` varchar(300);

ALTER TABLE `sonoQuizAnswers`
  ADD COLUMN `responsePayload` longtext;
