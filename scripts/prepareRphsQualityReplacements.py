#!/usr/bin/env python3
"""Prepare source-grounded replacements for the RPhS questions rejected in QA."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    dataset = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    review = json.loads(Path(args.audit).read_text(encoding="utf-8"))
    questions = dataset.get("questions", [])
    rejections = review.get("rejected", [])
    rejected_indices = [item["index"] for item in rejections]
    if len(questions) != 350 or len(rejections) != 99 or len(set(rejected_indices)) != 99:
        raise SystemExit("Expected exactly 350 questions and 99 unique review rejections.")

    rejected_set = set(rejected_indices)
    approved_stems = [question["question"] for index, question in enumerate(questions) if index not in rejected_set]
    reason_by_index = {item["index"]: item["reason"] for item in rejections}
    source = Path(args.source).read_text(encoding="utf-8")
    jobs = []
    for batch_number, start in enumerate(range(0, len(rejected_indices), 11), start=1):
        indices = rejected_indices[start:start + 11]
        jobs.append({
            "batch": batch_number,
            "required_questions": len(indices),
            "replacement_indices": indices,
            "rejection_reasons": [reason_by_index[index] for index in indices],
            "instructions": (
                "Create exactly 11 unique intermediate multiple-choice questions for registered physician "
                "sonography review. Use only claims clearly supported by the source transcript. These replace "
                "questions rejected for the listed reasons. Do not repeat, paraphrase, or test the same core "
                "clinical concept as any approved existing stem. Each question must have four distinct plausible "
                "options, one exact correctAnswer, a concise source-grounded explanation, and editable correct/" 
                "incorrect feedback. Do not include patient-specific advice or claims that go beyond the transcript."
            ),
            "approved_existing_stems": approved_stems,
            "source_transcript": source,
        })
    Path(args.out).write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
