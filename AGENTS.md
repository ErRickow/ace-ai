# AGENTS.md — Ace AI Acode Plugin

Guidance for AI coding agents working on this repository.

## Project goal

Ace AI is an agent-first AI coding assistant for Acode. It should feel closer to Cursor/Copilot/Windsurf than a plain chat widget: cursor-aware context, codebase read tools, permission-aware write tools, reviewable diffs, and safe hunk-level acceptance.

## Repository layout

- `src/core/` — constants, defaults, state, utilities, runtime detection, storage, editor context, patch/diff engine, prompt assembly, API client.
- `src/agent/` — tool schemas/parsing, read/write tool execution, permission model, preview/apply/undo behavior.
- `src/ui/` — shared UI templates/styles and the v0.8 chat/agent review layer.
- `src/native/` — Acode side button, sidebar, commands, selection-menu integration.
- `src/lifecycle/` — plugin init, render, cleanup, page setup.
- `plugin/` — installable Acode plugin output. `plugin/main.js` is generated.
- `tools/build.mjs` — concatenates source modules into `plugin/main.js`.
- `ARCHITECTURE.md` — high-level architecture and module map.

## Build and validation

Run this after any source change:

```bash
npm run check
```

This runs the build and then syntax-checks `plugin/main.js`.

Do not manually edit `plugin/main.js` unless you are intentionally patching a build artifact and cannot run the build. Prefer editing files under `src/`, then rebuild.

## Runtime constraints

Acode installable plugin ZIPs expect the plugin package files under `plugin/`:

- `main.js`
- `plugin.json`
- `readme.md`
- `changelogs.md`
- `icon.png`

The source ZIP may contain the full repository, but the installable plugin metadata in `plugin/plugin.json` should stay conservative and only list runtime plugin files.

## Agent/tool behavior rules

When modifying agent behavior, preserve these rules:

1. **No automatic write application** — write tools create pending operations and must be user-approved.
2. **Read before editing unknown files** — use or encourage `read_file`, `list_files`, and `search_in_files` when files are outside current context.
3. **Prefer minimal diffs** — avoid replacing whole files unless the requested change truly needs it.
4. **Never invent tools** — valid tools are:
   - write: `replace_selection`, `insert_at_cursor`, `replace_file`, `create_file`, `write_file`, `append_file`
   - read: `read_file`, `list_files`, `search_in_files`
5. **Respect unsaved tabs** — if Project Root or active path is unknown, avoid creating guessed file paths. Use selection/cursor/empty-path active-editor operations.
6. **Keep summaries honest** — do not say changes were applied until the apply path succeeds.
7. **Prefer complete file content for full-file tools** — `write_file` and `replace_file` require complete content, not fragments.

## Hunk review requirements

The diff/review system supports hunk-level accept/reject. Preserve these invariants:

- Hunk selection lives on `tool.preview.hunks[*].selected`.
- Rejected hunks must keep original lines.
- Accepted hunks must apply additions and remove deletions.
- `Patch.applySelectedHunks(preview)` is the source of truth for partial apply output.
- UI labels should clearly show accepted/rejected state and `x/y hunks accepted`.
- File-level reject should still skip the whole pending tool.

For new edit tool types, add preview generation that can produce `oldText`, `newText`, `rows`, and `hunks` when possible.

## Prompt and context standards

The system prompt should keep the model grounded in available context:

- Include cursor line/column and visible range when available.
- Include selected text and numbered context around the cursor.
- Include open files, dirty/unsaved state, and recent files when available.
- Mention `@file` / `@codebase` references as hints, not guaranteed file content.
- Explicitly tell the model to ask/read rather than hallucinate unknown files.

## Client/API standards

The API client should remain compatible with OpenAI-style chat completions and `/v1/responses` streams.

- Keep exponential backoff retry for retryable errors only.
- Track token usage when the provider returns usage data.
- Surface streaming/tool progress in UI state.
- For native function calls, read tools should be executed and their outputs sent back to the model before finalizing whenever the provider flow supports it.

## UI standards

- Keep mobile-first Acode WebView constraints in mind.
- Avoid overly wide textareas or controls that overflow small screens.
- All write tools must be reviewable before apply.
- “Explain change” must explain the pending operation, not claim it has been applied.
- Keep action buttons tappable and visually distinct.

## Versioning

Bump `package.json` and `plugin/plugin.json` for runtime behavior changes. Documentation-only changes may keep the same plugin version, but the ZIP filename should make the change clear.

## Common pitfalls

- Editing `plugin/main.js` and forgetting source files: the next build will erase the change.
- Creating files with relative paths when Project Root is unknown.
- Treating `create_file` as “overwrite if exists”; it should fail if the file already exists.
- Losing rejected hunk content during partial apply.
- Returning markdown-fenced JSON to the model parser; native tool calls or clean JSON are preferred.
- Claiming codebase-wide awareness when only active-file context was available.
## v0.8.14 tool-loop note

Read/search/list tools are observation-only. If the model emits read tools and write tools in the same Responses API turn, Ace AI must run the read tools and send their outputs back first. Do not expose the write calls until the model has continued after seeing those outputs. Missing read files should be represented as recoverable `ok:false` observations, not fatal agent errors.

