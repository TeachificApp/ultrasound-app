-- Rate-limit and audit magic-link / password-reset email sends (abuse protection)
CREATE TABLE IF NOT EXISTS auth_email_send_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_type ENUM('magic_link', 'password_reset') NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_id INT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_email_send_email_type_sent (email, email_type, sent_at),
  INDEX idx_auth_email_send_ip_sent (ip_address, sent_at)
);
