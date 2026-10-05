-- Add SendGrid delivery lifecycle tracking to email campaign analytics.
-- This is additive: existing engagement rows remain valid.
ALTER TABLE `emailCampaignEvents`
  MODIFY COLUMN `eventType` ENUM(
    'processed', 'delivered', 'deferred', 'bounce', 'blocked', 'dropped', 'spamreport',
    'open', 'click', 'unsubscribe'
  ) NOT NULL;

ALTER TABLE `emailCampaignEvents`
  ADD COLUMN `providerEventId` VARCHAR(255) NULL;

CREATE UNIQUE INDEX `emailCampaignEvents_providerEventId_unique`
  ON `emailCampaignEvents` (`providerEventId`);
