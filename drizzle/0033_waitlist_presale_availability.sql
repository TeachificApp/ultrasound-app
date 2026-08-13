ALTER TABLE `lms_courses`
  MODIFY COLUMN `status` ENUM('draft','public','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft',
  ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL,
  ADD COLUMN `presale_welcome_body` LONGTEXT NULL,
  ADD COLUMN `presale_welcome_media_url` TEXT NULL,
  ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL,
  ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;

ALTER TABLE `lms_enrollments`
  MODIFY COLUMN `enrollment_type` ENUM('full','free_preview','admin_preview','presale') NOT NULL DEFAULT 'full';

ALTER TABLE `webinars`
  MODIFY COLUMN `status` ENUM('draft','published','ended','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft',
  ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL,
  ADD COLUMN `presale_welcome_body` LONGTEXT NULL,
  ADD COLUMN `presale_welcome_media_url` TEXT NULL,
  ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL,
  ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;

ALTER TABLE `lms_cohort_groups`
  MODIFY COLUMN `status` ENUM('draft','open','active','completed','archived','waitlist','presale') NOT NULL DEFAULT 'draft',
  ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL,
  ADD COLUMN `presale_welcome_body` LONGTEXT NULL,
  ADD COLUMN `presale_welcome_media_url` TEXT NULL,
  ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL,
  ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;

ALTER TABLE `workshops`
  MODIFY COLUMN `status` ENUM('draft','public','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft',
  ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL,
  ADD COLUMN `presale_welcome_body` LONGTEXT NULL,
  ADD COLUMN `presale_welcome_media_url` TEXT NULL,
  ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL,
  ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;

ALTER TABLE `workshop_instances`
  MODIFY COLUMN `status` ENUM('draft','published','cancelled','completed','waitlist','presale') NOT NULL DEFAULT 'draft',
  ADD COLUMN `presale_welcome_heading` VARCHAR(500) NULL,
  ADD COLUMN `presale_welcome_body` LONGTEXT NULL,
  ADD COLUMN `presale_welcome_media_url` TEXT NULL,
  ADD COLUMN `presale_welcome_cta_label` VARCHAR(255) NULL,
  ADD COLUMN `presale_welcome_cta_url` VARCHAR(2048) NULL;

CREATE TABLE `content_waitlist_entries` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `product_type` ENUM('course','cohort_group','workshop','workshop_instance','webinar') NOT NULL,
  `product_id` INT NOT NULL,
  `parent_product_id` INT NULL,
  `user_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `notified_at` TIMESTAMP NULL,
  `enrolled_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `content_waitlist_entries_id_pk` PRIMARY KEY(`id`),
  CONSTRAINT `uq_content_waitlist_signup` UNIQUE(`product_type`,`product_id`,`email`)
);
