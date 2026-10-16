-- Keep the public 2028 UltrasoundExpo™ city and venue status together.
-- Additive data correction only; no event records are removed.
UPDATE `ultrasound_expo_events`
SET `location_label` = 'Orlando, Florida · Venue TBD'
WHERE `slug` = 'ultrasoundexpo-2028';
