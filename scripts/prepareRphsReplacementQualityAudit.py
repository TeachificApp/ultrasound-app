#!/usr/bin/env python3
"""Prepare bounded factual-quality audit jobs for validated RPhS replacements."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replacements", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    replacements = {int(index): question for index, question in json.loads(Path(args.replacements).read_text(encoding="utf-8"))["replacements"].items()}
    if len(replacements) != 99:
        raise SystemExit("Expected 99 validated replacement candidates.")
    source = Path(args.source).read_text(encoding="utf-8")
    jobs = []
    items = [{"index": index, **replacements[index]} for index in sorted(replacements)]
    for batch, start in enumerate(range(0, len(items), 11), start=1):
        jobs.append({
            "batch": batch,
            "instructions": (
                "Audit each proposed replacement question against the supplied source transcript. Approve only if the stem, "
                "correct answer, and explanation are directly supported; reject any inaccuracy, unsupported claim, ambiguous "
                "key, or weak grounding. Do not rewrite questions."
            ),
            "source_transcript": source,
            "questions": items[start:start + 11],
        })
    Path(args.out).write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
