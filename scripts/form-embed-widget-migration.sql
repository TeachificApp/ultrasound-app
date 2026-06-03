-- Form Embed Widget: configurable embed with triggers, domain restrictions, analytics

CREATE TABLE IF NOT EXISTS generalFormEmbedWidgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  templateId INT NOT NULL,
  widgetKey VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT 'Default Widget',
  isEnabled TINYINT(1) NOT NULL DEFAULT 0,
  displayType ENUM('inline', 'popup', 'slide_in') NOT NULL DEFAULT 'inline',
  settingsJson LONGTEXT NOT NULL,
  domainMode ENUM('all', 'allowlist') NOT NULL DEFAULT 'all',
  allowedDomains LONGTEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_widget_key (widgetKey),
  INDEX idx_embed_widget_template (templateId)
);

CREATE TABLE IF NOT EXISTS generalFormEmbedAnalytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  templateId INT NOT NULL,
  widgetId INT NULL,
  eventType VARCHAR(40) NOT NULL,
  triggerSource VARCHAR(80) NULL,
  deviceType VARCHAR(20) NULL,
  hostDomain VARCHAR(255) NULL,
  sessionKey VARCHAR(64) NULL,
  metadataJson LONGTEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_embed_analytics_template (templateId),
  INDEX idx_embed_analytics_event (eventType),
  INDEX idx_embed_analytics_created (createdAt)
);
