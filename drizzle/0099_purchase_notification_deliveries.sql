-- Durable idempotency state for access and confirmation emails sent per Stripe checkout.
CREATE TABLE IF NOT EXISTS purchase_notification_deliveries (
  id INT NOT NULL AUTO_INCREMENT,
  checkout_session_id VARCHAR(255) NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  status ENUM('sending', 'sent', 'failed') NOT NULL DEFAULT 'sending',
  attempts INT NOT NULL DEFAULT 1,
  last_error TEXT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY purchase_notification_delivery_unique (checkout_session_id, notification_type),
  KEY purchase_notification_delivery_status_idx (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
