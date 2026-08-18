# Platform Timestamp Policy

The platform persists business timestamps as UTC `Date` values. Administrators schedule sales windows, cohort sessions, workshops, course availability, and campaign sends in **America/New_York** unless an explicit offset is supplied.

Zone-less administrator inputs, including `datetime-local` values and legacy MySQL scheduled timestamps, must be converted with `parseScheduledTimestamp(value, PLATFORM_TIMEZONE, boundary)` before persistence or comparison. Date-only enrollment deadlines use the `end` boundary so they remain open through 11:59:59.999 PM Eastern on the stated date.

Availability decisions must use `isScheduledDeadlineOpen()` rather than raw `new Date(value) < new Date()` comparisons. User-facing scheduled times should use `formatInTimeZone()` with an explicit timezone; learner cohort schedules, enrollment windows, workshop sales windows, and email campaign confirmations use the platform Eastern timezone. Event telemetry and historical activity timestamps remain UTC instants and may be rendered in the viewer’s locale when they are not business deadlines.

## Audited workflow classifications

| Workflow | Persistence and evaluation rule | Presentation rule |
|---|---|---|
| Course and cohort enrollment deadlines | UTC persistence; `isScheduledDeadlineOpen()` with the Eastern platform timezone | Eastern scheduled date and countdown |
| Cohort administration persistence | Zone-less start dates parse at Eastern start-of-day; end and enrollment-close values parse at Eastern end-of-day | Administrator date fields preserve their entered Eastern calendar date |
| Workshop instance sales and enrollment close | UTC persistence; server sales-window helpers evaluate Eastern wall-clock deadlines | Eastern scheduled date/time and restricted availability labels |
| Embedded course checkout | Cohort enrollment-close validation uses `isScheduledDeadlineOpen()` before payment session creation | Closed checkout is rejected after the Eastern deadline boundary |
| LMS and Workshop Administration inputs | Convert stored UTC instants with `formatScheduledInput()`; parse submitted zone-less inputs as Eastern | `datetime-local` and date-only fields retain the administrator’s intended Eastern value |
| Webinar administration and landing | Stored schedule values parse and hydrate as Eastern wall-clock time | Webinar time remains configured by the webinar timezone; administrator input defaults to Eastern |
| CME expiry monitoring | Expiry is calculated from the persisted approval instant | Daily renewal notification date renders in Eastern |
| Cohort schedules and Course Overview | Session instants remain UTC | Course schedule cards and calendar labels use `formatInTimeZone()` in Eastern |
| Learner workshop dashboard | Instance start instant remains UTC | Enrollment card date uses `formatInTimeZone()` in Eastern |
| Learner subscription access | Access expiry is an exact UTC instant, not a scheduled wall-clock deadline | Dashboard cancellation branch uses the shared instant-expiry evaluator |

## Intentional instant and relative-duration handling

The remaining direct `Date.now()` arithmetic in learner progression and public on-load countdowns is **not** a scheduled calendar interpretation. Course drip eligibility is measured as elapsed duration from the stored enrollment instant, and “on load” timers are explicitly relative durations held in session storage. Those paths do not receive a timezone conversion. Likewise, activity history and analytics timestamps may use the learner’s local display context because they are historical instants rather than sales, enrollment, or scheduled-content deadlines.
| Email campaign scheduling | Persist the parsed UTC instant | Admin scheduler input and confirmation use Eastern wall-clock time |
| Audit logs, sent/open/click analytics, and subscription history | UTC instants | Viewer-local display is intentional because these are historical events, not scheduled platform deadlines |
