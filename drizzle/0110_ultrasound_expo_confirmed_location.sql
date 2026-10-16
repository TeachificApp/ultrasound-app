-- Present the confirmed city consistently across public UltrasoundExpo™ event information.
-- The exact venue remains intentionally configurable in the event administration workspace.
UPDATE ultrasound_expo_events
SET location_label = 'Orlando, Florida'
WHERE slug = 'ultrasoundexpo-2028';
