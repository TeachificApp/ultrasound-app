-- Instance-level event partnership packages are deliberately separate from the
-- global sponsorship program. No existing sponsorship, workshop, or webinar
-- records are removed or altered beyond optional public-detail columns.

ALTER TABLE `workshop_instances`
  ADD COLUMN `exhibitor_details` longtext NULL;

ALTER TABLE `webinars`
  ADD COLUMN `sponsor_details` longtext NULL;

CREATE TABLE IF NOT EXISTS `event_partnership_packages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` enum('workshop_exhibit','webinar_sponsor') NOT NULL,
  `workshop_instance_id` int NULL,
  `webinar_id` int NULL,
  `name` varchar(255) NOT NULL,
  `description` text NULL,
  `benefits` longtext NULL,
  `amount_cents` int NOT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'usd',
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_partnership_packages_workshop_idx` (`workshop_instance_id`, `is_active`),
  KEY `event_partnership_packages_webinar_idx` (`webinar_id`, `is_active`)
);

CREATE TABLE IF NOT EXISTS `event_partnership_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` enum('workshop_exhibit','webinar_sponsor') NOT NULL,
  `workshop_instance_id` int NULL,
  `webinar_id` int NULL,
  `package_id` int NOT NULL,
  `contact_name` varchar(255) NOT NULL,
  `contact_email` varchar(320) NOT NULL,
  `contact_phone` varchar(60) NULL,
  `organization_name` varchar(255) NOT NULL,
  `organization_website` varchar(1024) NULL,
  `notes` text NULL,
  `amount_cents` int NOT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'usd',
  `stripe_session_id` varchar(255) NULL,
  `stripe_payment_intent_id` varchar(255) NULL,
  `payment_status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  `status` enum('pending','paid','payment_failed','cancelled') NOT NULL DEFAULT 'pending',
  `paid_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_partnership_orders_stripe_session_unique` (`stripe_session_id`),
  KEY `event_partnership_orders_workshop_idx` (`workshop_instance_id`, `status`),
  KEY `event_partnership_orders_webinar_idx` (`webinar_id`, `status`),
  KEY `event_partnership_orders_package_idx` (`package_id`)
);
