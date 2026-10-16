-- Additive SEO metadata fields for crawler-visible page-editor controls.
ALTER TABLE site_pages ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE ultrasound_expo_event_pages ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE ultrasound_expo_event_pages ADD COLUMN seo_image VARCHAR(512) NULL;
ALTER TABLE lms_landing_pages ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE funnel_pages ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE bundles ADD COLUMN meta_keywords TEXT NULL;
ALTER TABLE bundles ADD COLUMN seo_image VARCHAR(512) NULL;
ALTER TABLE membership_plans ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE membership_plans ADD COLUMN seo_image VARCHAR(512) NULL;
ALTER TABLE communities ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE communities ADD COLUMN seo_image VARCHAR(512) NULL;
ALTER TABLE webinars ADD COLUMN seo_keywords TEXT NULL;
ALTER TABLE webinars ADD COLUMN seo_image VARCHAR(512) NULL;
