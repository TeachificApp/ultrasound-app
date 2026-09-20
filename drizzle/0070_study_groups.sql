-- Study Groups: private learner collaboration, organizational access, and group-content seats.
-- Additive only. Apply through the Railway MySQL migration process after the GitHub deployment.

CREATE TABLE IF NOT EXISTS `study_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `created_by_user_id` INT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `tier` ENUM('free','organization') NOT NULL DEFAULT 'free',
  `organization_name` VARCHAR(200) NULL,
  `seat_limit` INT NULL DEFAULT 5,
  `status` ENUM('active','archived','canceled') NOT NULL DEFAULT 'active',
  `meeting_provider` ENUM('zoom','teams','other') NULL,
  `meeting_url` TEXT NULL,
  `stripe_customer_id` VARCHAR(128) NULL,
  `stripe_subscription_id` VARCHAR(128) NULL,
  `stripe_checkout_session_id` VARCHAR(128) NULL,
  `current_period_end` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_groups_owner` (`created_by_user_id`),
  KEY `idx_study_groups_subscription` (`stripe_subscription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_members` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `user_id` INT NULL,
  `email` VARCHAR(320) NOT NULL,
  `role` ENUM('owner','org_admin','member') NOT NULL DEFAULT 'member',
  `invite_status` ENUM('active','pending','revoked') NOT NULL DEFAULT 'pending',
  `invite_token` VARCHAR(128) NULL,
  `invited_by_user_id` INT NOT NULL,
  `joined_at` TIMESTAMP NULL,
  `revoked_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_study_group_member_email` (`group_id`, `email`),
  UNIQUE KEY `uq_study_group_member_invite_token` (`invite_token`),
  KEY `idx_study_group_member_user` (`user_id`),
  KEY `idx_study_group_member_status` (`group_id`, `invite_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `storage_key` VARCHAR(512) NOT NULL,
  `file_url` TEXT NOT NULL,
  `mime_type` VARCHAR(128) NOT NULL,
  `file_size` INT NOT NULL,
  `uploaded_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_documents_group_created` (`group_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `description` TEXT NULL,
  `assigned_to_user_id` INT NULL,
  `due_at` TIMESTAMP NULL,
  `status` ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
  `created_by_user_id` INT NOT NULL,
  `completed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_tasks_group_status` (`group_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_messages_group_created` (`group_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_modules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `content` LONGTEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_modules_group_order` (`group_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_activity` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `actor_user_id` INT NULL,
  `action` VARCHAR(96) NOT NULL,
  `summary` VARCHAR(512) NOT NULL,
  `entity_type` VARCHAR(64) NULL,
  `entity_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_activity_group_created` (`group_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_content_access` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `group_id` INT NOT NULL,
  `content_type` ENUM('course','quiz','download') NOT NULL,
  `content_id` INT NOT NULL,
  `content_title` VARCHAR(500) NOT NULL,
  `seat_limit` INT NOT NULL,
  `list_price_cents` INT NOT NULL,
  `discounted_price_cents` INT NOT NULL,
  `status` ENUM('active','revoked') NOT NULL DEFAULT 'active',
  `stripe_checkout_session_id` VARCHAR(128) NULL,
  `stripe_payment_intent_id` VARCHAR(128) NULL,
  `source_order_id` INT NULL,
  `purchased_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_group_content_group` (`group_id`, `content_type`, `content_id`),
  KEY `idx_study_group_content_session` (`stripe_checkout_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_content_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `content_access_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `assigned_by_user_id` INT NOT NULL,
  `source_entitlement_id` INT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_study_group_content_assignment` (`content_access_id`, `user_id`),
  KEY `idx_study_group_content_assignment_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `study_group_workspace_blocks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `block_key` VARCHAR(100) NOT NULL,
  `blocks_json` LONGTEXT NOT NULL,
  `updated_by_user_id` INT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_study_group_workspace_block_key` (`block_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
