# my-pi

Personal Pi Coding Agent workflow repo for extensions, prompts, and skills.

## Linking this Project in Another Project's DevContainer

Essentially you can run this project's `setup.sh`, but the devcontainer needs to be able to see this repo's source files.

### Shared Personalization Mount

1. Add a shared personalization mount in that project's committed `devcontainer.json`:

```json
{
  "mounts": [
    "source=${localEnv:HOME}/.local/share/devcontainer,target=/home/node/.local/share/devcontainer,type=bind"
  ]
}
```

2. On your machine, copy this repo into that mounted directory:

```bash
mkdir -p ~/.local/share/devcontainer
cp -R $PATH_TO_MY_PI/my-pi ~/.local/share/devcontainer/my-pi
```

3. In the other project, execute the setup script:

```bash
#!/usr/bin/env bash
set -euo pipefail

exec /home/node/.local/share/devcontainer/my-pi/setup.sh
```
