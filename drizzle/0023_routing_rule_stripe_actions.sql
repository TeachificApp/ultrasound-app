-- Add per-rule Stripe checkout action columns to generalFormSuccessRoutingRules
ALTER TABLE `generalFormSuccessRoutingRules`
  ADD COLUMN `stripeEnabled` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `stripePriceId` varchar(255) DEFAULT NULL,
  ADD COLUMN `stripeAmount` int DEFAULT NULL,
  ADD COLUMN `stripeCheckoutMode` varchar(20) DEFAULT 'payment',
  ADD COLUMN `stripeSuccessUrl` varchar(2000) DEFAULT NULL,
  ADD COLUMN `stripeCancelUrl` varchar(2000) DEFAULT NULL;

-- Add per-rule Stripe checkout action columns to accreditationFormSuccessRoutingRules
ALTER TABLE `accreditationFormSuccessRoutingRules`
  ADD COLUMN `stripeEnabled` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `stripePriceId` varchar(255) DEFAULT NULL,
  ADD COLUMN `stripeAmount` int DEFAULT NULL,
  ADD COLUMN `stripeCheckoutMode` varchar(20) DEFAULT 'payment',
  ADD COLUMN `stripeSuccessUrl` varchar(2000) DEFAULT NULL,
  ADD COLUMN `stripeCancelUrl` varchar(2000) DEFAULT NULL;
