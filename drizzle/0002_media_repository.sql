CREATE TABLE IF NOT EXISTS `mediaAssets` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `slug` varchar(128) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `mediaType` enum('image','video','audio','document','html','scorm','zip','lms','other') NOT NULL DEFAULT 'other',
  `mimeType` varchar(128),
  `access` enum('public','private') NOT NULL DEFAULT 'private',
  `tags` text,
  `deletedAt` timestamp,
  `createdByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `mediaAssets_slug_unique` UNIQUE (`slug`)
);

CREATE TABLE IF NOT EXISTS `mediaVersions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `assetId` int NOT NULL,
  `versionNumber` int NOT NULL DEFAULT 1,
  `s3Key` text NOT NULL,
  `s3Url` text NOT NULL,
  `fileName` varchar(255),
  `fileSize` bigint,
  `mimeType` varchar(128),
  `notes` text,
  `uploadedByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `mediaAccessGrants` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `assetId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `token` varchar(128) NOT NULL,
  `expiresAt` timestamp,
  `firstUsedAt` timestamp,
  `revokedAt` timestamp,
  `createdByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `mediaAccessGrants_token_unique` UNIQUE (`token`)
);
