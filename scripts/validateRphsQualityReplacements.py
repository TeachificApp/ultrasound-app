#!/usr/bin/env python3
"""Validate approved RPhS replacement candidates before any Railway update."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


FIELDS = ("question", "correctAnswer", "explanation", "correctFeedback", "incorrectFeedback")


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--jobs", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--merged", default="")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    original = json.loads(Path(args.questions).read_text(encoding="utf-8"))["questions"]
    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    failures: list[str] = []
    replacements: dict[int, dict] = {}
    approved_indices = set(range(350)) - {index for job in jobs for index in job["replacement_indices"]}
    approved_stems = {normalize(original[index]["question"]) for index in approved_indices}
    if args.merged:
        replacements = {int(index): question for index, question in json.loads(Path(args.merged).read_text(encoding="utf-8"))["replacements"].items()}
    else:
        rows = [json.loads(line) for line in Path(args.output).read_text(encoding="utf-8").splitlines() if line.strip()]
        for job, row in zip(jobs, rows):
            if row.get("error"):
                failures.append(f"batch {job['batch']}: provider error")
                continue
            questions = json.loads(row["output"]).get("questions", [])
            if len(questions) != len(job["replacement_indices"]):
                failures.append(f"batch {job['batch']}: expected {len(job['replacement_indices'])} questions, received {len(questions)}")
                continue
            for index, question in zip(job["replacement_indices"], questions):
                replacements[index] = question
    for index in sorted(replacements):
        question = replacements[index]
        options = question.get("options")
        if any(not isinstance(question.get(field), str) or not question[field].strip() for field in FIELDS):
            failures.append(f"index {index}: required text missing")
        if not isinstance(options, list) or len(options) != 4 or len({str(option).strip().lower() for option in options}) != 4:
            failures.append(f"index {index}: options must contain four distinct values")
        elif question.get("correctAnswer") not in options:
            failures.append(f"index {index}: correct answer is not an option")
        stem = normalize(question.get("question", ""))
        if not stem or stem in approved_stems:
            failures.append(f"index {index}: replacement stem duplicates an approved or replacement stem")
        else:
            approved_stems.add(stem)
    if len(replacements) != 99:
        failures.append(f"expected 99 replacements, received {len(replacements)}")
    result = {"valid": not failures, "replacementCount": len(replacements), "failures": failures, "replacements": replacements if not failures else {}}
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    if failures:
        raise SystemExit("; ".join(failures[:10]))


if __name__ == "__main__":
    main()
