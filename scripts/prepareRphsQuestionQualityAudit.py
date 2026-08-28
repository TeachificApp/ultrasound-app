#!/usr/bin/env python3
"""Prepare seven structured factual-quality review jobs for RPhS generated questions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    dataset = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    questions = dataset.get("questions", [])
    if not dataset.get("valid") or len(questions) != 350:
        raise SystemExit("Expected the validated 350-question RPhS source dataset.")
    source = Path(args.source).read_text(encoding="utf-8")
    jobs = []
    for batch in range(7):
        start = batch * 50
        jobs.append({
            "batch": batch + 1,
            "instructions": (
                "Audit each multiple-choice question against the supplied source transcript. Approve only when the "
                "stem, correct answer, and explanation are supported by the source and the incorrect choices do not "
                "make the keyed answer ambiguous. Reject a question if it is inaccurate, unsupported, internally "
                "inconsistent, too weakly grounded, or duplicates the same clinical concept within this review batch. "
                "Do not rewrite questions in this pass; provide a concise reason for each decision."
            ),
            "source_transcript": source,
            "questions": [{"index": index, **question} for index, question in enumerate(questions[start:start + 50], start=start)],
        })
    Path(args.out).write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
