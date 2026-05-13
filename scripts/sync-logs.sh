#!/usr/bin/env bash
# Sync Claude Code conversation logs from ~/.claude/projects/ into ./ai-logs/.
# Idempotent — only copies newer files.
set -euo pipefail

cd "$(dirname "$0")/.."

DEST="ai-logs"
mkdir -p "$DEST"

shopt -s nullglob
count=0
for dir in "$HOME/.claude/projects/"*go-viral-8x*/; do
  for f in "$dir"*.jsonl; do
    base=$(basename "$f")
    # Tag with parent dir slug to disambiguate sessions from different cwds
    parent=$(basename "$dir")
    out="$DEST/${parent}__${base}"
    if [ ! -f "$out" ] || [ "$f" -nt "$out" ]; then
      cp "$f" "$out"
      echo "  synced $out"
      count=$((count+1))
    fi
  done
done

if [ "$count" -eq 0 ]; then
  echo "ai-logs already up to date."
else
  echo "Synced $count log file(s)."
fi
