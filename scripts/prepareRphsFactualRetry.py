#!/usr/bin/env python3
"""Prepare retries for factual-review-rejected RPhS replacement candidates only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--replacements", required=True)
    parser.add_argument("--audit", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    original = json.loads(Path(args.questions).read_text(encoding="utf-8"))["questions"]
    replacements = {int(index): question for index, question in json.loads(Path(args.replacements).read_text(encoding="utf-8"))["replacements"].items()}
    review = json.loads(Path(args.audit).read_text(encoding="utf-8"))
    retry_indices = [item["index"] for item in review["rejected"]]
    rejected_set = set(retry_indices)
    if len(original) != 350 or len(replacements) != 99 or not retry_indices or len(retry_indices) > 19 or len(rejected_set) != len(retry_indices):
        raise SystemExit("Expected 350 originals, 99 replacements, and one to 19 unique factual-review rejections.")
    reserved = [question["question"] for index, question in enumerate(original) if index not in replacements]
    reserved.extend(question["question"] for index, question in replacements.items() if index not in rejected_set)
    reason_by_index = {item["index"]: item["reason"] for item in review["rejected"]}
    source = Path(args.source).read_text(encoding="utf-8")
    jobs = []
    for batch, start in enumerate(range(0, len(retry_indices), 10), start=1):
        indices = retry_indices[start:start + 10]
        jobs.append({
            "batch": batch,
            "required_questions": len(indices),
            "replacement_indices": indices,
            "prior_rejection_reasons": [reason_by_index[index] for index in indices],
            "instructions": (
                "Create exactly the requested number of distinct intermediate multiple-choice questions for registered "
                "physician sonography review. Use only a source statement with an explicit, unambiguous answer or answer-key "
                "support. Do not reuse or paraphrase any reserved stem, avoid the reviewed rejection reasons, and do not infer "
                "facts beyond the transcript. Each question needs four distinct options, a correctAnswer matching one option, "
                "and concise source-grounded explanation/correctFeedback/incorrectFeedback."
            ),
            "reserved_stems": reserved,
            "source_transcript": source,
        })
    Path(args.out).write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
