-- Migration: Upgrade accreditationFormBranchRules to support multi-condition AND/OR logic
-- and add require/unrequire actions (matching generalFormBranchRules capabilities)

-- 1. Add logicOperator column (all = AND, any = OR)
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN logicOperator VARCHAR(10) NOT NULL DEFAULT 'all' AFTER conditionValue;

-- 2. Add conditions column (JSON array of {conditionItemId, conditionValue, operator})
--    Existing single-condition rules will be migrated below
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN conditions LONGTEXT AFTER logicOperator;

-- 3. Add ruleLabel for human-readable description
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN ruleLabel VARCHAR(255) DEFAULT '' AFTER templateId;

-- 4. Add isEnabled flag
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN isEnabled BOOLEAN NOT NULL DEFAULT TRUE AFTER action;

-- 5. Add operator column to support not_equals, contains, etc.
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN operator VARCHAR(30) NOT NULL DEFAULT 'equals' AFTER conditionValue;

-- 6. Migrate existing single-condition rules into the new conditions JSON column
UPDATE accreditationFormBranchRules
SET conditions = CONCAT(
  '[{"conditionItemId":', conditionItemId,
  ',"conditionValue":"', REPLACE(conditionValue, '"', '\\"'),
  '","operator":"equals"}]'
)
WHERE conditions IS NULL;

-- 7. Expand action enum to include require/unrequire
ALTER TABLE accreditationFormBranchRules
  MODIFY COLUMN action ENUM('show', 'hide', 'require', 'unrequire') NOT NULL DEFAULT 'show';

-- 8. Add targetType to support section-level rules (matching generalFormBranchRules)
ALTER TABLE accreditationFormBranchRules
  ADD COLUMN targetType VARCHAR(20) NOT NULL DEFAULT 'item' AFTER targetItemId;
