-- SCORM health alert snapshot + optional override email on platform_settings
ALTER TABLE `platform_settings`
  ADD COLUMN `scorm_health_snapshot` TEXT,
  ADD COLUMN `scorm_health_alert_email` VARCHAR(320);
