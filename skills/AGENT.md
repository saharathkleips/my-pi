# Agent Skills

Skills are on-demand packages following the [Agent Skills standard](https://agentskills.io).

## Conventions

- **Directory Structure:** Each skill is a directory (kebab-case) with a mandatory `SKILL.md` file.
- **Frontmatter (Mandatory):**
  - `name`: Must match the directory name exactly.
  - `description`: A clear summary (max 1024 characters).
- **Instructional Context:** Keep `SKILL.md` concise. Focus on the _how-to_ rather than long background info.
- **Discovery:** Pi Coding Agent will automatically load the skill when the task matches the description or when invoked via `/skill:name`.

## Example `SKILL.md`

```markdown
---
name: my-skill
description: Performs a specialized workflow task.
---

1.  Use `tool_x` to gather data.
2.  If data is empty, use `tool_y` to generate alternatives.
3.  Summarize the results in a concise table.
```
