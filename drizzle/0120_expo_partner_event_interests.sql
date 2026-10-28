-- Preserve legacy event_focus while allowing partner applications to select
-- UltrasoundExpo™, EchoExpo™, or both as separate event interests.
-- Additive and idempotent for MySQL/Railway.

SET @event_interests_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vendor_partner_applications'
    AND COLUMN_NAME = 'event_interests'
);
SET @event_interests_column_sql = IF(
  @event_interests_column_exists = 0,
  'ALTER TABLE `vendor_partner_applications` ADD COLUMN `event_interests` TEXT NULL AFTER `event_focus`',
  'SELECT 1'
);
PREPARE event_interests_column_statement FROM @event_interests_column_sql;
EXECUTE event_interests_column_statement;
DEALLOCATE PREPARE event_interests_column_statement;
