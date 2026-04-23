-- LMS Education Library tables

CREATE TABLE IF NOT EXISTS `lms_courses` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `slug` varchar(255) NOT NULL UNIQUE,
  `title` varchar(255) NOT NULL,
  `subtitle` varchar(500),
  `description` longtext,
  `cover_image_url` text,
  `status` enum('draft','public','hidden','private') NOT NULL DEFAULT 'draft',
  `type` enum('course','quiz','download') NOT NULL DEFAULT 'course',
  `brand` enum('aaus','iheartecho') NOT NULL DEFAULT 'aaus',
  `price` int NOT NULL DEFAULT 0,
  `is_free` boolean NOT NULL DEFAULT false,
  `currency` varchar(8) NOT NULL DEFAULT 'usd',
  `meta_title` varchar(255),
  `meta_description` text,
  `has_certificate` boolean NOT NULL DEFAULT false,
  `is_drip` boolean NOT NULL DEFAULT false,
  `created_by_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_sections` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `course_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `position` int NOT NULL DEFAULT 0,
  `is_preview` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_lessons` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `section_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` enum('video','text','quiz','download') NOT NULL DEFAULT 'text',
  `content` longtext,
  `media_asset_id` int,
  `position` int NOT NULL DEFAULT 0,
  `is_preview` boolean NOT NULL DEFAULT false,
  `drip_days` int NOT NULL DEFAULT 0,
  `duration_minutes` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_quizzes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `lesson_id` int NOT NULL UNIQUE,
  `title` varchar(255) NOT NULL,
  `passing_score` int NOT NULL DEFAULT 70,
  `allow_retakes` boolean NOT NULL DEFAULT true,
  `show_correct_answers` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_quiz_questions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `question` text NOT NULL,
  `type` enum('mcq','truefalse') NOT NULL DEFAULT 'mcq',
  `options` text,
  `correct_answer` varchar(255) NOT NULL,
  `explanation` text,
  `position` int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `lms_enrollments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `course_id` int NOT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp,
  `progress_pct` int NOT NULL DEFAULT 0,
  `group_id` int,
  `affiliate_code` varchar(64),
  `order_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_lesson_progress` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` int NOT NULL,
  `lesson_id` int NOT NULL,
  `completed_at` timestamp,
  `quiz_score` int,
  `quiz_passed` boolean,
  `attempts` int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `lms_groups` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `course_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `seats` int NOT NULL DEFAULT 1,
  `manager_id` int,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_group_seats` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `group_id` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enrollment_id` int,
  `invite_token` varchar(128),
  `accepted_at` timestamp
);

CREATE TABLE IF NOT EXISTS `lms_instructors` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int,
  `name` varchar(255) NOT NULL,
  `title` varchar(255),
  `bio` longtext,
  `avatar_url` text,
  `website` varchar(255),
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_course_instructors` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `course_id` int NOT NULL,
  `instructor_id` int NOT NULL,
  `revenue_share_pct` int NOT NULL DEFAULT 0,
  `is_primary` boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS `lms_affiliates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `code` varchar(64) NOT NULL UNIQUE,
  `commission_pct` int NOT NULL DEFAULT 10,
  `is_active` boolean NOT NULL DEFAULT true,
  `total_earned` int NOT NULL DEFAULT 0,
  `total_paid` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_affiliate_conversions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `affiliate_id` int NOT NULL,
  `enrollment_id` int NOT NULL,
  `order_id` int NOT NULL,
  `sale_amount` int NOT NULL,
  `commission_amount` int NOT NULL,
  `paid_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_landing_pages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `course_id` int NOT NULL UNIQUE,
  `hero_title` varchar(255),
  `hero_subtitle` text,
  `hero_image_url` text,
  `body_content` longtext,
  `cta_text` varchar(128) DEFAULT 'Enroll Now',
  `what_you_learn` longtext,
  `requirements` longtext,
  `is_custom` boolean NOT NULL DEFAULT false,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `lms_orders` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `course_id` int NOT NULL,
  `amount` int NOT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'usd',
  `stripe_payment_intent_id` varchar(255),
  `stripe_session_id` varchar(255),
  `status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `affiliate_id` int,
  `group_id` int,
  `seats` int NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
