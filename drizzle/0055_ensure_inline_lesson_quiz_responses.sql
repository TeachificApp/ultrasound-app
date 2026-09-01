CREATE TABLE IF NOT EXISTS `lms_inline_quiz_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `course_id` int NOT NULL,
  `lesson_id` int NOT NULL,
  `quiz_block_id` varchar(128) NOT NULL,
  `score` int NOT NULL,
  `passed` boolean NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inline_quiz_attempt_course_lesson` (`course_id`,`lesson_id`),
  KEY `idx_inline_quiz_attempt_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `lms_inline_quiz_responses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attempt_id` int NOT NULL,
  `question_key` varchar(128) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(32) NOT NULL,
  `answer_value` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inline_quiz_response_attempt` (`attempt_id`)
);
