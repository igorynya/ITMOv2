#!/usr/bin/env bash
set -euo pipefail

# Minimal runner: runs MCP checklist in strict mode and fails on any FAIL.
# Logs JSON output into practices/practice_04/evidence/checks/.

ROOT_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
EVIDENCE_DIR="$ROOT_DIR/practices/practice_04/evidence/checks"
SCRIPT_PATH="$ROOT_DIR/tools/practice-04-checklist/main.py"

mkdir -p "$EVIDENCE_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found" >&2
  exit 1
fi

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Checklist server not found at $SCRIPT_PATH" >&2
  exit 1
fi

OUTPUT_FILE="$EVIDENCE_DIR/check_strict_$(date +%Y%m%d_%H%M%S).json"

OUTPUT=$(python3 "$SCRIPT_PATH" --input '{"strict": true}') || true
printf "%s\n" "$OUTPUT" > "$OUTPUT_FILE"

echo "Saved output to $OUTPUT_FILE"

if printf "%s" "$OUTPUT" | grep -q '"ok": true'; then
  echo "Checklist OK"
  exit 0
else
  echo "Checklist FAIL" >&2
  exit 1
fi
