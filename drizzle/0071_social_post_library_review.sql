-- Shared Social Post Library review workflow.
-- Additive only: existing saved posts remain visible as drafts.
ALTER TABLE `social_post_library` MODIFY COLUMN `cardTheme` ENUM('dark', 'light', 'white', 'teal', 'aqua') NOT NULL DEFAULT 'light';
ALTER TABLE `social_post_library` ADD COLUMN `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' AFTER `updatedAt`;
ALTER TABLE `social_post_library` ADD COLUMN `publishedAt` TIMESTAMP NULL AFTER `status`;
ALTER TABLE `social_post_library` ADD COLUMN `publishedByUserId` INT NULL AFTER `publishedAt`;
ALTER TABLE `social_post_library` ADD COLUMN `flaggedAt` TIMESTAMP NULL AFTER `publishedByUserId`;
ALTER TABLE `social_post_library` ADD COLUMN `flaggedByUserId` INT NULL AFTER `flaggedAt`;
ALTER TABLE `social_post_library` ADD COLUMN `flagComment` TEXT NULL AFTER `flaggedByUserId`;
ALTER TABLE `social_post_library` ADD COLUMN `flagResolvedAt` TIMESTAMP NULL AFTER `flagComment`;
ALTER TABLE `social_post_library` ADD COLUMN `deletedAt` TIMESTAMP NULL AFTER `flagResolvedAt`;
ALTER TABLE `social_post_library` ADD COLUMN `deletedByUserId` INT NULL AFTER `deletedAt`;

CREATE INDEX `social_post_library_brand_status_idx`
  ON `social_post_library` (`brand`, `status`, `updatedAt`);
