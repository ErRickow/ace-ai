## 0.8.16

- Fixed duplicate assistant text caused by Responses-compatible streams that send both token deltas and final full text snapshots.
- Added conservative assistant-message dedupe at chat storage/render boundaries.
- Tool gating now ignores internal permission policy text, so casual prompts like “what can you do?” do not accidentally enable file tools.
- Added lightweight Markdown rendering for assistant replies: bold text, lists, headings, inline code, and fenced code blocks.
- Styled code blocks for mobile readability in the Acode panel.

## 0.8.15

- Replaced top loading card + footer loading button with one inline activity row inside the chat.
- Added shimmering Thinking/Working indicator and tool activity tree: reading/listing/searching → target file/query.
- Avoids read_file tool calls for greetings/capability questions by gating native tools unless the prompt actually needs codebase/file inspection or edits.
- Deduplicates duplicate read/list/search execution while still returning an observation for every Responses API call_id.
- Keeps Send button label stable while requests are running.

# Changelogs

## 0.8.14
- Fixed active-tab file writes when Project Root is unknown: `replace_file`, `write_file`, and `create_file` targeting the current filename now auto-convert to an active-editor or selected-code edit instead of showing a blocked relative-path error.
- When code is selected, full-file write proposals for the active filename are converted to safer `replace_selection` previews unless the prompt explicitly asks for a whole-file rewrite.
- Deduped repeated read tool calls and consolidated duplicate full-file write proposals for the same target into one review card.
- Removed noisy `Read tool context` and `Token usage` cards from the normal chat surface; diagnostics stay available internally and only show on failures/debug.
- Hunk accept/reject actions no longer appear as misleading “Last apply” cards because no file has been applied yet.
- Footer actions are cleaner on blocked reviews: fewer buttons, clearer active-editor fallback.

## 0.8.13
- Simplified mobile UI: one compact context strip, smaller empty state, fewer quick chips, and Options collapsed by default.
- Removed duplicate New Chat controls from the composer/footer; New Chat now lives in the header.
- Removed duplicated selection/status text from the header and context chips.
- Selection edits now keep a selection snapshot from request time and validate it before apply, reducing wrong-selection or changed-selection writes.
- Full-file context is no longer injected when code is selected, preventing duplicate selection + whole-file context confusion.

## 0.8.12
- Fixed Responses API function-call loop so read/list/search tool outputs are always sent back to the model before any write proposal is exposed.
- `read_file` now returns a recoverable `ok:false` observation for missing files instead of stopping the agent flow.
- `list_files` now falls back to active/open/recent editor files when Project Root is unavailable.
- `create_file` with a relative path and no Project Root now opens a new unsaved Acode tab when Acode `addNewFile`/`newEditorFile` is available.
- `write_file` can safely convert to active-editor replacement when the target matches the active tab but no Project Root is known.
- Improved Acode fs snapshots with `exists`, `stat`, directory detection, ArrayBuffer decoding, and clearer read/write errors.
- Skips common generated folders during codebase search (`node_modules`, `.git`, `dist`, `build`, cache folders).
- Added installable plugin ZIP packaging with `plugin.json` and `main.js` at ZIP root for Acode Local install.

# 0.8.11

- Refined the single chat UI for readability: cleaner message cards, context chips, clearer composer, and tappable mobile controls.
- Added visible New Chat action in the header and composer.
- Fixed New Chat so clearing history no longer resurrects migrated legacy v0.8.x messages.
- New Chat now also clears response thread state, pending review state, usage/read-tool diagnostics, and focuses the prompt.
- Added @codebase quick action to encourage list/search read tools before multi-file edits.

# 0.8.10

- Added per-hunk accept/reject review controls for generated diffs.
- Rebuilt preview diffing with LCS-based hunks so partial apply can keep accepted chunks and preserve rejected chunks.
- Apply summaries now include accepted hunk counts.

# Changelogs

## 0.8.9
- Added cursor line/column, visible range, open tabs, dirty state, and recent files to AI context.
- Added Cursor-style context assembly with numbered lines around cursor and @file mention hints.
- Added safe read tools: read_file, list_files, and search_in_files, including automatic read-tool loop for Responses API native function calls.
- Added retry with exponential backoff, token usage tracking, and tool progress status during streaming.
- Raised local chat history retention from 16 to 50 messages.
- Improved system prompt with no-hallucination, minimal-diff, and style-preservation guidance.
- Added per-proposed-change Explain and Reject actions in diff review.

