-- UltrasoundExpo™ annual event, configurable registration packages, and purchase records.
-- Additive migration only. Stripe remains the source of truth for payment details.
CREATE TABLE IF NOT EXISTS ultrasound_expo_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/New_York',
  location_label VARCHAR(512) NULL,
  description TEXT NULL,
  hero_image_url VARCHAR(2048) NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ultrasound_expo_events_slug_unique (slug),
  KEY ultrasound_expo_events_status_starts_idx (status, starts_at)
);

CREATE TABLE IF NOT EXISTS ultrasound_expo_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  package_type ENUM('registrant','exhibitor','sponsor','product','other') NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  benefits LONGTEXT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'usd',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ultrasound_expo_packages_event_active_idx (event_id, is_active),
  KEY ultrasound_expo_packages_event_type_idx (event_id, package_type)
);

CREATE TABLE IF NOT EXISTS ultrasound_expo_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  package_id INT NOT NULL,
  user_id INT NULL,
  attendee_name VARCHAR(255) NOT NULL,
  attendee_email VARCHAR(320) NOT NULL,
  attendee_phone VARCHAR(60) NULL,
  organization_name VARCHAR(255) NULL,
  organization_website VARCHAR(1024) NULL,
  notes TEXT NULL,
  ticket_code VARCHAR(80) NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'usd',
  stripe_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  payment_status ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  status ENUM('pending','confirmed','payment_failed','cancelled') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ultrasound_expo_registrations_session_unique (stripe_session_id),
  KEY ultrasound_expo_registrations_user_status_idx (user_id, status),
  KEY ultrasound_expo_registrations_event_status_idx (event_id, status),
  KEY ultrasound_expo_registrations_email_idx (attendee_email)
);

INSERT INTO ultrasound_expo_events (name, slug, starts_at, ends_at, timezone, location_label, description, hero_image_url, status)
SELECT 'UltrasoundExpo™ 2028', 'ultrasoundexpo-2028', '2028-01-16 09:00:00', '2028-01-17 17:00:00', 'America/New_York', 'Location to be announced', 'A new annual meeting for sonographers, physicians, educators, innovators, and the ultrasound industry.', 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/nmDnyKctfSTBjSLH.jpg', 'published'
WHERE NOT EXISTS (SELECT 1 FROM ultrasound_expo_events WHERE slug = 'ultrasoundexpo-2028');
