-- Additive one-time welcome delivery tracking for newsletter subscribers.
-- A nullable timestamp allows delivery to retry on a later subscribe request when
-- the email provider is temporarily unavailable, without sending duplicates.
ALTER TABLE `newsletter_subscribers`
  ADD COLUMN IF NOT EXISTS `welcome_email_sent_at` BIGINT NULL AFTER `unsubscribe_token`;
