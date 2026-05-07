# Extensions Development

Extensions are TypeScript modules that interface with the `ExtensionAPI`.

## Conventions

- **File Structure:**
  - Simple extensions: `name.ts`
  - Complex extensions: `name/index.ts`
- **Exports:** Must export a default function (sync or async) that accepts `ExtensionAPI`.
- **Tool Registration:** Use `pi.registerTool()` with TypeBox for schema validation.
- **Race Conditions:** Use `withFileMutationQueue()` for tools that modify the filesystem.

## API Usage Guidelines

- **Truncation:** Always truncate tool output to ~50KB or 2000 lines to preserve context.
- **UI:** Use `ctx.ui.confirm` or `ctx.ui.select` for user interaction during tool execution.
- **Lifecycle:** Use `ctx.on('input', ...)` or `ctx.on('tool_call', ...)` to intercept and augment agent behavior.

## Example Template

```typescript
import { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default async function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "my_tool",
    description: "Does something useful",
    schema: Type.Object({
      param: Type.String(),
    }),
    execute: async (args) => {
      return `Result: ${args.param}`;
    },
  });
}
```
