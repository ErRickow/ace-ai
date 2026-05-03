# Ace AI Architecture

Ace AI is packaged as a single `main.js` because Acode installable plugin ZIPs should keep `plugin.json`, `main.js`, `readme.md`, `changelogs.md`, and `icon.png` at the root.

The source is now modular. Run:

```bash
npm run build
```

to concatenate the modules in `src/` into `plugin/main.js`.

## Module map

- `src/core/*`: constants, state, utilities, storage, editor access, errors, prompts, streaming client, patches.
- `src/agent/*`: tool parsing, preview, apply/undo, and permission model.
- `src/ui/*`: templates, base UI, v0.8 chat-first layer.
- `src/native/*`: Acode side button, sidebar app, commands, selection menu integration.
- `src/lifecycle/*`: Acode plugin init/unmount and page rendering.

## AI IDE patterns used

- OpenCode-style permission actions: allow, ask, deny; UI replies: once, always, reject.
- Cline-style split between read-only tools, planning/chat, follow-up questions, and completion summary.
- Continue-style post-tool/apply result message so the assistant continues with a summary after changes are applied.
