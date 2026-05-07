# My Pi Agent Workflow

This repository contains personal extensions, prompts, and skills for the Pi Coding Agent.

## Repository Structure

- `extensions/`: TypeScript modules that extend core functionality via `pi.registerTool()`, `pi.registerCommand()`, etc.
- `prompts/`: Markdown templates for reusable editor snippets (accessible via `/` commands).
- `skills/`: On-demand capability packages following the Agent Skills standard (`SKILL.md`).

## Choosing Between Components

- **Extensions:** Use for low-level "verbs" (tools/commands) that require TypeScript logic or API integration. (e.g., "Add a tool to query JIRA").
- **Skills:** Use for high-level "manuals" (workflows) that guide the agent through multi-step tasks using existing tools. (e.g., "How to perform a security audit").
- **Prompts:** Use for static boilerplate or reusable editor snippets.

## General Conventions

- **Modularity:** Keep each component focused. Avoid bloated extensions; prefer multiple specialized ones.
- **Documentation:** Every component should be self-documenting. Use `AGENT.md` in subdirectories for specific technical requirements.

## Development Workflow

1.  **Creation:** When adding a new component, follow the specific instructions in its directory's `AGENT.md`.
2.  **Verification:** Ensure extensions compile (if using complex types) and prompts/skills follow the required frontmatter formats.
3.  **Local Loading:** Pi Coding Agent will automatically discover components in these conventional locations if configured to point to this repository.
