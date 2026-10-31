#!/usr/bin/env bash
# Blocks Edit/Write tool use on .env files.
# Claude Code passes the hook input as JSON on stdin.
# Exit code 2 = block the tool and show our message to Claude.

# Reads the target file path from the tool input
FILE_PATH=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# Matches .env, .env.local, .env.production, etc.
if echo "$BASENAME" | grep -qE '^\.env(\.|$)'; then
  echo "Blocked: .env file edits require explicit user approval. Inform the user and ask them to confirm before proceeding." >&2
  exit 2
fi

exit 0
