# AI Course and Lesson Focus Regeneration

The LMS administration area now provides **Regenerate Focus** at the course level and within an individual lesson editor. It is intended for repurposing an existing educational structure to a new clinical focus, such as adapting a lesson on fetal echocardiography indications to a pediatric echocardiography perspective.

## Workflow

1. An administrator selects **Regenerate Focus** for one lesson or an entire course.
2. The administrator supplies the new clinical focus and the teaching objective.
3. Course regeneration processes five lessons at a time, rather than failing when a course exceeds a fixed lesson count. The server returns one structured, rate-safe preview batch for review. Nothing is saved during generation.
4. The administrator expands each lesson preview, reviews the proposed title, objectives, instructional body, and number of existing block text fields that will change.
5. The dialog shows the current lesson range and remaining course progress. The administrator can discard the current batch and continue, or select **Apply This Batch & Continue** to save only the reviewed lessons and advance to the next batch.
6. Only an explicit apply action writes the proposal; closing the dialog writes nothing.

## Preserved fields

The workflow deliberately keeps the course and learner structure fixed. It never writes course pricing, access rules, course/section/lesson order, lesson IDs, block IDs or types, layout, styles, media URLs, image/video settings, CTA links, quiz blocks/questions, enrollments, completion, certificates, attempts, or learner answers.

It can update only the lesson title, learning objectives, free-text instructional body, optional video-supporting instructional text, and text fields already present in non-quiz content blocks. The server revalidates every requested block-text path against the current stored lesson before applying it, so a generated or altered preview cannot move blocks or rewrite protected media/layout fields.

## Validation

The implementation is administrator-gated, uses strict structured model output, generates course previews in five-lesson batches to avoid unbounded direct-provider requests, and writes each accepted batch in a single database transaction. Focused regression coverage confirms batch progression plus preservation of media, styling, CTA links, quiz block content, and block IDs when instructional text is updated. Target server and client bundles compile successfully.

Live validation is required before using the workflow on active course content.
