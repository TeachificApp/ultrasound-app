-- Correct the published inaugural UltrasoundExpo™ event dates without changing prior registrations or package records.
UPDATE ultrasound_expo_events
SET
  starts_at = '2028-01-14 12:00:00',
  ends_at = '2028-01-16 14:00:00'
WHERE slug = 'ultrasoundexpo-2028';
