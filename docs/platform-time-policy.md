# Platform Timestamp Policy

The platform persists business timestamps as UTC `Date` values. Administrators schedule sales windows, cohort sessions, workshops, course availability, and campaign sends in **America/New_York** unless an explicit offset is supplied.

Zone-less administrator inputs, including `datetime-local` values and legacy MySQL scheduled timestamps, must be converted with `parseScheduledTimestamp(value, PLATFORM_TIMEZONE, boundary)` before persistence or comparison. Date-only enrollment deadlines use the `end` boundary so they remain open through 11:59:59.999 PM Eastern on the stated date.

Availability decisions must use `isScheduledDeadlineOpen()` rather than raw `new Date(value) < new Date()` comparisons. User-facing scheduled times should use `formatInTimeZone()` with an explicit timezone; learner cohort schedules, enrollment windows, workshop sales windows, and email campaign confirmations use the platform Eastern timezone. Event telemetry and historical activity timestamps remain UTC instants and may be rendered in the viewer’s locale when they are not business deadlines.
