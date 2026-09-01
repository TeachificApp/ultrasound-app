-- Store local application scope metadata for Stripe coupons. Stripe remains
-- the payment authority; this table records catalog, content-type, or selected
-- product targeting for checkout validation.
CREATE TABLE coupon_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stripe_coupon_id VARCHAR(255) NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'site_wide',
  product_keys TEXT NULL,
  duration VARCHAR(32) NOT NULL DEFAULT 'once',
  duration_in_months INT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE KEY coupon_metadata_stripe_coupon_id_unique (stripe_coupon_id)
);
