-- Extend the shared Waitlist target enum for additional purchasable content types.
ALTER TABLE content_waitlist_entries
  MODIFY COLUMN product_type ENUM('course','cohort_group','workshop','workshop_instance','webinar','download','bundle','membership','quiz') NOT NULL;
