# Availability Audit Notes

- Course landing cards now send cohort groups with `status: "waitlist"` to the status-aware detail dialog rather than directly to checkout. The dialog's existing Waitlist action opens the shared duplicate-safe product Waitlist form.
- Downloads and digital bundles currently use `draft`, `published`, `hidden`, `private`, and `archived` status values. Memberships and course bundles currently use `draft` and `published`. Their separate purchase models will need an explicit pre-sale access representation if Pre-sale purchase is to be supported.
- Standalone quizzes are embedded-only in this project and have no separate public sales flow, so availability controls should remain at their parent learning experience rather than introduce standalone Quiz Creator checkout.
