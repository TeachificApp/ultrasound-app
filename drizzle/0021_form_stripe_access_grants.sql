-- Migration: Add Stripe checkout fields to accreditationFormTemplates
-- and grantAccessActions to accreditationFormSuccessRoutingRules

ALTER TABLE `accreditationFormTemplates`
  ADD COLUMN IF NOT EXISTS `stripeEnabled` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `stripeProductId` varchar(255),
  ADD COLUMN IF NOT EXISTS `stripePriceId` varchar(255),
  ADD COLUMN IF NOT EXISTS `stripeAmount` int,
  ADD COLUMN IF NOT EXISTS `stripeCheckoutMode` varchar(20) DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS `stripeSuccessUrl` varchar(500),
  ADD COLUMN IF NOT EXISTS `stripeCancelUrl` varchar(500);

ALTER TABLE `accreditationFormSuccessRoutingRules`
  ADD COLUMN IF NOT EXISTS `grantAccessActions` longtext;
