-- EchoExpo™ is an iHeartEcho™-focused companion event within the same annual event dates.
-- It is administered inside UltrasoundExpo.com, which retains the sole vendor approval,
-- partner portal, dashboard, payment, resource, and reporting workflow.
-- Additive and idempotent for Railway MySQL.

SET @event_focus_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendor_partner_applications' AND COLUMN_NAME = 'event_focus');
SET @event_focus_sql = IF(@event_focus_exists = 0, 'ALTER TABLE `vendor_partner_applications` ADD COLUMN `event_focus` VARCHAR(40) NULL AFTER `partner_types`', 'SELECT 1');
PREPARE event_focus_statement FROM @event_focus_sql;
EXECUTE event_focus_statement;
DEALLOCATE PREPARE event_focus_statement;

SET @event_tenant_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events' AND COLUMN_NAME = 'tenant');
SET @event_tenant_sql = IF(@event_tenant_exists = 0, 'ALTER TABLE `ultrasound_expo_events` ADD COLUMN `tenant` VARCHAR(40) NOT NULL DEFAULT ''ultrasound_expo'' AFTER `id`', 'SELECT 1');
PREPARE event_tenant_statement FROM @event_tenant_sql;
EXECUTE event_tenant_statement;
DEALLOCATE PREPARE event_tenant_statement;

SET @event_tenant_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events' AND INDEX_NAME = 'ultrasound_expo_events_tenant_status_starts_idx');
SET @event_tenant_index_sql = IF(@event_tenant_index_exists = 0, 'CREATE INDEX `ultrasound_expo_events_tenant_status_starts_idx` ON `ultrasound_expo_events` (`tenant`, `status`, `starts_at`)', 'SELECT 1');
PREPARE event_tenant_index_statement FROM @event_tenant_index_sql;
EXECUTE event_tenant_index_statement;
DEALLOCATE PREPARE event_tenant_index_statement;

-- Creates the live EchoExpo™ 2028 instance only if it does not already exist.
INSERT INTO ultrasound_expo_events (
  tenant, name, slug, starts_at, ends_at, timezone, location_label,
  description, hero_image_url, status
)
SELECT
  'echo_expo',
  'EchoExpo™ 2028',
  'echoexpo-2028',
  '2028-01-14 12:00:00',
  '2028-01-16 14:00:00',
  'America/New_York',
  'Orlando, Florida · Venue TBD',
  'EchoExpo™ is the cardiac ultrasound and echocardiography experience within the annual UltrasoundExpo™ event, with focused cardiac education, Echo Games, Echo Skills, CME hands-on workshops, and a dedicated exhibit hall location.',
  NULL,
  'published'
WHERE NOT EXISTS (
  SELECT 1 FROM ultrasound_expo_events WHERE slug = 'echoexpo-2028'
);
