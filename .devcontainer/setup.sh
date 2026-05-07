#!/usr/bin/env bash
set -euxo pipefail
exec > /tmp/post-create.log 2>&1

WORKSPACE_DIR="${1:-$(pwd)}"
HOME_DIR="/home/node"
SHELL_HISTORY_DIR="$HOME_DIR/.shellhistory"
LOCAL_DIR="$HOME_DIR/.local"
PI_DIR="$HOME_DIR/.pi"
LOCAL_SETUP="$WORKSPACE_DIR/.devcontainer/local.setup.sh"
PNPM_DIR="$HOME_DIR/.local/share/pnpm"
NODE_MODULES_DIR="$WORKSPACE_DIR/node_modules"
SHARED_HOST_DIR="$HOME_DIR/.local/share/devcontainer"

echo "Preparing mounted directories..."
mkdir -p "$LOCAL_DIR" "$SHELL_HISTORY_DIR" "$PNPM_DIR" "$NODE_MODULES_DIR" "$PI_DIR"

echo "Fixing volume permissions..."
sudo chown -R node:node "$LOCAL_DIR" "$SHELL_HISTORY_DIR" "$PNPM_DIR" "$NODE_MODULES_DIR" "$PI_DIR" || true

echo "Persisting shell history..."
touch "$SHELL_HISTORY_DIR/.bash_history" "$SHELL_HISTORY_DIR/.zsh_history"
ln -sf "$SHELL_HISTORY_DIR/.bash_history" "$HOME_DIR/.bash_history"
ln -sf "$SHELL_HISTORY_DIR/.zsh_history" "$HOME_DIR/.zsh_history"

echo "Setting up pnpm..."
sudo corepack enable pnpm

echo "Running Pi workflow setup..."
"$WORKSPACE_DIR/setup.sh"

if [ -f "$SHARED_HOST_DIR/.gitconfig" ]; then
  echo "Setting up gitconfig..."
  git config --global include.path "$SHARED_HOST_DIR/.gitconfig"
fi

if [ -x "$LOCAL_SETUP" ]; then
  echo "Running local setup script..."
  "$LOCAL_SETUP" "$WORKSPACE_DIR"
fi

echo "Devcontainer setup complete!"
