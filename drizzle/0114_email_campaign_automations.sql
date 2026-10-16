-- Approval-safe email campaign automations. Rules are inactive by default; no historical delivery is created.
CREATE TABLE IF NOT EXISTS email_automation_workflows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  scope ENUM('learn','apps','expo') NOT NULL,
  trigger_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id INT NULL,
  email_template_id INT NOT NULL,
  sender_profile_id INT NULL,
  subject VARCHAR(500) NOT NULL,
  html_body LONGTEXT NOT NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id INT NOT NULL,
  last_triggered_at TIMESTAMP NULL,
  last_status VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX email_automation_workflows_active_trigger_idx (is_active, scope, trigger_type),
  INDEX email_automation_workflows_target_idx (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS email_automation_deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  source_key VARCHAR(255) NOT NULL,
  user_id INT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  recipient_name VARCHAR(255) NULL,
  subject VARCHAR(500) NOT NULL,
  html_body LONGTEXT NOT NULL,
  sender_profile_id INT NULL,
  status ENUM('queued','sending','sent','failed','cancelled') NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY email_automation_deliveries_workflow_source_unique (workflow_id, source_key),
  INDEX email_automation_deliveries_due_idx (status, scheduled_for),
  INDEX email_automation_deliveries_workflow_idx (workflow_id, created_at)
);