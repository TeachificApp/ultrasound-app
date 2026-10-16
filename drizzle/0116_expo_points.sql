-- ExpoPoints is an additive, per-Expo-instance points and redemption ledger.
-- No existing registrations, event records, partner records, or platform points are changed.

CREATE TABLE IF NOT EXISTS `expo_points_programs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `host_event_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `leaderboard_scope` ENUM('ultrasound_expo','echo_expo','combined') NOT NULL DEFAULT 'ultrasound_expo',
  `eligible_roles_json` TEXT NOT NULL,
  `live_display_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by_user_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expo_points_programs_host_event_unique` (`host_event_id`),
  KEY `expo_points_programs_scope_active_idx` (`leaderboard_scope`, `is_active`)
);

CREATE TABLE IF NOT EXISTS `expo_points_program_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `program_id` INT NOT NULL,
  `event_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expo_points_program_events_program_event_unique` (`program_id`, `event_id`),
  KEY `expo_points_program_events_event_idx` (`event_id`)
);

CREATE TABLE IF NOT EXISTS `expo_points_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `program_id` INT NOT NULL,
  `event_id` INT NULL,
  `user_id` INT NOT NULL,
  `activity_type` ENUM('attendance','cme','booth_visit','expo_game','networking','community','other','admin_adjustment','reward_redemption') NOT NULL,
  `points` INT NOT NULL,
  `description` VARCHAR(1000) NOT NULL,
  `source_key` VARCHAR(255) NULL,
  `awarded_by_user_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expo_points_transactions_source_unique` (`program_id`, `source_key`),
  KEY `expo_points_transactions_program_user_created_idx` (`program_id`, `user_id`, `created_at`),
  KEY `expo_points_transactions_program_event_idx` (`program_id`, `event_id`)
);

CREATE TABLE IF NOT EXISTS `expo_points_rewards` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `program_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `points_cost` INT NOT NULL,
  `inventory_limit` INT NULL,
  `redeemed_count` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `expo_points_rewards_program_active_idx` (`program_id`, `is_active`, `sort_order`)
);

CREATE TABLE IF NOT EXISTS `expo_points_redemptions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `program_id` INT NOT NULL,
  `reward_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `points_cost` INT NOT NULL,
  `status` ENUM('requested','fulfilled','cancelled') NOT NULL DEFAULT 'requested',
  `transaction_id` INT NULL,
  `fulfillment_note` TEXT NULL,
  `fulfilled_by_user_id` INT NULL,
  `fulfilled_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `expo_points_redemptions_program_status_idx` (`program_id`, `status`, `created_at`),
  KEY `expo_points_redemptions_user_idx` (`user_id`, `created_at`)
);
