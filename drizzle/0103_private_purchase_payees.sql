-- Private purchaser identities for legitimate purchaser/learner mismatches.
-- This record is limited to Platform Admin member profiles and is never exposed
-- through learner-facing data contracts.
CREATE TABLE IF NOT EXISTS `purchase_payees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255),
  `email` varchar(320) NOT NULL,
  `first_observed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_observed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_payee_user_email_unique` (`user_id`, `email`),
  KEY `purchase_payee_user_last_observed_idx` (`user_id`, `last_observed_at`)
);
