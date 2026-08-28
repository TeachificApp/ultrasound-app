#!/usr/bin/env python3
"""Prepare retry jobs only for RPhS replacement stems that duplicate retained content."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--jobs", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    original = json.loads(Path(args.questions).read_text(encoding="utf-8"))["questions"]
    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in Path(args.output).read_text(encoding="utf-8").splitlines() if line.strip()]
    replacements = {}
    for job, row in zip(jobs, rows):
        for index, question in zip(job["replacement_indices"], json.loads(row["output"])["questions"]):
            replacements[index] = question

    rejected = set(replacements)
    reserved_stems = {normalize(question["question"]) for index, question in enumerate(original) if index not in rejected}
    retry_indices = []
    valid_replacements = {}
    for index in sorted(replacements):
        stem = normalize(replacements[index]["question"])
        if not stem or stem in reserved_stems:
            retry_indices.append(index)
        else:
            reserved_stems.add(stem)
            valid_replacements[index] = replacements[index]
    if len(retry_indices) != 14:
        raise SystemExit(f"Expected 14 duplicate retries, found {len(retry_indices)}.")

    source = Path(args.source).read_text(encoding="utf-8")
    retry_jobs = []
    for batch, start in enumerate(range(0, len(retry_indices), 7), start=1):
        indices = retry_indices[start:start + 7]
        retry_jobs.append({
            "batch": batch,
            "replacement_indices": indices,
            "required_questions": len(indices),
            "instructions": (
                "Create exactly seven intermediate multiple-choice questions for registered physician sonography review. "
                "Use only facts directly supported by the source transcript. Do not duplicate, paraphrase, or test the "
                "same core clinical concept as any reserved stem. Each question must have four distinct plausible options, "
                "one exact correctAnswer, a concise source-grounded explanation, and editable correct/incorrect feedback. "
                "Do not provide patient-specific clinical advice."
            ),
            "reserved_stems": sorted(reserved_stems),
            "source_transcript": source,
        })
    Path(args.out).write_text(json.dumps(retry_jobs, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"retryIndices": retry_indices, "validReplacementCount": len(valid_replacements)}))


if __name__ == "__main__":
    main()
