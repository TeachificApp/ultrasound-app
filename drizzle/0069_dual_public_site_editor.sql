-- Dual-brand public website and blog editor support.
-- This migration is additive: it preserves existing staging rows and creates
-- two independently editable .net public-site tenants for future .com promotion.

ALTER TABLE `marketingSitePages`
  ADD COLUMN `blogExcerpt` TEXT NULL,
  ADD COLUMN `blogAuthor` VARCHAR(255) NULL,
  ADD COLUMN `blogCategory` VARCHAR(160) NULL,
  ADD COLUMN `blogPublishedAt` TIMESTAMP NULL;

CREATE INDEX `marketing_site_pages_blog_listing_idx`
  ON `marketingSitePages` (`siteKey`, `pageType`, `isPublished`, `blogPublishedAt`);

INSERT IGNORE INTO `marketingSiteSettings`
  (`siteKey`, `hostDomain`, `sourceDomain`, `siteName`, `isStaging`, `stagingBannerText`)
VALUES
  ('aaus-net', 'www.allaboutultrasound.net', 'www.allaboutultrasound.com', 'All About Ultrasound™', 1,
   'Preview on allaboutultrasound.net — final promotion target: www.allaboutultrasound.com'),
  ('iheartecho-net', 'www.iheartecho.net', 'www.iheartecho.com', 'iHeartEcho™', 1,
   'Preview on iheartecho.net — final promotion target: www.iheartecho.com');
