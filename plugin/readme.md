# Ace AI

Author: Er Rickow

License: Apache-2.0

Ace AI is an Acode-native AI coding assistant powered by the Neosantara Responses API. It supports normal chat, code explanations, codebase inspection, and review-first file edits from inside Acode.

## Core features

- Chat-first UI for everyday questions and coding help.
- Cursor-aware context from the active file and selected code.
- Pinned context snapshots so you can attach the current file without forcing full-file mode.
- Agent read tools for `read_file`, `list_files`, `search_in_files`, `project_overview`, and `open_file`.
- Review-first edit tools for selection edits, full-file edits, new files, delete/rename/move operations, directories, and line inserts.
- Inline diff review with hunk selection before apply.
- Visible-terminal command proposals for safe lint/test/typecheck/syntax checks.
- Undo support for apply batches when Acode exposes enough editor or filesystem APIs.
- Responses API conversation continuity through `previous_response_id`.

## Setup

1. Open Ace AI in Acode.
2. Open Settings.
3. Add your Neosantara API key.
4. Confirm the Base URL is:

```txt
https://api.neosantara.xyz/v1
```

5. Optionally set Project Root when you want the agent to create or edit relative project files.

Settings are stored locally on your device. Ace AI does not hardcode your API key.

## Safety model

Ace AI does not apply file changes automatically. Proposed changes are shown in Review first, and you decide whether to apply or reject them.

When Project Root is not set, project-relative writes are blocked before apply. New-file proposals that were previewed as an unsaved Acode tab can still be applied as an unsaved tab so you can save them manually.

Terminal commands are allowlisted, require confirmation, and are sent to a visible Acode terminal instead of running silently in the background.

## Markdown rendering

Ace AI includes a lightweight Markdown renderer for chat output with copyable, syntax-highlighted fenced code blocks for JavaScript, TypeScript, HTML, CSS, JSON, PHP, Python, Bash, SQL, and related languages. It is bundled directly into the plugin so the installable ZIP stays self-contained.
