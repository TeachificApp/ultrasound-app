#!/usr/bin/env python3
"""Rotate scanned RPhS PDF page images for deterministic OCR preparation."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    source_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pages = sorted(source_dir.glob("*.png"))
    if not pages:
        raise SystemExit("No PNG pages found for rotation.")

    for page in pages:
        with Image.open(page) as image:
            image.rotate(180, expand=True).save(output_dir / page.name, "PNG")


if __name__ == "__main__":
    main()
