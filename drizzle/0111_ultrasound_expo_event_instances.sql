-- UltrasoundExpo™ per-event agenda, landing pages, partner profiles, product documents, and recording access.
-- Additive only: all existing Expo events, registrations, vendors, and pages remain intact.

-- Railway MySQL does not support ADD COLUMN IF NOT EXISTS. Keep each addition
-- idempotent without failing when this migration is re-applied to an existing event table.
SET @expo_event_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events' AND COLUMN_NAME = 'registration_terms');
SET @expo_event_column_sql = IF(@expo_event_column_exists = 0, 'ALTER TABLE `ultrasound_expo_events` ADD COLUMN `registration_terms` TEXT NULL AFTER `hero_image_url`', 'SELECT 1');
PREPARE expo_event_column_statement FROM @expo_event_column_sql;
EXECUTE expo_event_column_statement;
DEALLOCATE PREPARE expo_event_column_statement;

SET @expo_event_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events' AND COLUMN_NAME = 'attendee_instructions');
SET @expo_event_column_sql = IF(@expo_event_column_exists = 0, 'ALTER TABLE `ultrasound_expo_events` ADD COLUMN `attendee_instructions` TEXT NULL AFTER `registration_terms`', 'SELECT 1');
PREPARE expo_event_column_statement FROM @expo_event_column_sql;
EXECUTE expo_event_column_statement;
DEALLOCATE PREPARE expo_event_column_statement;

SET @expo_event_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events' AND COLUMN_NAME = 'partner_instructions');
SET @expo_event_column_sql = IF(@expo_event_column_exists = 0, 'ALTER TABLE `ultrasound_expo_events` ADD COLUMN `partner_instructions` TEXT NULL AFTER `attendee_instructions`', 'SELECT 1');
PREPARE expo_event_column_statement FROM @expo_event_column_sql;
EXECUTE expo_event_column_statement;
DEALLOCATE PREPARE expo_event_column_statement;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_agenda_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `starts_at` timestamp NOT NULL,
  `ends_at` timestamp NULL,
  `location_label` varchar(512),
  `speaker_names` text,
  `category` varchar(100),
  `status` enum('draft','published','cancelled') NOT NULL DEFAULT 'draft',
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ultrasound_expo_agenda_event_status_starts_idx` (`event_id`,`status`,`starts_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_event_pages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `page_type` enum('landing','attendee','exhibitor','schedule','prospectus','custom') NOT NULL DEFAULT 'custom',
  `access_level` enum('public','registered','partners') NOT NULL DEFAULT 'public',
  `blocks_json` longtext,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `seo_title` varchar(255),
  `seo_description` text,
  `created_by_user_id` int,
  `updated_by_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ultrasound_expo_event_pages_event_slug_unique` (`event_id`,`slug`),
  KEY `ultrasound_expo_event_pages_event_status_idx` (`event_id`,`status`,`access_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_partner_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `vendor_application_id` int NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `summary` text,
  `website_url` varchar(1024),
  `logo_url` varchar(2048),
  `contact_email` varchar(320),
  `contact_phone` varchar(60),
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ultrasound_expo_partner_profiles_event_vendor_unique` (`event_id`,`vendor_application_id`),
  KEY `ultrasound_expo_partner_profiles_event_published_idx` (`event_id`,`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_partner_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `partner_profile_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `file_url` varchar(2048) NOT NULL,
  `file_name` varchar(255),
  `mime_type` varchar(100),
  `is_published` tinyint(1) NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ultrasound_expo_partner_documents_profile_published_idx` (`partner_profile_id`,`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ultrasound_expo_recordings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `video_url` varchar(2048),
  `thumbnail_url` varchar(2048),
  `duration_seconds` int,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `sort_order` int NOT NULL DEFAULT 0,
  `created_by_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ultrasound_expo_recordings_event_status_idx` (`event_id`,`status`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
