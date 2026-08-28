#!/usr/bin/env python3
"""Validate and summarize all RPhS replacement factual-quality review outputs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    rows = [json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()]
    reviews = []
    for row in rows:
        if row.get("error"):
            raise SystemExit(f"Provider error: {row['error']}")
        reviews.extend(json.loads(row["output"])["reviews"])
    indices = [review["index"] for review in reviews]
    if len(reviews) != 99 or len(set(indices)) != 99:
        raise SystemExit("Expected one review for each of 99 replacement candidates.")
    rejected = [review for review in reviews if review["verdict"] == "reject"]
    result = {"reviewCount": len(reviews), "approvedCount": len(reviews) - len(rejected), "rejectedCount": len(rejected), "rejected": rejected}
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("reviewCount", "approvedCount", "rejectedCount")}))


if __name__ == "__main__":
    main()
