# AI Course and Lesson Focus Regeneration

The LMS administration area now provides **Regenerate Focus** at the course level and within an individual lesson editor. It is intended for repurposing an existing educational structure to a new clinical focus, such as adapting a lesson on fetal echocardiography indications to a pediatric echocardiography perspective.

## Workflow

1. An administrator selects **Regenerate Focus** for one lesson or an entire course.
2. The administrator supplies the new clinical focus and the teaching objective.
3. The server returns a structured preview for review. Nothing is saved during generation.
4. The administrator expands each lesson preview, reviews the proposed title, objectives, instructional body, and number of existing block text fields that will change.
5. Only **Apply Reviewed Changes** writes the proposal.

## Preserved fields

The workflow deliberately keeps the course and learner structure fixed. It never writes course pricing, access rules, course/section/lesson order, lesson IDs, block IDs or types, layout, styles, media URLs, image/video settings, CTA links, quiz blocks/questions, enrollments, completion, certificates, attempts, or learner answers.

It can update only the lesson title, learning objectives, free-text instructional body, optional video-supporting instructional text, and text fields already present in non-quiz content blocks. The server revalidates every requested block-text path against the current stored lesson before applying it, so a generated or altered preview cannot move blocks or rewrite protected media/layout fields.

## Validation

The implementation is administrator-gated, uses strict structured model output, limits a course preview to 30 lessons for a bounded review response, and writes all accepted lesson updates in a single database transaction. Focused regression coverage confirms that media, styling, CTA links, quiz block content, and block IDs remain unchanged when instructional text is updated. Target server and client bundles compile successfully.

Live validation is required before using the workflow on active course content.
