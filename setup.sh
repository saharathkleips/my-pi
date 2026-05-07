#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HOME_DIR="${HOME:-/home/node}"
PI_HOME="${PI_HOME:-$HOME_DIR/.pi}"
PI_AGENT_DIR="${PI_AGENT_DIR:-$PI_HOME/agent}"
PI_CODING_AGENT_VERSION="$(sed -nE 's/.*"@mariozechner\/pi-coding-agent": "([^"]+)".*/\1/p' "$SCRIPT_DIR/package.json")"

echo "Setting up Pi workflow..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is not available. Enable Corepack or install pnpm first." >&2
  exit 1
fi

echo "Installing Pi Coding Agent..."
pnpm install -g "@mariozechner/pi-coding-agent@${PI_CODING_AGENT_VERSION}"

echo "Linking workflow directories..."
mkdir -p "$PI_AGENT_DIR"

for dir in extensions prompts skills; do
  if [ ! -d "$SCRIPT_DIR/$dir" ]; then
    echo "ERROR: expected directory missing: $SCRIPT_DIR/$dir" >&2
    exit 1
  fi
  ln -sfn "$SCRIPT_DIR/$dir" "$PI_AGENT_DIR/$dir"
done

echo "Pi workflow setup complete!"
