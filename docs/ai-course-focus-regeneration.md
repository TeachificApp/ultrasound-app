# AI Course and Lesson Focus Regeneration

The LMS administration area now provides **Regenerate Focus** at the course level and within an individual lesson editor. It is intended for repurposing an existing educational structure to a new clinical focus, such as adapting a lesson on fetal echocardiography indications to a pediatric echocardiography perspective.

## Workflow

1. An administrator selects **Regenerate Focus** for one lesson or an entire course.
2. The administrator supplies the new clinical focus and the teaching objective.
3. For a course, the administrator selects the specific lessons to regenerate. The selection may contain **one to 25 lessons**; it is not restricted to sequential lessons. Unselected lessons remain unchanged.
4. The server validates that every selected lesson belongs to that course, preserves the stored course order for the preview, and returns a structured proposal only for the selected lessons. Nothing is saved during generation, and no selection is saved automatically.
5. The administrator expands each lesson preview and reviews the proposed title, objectives, instructional body, and number of existing block text fields that will change.
6. Only an explicit **Apply Reviewed Changes** action writes the reviewed proposal; closing the dialog or selecting **Start Over** writes nothing.

## Preserved fields

The workflow deliberately keeps the course and learner structure fixed. It never writes course pricing, access rules, course/section/lesson order, lesson IDs, block IDs or types, layout, styles, media URLs, image/video settings, CTA links, quiz blocks/questions, enrollments, completion, certificates, attempts, or learner answers.

It can update only the lesson title, learning objectives, free-text instructional body, optional video-supporting instructional text, and text fields already present in non-quiz content blocks. The server revalidates every requested block-text path against the current stored lesson before applying it, so a generated or altered preview cannot move blocks or rewrite protected media/layout fields.

## Validation

The implementation is administrator-gated, uses strict structured model output, validates a selected course set of one to 25 lessons, and writes only the explicitly reviewed lessons in a single database transaction. Focused regression coverage confirms selected-lesson ordering and selection boundaries plus preservation of media, styling, CTA links, quiz block content, and block IDs when instructional text is updated. Target server and client bundles compile successfully.

Live validation is required before using the workflow on active course content.
