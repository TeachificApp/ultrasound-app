#!/usr/bin/env python3
"""Prepare seven source-grounded question-generation jobs from an OCR transcript."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


FOCUSES = [
    "venous anatomy, physiology, calf-muscle pump function, and perforator anatomy",
    "venous duplex technique, patient positioning, Doppler maneuvers, and reflux assessment",
    "chronic venous insufficiency, chronic venous disease, CEAP-style clinical findings, and venous ulcer concepts",
    "superficial and deep venous thrombosis, obstruction, post-thrombotic change, and differential assessment",
    "thermal ablation devices, procedural setup, treatment parameters, and immediate treatment technique",
    "sclerotherapy, foam preparation, accessory-vein treatment, complications, and follow-up",
    "venous interventions, chronic venous disease reporting, anatomy variants, quality/safety, and clinically relevant review",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    source = Path(args.source).read_text(encoding="utf-8")
    if len(source.split()) < 1_000:
        raise SystemExit("OCR transcript is too short for reliable source-grounded question generation.")

    jobs = []
    for batch_number, focus in enumerate(FOCUSES, start=1):
        jobs.append(
            {
                "batch": batch_number,
                "required_questions": 50,
                "topic_focus": focus,
                "instructions": (
                    "Create exactly 50 unique intermediate multiple-choice questions for registered physician "
                    "sonography review. Use the supplied scanned-source transcript as the factual basis. "
                    "Do not ask a follow-up question and do not mention the transcript. Each question must have "
                    "four plausible, distinct options; the correctAnswer must exactly match one option. Give concise, "
                    "editable correctFeedback and incorrectFeedback grounded in the source. Avoid duplicate stems or "
                    "near-duplicates across the batch. Do not create patient-specific clinical advice."
                ),
                "source_transcript": source,
            }
        )

    Path(args.out).write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
