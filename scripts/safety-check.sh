#!/usr/bin/env bash
# Checks the lines a change ADDS for risky calls and likely real identifiers.
# Usage: scripts/safety-check.sh <base-ref>   (default: origin/main)
set -u
BASE="${1:-origin/main}"
# The leading "+" diff marker is stripped so a line that begins with "@" (such
# as CLAUDE.md's "@AGENTS.md" import) is not mistaken for an email address.
ADDED=$(git diff --unified=0 "$BASE"...HEAD -- '*.gs' '*.html' '*.js' '*.json' '*.md' '*.csv' \
  | grep -E '^\+' | grep -vE '^\+\+\+' | sed 's/^+//' || true)
FAIL=0

RISKY='\.(clear|clearContent|clearContents|deleteRow|deleteRows|deleteColumn|deleteColumns|deleteSheet|setTrashed|removeFile|removeFolder)\('
CODE=$(git diff --unified=0 "$BASE"...HEAD -- '*.gs' '*.html' '*.js' \
  | grep -E '^\+' | grep -vE '^\+\+\+' || true)
HITS=$(printf '%s\n' "$CODE" | grep -E "$RISKY" | grep -v 'SAFETY-APPROVED:' || true)
if [ -n "$HITS" ]; then
  echo "BLOCKED: calls that can delete or clear data (add '// SAFETY-APPROVED: reason' after owner approval):"
  printf '%s\n' "$HITS"; FAIL=1
fi

EMAILS=$(printf '%s\n' "$ADDED" | grep -Eo '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  | grep -viE '@(example\.(com|org|net)|[a-z0-9.-]+\.example|users\.noreply\.github\.com|anthropic\.com)$' || true)
if [ -n "$EMAILS" ]; then
  echo "BLOCKED: email addresses that are not fictional (use @example.com):"
  printf '%s\n' "$EMAILS" | sort -u; FAIL=1
fi

IDS=$(printf '%s\n' "$ADDED" | grep -E 'docs\.google\.com/|drive\.google\.com/|script\.google\.com/macros/s/' || true)
if [ -n "$IDS" ]; then
  echo "BLOCKED: links to real Google files or deployments:"
  printf '%s\n' "$IDS"; FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then echo "Safety check passed."; fi
exit "$FAIL"
