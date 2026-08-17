ALTER TABLE membership_plans
  MODIFY COLUMN compare_at_price DECIMAL(10,2) NULL;

-- CME Membership values were legacy cents persisted into a decimal-dollar column.
-- The plan is draft, and clearing its stale Stripe price ensures the corrected amount is created on its next checkout.
UPDATE membership_plans
SET price = price / 100,
    compare_at_price = compare_at_price / 100,
    stripe_price_id = NULL
WHERE id = 60001
  AND price = 19997.00
  AND compare_at_price = 29997;
