#!/usr/bin/env python3
"""Validate the seven generated RPhS question batches before Railway insertion."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


REQUIRED_FIELDS = ("question", "options", "correctAnswer", "explanation", "correctFeedback", "incorrectFeedback")


def normalized_stem(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    rows = [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    failures: list[str] = []
    questions: list[dict] = []
    for row_number, row in enumerate(rows, start=1):
        if row.get("error"):
            failures.append(f"batch {row_number}: provider error")
            continue
        try:
            payload = json.loads(row["output"])
            batch_questions = payload["questions"]
        except (KeyError, TypeError, json.JSONDecodeError) as error:
            failures.append(f"batch {row_number}: invalid JSON ({error})")
            continue
        if len(batch_questions) != 50:
            failures.append(f"batch {row_number}: expected 50 questions, received {len(batch_questions)}")
        for question_number, question in enumerate(batch_questions, start=1):
            missing = [field for field in REQUIRED_FIELDS if field != "options" and (not isinstance(question.get(field), str) or not question[field].strip())]
            options = question.get("options")
            if not isinstance(options, list):
                missing.append("options")
            if missing:
                failures.append(f"batch {row_number} question {question_number}: missing {', '.join(missing)}")
            if not isinstance(options, list) or len(options) != 4 or len({str(option).strip().lower() for option in options}) != 4:
                failures.append(f"batch {row_number} question {question_number}: options must contain four distinct values")
            elif question.get("correctAnswer") not in options:
                failures.append(f"batch {row_number} question {question_number}: correct answer is not an option")
            questions.append(question)

    stems = [normalized_stem(question.get("question", "")) for question in questions]
    duplicate_stems = len(stems) - len(set(stems))
    if duplicate_stems:
        failures.append(f"dataset: {duplicate_stems} duplicate question stems")
    if len(questions) != 350:
        failures.append(f"dataset: expected 350 questions, received {len(questions)}")

    output = {"valid": not failures, "questionCount": len(questions), "failures": failures, "questions": questions if not failures else []}
    Path(args.out).write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")
    if failures:
        raise SystemExit("; ".join(failures[:10]))


if __name__ == "__main__":
    main()
