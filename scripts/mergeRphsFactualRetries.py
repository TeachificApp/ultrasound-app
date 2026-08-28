#!/usr/bin/env python3
"""Merge factual-correction retry candidates into a validated RPhS replacement map."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replacements", required=True)
    parser.add_argument("--retry-jobs", required=True)
    parser.add_argument("--retry-output", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    replacements = {int(index): question for index, question in json.loads(Path(args.replacements).read_text(encoding="utf-8"))["replacements"].items()}
    retry_jobs = json.loads(Path(args.retry_jobs).read_text(encoding="utf-8"))
    retry_rows = [json.loads(line) for line in Path(args.retry_output).read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(retry_jobs) != len(retry_rows):
        raise SystemExit("Retry job/output count mismatch.")
    for job, row in zip(retry_jobs, retry_rows):
        if row.get("error"):
            raise SystemExit(f"Retry provider error: {row['error']}")
        questions = json.loads(row["output"])["questions"]
        if len(questions) != len(job["replacement_indices"]):
            raise SystemExit("Retry question count does not match requested positions.")
        for index, question in zip(job["replacement_indices"], questions):
            replacements[index] = question
    if len(replacements) != 99:
        raise SystemExit(f"Expected 99 replacement positions, got {len(replacements)}.")
    Path(args.out).write_text(json.dumps({"replacements": replacements}, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
