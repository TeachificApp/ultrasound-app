-- Migration 0003: Media Repository Enhancements
-- Adds folder and thumbnailUrl columns to mediaAssets
-- Adds mediaViewEvents table for embed analytics

ALTER TABLE `mediaAssets`
  ADD COLUMN `folder` varchar(255) DEFAULT NULL AFTER `tags`,
  ADD COLUMN `thumbnailUrl` text DEFAULT NULL AFTER `folder`;

CREATE TABLE IF NOT EXISTS `mediaViewEvents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assetId` int NOT NULL,
  `grantId` int DEFAULT NULL,
  `viewerEmail` varchar(320) DEFAULT NULL,
  `referer` text DEFAULT NULL,
  `ipHash` varchar(64) DEFAULT NULL,
  `viewType` enum('embed','direct') NOT NULL DEFAULT 'direct',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mediaViewEvents_assetId` (`assetId`),
  KEY `idx_mediaViewEvents_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
