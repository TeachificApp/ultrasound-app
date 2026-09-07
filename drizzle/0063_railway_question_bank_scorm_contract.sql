-- Railway MySQL alignment for the existing Question Bank and SCORM import contract.
-- These nullable fields are schema compatibility only; SCORM parsing continues to save
-- its native question types and does not create flashcard records.
ALTER TABLE `question_bank`
  ADD COLUMN `flashcard_front` LONGTEXT NULL,
  ADD COLUMN `flashcard_back` LONGTEXT NULL,
  ADD COLUMN `flashcard_hint` TEXT NULL,
  ADD COLUMN `flashcard_back_image_url` TEXT NULL,
  ADD COLUMN `source_quickfire_question_id` INT NULL;

ALTER TABLE `question_bank`
  MODIFY COLUMN `type` ENUM('mcq', 'truefalse', 'multiselect', 'hotspot', 'matching', 'flashcard') NOT NULL DEFAULT 'mcq';
