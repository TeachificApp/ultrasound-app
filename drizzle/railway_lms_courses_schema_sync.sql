-- Sync lms_courses schema on Railway MySQL after Manus TiDB mirror.
-- Run once in Railway → MySQL-UltrasoundAssist → Connect.
-- (App startup also runs ensureLmsCoursesSchema.ts — checks INFORMATION_SCHEMA first.)

ALTER TABLE `lms_courses`
  MODIFY COLUMN `status` ENUM('draft','public','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft',
  MODIFY COLUMN `type` ENUM('course','quiz','download','cohort','workshop') NOT NULL DEFAULT 'course',
  MODIFY COLUMN `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE `lms_courses` ADD COLUMN `enrollment_close_date` TIMESTAMP NULL;
ALTER TABLE `lms_courses` ADD COLUMN `bundle_only` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `meta_keywords` TEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `certificate_template_id` INT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `credit_hours` VARCHAR(16) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `certificate_title_override` VARCHAR(512) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `show_instructor` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `hide_progress` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `show_in_library` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `lms_courses` ADD COLUMN `course_overview_top_blocks` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `course_overview_blocks` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `course_overview_bottom_blocks` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `send_enrollment_email` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `lms_courses` ADD COLUMN `custom_thank_you_enabled` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `custom_thank_you_blocks` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `post_purchase_redirect_url` VARCHAR(1024) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `welcome_email_enabled` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `lms_courses` ADD COLUMN `welcome_email_subject` VARCHAR(500) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `welcome_email_body` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `hide_pricing_options` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_enabled` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_course_id` INT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_product_type` VARCHAR(20) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_product_id` INT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_headline` VARCHAR(500) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `upsell_description` TEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `completion_redirect_url` VARCHAR(1024) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `completion_email_enabled` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `completion_email_subject` VARCHAR(500) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `completion_email_body` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `primary_color` VARCHAR(20) DEFAULT '#179ca3';
ALTER TABLE `lms_courses` ADD COLUMN `accent_color` VARCHAR(20) DEFAULT '#0d9488';
ALTER TABLE `lms_courses` ADD COLUMN `gradient_from` VARCHAR(20) DEFAULT '#179ca3';
ALTER TABLE `lms_courses` ADD COLUMN `gradient_to` VARCHAR(20) DEFAULT '#0d9488';
ALTER TABLE `lms_courses` ADD COLUMN `gradient_direction` VARCHAR(30) DEFAULT '135deg';
ALTER TABLE `lms_courses` ADD COLUMN `thumbnail_url` TEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `custom_labels` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `default_mark_complete` INT NOT NULL DEFAULT 1;
ALTER TABLE `lms_courses` ADD COLUMN `player_theme` ENUM('light','dark') NOT NULL DEFAULT 'light';
ALTER TABLE `lms_courses` ADD COLUMN `allow_group_purchase` TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE `lms_courses` ADD COLUMN `library_order` INT NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `publish_domain` VARCHAR(255) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `multi_cohort_mode` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_enabled` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_heading` VARCHAR(500) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_body` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_cta_label` VARCHAR(255) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_cta_url` VARCHAR(2048) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_redirect_url` VARCHAR(2048) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `waitlist_success_message` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `presale_welcome_body` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `presale_welcome_media_url` TEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `player_sidebar_blocks` LONGTEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `purchase_terms_text` TEXT NULL;
ALTER TABLE `lms_courses` ADD COLUMN `purchase_terms_link_text_1` VARCHAR(255) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `purchase_terms_link_url_1` VARCHAR(2048) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `purchase_terms_link_text_2` VARCHAR(255) NULL;
ALTER TABLE `lms_courses` ADD COLUMN `purchase_terms_link_url_2` VARCHAR(2048) NULL;
