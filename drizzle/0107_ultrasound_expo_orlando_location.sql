-- Inaugural UltrasoundExpo™ location confirmed by the organizer.
-- Preserve the event record while presenting the city and an explicit venue-TBD label.
UPDATE ultrasound_expo_events
SET location_label = 'Orlando, FL · Venue to be announced'
WHERE slug = 'ultrasoundexpo-2028';
