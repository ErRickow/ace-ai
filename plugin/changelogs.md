## 0.8.44

- Switched project and plugin licensing metadata to Apache-2.0.
- Added repository `LICENSE` file with Apache License 2.0 terms.

## 0.8.43

- Fixed unsafe new-file persistence behavior when Project Root is unavailable.
- Relative create_file/write_file without a Project Root is now blocked instead of opening a fragile unsaved tab.
- create_file now opens the persisted file after successful filesystem creation.
- Updated new-file preview/preflight/undo handling so generated files are not lost after Acode reload.

## 0.8.42

- Hardened Acode selection menu cleanup so legacy `Ace Fix/Explain/Refactor/Agent/Plan` labels are compacted to icons even when Acode renders them as combined tooltip text.
- Added runtime text-node sanitizer and compact selection-menu CSS to prevent long cursor toolbars.

- Selection menu hover hint is now truly icon-only: legacy tooltip/title/aria/data-tooltip text is stripped instead of preserved.
- Acode selection menu registration reduced to one compact icon and runtime cleanup removes leftover Ace action labels from DOM attributes.
- Added aggressive tooltip cleanup for Materialize-style tooltip nodes and legacy selection menu buttons.

## 0.8.41

- Changed Acode cursor/selection hint menu entries to icon-only labels so the mobile cursor toolbar no longer shows long repeated text.
- Kept the same actions: fix, explain, refactor, agent, and plan.

## 0.8.41

- Fixed compact markdown bullet rendering for responses like `I can:- Analyze.- Suggest.`.
- Broadened list-boundary normalization outside fenced code blocks.
- Switched streaming UI refresh from 120ms timeout to requestAnimationFrame for more real-time updates.
- Stream timer cleanup now uses cancelAnimationFrame.
- Final render keeps the last streamed content until after the final UI state is rendered.

## 0.8.41

- Refined loading states per stage: plain chat shows a simple exploring shimmer, while inspect/propose/apply/review stages show tree rows.
- Made shimmer calmer by keeping stable orange text and using a softer moving highlight instead of a harsh fade/flicker.
- Added clearer tool activity labels for project overview, file listing, code search, commands, and file reads.

## 0.8.41

- Registry metadata polish: author set to Er Rickow and plugin.json kept marketplace-ready with price, license, keywords, readme, changelogs, and description.
- Loading animation now avoids fade-in behavior and uses shimmer-only text motion for the active loading label.
- Fixed V8 style override so the orange shimmer keyframes stay visible in the chat shell.

- Changed plugin author metadata to Er Rickow.
- Added/cleaned marketplace-ready manifest fields: price, license, keywords, description, readme, and changelogs.
- Kept plugin README focused on plugin usage only, with changelog separated into changelogs.md.
- Added source README notes for local/remote ZIP development and registry-ready metadata.

## 0.8.41

- Fixed sidebar chat scrolling by bounding sidebar view/chat heights and enabling touch scrolling.
- Moved the loading tree into the chat conversation so it scrolls with chat history instead of pushing the shell down.
- Added sidebar-aware auto-scroll after render and streaming updates.
- Hardened V8 streaming busy-detail updates to target the loading detail node directly.

# Changelog

## 0.8.41

- Decoded common HTML entities inside tool content before apply.
- Reworked loading card into tree-style shimmer.

# Changelogs

## 0.8.41

- Fixed apply preflight for `create_file` proposals that were previewed as `new unsaved tab:` when Project Root is not set. These proposals now reach the existing unsaved Acode tab fallback instead of being blocked as relative-path errors.
- Improved the preflight error hint to explain the Project Root option and active-editor fallback more clearly.
- Added a project-source `README.md` with build, validation, packaging, and architecture notes.
- Rewrote the plugin-store `readme.md` to describe the plugin only, while keeping changelog entries in `changelogs.md`.
- Synchronized package, plugin manifest, runtime constants, generated bundle header, and docs to version `0.8.41`.

## 0.8.41

- Preserved write function calls emitted in the same model round as read/search/list/project tools, then merged them back into the final review response after tool outputs return.
- Deduplicated read-tool calls before execution so repeated native read calls do not duplicate filesystem work or activity rows.
- Reset read-tool results, tool activity, and progress for each agent send/auto-loop iteration to avoid stale UI state leaking between rounds.
- Added a streaming render token so delayed 120ms stream renders cannot repaint stale content after a request has already completed or failed.
- Cached validated `run_command` allowlist output during preview and reused it during apply.
- Expanded apply preflight path checks to all path-based write tools, including `create_file`, `insert_after_line`, `rename_file`, `move_file`, and `create_directory`.
- Limited the undo stack to the latest 10 apply batches to reduce mobile memory growth from large snapshots.
- Synchronized package, plugin manifest, runtime constants, generated bundle header, and docs to version `0.8.41`.

## 0.8.24

- Added Acode `actionStack` integration so Android back closes nested Ace AI UI states in order: Settings, Review drawer, maximized panel, then panel.
- Reworked Review into a compact tool timeline with an expandable details drawer containing file-tree grouping, diff rows, and hunk approval.
- Added quick menu support through Acode context menu when available, with fallback alert text.
- Added command palette actions for New Chat, Review Current File, Apply Pending Tools, Undo Last Apply, Run lint, and Run tests.
- Added visible terminal command execution for safe project checks. Commands are allowlisted, require confirmation, and are sent to an Acode terminal tab instead of running silently.
- Kept v0.8.23 apply/tool hardening: failed tools stop success summaries, partial apply state is preserved, stale `replace_selection` is blocked, and unsafe same-target edits are prevented.
- Updated agent quick chips with Review file, Run lint, Run tests, and Syntax actions.
- Synchronized package, plugin manifest, runtime constants, generated bundle header, and docs to version `0.8.24`.

## 0.8.22

- Added a real post-apply assistant summary with target, operation mode, hunk count, and line stats.
- Improved Markdown rendering for dense model analysis, lists, headings, inline code, and fenced code blocks.
- Stopped generic native-tool placeholder messages from being saved as assistant replies.
- Refactored read/list/search tool logic into `src/agent/read-tools.js` for easier auditing.
- Added ESLint and Prettier validation scripts in addition to generated `plugin/main.js` syntax checks.

## 0.8.21

- Reworked the review UI into one compact card with expandable change rows.
- Replaced large hunk action buttons with smaller include checkboxes.
- Clarified review copy so append-only, selection edits, and file replacement edits are visibly different.

## 0.8.20

- Simplified approval UI into one compact Review Changes card.
- Treated codebase/project/workspace prompts as broader tasks even when text is selected.
- Improved active-editor fallback behavior when Project Root is unavailable.

## 0.8.19

- Fixed streaming/render duplication caused by mixed token deltas and final snapshots.
- Tightened plain conversation flow so casual prompts do not trigger file tools.
- Added compact tool activity trees for read/list/search work.
- Hardened delete-file apply/undo with fallback Acode filesystem methods.

## 0.8.18 and earlier

- Added agent flow phases, Responses API continuity, codebase read tools, per-hunk diff review, undo batches, local chat history, and mobile-first Acode UI improvements.
