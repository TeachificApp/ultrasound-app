-- Per-learner CME restrictions. These fields are additive and leave existing
-- course access, completed lessons, and certificate records unchanged.
ALTER TABLE `lms_enrollments`
  ADD COLUMN `cme_credit_restricted` boolean NOT NULL DEFAULT false;

ALTER TABLE `lms_lessons`
  ADD COLUMN `hide_for_cme_restricted` boolean NOT NULL DEFAULT false;
