-- Optional native-quiz logo set once on a Question Bank parent folder.
-- Child folders and questions inherit it at delivery time; no Question Bank record is changed.
ALTER TABLE `question_bank_folders`
  ADD COLUMN IF NOT EXISTS `quiz_logo_url` TEXT NULL AFTER `color`;
