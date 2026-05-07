# DevContainer

This folder contains the devcontainer configuration for `my-pi`.

## Local customization

For project-specific customization, create an executable:

- `.devcontainer/local.setup.sh`

It is called automatically after the shared setup completes and receives the workspace path as its first argument.

Example:

```bash
#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$1"
```

## Shared host directory

The devcontainer bind-mounts your host directory:

- `~/.local/share/devcontainer/`

into the container at:

- `/home/node/.local/share/devcontainer/`

Use this shared location for personal, machine-specific files such as:

- `.gitconfig`
- signing keys / key material
- shell preferences
- editor preferences
- local-only tooling

If `~/.local/share/devcontainer/.gitconfig` exists, the setup script automatically adds it via:

```ini
[include]
    path = /home/node/.local/share/devcontainer/.gitconfig
```

## Notes

- The container persists pnpm, node_modules, shell history, and Pi state in named volumes.
- The root `./setup.sh` installs `@mariozechner/pi-coding-agent` and links `extensions/`, `prompts/`, and `skills/` into the Pi agent directory.
