#!/usr/bin/env python3
"""Prepare the final source-grounding review for a subset of RPhS replacements."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replacements", required=True)
    parser.add_argument("--retry-jobs", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    replacements = {int(index): question for index, question in json.loads(Path(args.replacements).read_text(encoding="utf-8"))["replacements"].items()}
    retry_jobs = json.loads(Path(args.retry_jobs).read_text(encoding="utf-8"))
    indices = [index for job in retry_jobs for index in job["replacement_indices"]]
    if not indices or len(indices) > 11:
        raise SystemExit("Expected one final review subset of one to 11 questions.")
    job = {
        "instructions": (
            "Audit each proposed replacement question against the supplied source transcript. Approve only if the stem, "
            "correct answer, and explanation are directly supported and the correct answer is unambiguous. Reject any "
            "inaccuracy, unsupported claim, or ambiguity. Do not rewrite questions."
        ),
        "source_transcript": Path(args.source).read_text(encoding="utf-8"),
        "questions": [{"index": index, **replacements[index]} for index in indices],
    }
    Path(args.out).write_text(json.dumps([job], ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
