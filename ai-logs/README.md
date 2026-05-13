# AI Working Logs

Raw conversation logs and a curated summary, per the 8x Engineer contest's [AI Logs guideline](https://8xengineer.com/guidelines/ai-logs).

## Contents

| File | Purpose |
|---|---|
| `SUMMARY.md` | Human-readable, day-by-day narrative of what we built, what we decided, what's left. Read this first. |
| `session-*-claude-code.jsonl` | Raw Claude Code conversation logs (full prompts + responses + tool calls). One file per session. |

## Re-syncing logs

Claude Code auto-saves every conversation to `~/.claude/projects/<encoded-path>/*.jsonl`. Before each commit, re-sync the latest:

```bash
pnpm logs:sync
```

This copies all matching `*go-viral-8x*` session files into this folder, idempotently (`cp -u` only overwrites if the source is newer).
