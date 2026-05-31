-- Migration: Thinkific Community Sync
-- Adds Thinkific source fields to communities table and creates sync/gating tables

-- 1. Extend communities table with Thinkific source fields and new privacy/access enums
ALTER TABLE `communities`
  MODIFY COLUMN `privacy` ENUM('public','private','paid','invite_only','course_gated') NOT NULL DEFAULT 'public',
  MODIFY COLUMN `access_type` ENUM('free','paid','restricted','invite_only','course_gated') NOT NULL DEFAULT 'free',
  ADD COLUMN `thinkific_source_type` ENUM('thinkific_community','thinkific_space') NULL AFTER `access_type`,
  ADD COLUMN `thinkific_community_id` VARCHAR(64) NULL AFTER `thinkific_source_type`,
  ADD COLUMN `thinkific_space_id` VARCHAR(64) NULL AFTER `thinkific_community_id`;

-- 2. Thinkific community sync state table
CREATE TABLE IF NOT EXISTS `thinkific_community_sync_state` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `community_id` INT NOT NULL UNIQUE,
  `thinkific_community_id` VARCHAR(64) NULL,
  `thinkific_space_id` VARCHAR(64) NULL,
  `sync_cursor` VARCHAR(255) NULL,
  `sync_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `last_synced_at` BIGINT NULL,
  `total_posts_synced` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Community course linkages (enrollment-gated access)
CREATE TABLE IF NOT EXISTS `community_course_linkages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `community_id` INT NOT NULL,
  `lms_course_id` INT NOT NULL,
  `thinkific_course_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_community_course` (`community_id`, `lms_course_id`)
);

-- 4. Community invite tokens
CREATE TABLE IF NOT EXISTS `community_invites` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `community_id` INT NOT NULL,
  `token` VARCHAR(128) NOT NULL UNIQUE,
  `email` VARCHAR(255) NULL,
  `used_by_user_id` INT NULL,
  `used_at` BIGINT NULL,
  `expires_at` BIGINT NULL,
  `max_uses` INT NULL,
  `use_count` INT NOT NULL DEFAULT 0,
  `created_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Thinkific post import tracking (deduplication)
CREATE TABLE IF NOT EXISTS `thinkific_post_imports` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `thinkific_post_id` VARCHAR(64) NOT NULL UNIQUE,
  `local_post_id` INT NOT NULL,
  `community_id` INT NOT NULL,
  `depth` INT NOT NULL DEFAULT 0,
  `parent_local_post_id` INT NULL,
  `imported_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_community_id` (`community_id`),
  INDEX `idx_local_post_id` (`local_post_id`)
);
