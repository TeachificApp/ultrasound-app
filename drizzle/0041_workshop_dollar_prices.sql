ALTER TABLE workshop_instances
  MODIFY COLUMN price DECIMAL(10,2) NULL,
  MODIFY COLUMN compare_at_price DECIMAL(10,2) NULL;

ALTER TABLE workshops
  MODIFY COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN compare_at_price DECIMAL(10,2) NULL;

-- Existing instance overrides and legacy compare-at values were stored as cents.
UPDATE workshop_instances
SET price = price / 100
WHERE id IN (1, 30001, 30002) AND price IN (229700, 129700, 249700);

UPDATE workshops
SET compare_at_price = compare_at_price / 100
WHERE id IN (1, 30002, 60001, 60003) AND compare_at_price IN (349700, 159700);
