CREATE TABLE `lms_inline_quiz_attempts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `course_id` int NOT NULL,
  `lesson_id` int NOT NULL,
  `quiz_block_id` varchar(128) NOT NULL,
  `score` int NOT NULL,
  `passed` boolean NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `lms_inline_quiz_attempts_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_inline_quiz_attempt_course_lesson` ON `lms_inline_quiz_attempts` (`course_id`,`lesson_id`);
CREATE INDEX `idx_inline_quiz_attempt_user` ON `lms_inline_quiz_attempts` (`user_id`);

CREATE TABLE `lms_inline_quiz_responses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `attempt_id` int NOT NULL,
  `question_key` varchar(128) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(32) NOT NULL,
  `answer_value` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `lms_inline_quiz_responses_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_inline_quiz_response_attempt` ON `lms_inline_quiz_responses` (`attempt_id`);
