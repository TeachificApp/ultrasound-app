-- Editable, per-instance workshop confirmation content.  Held by default until reviewed.
ALTER TABLE workshop_instances
  ADD COLUMN IF NOT EXISTS confirmation_email_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmation_email_approved_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS confirmation_email_subject VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS confirmation_email_heading VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS confirmation_email_intro TEXT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_email_details LONGTEXT NULL;
