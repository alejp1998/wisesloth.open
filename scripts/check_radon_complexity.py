#!/usr/bin/env python3
"""Radon cyclomatic-complexity gate for the fastapi-api Python service.

Fails when any block is rated C or worse (cyclomatic complexity >= 11),
matching the CI/pre-commit threshold. Mirrors the pre-commit radon hook so it
can also be run standalone:

    python scripts/check_radon_complexity.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from radon.complexity import cc_visit

# Blocks with cyclomatic complexity >= 11 are rated C or worse (A=1-5, B=6-10, C=11-20, ...)
COMPLEXITY_THRESHOLD = 11

# Known legacy hotspots that already exceed the threshold before this gate was
# introduced. They are pinned to their CURRENT complexity so they cannot grow
# further; ideally each should be refactored below the threshold (TODO).
# Key is (path relative to fastapi-api, function name).
COMPLEXITY_EXCEPTIONS: dict[tuple[str, str], int] = {
    ("app/services/ai_service.py", "_generate"): 14,
    ("app/services/ai_service.py", "_try_salvage_truncated_json"): 16,
    ("app/services/ai_service.py", "_parse_json_response"): 14,
}

EXCLUDED_DIR_PARTS = {"__pycache__", "completion_logs", "error_logs", "mykeys"}


def main() -> int:
    api_root = Path(__file__).resolve().parents[1] / "fastapi-api"
    failures: list[str] = []

    for py_file in sorted(api_root.rglob("*.py")):
        if any(part in EXCLUDED_DIR_PARTS for part in py_file.parts):
            continue
        try:
            blocks = cc_visit(py_file.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - parse errors surface as failures
            failures.append(f"{py_file}: failed to parse: {exc}")
            continue
        rel = py_file.relative_to(api_root)
        for block in blocks:
            allowed = COMPLEXITY_EXCEPTIONS.get((str(rel), block.name))
            if block.complexity >= COMPLEXITY_THRESHOLD and block.complexity > (allowed or 0):
                failures.append(f"{rel}:{block.lineno} {block.name} (complexity {block.complexity})")

    if failures:
        print(f"Radon complexity gate FAILED (cyclomatic complexity >= {COMPLEXITY_THRESHOLD}):")
        for failure in failures:
            print(f"  {failure}")
        return 1

    print("Radon complexity gate passed (no new C-or-worse blocks).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
