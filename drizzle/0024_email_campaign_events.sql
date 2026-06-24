-- Email campaign open/click/unsubscribe event log (first-party tracking)
CREATE TABLE IF NOT EXISTS `emailCampaignEvents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaignId` int NOT NULL,
  `userId` int DEFAULT NULL,
  `recipientKey` varchar(128) NOT NULL,
  `eventType` enum('open','click','unsubscribe') NOT NULL,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_campaign_events_campaign` (`campaignId`, `eventType`),
  KEY `idx_email_campaign_events_recipient` (`campaignId`, `recipientKey`)
);
