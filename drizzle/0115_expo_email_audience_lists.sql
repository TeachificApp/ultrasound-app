-- System-managed audiences for UltrasoundExpo™ and EchoExpo™.
-- Additive only: existing list records and subscriber preferences remain unchanged.

INSERT INTO `emailLists` (`name`, `description`, `isActive`, `subscriberCount`)
SELECT 'UltrasoundExpo™ Attendees',
       'Automatically includes confirmed attendee registrations for UltrasoundExpo™ event instances.',
       TRUE,
       0
WHERE NOT EXISTS (
  SELECT 1 FROM `emailLists` WHERE `name` = 'UltrasoundExpo™ Attendees'
);

INSERT INTO `emailLists` (`name`, `description`, `isActive`, `subscriberCount`)
SELECT 'EchoExpo™ Attendees',
       'Automatically includes confirmed attendee registrations for EchoExpo™ event instances within UltrasoundExpo™.',
       TRUE,
       0
WHERE NOT EXISTS (
  SELECT 1 FROM `emailLists` WHERE `name` = 'EchoExpo™ Attendees'
);

INSERT INTO `emailLists` (`name`, `description`, `isActive`, `subscriberCount`)
SELECT 'Exhibitors & Sponsors — UltrasoundExpo™ | EchoExpo™',
       'Automatically includes vendor, exhibitor, and sponsor applications and registrations. Tags identify the organization role and program pathway.',
       TRUE,
       0
WHERE NOT EXISTS (
  SELECT 1 FROM `emailLists` WHERE `name` = 'Exhibitors & Sponsors — UltrasoundExpo™ | EchoExpo™'
);
