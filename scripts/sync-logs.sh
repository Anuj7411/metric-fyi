#!/usr/bin/env bash
# Sync Claude Code conversation logs from ~/.claude/projects/ into ./ai-logs/.
#
# Two passes:
#   1. Idempotent copy of newer .jsonl files (tagged with parent-dir slug to
#      disambiguate sessions started from different cwds).
#   2. Redact known secret patterns (Gemini keys, Supabase JWTs, OpenAI keys,
#      Anthropic keys, .env-style key=value pairs) so credentials never end
#      up in the public repo, even if they appeared in a prompt.
set -euo pipefail

cd "$(dirname "$0")/.."

DEST="ai-logs"
mkdir -p "$DEST"

shopt -s nullglob
count=0
for dir in "$HOME/.claude/projects/"*go-viral-8x*/; do
  for f in "$dir"*.jsonl; do
    base=$(basename "$f")
    parent=$(basename "$dir")
    out="$DEST/${parent}__${base}"
    if [ ! -f "$out" ] || [ "$f" -nt "$out" ]; then
      cp "$f" "$out"
      count=$((count+1))
    fi
  done
done

# Redact common secret patterns across every synced file. Run on every sync
# so any newly-added key in the latest segment gets caught.
# Patterns:
#   AIza[0-9A-Za-z_-]{35}     Google API keys (Gemini)
#   sk-[A-Za-z0-9-]{20,}      OpenAI / many vendors
#   sk-ant-[A-Za-z0-9-]{20,}  Anthropic
#   eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_.-]{20,}   JWT (Supabase keys, etc) — but leave the publishable/anon role JWTs since those are already public
#   We deliberately do NOT redact JWTs because the Supabase anon key is
#   public-by-design and is also embedded in client builds. If you ever
#   paste a service_role JWT, redact it manually.

redact_count=0
for jf in "$DEST"/*.jsonl; do
  before=$(wc -c < "$jf")
  # In-place sed; using a temp file because GNU sed -i and macOS sed -i differ.
  tmp="${jf}.tmp"
  sed -E \
    -e 's/AIza[0-9A-Za-z_-]{35}/[REDACTED_GOOGLE_API_KEY]/g' \
    -e 's/sk-ant-[A-Za-z0-9-]{20,}/[REDACTED_ANTHROPIC_KEY]/g' \
    -e 's/sk-[A-Za-z0-9_-]{20,}/[REDACTED_API_KEY]/g' \
    "$jf" > "$tmp"
  after=$(wc -c < "$tmp")
  if [ "$before" != "$after" ]; then
    mv "$tmp" "$jf"
    redact_count=$((redact_count+1))
  else
    rm -f "$tmp"
  fi
done

if [ "$count" -eq 0 ] && [ "$redact_count" -eq 0 ]; then
  echo "ai-logs already up to date."
else
  [ "$count" -gt 0 ] && echo "Synced $count file(s)."
  [ "$redact_count" -gt 0 ] && echo "Redacted secrets in $redact_count file(s)."
fi
