# Prompt Templates

Prompt templates are reusable Markdown snippets invoked via `/filename` in the editor.

## Conventions

- **Naming:** Filenames (lowercase, kebab-case) determine the command name (e.g., `git-commit.md` -> `/git-commit`).
- **Arguments:**
  - `$1`, `$2`: Positional arguments.
  - `$@`: All arguments.
  - `${@:2}`: Arguments starting from index 2.
- **Frontmatter:** Include `description` and `argument-hint` for better IDE/CLI integration.

## Example

```markdown
---
description: Create a boilerplate React component
argument-hint: "<ComponentName>"
---

Create a new React component named $1 using functional syntax and TypeScript.
```
