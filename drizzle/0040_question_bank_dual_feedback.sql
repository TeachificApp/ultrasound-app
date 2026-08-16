ALTER TABLE `question_bank` ADD COLUMN `correct_feedback` LONGTEXT NULL AFTER `explanation`;
ALTER TABLE `question_bank` ADD COLUMN `incorrect_feedback` LONGTEXT NULL AFTER `correct_feedback`;
