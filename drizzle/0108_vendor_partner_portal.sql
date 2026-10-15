-- Approval-gated vendor, exhibitor, and sponsor partner portal.
-- Additive only: partner pricing, checkout, resources, and booth preferences are
-- accessible only after an administrator links a shared user account to approval.

CREATE TABLE IF NOT EXISTS vendor_partner_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_name VARCHAR(255) NOT NULL,
  organization_website VARCHAR(1024) NULL,
  organization_logo_url VARCHAR(2048) NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(320) NOT NULL,
  contact_phone VARCHAR(60) NOT NULL,
  message TEXT NULL,
  requested_scopes TEXT NULL,
  partner_types TEXT NULL,
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  linked_user_id INT NULL,
  aaus_access BOOLEAN NOT NULL DEFAULT FALSE,
  expo_access BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_notes TEXT NULL,
  reviewed_by_user_id INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY vendor_partner_applications_status_created_idx (status, created_at),
  KEY vendor_partner_applications_contact_email_idx (contact_email),
  KEY vendor_partner_applications_linked_user_idx (linked_user_id)
);

CREATE TABLE IF NOT EXISTS ultrasound_expo_partner_resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  resource_type ENUM('floor_plan','booth_setup','logistics','document','other') NOT NULL DEFAULT 'other',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  resource_url VARCHAR(2048) NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ultrasound_expo_partner_resources_event_published_idx (event_id, is_published, sort_order)
);

CREATE TABLE IF NOT EXISTS ultrasound_expo_booths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  booth_code VARCHAR(100) NOT NULL,
  zone_label VARCHAR(255) NULL,
  dimensions VARCHAR(100) NULL,
  description TEXT NULL,
  map_reference VARCHAR(255) NULL,
  availability_status ENUM('available','reserved','sold','unavailable') NOT NULL DEFAULT 'available',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ultrasound_expo_booths_event_code_unique (event_id, booth_code),
  KEY ultrasound_expo_booths_event_status_idx (event_id, availability_status, sort_order)
);

CREATE TABLE IF NOT EXISTS ultrasound_expo_booth_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  booth_id INT NOT NULL,
  vendor_application_id INT NOT NULL,
  status ENUM('requested','confirmed','declined','cancelled') NOT NULL DEFAULT 'requested',
  vendor_note TEXT NULL,
  admin_note TEXT NULL,
  reviewed_by_user_id INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ultrasound_expo_booth_requests_vendor_idx (vendor_application_id, status),
  KEY ultrasound_expo_booth_requests_event_booth_idx (event_id, booth_id, status)
);

ALTER TABLE sponsorships ADD COLUMN vendor_application_id INT NULL;
ALTER TABLE sponsorships ADD KEY sponsorships_vendor_application_idx (vendor_application_id);
ALTER TABLE event_partnership_orders ADD COLUMN vendor_application_id INT NULL;
ALTER TABLE event_partnership_orders ADD KEY event_partnership_orders_vendor_application_idx (vendor_application_id);
ALTER TABLE ultrasound_expo_registrations ADD COLUMN vendor_application_id INT NULL;
ALTER TABLE ultrasound_expo_registrations ADD KEY ultrasound_expo_registrations_vendor_application_idx (vendor_application_id);
