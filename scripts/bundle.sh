#!/usr/bin/env bash
# Concatenates apps-script/*.gs into a single paste-ready file at dist/HouseholdFinanceTracker.gs
set -euo pipefail
cd "$(dirname "$0")/.."
out=dist/HouseholdFinanceTracker.gs
{
  echo "/**"
  echo " * Household Finance Tracker — bundled Apps Script"
  echo " * Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) from apps-script/*.gs by scripts/bundle.sh"
  echo " * Source: https://github.com/howardbe517-sudo/household-finance-tracker"
  echo " *"
  echo " * HOW TO USE"
  echo " *   1. Create a new, blank Google Sheet."
  echo " *   2. Extensions → Apps Script. Delete the default contents of Code.gs."
  echo " *   3. Paste this entire file. Save (Ctrl/Cmd+S)."
  echo " *   4. In the function dropdown pick buildWorkbookWithSample (or buildWorkbookEmpty) → Run."
  echo " *   5. Approve the permissions (it only touches this spreadsheet). Wait ~1–2 minutes."
  echo " *   6. Back in the Sheet: reload. Use the 'Finance Tracker' menu for QA and helpers."
  echo " */"
  echo
  for f in apps-script/*.gs; do
    echo "/* ===================================================================== */"
    echo "/* $(basename "$f")"
    echo "/* ===================================================================== */"
    cat "$f"
    echo
  done
} > "$out"
echo "wrote $out ($(wc -l < "$out") lines)"
