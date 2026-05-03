# Ace AI

Ace AI is an Acode-native AI coding assistant powered by Neosantara API.



## v0.8.16

- Fixes duplicated assistant responses during streaming.
- Renders assistant Markdown, including lists, bold text, inline code, and fenced code blocks.
- Keeps casual chat tool-free unless the user explicitly asks for codebase/file inspection or edits.

## v0.8.8

- Agent and Plan conversations are now stored in local history.
- Uses Neosantara Responses API only (`/v1/responses`) with `previous_response_id` conversation continuity.
- Responses API mode stores the latest `previous_response_id` so follow-up messages can continue the server-side thread.
- Agent mode can return plain text for normal discussion. JSON is only used internally when Ace needs reviewable tool calls.
- Added New chat / Clear Chat History, which also resets the Responses API thread.

## v0.4.1 highlights

- Native Acode Side Button integration.
- Sidebar app integration when supported by your Acode build.
- Selection menu actions: Ace Fix, Ace Explain, Ace Refactor, Ace Agent.
- Command palette commands: Chat, Edit Selection, Explain Error, Generate Widget.
- Compact IDE-style UI: Chat, Edit, Changes.
- Diff preview and manual apply flow.
- Unified diff patch apply support.
- Compact prompt chips instead of native inputHints dropdown.
- Enter sends, Shift+Enter inserts a newline.
- Context-aware footer actions for Chat/Edit/Changes.
- Smaller mobile bottom-sheet layout.
- Settings modal for API key, base URL, model, temperature, max tokens.

## Setup

1. Open Ace AI.
2. Tap Settings.
3. Add your Neosantara API key.
4. Select code or open a file.
5. Use Chat, Edit, or Changes.

Default API base URL:

```txt
https://api.neosantara.xyz/v1
```

Ace AI does not hardcode your API key.


## v0.4.2 improvements

- Mobile-first responsive sheet layout
- Scrollable chat and diff areas
- Maximize button for full-screen mode
- Cleaner footer actions


## v0.4.3 error handling

Ace AI now shows failures inside the panel with:
- friendly error title and hint
- Retry Last Request
- Copy Error Report
- Clear Error

Common cases covered:
- missing API key
- invalid Base URL
- network/CORS/fetch failure
- timeout
- invalid JSON response
- empty AI response
- HTTP 401/403/429/5xx


## v0.4.4

Ace AI now uses streaming-only responses. Chat stays in Chat; Changes opens only for Edit mode output.


## v0.5.0 Agent Mode

Agent mode returns reviewable tool calls instead of normal prose. Supported tools: `replace_selection`, `insert_at_cursor`, `replace_file`, `create_file`, `write_file`, and `append_file`. Ace AI shows all pending tools first; nothing is applied until you tap **Apply Tools**.


## v0.6.0 Agent mode

Agent mode uses reviewable tool calls. Ace AI displays every proposed edit/create/write operation with a diff. No tool runs until you tap **Approve & Apply Tools**.


## v0.6.1

This version tightens mode separation. Chat answers stay in Chat, Agent proposals stay in Agent, and Review only applies Edit results. It also adds debug state copy and runtime state clearing for Acode cache troubleshooting.


## v0.7.0

- Minimal Acode-like dark UI without heavy gradients.
- Review tab now shows agent proposed file tree and per-tool diffs.
- Agent tools can be selected individually before applying.
- Added Apply Selected, Select all, None, Reject, and Undo Last.
- Chat, Edit, Agent, and Review are more strictly separated.


## v0.7.1 fixes

- Fixes `Patch.previewPatch is not a function` in Edit → Review.
- Adds safer filesystem guards for Acode `fs` operations.
- Keeps create/write operations approval-first in Review.


## v0.7.2 fixes

- Scrollable Review tab on Android
- Immediate quick action prompt fill
- Visible streaming/loading state


## v0.7.3

- Fix create_file for relative paths such as `index.js` when a project root is known.
- Add optional Project Root setting for agent file tools.
- Block relative file tools during review/preflight when no project folder is available.
- Improve preflight so blocked tools fail before partial writes happen.


## v0.8.1

