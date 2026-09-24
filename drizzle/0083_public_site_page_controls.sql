-- Per-brand public-site page tree, navigation, visibility, and SEO controls.
-- Applied by scripts/apply-public-site-page-controls-migration.ts after an
-- information-schema guard so it is safe on Railway MySQL partial migrations.

ALTER TABLE `marketingSitePages` ADD COLUMN `parentId` INT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `hideInNavigation` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `marketingSitePages` ADD COLUMN `visibility` ENUM('public', 'site_password', 'members_or_groups') NOT NULL DEFAULT 'public';
ALTER TABLE `marketingSitePages` ADD COLUMN `sitePasswordHash` VARCHAR(128) NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `headerType` ENUM('standard', 'splash', 'no_header') NOT NULL DEFAULT 'standard';
ALTER TABLE `marketingSitePages` ADD COLUMN `seoKeywords` TEXT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `headerCode` LONGTEXT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `footerCode` LONGTEXT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `hideFromSearch` BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX `marketing_site_pages_site_parent_order_idx` ON `marketingSitePages` (`siteKey`, `parentId`, `sortOrder`);
