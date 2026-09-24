-- Dual public websites and editable blog sidebar content.
-- Applied by scripts/apply-public-site-tenants-migration.ts after checking the
-- existing Railway MySQL schema, so this stays safe across partially-applied CMS migrations.

ALTER TABLE `marketingSiteSettings` ADD COLUMN `blogSidebarBlocks` LONGTEXT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `blogExcerpt` TEXT NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `blogAuthor` VARCHAR(255) NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `blogCategory` VARCHAR(160) NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `blogPublishedAt` TIMESTAMP NULL;
ALTER TABLE `marketingSitePages` ADD COLUMN `blogSidebarMode` ENUM('inherit', 'override') NOT NULL DEFAULT 'inherit';
ALTER TABLE `marketingSitePages` ADD COLUMN `blogSidebarBlocks` LONGTEXT NULL;
CREATE INDEX `marketing_site_pages_site_path_idx` ON `marketingSitePages` (`siteKey`, `path`);