Ace AI is now a single agentic chat interface. Use the Mode picker for Agent, Ask, or Plan, and the Permission picker for Safe, Balanced, or Autopilot behavior. File edits and file creation are proposed as pending changes inside the conversation and must be reviewed before applying.


## v0.8.1 fix

- Fixed blank sidebar panel caused by hidden sidebar root.
- Fixed side/floating button mounting by assigning State.panel in the v0.8 single-chat mount layer.
- Added safer open-panel guard and unique CSS/cache keys to avoid stale v0.8.0 UI.


## v0.8.2

Ace AI is chat-first by default. Use Agent for discussion and reviewable file changes, or Plan when you want a plan before editing. Apply operations now add a summary back into the conversation.


## v0.8.3

- Source refactored into maintainable modules with a build step that generates the Acode-compatible `main.js` bundle.
- Added permission-aware approval inspired by OpenCode: allow once, always allow for this session, or reject pending write tools.
- Kept Chat as the default mode. Agent mode can discuss or ask/plan first; tools are optional.
- Kept post-apply summaries in the conversation.


## v0.8.4

Fixes permission-aware Apply Selected. In Safe mode, inline Apply now behaves like Allow once & apply.


## v0.8.5 UX fixes

- Agent can answer normally by default.
- Agent can discuss first, then propose reviewable changes only when needed.
- Unsaved active tabs are handled as active-editor edits instead of blocked relative file creation.
- Apply buttons are clearer and disabled when there are no applicable changes.


## v0.8.7

- Apply diagnostics panel
- Use active editor fallback for blocked file tools
- Better apply/reject/retry UX
- More helpful blocked Project Root hints


## v0.8.7

- Removed visible Chat mode. Ace AI now uses Agent and Plan like modern IDE agents.
- Removed the mode help banner from the top of the panel to reduce clutter.
- Agent can discuss normally and only proposes tools when file/editor changes are requested.
- Successful apply diagnostics are collapsed behind a Details button; failures still show diagnostics automatically.

## v0.8.11

- Readability-focused single chat UI inspired by modern AI IDE panels.
- Context chips show active file, cursor line, visible range, open tabs, selection state, and unsaved state.
- New Chat is available from the header/composer and now fully clears local chat plus Responses API thread state.
- Pending changes remain review-first, with per-hunk accept/reject inherited from v0.8.10.
## v0.8.14 function/tool fixes

- Read tools are now observation-first: `read_file`, `list_files`, and `search_in_files` results are sent back to the model before write proposals are shown.
- Missing `read_file` paths no longer stop the agent; the model receives an `ok:false` result and can continue by searching/listing or asking for the right path.
- `list_files` has an active/open/recent-editor fallback when Project Root is unavailable.
- Relative `create_file` without Project Root opens an unsaved Acode tab when supported by the current Acode build.
- File snapshots now use Acode fs `exists`, `stat`, `readFile`, `writeFile`, and `createFile` more defensively.


## v0.8.14 review/function cleanup

- Active-file writes with relative paths no longer get blocked just because Project Root is missing; if the path matches the current Acode tab, Ace AI converts the proposal to an active-editor edit.
- When code is selected, active-file rewrite proposals are converted to safer selection edits unless the prompt clearly asks for a whole-file rewrite.
- Duplicate read calls and duplicate full-file write proposals are consolidated before the review UI is rendered.
- Read/tool/token debug cards are hidden from the normal chat surface to keep the mobile UI readable.
- Hunk accept/reject state is review state only; it no longer appears as a fake Last Apply result.

### Install local ZIP

Use the installable ZIP whose root contains `plugin.json`, `main.js`, `readme.md`, `changelogs.md`, and `icon.png`. In Acode: Settings → Plugins → + → LOCAL → choose the ZIP.


## v0.8.15 inline activity polish

- Busy state now renders inline in the conversation as a compact Thinking/Working row.
- Read tools are displayed as a tree, for example `reading → me.test.js`, instead of raw progress text.
- Footer buttons no longer show duplicate loading state during streaming.
- Agent tools are gated for casual prompts, so greetings and “what can you do?” should answer normally without reading files.
- Duplicate read/search/list calls reuse the same observation but still satisfy every function-call output required by the Responses API.
