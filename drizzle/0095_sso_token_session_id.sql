-- Add the opaque session binding used by cross-domain SSO tokens.
-- This is additive only: existing tokens remain redeemable with a NULL session_id.
ALTER TABLE `sso_tokens`
  ADD COLUMN `session_id` VARCHAR(96) NULL AFTER `user_id`;