## 0.8.8
- Added local conversation history for Agent and Plan messages, not only legacy Chat mode.
- Switched Ace AI to Neosantara Responses API only (`/v1/responses`) with `previous_response_id` state; Chat Completions fallback removed.
- Added automatic fallback to Chat Completions if Responses API fails.
- Agent can now answer in plain text for normal discussion; JSON is treated as an internal tool protocol only when tool calls are needed.
- Added New chat / Clear Chat History action that also clears the Responses API thread id.
- Migrates recent local chat history from older v0.8.x storage keys when possible.

## 0.8.7
- Added apply diagnostics timeline for permission, preflight, execution, and summary steps.
- Added one-tap fallback to use the active editor for blocked file tools when Project Root is unavailable.
- Improved blocked-tool UX so users see exactly what to do next instead of a dead Apply button.
- Added post-apply summary and diagnostics visibility after agent operations.
- Kept modular source structure and rebuilt the installable root main.js for Acode.

# Changelogs

## 0.8.5
- Improved mobile UX: compact composer, clearer empty/chat state, and non-overlapping review flow.
- Fixed active unsaved file workflows: agent create_file targeting the active filename is converted to active editor replacement.
- Improved prompts so Agent does not create relative files when Project Root is missing.
- Apply buttons now show disabled state correctly when every proposed tool is blocked.
- Added clearer blocked tool messaging and guidance.
- Added safer post-apply summary and kept source modules maintainable.

## 0.8.4
- Fixed inline Apply Selected in Safe permission mode. It now maps to Allow once & apply instead of doing nothing.
- Permission-aware pending changes card now shows Allow once / Always when approval is required.
- Added extra post-apply conversation summary fallback.
- Kept modular source structure for maintainability.

## 0.8.3
- Refactored source into module files under `src/` while keeping installable `plugin/main.js` as a single Acode-compatible bundle.
- Added session permission model for pending agent tools: Allow once, Always, Reject.
- Added OpenCode-style allow/ask/deny foundation for future granular permissions.
- Kept Agent-first behavior, optional Agent tools, and post-apply summary.

# Changelogs

## 0.8.2
- Default mode changed to Agent so Ace can discuss before using tools.
- Agent mode can return a discussion/clarification message with no tools.
- Composer/textarea made compact for Android.
- After applying tools, Ace adds a summary message to the conversation.
- Pending review footer simplified.
- Permission copy fixed so Balanced/Safe wording is not misleading.

# Changelog

## 0.8.1
- Fixed blank Ace AI sidebar in Acode.
- Fixed AI side/floating button not opening the panel.
- Fixed v0.8 mount layer not assigning `State.panel` for overlay panels.
- Sidebar panels now remove `ace-ai-hidden` immediately.
- Updated cache/style keys to avoid stale v0.8.0 CSS.

# Changelogs

## 0.8.0
- Reworked Ace AI into a single agentic chat interface.
- Removed the visible Chat/Edit/Agent/Review tab workflow.
- Added Mode picker: Agent, Ask, Plan.
- Added Permission picker: Safe, Balanced, Autopilot.
- Pending file/create/edit/write tool calls now appear inline in the chat.
- Review changes opens as an inline drawer/card, not a dedicated tab.
- Apply selected, reject, copy JSON, and undo remain available from the chat surface.
- Kept review-first approval flow for write tools.

# Changelog

## 0.7.3
- Fixed `create_file` relative path handling (`index.js`, `src/index.js`, etc.).
- Added Project Root / Folder URL setting for agent file tools.
- Added preflight guard before applying selected tools.
- Reworded file path errors so blocked tools are clearer and safer.
- Checked Acode fs docs: `createFile(name, content)` is called on a directory FileSystem object, while `writeFile(content)` is called on a file FileSystem object.

# Changelogs

## 0.7.2
- Fixed Review tab scrolling on Android by making active views scrollable and Review content non-shrinking.
- Fixed quick action chips in Edit/Agent so prompt text appears immediately without pressing Enter.
- Added visible loading/streaming state banner and footer spinner.
- Updated state/cache keys to avoid v0.7.1 stale UI state.

# Changelogs

