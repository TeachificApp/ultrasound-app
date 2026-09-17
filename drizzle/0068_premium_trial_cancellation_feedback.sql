CREATE TABLE IF NOT EXISTS `premium_trial_cancellation_feedback` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `membershipId` INT NOT NULL,
  `stripeSubscriptionId` VARCHAR(128) NOT NULL,
  `brand` VARCHAR(32) NOT NULL,
  `reason` VARCHAR(64) NOT NULL,
  `details` TEXT NULL,
  `trialEndsAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `premium_trial_feedback_subscription_unique` (`stripeSubscriptionId`),
  KEY `premium_trial_feedback_reason_created_idx` (`reason`, `createdAt`),
  KEY `premium_trial_feedback_brand_created_idx` (`brand`, `createdAt`),
  KEY `premium_trial_feedback_user_idx` (`userId`)
);
