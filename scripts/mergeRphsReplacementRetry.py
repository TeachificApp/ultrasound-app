#!/usr/bin/env python3
"""Merge RPhS duplicate-stem retry candidates into the original replacement output."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", required=True)
    parser.add_argument("--original-output", required=True)
    parser.add_argument("--retry-jobs", required=True)
    parser.add_argument("--retry-output", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in Path(args.original_output).read_text(encoding="utf-8").splitlines() if line.strip()]
    replacements = {}
    for job, row in zip(jobs, rows):
        for index, question in zip(job["replacement_indices"], json.loads(row["output"])["questions"]):
            replacements[index] = question
    retry_jobs = json.loads(Path(args.retry_jobs).read_text(encoding="utf-8"))
    retry_rows = [json.loads(line) for line in Path(args.retry_output).read_text(encoding="utf-8").splitlines() if line.strip()]
    for job, row in zip(retry_jobs, retry_rows):
        for index, question in zip(job["replacement_indices"], json.loads(row["output"])["questions"]):
            replacements[index] = question
    if len(replacements) != 99:
        raise SystemExit(f"Expected 99 replacement positions, got {len(replacements)}.")
    Path(args.out).write_text(json.dumps({"replacements": replacements}, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
