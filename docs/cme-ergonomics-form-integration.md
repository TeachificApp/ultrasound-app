# Ergonomics CME External Form Integration

The existing Ergonomics CME post-test uses the external Certification Survey form. Its required completion-date field is identified by query parameter `id293`; the former static placeholder value was invalid and has been removed from the lesson’s saved form URL.

The form accepts query-prefilled first name, last name, and email using `id15`, `id336`, and `id35`, respectively. The application now resolves supported profile placeholders before rendering the embedded form. The completion date, attestation, course choice, date of birth, and credentials remain required fields that the learner must supply or select in the external form.

No learner name, email address, responses, attempts, completion records, or certificate records are retained in this note.