## 0.7.1
- Fixed Review crash: `Patch.previewPatch is not a function`.
- Added patch preview renderer for unified diff output.
- Added safer Acode fs guards for `createFile` and `writeFile`.
- Added parent folder checks before `create_file` to avoid silent filesystem failures.
- Kept Review UX minimal and compatible with Acode dark theme.

## 0.7.0
- Reworked Review UX into an IDE-style approval flow.
- Added proposed file tree with create/modify/append/selection markers.
- Added per-tool checkboxes and Apply Selected.
- Added Undo Last Apply for applied tool batches.
- Replaced gradient-heavy styling with a minimalist Acode-like theme.
- Agent proposals now open in Review; Chat remains Chat.

# Changelogs

## 0.6.1
- Clear stale runtime review state on plugin init.
- Hard guard: Chat results stay in Chat and cannot show Replace Selection in Review.
- Review tab now only applies Edit outputs.
- Added Copy Debug State and Clear Runtime State actions.
- Fixed reject handler crash caused by undefined mode variable.
- Header/toast now show plugin version for easier cache verification.

# Changelogs

## 0.6.0
- AgentCore rewrite with approval-first tool flow.
- Chat never becomes Changes; Changes is reserved for edit/review outputs.
- Agent mode now shows “AI wants to edit/create/write” tool cards before applying.
- Added diff preview per pending tool.
- Added safer Acode fs handling for create_file/write_file/append_file.
- create_file is blocked if target already exists to avoid accidental overwrite.
- write_file/append_file require existing files; use create_file for new files.
- Apply button renamed to Approve & Apply Tools.

# Changelogs

## 0.5.0
- Added Agent tab with reviewable tool calls.
- Added tool protocol: replace_selection, insert_at_cursor, replace_file, create_file, write_file, append_file.
- Agent responses are JSON-only and streaming-only.
- Tools are never auto-applied; user must tap Apply Tools.
- Added Acode fs integration for create/write/append when available.
- Chat results stay in Chat; Edit results go to Changes; Agent results stay in Agent.

# Changelogs

## 0.4.4
- Switched API calls to streaming-only Chat Completions (`stream: true`).
- Removed non-stream response path from the client.
- Chat responses now stay in Chat; only Edit mode opens Changes.
- Added live streaming text in Chat and Edit.
- Changes tab is now reserved for generated code edits/patches.

## 0.4.3
- Added structured error handling inside Ace AI UI.
- Added API timeout handling and friendly HTTP error messages.
- Added Retry Last Request, Copy Error Report, and Clear Error actions.
- Preserves prompt text when a request fails.
- Handles missing API key, invalid base URL, network/CORS failures, invalid JSON, empty responses, 401/403/429, and server errors.
- Busy state now always recovers after failed requests.

## 0.4.2
- Fixed mobile layout so panel is not cramped into a forced width.
- Chat/changes views are now properly scrollable on Android.
- Added maximize button for full-screen focus.
- Removed duplicate action buttons inside Changes view.
- Chat responses no longer auto-open the Changes tab.
- Responsive panel layout refined for Acode mobile usage.

## 0.4.1

- Removed native inputHints dropdown from prompt textareas because it can steal Enter and cover the panel on Android.
- Added safe keyboard handling: Enter sends/generates, Shift+Enter creates a newline.
- Made footer actions context-aware: Chat only shows Send, Edit shows Generate Edit, Changes shows Apply/Copy/Insert/Reject.
- Reduced panel height and textarea height for a cleaner mobile bottom-sheet UI.
- Reordered Chat view so the conversation stays above the prompt.

## 0.4.0

- Rebuilt UI into Chat / Edit / Changes tabs.
- Replaced custom-first floating UI with native `sideButton` integration and fallback button.
- Added `sidebarApps` integration when available.
- Added `selectionMenu` actions for selected code.
- Added command palette commands with fallback registration.
- Added actionStack handling so Android Back closes Ace AI first.
- Added input hints for slash commands where supported.
- Improved diff preview and patch application.
- Kept Neosantara OpenAI-compatible API integration.

## 0.3.0

- Refactored shared modules.
- Added Cursor-like chat/edit/diff/tools/presets flow.


## 0.8.7

- Removed Chat from visible mode picker; Agent is now the default conversation mode.
- Kept Plan mode for plan-only workflows.
- Removed top mode/help banner for a cleaner IDE-agent UI.
- Collapsed successful diagnostics behind Details while still showing failures.
