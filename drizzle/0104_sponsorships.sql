-- Vendor/exhibitor and sponsorship applications with Stripe fulfillment metadata.
-- Records only business contact and payment-reference data needed to coordinate
-- recognition; card details remain exclusively in Stripe.
CREATE TABLE IF NOT EXISTS `sponsorships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `contact_name` varchar(255) NOT NULL,
  `contact_email` varchar(320) NOT NULL,
  `contact_phone` varchar(60),
  `organization_name` varchar(255) NOT NULL,
  `organization_website` varchar(1024),
  `organization_logo_url` varchar(2048),
  `sponsorship_tier` enum('silver','gold','platinum','other') NOT NULL,
  `sponsorship_scope` enum('workshop_instance','website','app','podcast','other') NOT NULL,
  `workshop_instance_id` int,
  `other_purpose` text,
  `amount_cents` int NOT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'usd',
  `stripe_session_id` varchar(255),
  `stripe_payment_intent_id` varchar(255),
  `payment_status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  `status` enum('pending','paid','payment_failed','cancelled') NOT NULL DEFAULT 'pending',
  `notes` text,
  `paid_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sponsorships_stripe_session_unique` (`stripe_session_id`),
  KEY `sponsorships_status_created_idx` (`status`, `created_at`),
  KEY `sponsorships_workshop_instance_idx` (`workshop_instance_id`),
  KEY `sponsorships_contact_email_idx` (`contact_email`)
);
