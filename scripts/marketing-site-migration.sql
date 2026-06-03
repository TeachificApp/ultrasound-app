-- Marketing site staging replica (site.allaboutultrasound.com)

CREATE TABLE IF NOT EXISTS marketingSiteSettings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  siteKey VARCHAR(64) NOT NULL UNIQUE,
  hostDomain VARCHAR(255) NOT NULL,
  sourceDomain VARCHAR(255) NOT NULL DEFAULT 'www.allaboutultrasound.com',
  siteName VARCHAR(255) NOT NULL DEFAULT 'All About Ultrasound',
  isStaging TINYINT(1) NOT NULL DEFAULT 1,
  navJson LONGTEXT NULL,
  footerJson LONGTEXT NULL,
  headerBlocks LONGTEXT NULL,
  footerBlocks LONGTEXT NULL,
  faviconUrl VARCHAR(512) NULL,
  globalCss LONGTEXT NULL,
  stagingBannerText VARCHAR(500) NULL DEFAULT 'Staging Preview — Not Live',
  lastImportAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketingSitePages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  siteKey VARCHAR(64) NOT NULL DEFAULT 'aau-staging',
  path VARCHAR(500) NOT NULL,
  title VARCHAR(500) NULL,
  pageType ENUM('page', 'blog_post', 'redirect') NOT NULL DEFAULT 'page',
  blocks LONGTEXT NULL,
  seoTitle VARCHAR(255) NULL,
  seoDescription TEXT NULL,
  seoImage VARCHAR(512) NULL,
  sourceUrl VARCHAR(1000) NULL,
  redirectUrl VARCHAR(1000) NULL,
  isPublished TINYINT(1) NOT NULL DEFAULT 1,
  sortOrder INT NOT NULL DEFAULT 0,
  importStatus ENUM('pending', 'imported', 'failed') NOT NULL DEFAULT 'pending',
  importError TEXT NULL,
  linkAuditJson LONGTEXT NULL,
  importedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_marketing_page_path (siteKey, path),
  INDEX idx_marketing_pages_site (siteKey),
  INDEX idx_marketing_pages_published (isPublished)
);

INSERT IGNORE INTO marketingSiteSettings (siteKey, hostDomain, sourceDomain, isStaging, stagingBannerText)
VALUES ('aau-staging', 'site.allaboutultrasound.com', 'www.allaboutultrasound.com', 1, 'Staging Preview — Not indexed. Not the live website.');
