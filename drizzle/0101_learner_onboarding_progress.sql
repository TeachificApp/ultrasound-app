-- Per-learner, cross-device progress for the first-three-visit Learn access guide.
CREATE TABLE IF NOT EXISTS learner_onboarding_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  learn_visit_count INT NOT NULL DEFAULT 0,
  last_visit_key VARCHAR(128) NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX learner_onboarding_progress_last_seen_idx (last_seen_at)
);
