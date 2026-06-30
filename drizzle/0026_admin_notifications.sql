-- Migration: admin_notifications table
-- Stores all admin-facing notifications (fulfillment events, alerts, system messages)
-- so they are visible in the Platform Admin → Notifications page.

CREATE TABLE IF NOT EXISTS admin_notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(1200) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'system',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_notifications_created_at (created_at DESC),
  INDEX idx_admin_notifications_is_read (is_read),
  INDEX idx_admin_notifications_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
