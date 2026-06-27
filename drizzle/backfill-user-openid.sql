-- Backfill stable openId for legacy users (SSO + magic link session lookup).
--
-- Column name is `openId` (camelCase), NOT open_id.
-- Matches server/lib/ensureUserOpenId.ts: email:{lowercase-trimmed-email}
--
-- Safe to run multiple times (only updates rows where openId IS NULL).
-- Prefer deploy startup backfill (backfillUserOpenIds) which skips unique conflicts.

-- Users with an email address
UPDATE users
SET openId = CONCAT('email:', LOWER(TRIM(email)))
WHERE openId IS NULL
  AND email IS NOT NULL
  AND TRIM(email) != '';

-- Users without email (rare — synthetic id-based openId)
UPDATE users
SET openId = CONCAT('user:', id)
WHERE openId IS NULL
  AND (email IS NULL OR TRIM(email) = '');
