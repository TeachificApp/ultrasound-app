#!/usr/bin/env python3
"""Locate duplicate generated RPhS question stems and prepare a replacement job."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def normalized_stem(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generated", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    questions: list[dict] = []
    for row in (json.loads(line) for line in Path(args.generated).read_text(encoding="utf-8").splitlines() if line.strip()):
        questions.extend(json.loads(row["output"])["questions"])

    seen: dict[str, int] = {}
    replace_indices: list[int] = []
    for index, question in enumerate(questions):
        stem = normalized_stem(question["question"])
        if stem in seen:
            replace_indices.append(index)
        else:
            seen[stem] = index
    if not replace_indices:
        raise SystemExit("No duplicate question stems were found.")

    job = {
        "required_questions": len(replace_indices),
        "replace_indices": replace_indices,
        "instructions": (
            "Create exactly the requested number of unique intermediate multiple-choice questions for registered "
            "physician sonography review. Use the source transcript as the factual basis. Do not repeat any of the "
            "existing stems listed below or create a near-duplicate. Each question needs four distinct options, an exact "
            "matching correctAnswer, an explanation, correctFeedback, and incorrectFeedback. Do not ask a follow-up "
            "question and do not provide patient-specific clinical advice."
        ),
        "existing_stems": [question["question"] for question in questions],
        "source_transcript": Path(args.source).read_text(encoding="utf-8"),
    }
    Path(args.out).write_text(json.dumps([job], ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"totalQuestions": len(questions), "replacementIndices": replace_indices}))


if __name__ == "__main__":
    main()
