CREATE TABLE stripe_subscription_sync_snapshots (
  id INT NOT NULL AUTO_INCREMENT,
  enrollment_id INT NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stripe_sync_snapshot_enrollment (enrollment_id)
);

CREATE TABLE stripe_subscription_sync_runs (
  id INT NOT NULL AUTO_INCREMENT,
  subscriptions_checked INT NOT NULL DEFAULT 0,
  accounts_added INT NOT NULL DEFAULT 0,
  access_revoked INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
