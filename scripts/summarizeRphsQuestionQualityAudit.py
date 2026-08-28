#!/usr/bin/env python3
"""Validate and summarize structured RPhS factual-quality review output."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    reviews = []
    for row in (json.loads(line) for line in Path(args.input).read_text(encoding="utf-8").splitlines() if line.strip()):
        if row.get("error"):
            raise SystemExit(f"Provider error: {row['error']}")
        reviews.extend(json.loads(row["output"])["reviews"])
    indices = [review["index"] for review in reviews]
    if len(reviews) != 350 or sorted(indices) != list(range(350)):
        raise SystemExit("Quality audit must review every source question exactly once.")
    rejected = [review for review in reviews if review["verdict"] == "reject"]
    Path(args.out).write_text(json.dumps({"reviewCount": len(reviews), "approvedCount": len(reviews) - len(rejected), "rejectedCount": len(rejected), "rejected": rejected}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"reviewCount": len(reviews), "approvedCount": len(reviews) - len(rejected), "rejectedCount": len(rejected)}))


if __name__ == "__main__":
    main()
