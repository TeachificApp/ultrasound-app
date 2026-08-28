#!/usr/bin/env python3
"""Replace duplicate RPhS generated question stems with unique validated candidates."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def normalized_stem(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generated", required=True)
    parser.add_argument("--replacement-job", required=True)
    parser.add_argument("--replacements", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    generated_rows = [json.loads(line) for line in Path(args.generated).read_text(encoding="utf-8").splitlines() if line.strip()]
    replacement_job = json.loads(Path(args.replacement_job).read_text(encoding="utf-8"))[0]
    replacement_row = json.loads(Path(args.replacements).read_text(encoding="utf-8").splitlines()[0])
    replacement_candidates = json.loads(replacement_row["output"])["questions"]
    replace_indices = replacement_job["replace_indices"]

    current_questions = [question for row in generated_rows for question in json.loads(row["output"])["questions"]]
    retained_stems = {
        normalized_stem(question["question"])
        for index, question in enumerate(current_questions)
        if index not in replace_indices
    }

    selected: list[dict] = []
    for candidate in replacement_candidates:
        stem = normalized_stem(candidate.get("question", ""))
        options = candidate.get("options")
        if not stem or stem in retained_stems or stem in {normalized_stem(item["question"]) for item in selected}:
            continue
        if not isinstance(options, list) or len(options) != 4 or candidate.get("correctAnswer") not in options:
            continue
        selected.append(candidate)
        if len(selected) == len(replace_indices):
            break
    if len(selected) != len(replace_indices):
        raise SystemExit("Not enough unique, structurally valid replacement questions were generated.")

    for index, replacement in zip(replace_indices, selected):
        row_index, question_index = divmod(index, 50)
        payload = json.loads(generated_rows[row_index]["output"])
        payload["questions"][question_index] = replacement
        generated_rows[row_index]["output"] = json.dumps(payload, ensure_ascii=False)

    with Path(args.out).open("w", encoding="utf-8") as output:
        for row in generated_rows:
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(json.dumps({"replaced": len(selected), "indices": replace_indices}))


if __name__ == "__main__":
    main()
