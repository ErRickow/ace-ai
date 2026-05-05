const AgentTools = {
  writeNames: [
    "replace_selection",
    "insert_at_cursor",
    "replace_file",
    "create_file",
    "write_file",
    "append_file",
    "delete_file",
    "rename_file",
    "move_file",
    "create_directory",
    "insert_after_line",
    "run_command",
  ],
  readNames: [
    "read_file",
    "list_files",
    "search_in_files",
    "project_overview",
    "open_file",
  ],
  names: [
    "replace_selection",
    "insert_at_cursor",
    "replace_file",
    "create_file",
    "write_file",
    "append_file",
    "delete_file",
    "rename_file",
    "move_file",
    "create_directory",
    "insert_after_line",
    "run_command",
    "read_file",
    "list_files",
    "search_in_files",
    "project_overview",
    "open_file",
  ],
  // Native function definitions for /v1/responses "tools" parameter.
  // Each entry maps 1-to-1 with the existing tool names so parse/normalize/run work unchanged.
  nativeSchema() {
    const pathProp = {
      type: "string",
      description: "File path (relative to Project Root, or absolute).",
    };
    const contentProp = {
      type: "string",
      description: "Complete file or snippet content.",
    };
    return [
      {
        type: "function",
        name: "replace_selection",
        description:
          "Replace the currently selected code in the active Acode editor tab. Use when the user has a selection and the change is local to that selection.",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Complete replacement text for the selected code.",
            },
          },
          required: ["content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "insert_at_cursor",
        description:
          "Insert text at the current cursor position in the active editor. Use for small insertions when nothing is selected.",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Text to insert at the cursor.",
            },
          },
          required: ["content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "replace_file",
        description:
          "Replace the complete content of an existing file, or of the active editor when path is empty. Always send the full file content.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description:
                "Path to the target file. Leave empty to replace the active editor tab.",
            }),
            content: contentProp,
          },
          required: ["content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "create_file",
        description:
          "Create a brand-new file. Fails if the file already exists. Relative paths require Project Root so the file is persisted to storage.",
        parameters: {
          type: "object",
          properties: { path: pathProp, content: contentProp },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "write_file",
        description:
          "Overwrite an existing file with complete new content. Requires the file to already exist.",
        parameters: {
          type: "object",
          properties: { path: pathProp, content: contentProp },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "append_file",
        description:
          "Append content to the end of an existing file without touching the rest.",
        parameters: {
          type: "object",
          properties: {
            path: pathProp,
            content: { type: "string", description: "Content to append." },
          },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "delete_file",
        description:
          "Delete a file or directory from the workspace using Acode filesystem deletion. Use only for real storage deletion, not for closing an editor tab.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description:
                "Path to delete. Leave empty only when the active editor is a real saved file path.",
            }),
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "rename_file",
        description:
          "Rename a file within the same folder. Use when only the file name changes, not its directory. Prefer this over delete+create to avoid data loss.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description: "Current file path.",
            }),
            new_name: {
              type: "string",
              description:
                "New file name only (no directory, no slashes), e.g. index.js → app.js.",
            },
          },
          required: ["path", "new_name"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "move_file",
        description:
          "Move a file to a different folder (optionally renaming it). Use when the destination directory changes. Prefer this over delete+create to avoid data loss.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description: "Current file path.",
            }),
            new_path: {
              type: "string",
              description:
                "Full destination path including filename, relative to Project Root or absolute.",
            },
          },
          required: ["path", "new_path"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "read_file",
        description:
          "Read a file from the workspace. Leave path empty to read the active editor. Use optional 1-based line bounds for focused reads. If the file is missing, the tool returns an ok:false observation; continue by searching/listing or asking the user instead of guessing.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description: "File path. Leave empty for the active editor.",
            }),
            start_line: {
              type: "number",
              description: "Optional 1-based start line.",
            },
            end_line: {
              type: "number",
              description: "Optional 1-based end line.",
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "list_files",
        description:
          "List files under the Project Root or a folder. Use before multi-file edits when project structure is unknown.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.",
            },
            max_depth: {
              type: "number",
              description: "Optional recursion depth, default 2.",
            },
            glob: {
              type: "string",
              description:
                "Optional simple extension/glob hint, e.g. *.js or src/*.ts.",
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "search_in_files",
        description:
          "Search text across files in the workspace. Use for @codebase-like lookup before changing related code.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text or regex-like literal to search for.",
            },
            path: {
              type: "string",
              description:
                "Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.",
            },
            max_results: {
              type: "number",
              description: "Maximum result matches, default 30.",
            },
            include_glob: {
              type: "string",
              description: "Optional extension/glob hint such as *.js.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "project_overview",
        description:
          "Inspect project metadata and summarize likely framework, package scripts, config files, and safe validation commands. Prefer this for Diagnose Project before editing or running commands.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional project/folder path relative to Project Root or absolute. Empty means Project Root/active folder.",
            },
            max_depth: {
              type: "number",
              description:
                "Optional recursion depth for config discovery, default 3.",
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "open_file",
        description:
          "Open a file in Acode and optionally jump to a 1-based line/column. Use for navigation after search/read results, not for editing.",
        parameters: {
          type: "object",
          properties: {
            path: pathProp,
            line: {
              type: "integer",
              description: "Optional 1-based line number to jump to.",
            },
            column: {
              type: "integer",
              description: "Optional 1-based column number to jump to.",
            },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "run_command",
        description:
          "Request a safe visible terminal command such as npm run lint, npm test, npm run check, or node --check file.js. The user must approve it in Review before it runs.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description:
                "Command to run in a visible Acode terminal. Must match Ace AI's safe allowlist.",
            },
            cwd: {
              type: "string",
              description:
                "Optional working directory hint. Ace AI does not cd silently; include only for display/context.",
            },
          },
          required: ["command"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "create_directory",
        description:
          "Create a new directory (folder) in the workspace. Fails if the directory already exists. Use before create_file when the target folder is not yet present.",
        parameters: {
          type: "object",
          properties: {
            path: Object.assign({}, pathProp, {
              description:
                "Path of the new directory to create (relative to Project Root, or absolute).",
            }),
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: "insert_after_line",
        description:
          "Insert text after a specific line number in an existing file. More surgical than replace_file — use when you only need to add lines without touching the rest. Line numbers are 1-based; use line 0 to insert before the first line.",
        parameters: {
          type: "object",
          properties: {
            path: pathProp,
            line: {
              type: "integer",
              description:
                "Insert after this line number (1-based). Use 0 to insert at the very beginning of the file.",
            },
            content: {
              type: "string",
              description:
                "Text to insert. A newline is added automatically after the target line.",
            },
          },
          required: ["path", "line", "content"],
          additionalProperties: false,
        },
      },
    ];
  },
  // Parse native function_call items collected from a /v1/responses stream.
  // Each item looks like: { name, arguments } where arguments is a JSON string.
  parseNativeCalls(calls) {
    const tools = [];
    (calls || []).forEach((call, index) => {
      const name = String(call.name || "").trim();
      if (!this.names.includes(name)) return;
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch (_) {}
      if (args && typeof args === "object") {
        tools.push(this.normalize({ id: index + 1, name, args }));
      }
    });
    return tools;
  },
  exampleValueForSchemaProp(name, prop) {
    const key = String(name || "");
    const description = String(prop?.description || "").toLowerCase();
    if (/content|snippet|text|code/.test(key + " " + description))
      return "complete content";
    if (/query|pattern/.test(key + " " + description)) return "text to find";
    if (/command|cmd/.test(key + " " + description)) return "npm run lint";
    if (/new_name|filename/.test(key + " " + description)) return "new-name.js";
    if (/new_path|destination/.test(key + " " + description))
      return "destination/path/file.js";
    if (/path|file|folder|directory/.test(key + " " + description))
      return "relative/or/absolute/path";
    if (/line|depth|result|column/.test(key + " " + description)) return 1;
    if (prop?.type === "boolean") return true;
    if (prop?.type === "number" || prop?.type === "integer") return 1;
    return "value";
  },
  schemaTextExamples() {
    return this.nativeSchema()
      .filter((item) => item?.type === "function" && item.name)
      .map((item) => {
        const props = item.parameters?.properties || {};
        const required = Array.isArray(item.parameters?.required)
          ? item.parameters.required
          : [];
        const keys = required.length
          ? required
          : Object.keys(props).slice(0, 2);
        const args = {};
        keys.forEach((key) => {
          args[key] = this.exampleValueForSchemaProp(key, props[key]);
        });
        return "    " + JSON.stringify({ name: item.name, args });
      });
  },
  schemaText() {
    const examples = this.schemaTextExamples();
    return [
      "You are in Ace AI Agent mode. You may answer in normal plain text for discussion, explanations, debugging, and planning.",
      "Only return JSON when you need to propose reviewable file/editor tools. If no tools are needed, return plain text.",
      "When returning tool calls, return JSON only, no markdown fences, with this shape:",
      "Every write/edit/create operation MUST be represented as a pending tool call. Nothing is applied automatically.",
      "{",
      '  "message": "short plan and summary for the user",',
      '  "tools": [',
      examples.join(",\n"),
      "  ]",
      "}",
      "Rules:",
      "- The user must approve tools after seeing diffs. Do not say changes are applied.",
      "- If selected code exists and the user asks about that snippet/current code, prefer replace_selection.",
      "- If the user says codebase/code base/project/workspace/repo/@codebase/all files, the selection is context only; inspect files and use file-level tools instead of replacing just the selection.",
      "- Do not call replace_file/write_file for the active filename unless the user explicitly asked to rewrite the whole file or the task is clearly file/project-level.",
      "- Use create_file only for brand-new files. If the file may exist, use write_file and include complete content.",
      "- Use project_overview for Diagnose Project. Use read_file/list_files/search_in_files before editing files that are not already included in context. If a read tool returns ok:false, continue safely by trying another read/search/list or ask the user; never invent file contents.",
      "- Use open_file only to navigate to an existing/read/search/project_overview result. It is not an edit tool.",
      "- Use write_file/replace_file only with complete file content, not partial fragments.",
      "- delete_file is supported for real filesystem deletion. Do not use it to close tabs; use it only when the user asks to delete a file or directory.",
      "- Use rename_file to rename within the same folder (new_name = filename only, no slashes). Use move_file to move to a different folder. Prefer rename_file/move_file over delete+create to avoid data loss.",
      "- Use create_directory to create a new folder before creating files inside it when the folder does not exist yet.",
      "- Use insert_after_line for adding imports, functions, or blocks to an existing file without replacing the whole content. Prefer it over replace_file/write_file for small insertions.",
      "- Use run_command only when the user asks to run/check/validate tests, lint, typecheck, format check, or syntax. It must be a safe visible-terminal command and the user still approves it in Review.",
      "- Never invent chmod, destructive terminal, package install, network, or background tools.",
      "- Keep paths relative to the active file folder or Project Root when possible.",
      "- If the active Acode tab is unsaved or Project Root is unknown, do NOT create a file with the active filename. Use replace_selection for local edits or replace_file with an empty path to replace the active editor content.",
      "- For tests for selected code: in Agent mode, answer normally unless the user clearly wants the editor/file changed. If Project Root is unknown, update the active editor/selection instead of creating a separate relative file.",
      "- For multi-file tasks, provide one tool per file/action.",
    ].join("\n");
  },
  cleanJson(raw) {
    let text = Util.stripFence(raw || "").trim();
    if (text.startsWith("```")) text = Util.stripFence(text);
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    return text.trim();
  },
  parse(raw) {
    const original = String(raw || "").trim();
    const source = this.cleanJson(original);
    let data = null;
    try {
      data = JSON.parse(source);
    } catch (error) {
      return { message: original, tools: [], raw: original };
    }
    const hasToolShape =
      data &&
      typeof data === "object" &&
      (Object.prototype.hasOwnProperty.call(data, "tools") ||
        Object.prototype.hasOwnProperty.call(data, "tool_calls") ||
        Object.prototype.hasOwnProperty.call(data, "actions"));
    if (!hasToolShape) return { message: original, tools: [], raw: original };
    let tools = data.tools || data.tool_calls || data.actions || [];
    if (!Array.isArray(tools)) tools = [];
    tools = tools
      .map((tool, index) => {
        const name = String(tool.name || tool.tool || tool.type || "").trim();
        const args = tool.args || tool.arguments || tool.input || {};
        return this.normalize({
          id: index + 1,
          name,
          args: args && typeof args === "object" ? args : {},
        });
      })
      .filter((tool) => this.writeNames.includes(tool.name));
    const message = String(data.message || data.summary || "").trim();
    if (!tools.length && !message)
      return { message: original, tools: [], raw: original };
    return { message, tools, raw: source };
  },
  normalize(tool) {
    const args = tool.args || {};
    const content = Util.unhtml(args.content ?? args.text ?? args.code ?? "");
    const path = String(args.path || args.file || args.filename || "").trim();
    const query = String(args.query || args.pattern || "").trim();
    const startLine =
      Number(args.start_line || args.startLine || args.line_start || 0) || 0;
    const endLine =
      Number(args.end_line || args.endLine || args.line_end || 0) || 0;
    const maxDepth = Number(args.max_depth || args.maxDepth || 0) || 0;
    const maxResults = Number(args.max_results || args.maxResults || 0) || 0;
    const glob = String(
      args.glob || args.include_glob || args.includeGlob || "",
    ).trim();
    const newName = String(args.new_name || args.newName || "").trim();
    const newPath = String(
      args.new_path || args.newPath || args.destination || args.dest || "",
    ).trim();
    const command = String(args.command || args.cmd || "").trim();
    const cwd = String(
      args.cwd || args.working_directory || args.workingDirectory || "",
    ).trim();
    const openLine =
      Number(args.line || args.target_line || args.start_line || 0) || 0;
    const openColumn = Number(args.column || args.col || 1) || 1;
    const insertAfterLine =
      Number(args.line ?? args.insert_after_line ?? args.after_line ?? -1) >= 0
        ? Number(args.line ?? args.insert_after_line ?? args.after_line)
        : -1;
    return Object.assign({}, tool, {
      path,
      content,
      query,
      startLine,
      endLine,
      maxDepth,
      maxResults,
      glob,
      newName,
      newPath,
      command,
      cwd,
      openLine,
      openColumn,
      insertAfterLine,
      safeCommand: "",
      title: this.titleFor(tool.name, path || query),
      preview: null,
      warning: "",
      error: "",
      selected: true,
      appliesTo:
        path ||
        (tool.name.includes("selection")
          ? "selection"
          : tool.name.includes("cursor")
            ? "cursor"
            : tool.name.includes("search")
              ? "workspace search"
              : "active file"),
    });
  },
  titleFor(name, path) {
    const target = path ? " " + path : "";
    const map = {
      replace_selection: "Replace selection",
      insert_at_cursor: "Insert at cursor",
      replace_file: "Replace file",
      create_file: "Create file",
      write_file: "Write file",
      append_file: "Append file",
      delete_file: "Delete file/folder",
      rename_file: "Rename file",
      move_file: "Move file",
      create_directory: "Create folder",
      insert_after_line: "Insert after line",
      read_file: "Read file",
      list_files: "List files",
      search_in_files: "Search files",
      open_file: "Open file",
      project_overview: "Inspect project",
      run_command: "Run command",
    };
    return (map[name] || "Run tool") + target;
  },
  safeCommand(command) {
    const cmd = String(command || "").trim();
    if (!cmd) return "";
    // Terminal tools must stay single-line and visible. Block shell control
    // chars, escaping, redirects, environment expansion, and package/network/
    // destructive commands before checking the allowlist.
    if (/[\r\n\\;&|`$<>]/.test(cmd)) return "";
    if (
      /\b(rm|sudo|su|chmod|chown|mkfs|dd|shutdown|reboot|curl|wget|nc|ssh|scp|apk|apt|pip|npm\s+install|pnpm\s+add|yarn\s+add|bun\s+add)\b/i.test(
        cmd,
      )
    )
      return "";
    const safePath = "[A-Za-z0-9_./:@+\\-=]+";
    const allowed = [
      /^npm\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
      /^pnpm\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
      /^yarn\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
      /^bun\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
      new RegExp("^node\\s+--check\\s+" + safePath + "$", "i"),
      new RegExp("^node\\s+-c\\s+" + safePath + "$", "i"),
    ];
    return allowed.some((re) => re.test(cmd)) ? cmd : "";
  },
  fsFactory() {
    const fs = Acode.require("fs") || Acode.require("fsOperation");
    if (typeof fs !== "function") {
      throw ErrorKit.create({
        code: "FS_UNAVAILABLE",
        title: "Acode fs API is unavailable",
        message:
          'File create/write requires acode.require("fs") or fsOperation.',
        hint: "Editor-only tools like replace_selection and insert_at_cursor can still be used.",
      });
    }
    return fs;
  },
  isAbsolutePath(path) {
    const value = String(path || "").trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/");
  },
  sanitizeProjectRoot(value) {
    return String(value || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  },
  baseDir() {
    const configured = this.sanitizeProjectRoot(
      Store.settings().projectRoot || "",
    );
    if (configured) return configured;
    const info = Editor.info();
    let base = String(info.location || info.uri || "")
      .trim()
      .replace(/\\/g, "/");
    if (!base) return "";
    // Acode can report an unsaved tab URI as just `file.js`. That is not a
    // writable project root. Only trust absolute URLs/paths as storage roots.
    if (!this.isAbsolutePath(base)) return "";
    const clean = base.replace(/[?#].*$/, "").replace(/\/+$/, "");
    if (!clean) return "";
    if (/\.[a-z0-9]+$/i.test(clean))
      return clean.replace(/\/[^/]*$/, "").replace(/\/+$/, "");
    return clean;
  },
  activeFilenameMatches(path) {
    const value = String(path || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    if (!value || value.includes("/")) return false;
    const active = String(Editor.info().filename || "").trim();
    return Boolean(active && active !== "untitled" && value === active);
  },
  canUseActiveEditorFallback(path) {
    // Mobile-friendly fallback: when the current Acode tab is new/unsaved, an AI model
    // often proposes create_file/write_file/replace_file with the active filename.
    // Treat that as an active-editor operation so the user is not forced to configure
    // Project Root just to edit the current tab.
    return !this.baseDir() && this.activeFilenameMatches(path);
  },
  canUseActiveDeleteFallback(path) {
    return (
      !this.baseDir() &&
      this.activeFilenameMatches(path) &&
      this.isAbsolutePath(this.activePath())
    );
  },
  isCodebaseRequest(text) {
    const prompt = String(text || "")
      .split(/\n\s*Permission:/i)[0]
      .toLowerCase();
    return /@codebase|\bcode\s*base\b|\bcodebase\b|\bproject\b|\bworkspace\b|\brepo(?:sitory)?\b|\bentire\s+(app|project|workspace|repo|codebase)\b|\ball\s+files?\b/i.test(
      prompt,
    );
  },
  shouldPreferSelectionEdit() {
    const snap = State.lastSelectionSnapshot;
    if (!snap || !String(snap.text || "").trim()) return false;
    const prompt = String(State.lastRequest?.prompt || "");
    if (this.isCodebaseRequest(prompt)) return false;
    return !/(whole|entire|full)\s+(file|document)|replace\s+(the\s+)?file|rewrite\s+(the\s+)?file|overwrite\s+(the\s+)?file/i.test(
      prompt,
    );
  },
  convertToSelectionReplacement(tool, reason) {
    const snap = State.lastSelectionSnapshot || {};
    tool.name = "replace_selection";
    tool.path = "";
    tool.appliesTo = "selection";
    tool.title = "AI wants to replace selected code";
    tool.warning =
      reason ||
      "Converted to selection edit because code is selected. Clear the selection if you want a whole-file rewrite.";
    tool.selectionSnapshot = {
      text: snap.text || Editor.selectedText(),
      range: snap.range || Editor.selectionRange(),
      fileKey:
        snap.fileKey || Editor.info().uri || Editor.info().filename || "",
      snapshotFileKey: snap.fileKey || "",
      filename: snap.filename || Editor.info().filename || "",
      fromSnapshot: Boolean(snap.text),
    };
    return tool;
  },
  convertToActiveEditorReplacement(tool, reason) {
    tool.name = "replace_file";
    tool.path = "";
    tool.appliesTo = "active file";
    tool.title = "AI wants to update the active editor";
    tool.warning =
      reason ||
      "Project Root is not available, so this will update the current Acode tab instead of creating a separate file.";
    return tool;
  },
  previewSelectionReplacement(tool, content, reason) {
    this.convertToSelectionReplacement(tool, reason);
    const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
    tool.preview = this.makePreview(oldText, content, "selection", tool.id);
    return tool;
  },
  previewActiveEditorReplacement(tool, content, reason) {
    this.convertToActiveEditorReplacement(tool, reason);
    tool.preview = this.makePreview(
      Editor.text(),
      content,
      "active file",
      tool.id,
    );
    return tool;
  },
  async prepareFilePreview(tool, mode) {
    const content = tool.content;
    const isCreate = mode === "create_file";
    if (!tool.path) tool.error = mode + ".path is empty";
    if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
      if (this.shouldPreferSelectionEdit())
        return this.previewSelectionReplacement(
          tool,
          content,
          "Converted to selected-code edit because text is selected and the target matches the active tab.",
        );
      return this.previewActiveEditorReplacement(
        tool,
        content,
        isCreate
          ? "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of creating a new file."
          : "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of writing a project file.",
      );
    }
    const noRootRelative =
      isCreate &&
      tool.path &&
      this.isRelativePath(tool.path) &&
      !this.baseDir();
    if (noRootRelative) {
      tool.error = this.noProjectRootCreateError(tool.path);
      tool.appliesTo = "blocked new file: " + tool.path;
      tool.preview = this.makePreview("", content, tool.appliesTo, tool.id);
      return tool;
    }
    const pathError = tool.path ? this.relativePathError(tool.path) : "";
    if (pathError) tool.error = pathError;
    const snap =
      tool.path && !pathError
        ? await this.fileSnapshot(tool.path)
        : { exists: false, content: "" };
    if (isCreate && snap.exists)
      tool.error =
        "File already exists. create_file is blocked to avoid overwriting: " +
        tool.path;
    if (!isCreate && !snap.exists && !tool.error)
      tool.warning =
        "File does not exist yet — write_file will create it (same as create_file).";
    tool.preview = this.makePreview(
      snap.content || "",
      content,
      snap.full || tool.path || (isCreate ? "new file" : "file"),
      tool.id,
    );
    return tool;
  },
  relativePathError(path) {
    const value = String(path || "").trim();
    if (!value || this.isAbsolutePath(value)) return "";
    if (this.baseDir()) return "";
    return this.noProjectRootCreateError(value);
  },
  noProjectRootCreateError(path) {
    const value = String(path || "").trim() || "new file";
    return (
      "Project Root is unavailable for the relative path: " +
      value +
      ". Ace AI will not create a temporary unsaved Acode tab because that tab is not persisted and may disappear or load forever after Acode reload. Set Project Root in Settings or open a saved file/folder first, then retry."
    );
  },
  resolvePath(path) {
    const value = String(path || "").trim();
    if (!value)
      return String(Editor.info().uri || Editor.info().location || "").trim();
    if (this.isAbsolutePath(value)) return value;
    const base = this.baseDir();
    return base ? base + "/" + value.replace(/^\/+/, "") : value;
  },
  splitPath(fullPath) {
    const path = String(fullPath || "").replace(/\/+$/, "");
    const idx = path.lastIndexOf("/");
    if (idx < 0) return { dir: this.baseDir(), name: path };
    if (idx === 0) return { dir: "/", name: path.slice(1) };
    return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
  },
  activePath() {
    const info = Editor.info();
    return String(info.uri || info.location || info.filename || "").trim();
  },
  isRelativePath(path) {
    const value = String(path || "").trim();
    return Boolean(value && !this.isAbsolutePath(value));
  },
  toTextContent(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try {
      if (value instanceof ArrayBuffer)
        return new TextDecoder("utf-8").decode(value);
      if (ArrayBuffer.isView(value))
        return new TextDecoder("utf-8").decode(value);
    } catch (_) {}
    return String(value || "");
  },
  async fileSnapshot(path) {
    const requested = String(path || "").trim();
    if (requested && !this.baseDir() && this.activeFilenameMatches(requested)) {
      return {
        full: this.activePath() || requested,
        exists: true,
        content: Editor.text(),
        active: true,
        stat: null,
      };
    }
    const full = this.resolvePath(path);
    if (!full)
      return { full, exists: false, content: "", error: "Path is empty" };
    try {
      const fs = this.fsFactory();
      const file = await fs(full);
      let exists = true;
      if (typeof file.exists === "function") exists = await file.exists();
      if (!exists) return { full, exists: false, content: "" };
      let stat = null;
      if (typeof file.stat === "function") {
        try {
          stat = await file.stat();
        } catch (_) {}
        if (stat && stat.isDirectory)
          return {
            full,
            exists: true,
            isDirectory: true,
            content: "",
            stat,
            error: "The path is a folder, not a file",
          };
      }
      if (typeof file.readFile !== "function")
        return {
          full,
          exists: true,
          content: "",
          stat,
          error: "Acode fs.readFile is unavailable for this path",
        };
      let content = "";
      try {
        content = await file.readFile("utf-8");
      } catch (_) {
        content = await file.readFile();
      }
      return { full, exists: true, content: this.toTextContent(content), stat };
    } catch (error) {
      return {
        full,
        exists: false,
        content: "",
        error: error.message || String(error),
      };
    }
  },
  async snapshotForDelete(path) {
    const requested = String(path || "").trim();
    const full = this.canUseActiveDeleteFallback(requested)
      ? this.activePath()
      : this.resolvePath(path);
    if (!full)
      return { full, exists: false, content: "", error: "Path is empty" };
    try {
      const fs = this.fsFactory();
      const file = await fs(full);
      let exists = true;
      if (typeof file.exists === "function") exists = await file.exists();
      if (!exists) return { full, exists: false, content: "" };
      let stat = null;
      if (typeof file.stat === "function") {
        try {
          stat = await file.stat();
        } catch (_) {}
      }
      if (stat && stat.isDirectory) {
        const entries = await this.readDirectoryEntries(full).catch(() => []);
        const children = [];
        for (const entry of entries || []) {
          const item = this.normalizeDirEntry(entry, full);
          if (!item || !item.path) continue;
          children.push(await this.snapshotForDelete(item.path));
        }
        return { full, exists: true, isDirectory: true, stat, children };
      }
      let content = "";
      if (typeof file.readFile === "function") {
        try {
          content = await file.readFile("utf-8");
        } catch (_) {
          content = await file.readFile();
        }
      }
      return {
        full,
        exists: true,
        isDirectory: false,
        content: this.toTextContent(content),
        stat,
      };
    } catch (error) {
      return {
        full,
        exists: false,
        content: "",
        error: error.message || String(error),
      };
    }
  },
  snapshotTreeLines(snapshot, indent = "") {
    if (!snapshot) return [];
    const name =
      Util.filenameFromPath(snapshot.full) ||
      String(snapshot.full || "").trim() ||
      "target";
    if (!snapshot.isDirectory) {
      const size = snapshot.content
        ? " (" + snapshot.content.length + " chars)"
        : "";
      return [indent + name + size];
    }
    const lines = [indent + name + "/"];
    (snapshot.children || []).forEach((child) => {
      lines.push(...this.snapshotTreeLines(child, indent + "  "));
    });
    return lines;
  },
  async deleteFsEntry(fullPath) {
    const fs = this.fsFactory();
    const file = await fs(fullPath);
    const methods = ["delete", "remove", "deleteFile", "rm", "unlink"];
    let lastError = null;
    for (const method of methods) {
      if (typeof file[method] !== "function") continue;
      try {
        await file[method]();
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      "Acode fs delete API is unavailable for: " +
        fullPath +
        (lastError
          ? " (" + (lastError.message || String(lastError)) + ")"
          : ""),
    );
  },
  async restoreSnapshot(snapshot) {
    if (!snapshot || !snapshot.exists) return;
    const fs = this.fsFactory();
    const full = String(snapshot.full || "").trim();
    if (!full) throw new Error("Restore path is empty");
    if (snapshot.isDirectory) {
      const parts = this.splitPath(full);
      if (parts.dir && parts.name) {
        const parent = await fs(parts.dir);
        if (typeof parent.createDirectory !== "function")
          throw new Error(
            "Acode fs.createDirectory is unavailable for: " + parts.dir,
          );
        try {
          await parent.createDirectory(parts.name);
        } catch (_) {}
      }
      for (const child of snapshot.children || []) {
        await this.restoreSnapshot(child);
      }
      return;
    }
    const parts = this.splitPath(full);
    if (!parts.name) throw new Error("Restore file name is empty: " + full);
    if (!parts.dir)
      throw new Error("Restore folder is unavailable for: " + full);
    const dir = await fs(parts.dir);
    if (typeof dir.createFile !== "function")
      throw new Error(
        "Acode fs.createFile is unavailable for restore: " + parts.dir,
      );
    await dir.createFile(parts.name, snapshot.content || "");
  },
  isWriteName(name) {
    return this.writeNames.includes(String(name || "").trim());
  },
  makePreview(oldText, newText, target, toolId) {
    const preview = Patch.withHunks(oldText, newText, {
      toolId: toolId || "tool",
    });
    preview.target = target || preview.target || "";
    return preview;
  },
  toolHasSelectedHunks(tool) {
    if (!tool || tool.error || tool.selected === false) return false;
    return Patch.hasSelectedHunks(tool.preview);
  },
  hunkSummary(tool) {
    const hunks = tool?.preview?.hunks || [];
    if (!hunks.length) return "";
    const selected = hunks.filter((h) => h.selected !== false).length;
    return selected + "/" + hunks.length + " hunks accepted";
  },
  setHunkSelection(toolId, hunkId, selected) {
    const tool = (State.pendingTools || []).find(
      (item) => String(item.id) === String(toolId),
    );
    if (!tool) return false;
    const hunk = (tool.preview?.hunks || []).find(
      (item) => String(item.id) === String(hunkId),
    );
    if (!hunk) return false;
    hunk.selected = Boolean(selected);
    const any = (tool.preview?.hunks || []).some(
      (item) => item.selected !== false,
    );
    tool.selected = any;
    return true;
  },
  setAllHunks(toolId, selected) {
    const tool = (State.pendingTools || []).find(
      (item) => String(item.id) === String(toolId),
    );
    if (!tool || !tool.preview?.hunks?.length) return false;
    tool.preview.hunks.forEach((hunk) => {
      hunk.selected = Boolean(selected);
    });
    tool.selected = Boolean(selected);
    return true;
  },
  effectiveContent(tool) {
    if (tool?.preview?.hunks?.length)
      return Patch.applySelectedHunks(tool.preview);
    return String(tool?.content ?? "");
  },
  targetKey(tool) {
    const name = String(tool?.name || "").trim();
    if (name === "replace_selection") return "__selection__";
    if (name === "insert_at_cursor") return "__cursor__";
    if (name === "run_command")
      return "__command__:" + String(tool?.command || "").trim();
    return String(tool?.path || "").trim() || "__active_editor__";
  },
  markUnsafeToolBatch(tools) {
    const byTarget = new Map();
    (tools || []).forEach((tool) => {
      const key = this.targetKey(tool);
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(tool);
    });
    byTarget.forEach((items, key) => {
      if (items.length < 2) return;
      const fullWrites = items.filter((tool) =>
        [
          "replace_file",
          "write_file",
          "create_file",
          "delete_file",
          "replace_selection",
          "insert_at_cursor",
        ].includes(tool.name),
      );
      const surgical = items.filter((tool) =>
        ["append_file", "insert_after_line"].includes(tool.name),
      );
      if (fullWrites.length > 1) {
        fullWrites.slice(0, -1).forEach((tool) => {
          tool.error =
            "Multiple full-target edits point at the same target. Keep only the final consolidated edit before applying.";
          tool.selected = false;
        });
      }
      const sameLineInserts = new Set();
      items.forEach((tool) => {
        if (tool.name !== "insert_after_line") return;
        const lineKey = `${key}:${tool.insertAfterLine}`;
        if (sameLineInserts.has(lineKey)) {
          tool.error =
            "Multiple insert_after_line tools target the same file and line. Combine them into one insertion before applying.";
          tool.selected = false;
        }
        sameLineInserts.add(lineKey);
      });
      if (!fullWrites.length || !surgical.length) return;
      surgical.forEach((tool) => {
        tool.error =
          "This operation conflicts with another selected full-target edit for the same target. Combine the changes into one tool before applying.";
        tool.selected = false;
      });
    });
    return tools;
  },
  sanitizeWriteTools(tools) {
    const normalized = (tools || [])
      .map((raw, index) =>
        this.normalize(Object.assign({ id: index + 1 }, raw || {})),
      )
      .filter((tool) => this.isWriteName(tool.name));
    const exactSeen = new Set();
    const exactDeduped = [];
    for (const tool of normalized) {
      const exactKey = [
        tool.name,
        String(tool.path || ""),
        String(tool.content || ""),
      ].join("\u0000");
      if (exactSeen.has(exactKey)) continue;
      exactSeen.add(exactKey);
      exactDeduped.push(tool);
    }
    // A sequence of full-file rewrites for the same target is unsafe: applying
    // more than one would let the later rewrite erase the previous one. Keep the
    // model's last proposal for that target, similar to how IDE agents consolidate
    // pending file writes into one review card per file.
    const lastByTarget = new Map();
    exactDeduped.forEach((tool, index) => {
      if (
        ["replace_file", "write_file", "create_file", "delete_file"].includes(
          tool.name,
        )
      ) {
        const target = (tool.path || "").trim() || "__active_editor__";
        lastByTarget.set(target, index);
      }
    });
    const consolidated = exactDeduped
      .filter((tool, index) => {
        if (
          ![
            "replace_file",
            "write_file",
            "create_file",
            "delete_file",
          ].includes(tool.name)
        )
          return true;
        const target = (tool.path || "").trim() || "__active_editor__";
        return lastByTarget.get(target) === index;
      })
      .sort((a, b) => {
        if (a.name === "insert_after_line" && b.name === "insert_after_line") {
          const pathCompare = String(a.path || "").localeCompare(
            String(b.path || ""),
          );
          if (pathCompare) return pathCompare;
          return (
            Number(b.insertAfterLine || 0) - Number(a.insertAfterLine || 0)
          );
        }
        return 0;
      })
      .map((tool, index) => Object.assign(tool, { id: index + 1 }));
    return this.markUnsafeToolBatch(consolidated);
  },
  async preparePreviews(tools) {
    const sanitized = this.sanitizeWriteTools(tools);
    const prepared = await Promise.all(
      sanitized.map(async (tool) => {
        try {
          await this.preparePreview(tool);
        } catch (error) {
          tool.error = error.message || String(error);
        }
        tool.selected = !tool.error;
        return tool;
      }),
    );
    return prepared;
  },
  async preparePreview(tool) {
    const content = tool.content;
    if (
      !content &&
      ![
        "insert_at_cursor",
        "delete_file",
        "create_directory",
        "run_command",
      ].includes(tool.name)
    )
      tool.warning = "Content is empty; this tool is probably not useful.";
    if (tool.name === "replace_selection") {
      const liveText = Editor.selectedText();
      const snapshot = State.lastSelectionSnapshot || null;
      const oldText = liveText || snapshot?.text || "";
      if (!oldText)
        tool.error =
          "There is no active selection. Select code first or ask the agent to use replace_file/write_file.";
      tool.selectionSnapshot = {
        text: oldText,
        range: liveText ? Editor.selectionRange() : snapshot?.range || null,
        fileKey: Editor.info().uri || Editor.info().filename || "",
        snapshotFileKey: snapshot?.fileKey || "",
        filename: Editor.info().filename || snapshot?.filename || "",
        fromSnapshot: !liveText && Boolean(snapshot?.text),
      };
      const target =
        "selection" + (snapshot?.line ? " around line " + snapshot.line : "");
      tool.preview = this.makePreview(oldText, content, target, tool.id);
      return tool;
    }
    if (tool.name === "insert_at_cursor") {
      tool.preview = this.makePreview("", content, "cursor", tool.id);
      return tool;
    }
    if (tool.name === "run_command") {
      const cmd = this.safeCommand(tool.command);
      tool.safeCommand = cmd;
      if (!cmd)
        tool.error =
          "Command blocked by Ace AI safety policy: " +
          (tool.command || "(empty)");
      tool.command = cmd || tool.command;
      tool.appliesTo = "terminal: " + (tool.command || "command");
      tool.warning =
        "This command will run only after approval and will be typed into a visible Acode terminal.";
      tool.preview = this.makePreview(
        "",
        tool.command || "(blocked command)",
        tool.appliesTo,
        tool.id,
      );
      return tool;
    }
    if (tool.name === "replace_file") {
      if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(
            tool,
            "Converted to selected-code edit because text is selected and the target matches the active tab.",
          );
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(
            oldText,
            content,
            "selection",
            tool.id,
          );
          return tool;
        }
        this.convertToActiveEditorReplacement(
          tool,
          "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead.",
        );
        const oldText = Editor.text();
        tool.preview = this.makePreview(
          oldText,
          content,
          "active file",
          tool.id,
        );
        return tool;
      }
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      if (!tool.path) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(
            tool,
            "Converted to selected-code edit because code is selected. Clear the selection to rewrite the whole active file.",
          );
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(
            oldText,
            content,
            "selection",
            tool.id,
          );
          return tool;
        }
        const oldText = Editor.text();
        tool.preview = this.makePreview(
          oldText,
          content,
          "active file",
          tool.id,
        );
        return tool;
      }
      const snap = await this.fileSnapshot(tool.path);
      if (!snap.exists)
        tool.error = "Target file not found for replace_file: " + tool.path;
      tool.preview = this.makePreview(
        snap.content,
        content,
        snap.full,
        tool.id,
      );
      return tool;
    }
    if (tool.name === "create_file")
      return await this.prepareFilePreview(tool, "create_file");
    if (tool.name === "write_file")
      return await this.prepareFilePreview(tool, "write_file");
    if (tool.name === "rename_file") {
      if (!tool.path) tool.error = "rename_file.path is empty";
      if (!tool.newName) tool.error = "rename_file.new_name is empty";
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      const snap =
        tool.path && !pathError
          ? await this.fileSnapshot(tool.path)
          : { exists: false, content: "" };
      if (!snap.exists && !tool.error)
        tool.error = "File not found for rename_file: " + tool.path;
      const oldName = Util.filenameFromPath(tool.path || "");
      tool.preview = this.makePreview(
        oldName,
        tool.newName,
        snap.full || tool.path,
        tool.id,
      );
      tool.appliesTo = tool.path + " → " + tool.newName;
      return tool;
    }
    if (tool.name === "move_file") {
      if (!tool.path) tool.error = "move_file.path is empty";
      if (!tool.newPath) tool.error = "move_file.new_path is empty";
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      const snap =
        tool.path && !pathError
          ? await this.fileSnapshot(tool.path)
          : { exists: false, content: "" };
      if (!snap.exists && !tool.error)
        tool.error = "File not found for move_file: " + tool.path;
      tool.preview = this.makePreview(
        tool.path,
        tool.newPath,
        snap.full || tool.path,
        tool.id,
      );
      tool.appliesTo = tool.path + " → " + tool.newPath;
      return tool;
    }
    if (tool.name === "append_file") {
      if (!tool.path) tool.error = "append_file.path is empty";
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      const snap =
        tool.path && !pathError
          ? await this.fileSnapshot(tool.path)
          : { exists: false, content: "" };
      if (!snap.exists)
        tool.error = "append_file requires an existing file: " + tool.path;
      const oldText = snap.content || "";
      const newText = oldText + content;
      tool.preview = this.makePreview(
        oldText,
        newText,
        snap.full || tool.path,
        tool.id,
      );
      return tool;
    }
    if (tool.name === "delete_file") {
      const targetPath = tool.path
        ? String(tool.path || "").trim()
        : this.activePath();
      if (!targetPath) {
        tool.error = "delete_file.path is empty";
        tool.appliesTo = "delete target";
        tool.preview = this.makePreview("", "", "delete target", tool.id);
        return tool;
      }
      const pathError =
        targetPath && !this.canUseActiveDeleteFallback(targetPath)
          ? this.relativePathError(targetPath)
          : "";
      if (pathError) tool.error = pathError;
      const snap =
        targetPath && !pathError
          ? await this.snapshotForDelete(targetPath)
          : { exists: false, content: "", full: targetPath };
      tool.deleteSnapshot = snap;
      if (!snap.exists)
        tool.error =
          "Target file or folder not found for delete_file: " + targetPath;
      const oldText = snap.isDirectory
        ? this.snapshotTreeLines(snap).join("\n")
        : String(snap.content || "");
      const target = snap.full || targetPath || "target";
      tool.preview = this.makePreview(oldText, "", target, tool.id);
      if (snap.isDirectory)
        tool.warning =
          "This delete removes a folder tree recursively. Undo will try to restore files and folders, but external changes after deletion may not be recoverable.";
      tool.appliesTo = snap.isDirectory ? "folder: " + target : target;
      return tool;
    }
    if (tool.name === "create_directory") {
      if (!tool.path) tool.error = "create_directory.path is empty";
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      if (!tool.error) {
        const snap = await this.fileSnapshot(tool.path);
        if (snap.exists) tool.error = "Directory already exists: " + tool.path;
      }
      tool.appliesTo = "new directory: " + (tool.path || "?");
      tool.preview = this.makePreview(
        "",
        "(empty directory)",
        tool.path || "new directory",
        tool.id,
      );
      return tool;
    }
    if (tool.name === "insert_after_line") {
      if (!tool.path) tool.error = "insert_after_line.path is empty";
      if (tool.insertAfterLine < 0)
        tool.error = "insert_after_line.line must be >= 0";
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      const snap =
        tool.path && !pathError
          ? await this.fileSnapshot(tool.path)
          : { exists: false, content: "" };
      if (!snap.exists && !tool.error)
        tool.error = "File not found: " + tool.path;
      if (!tool.error) {
        const lines = String(snap.content || "").split("\n");
        const at = Math.max(0, Math.min(tool.insertAfterLine, lines.length));
        const newLines = lines.slice();
        const insertedLines = String(tool.content || "")
          .replace(/\r\n/g, "\n")
          .split("\n");
        newLines.splice(at, 0, ...insertedLines);
        tool.preview = this.makePreview(
          snap.content || "",
          newLines.join("\n"),
          snap.full || tool.path,
          tool.id,
        );
      } else {
        tool.preview = this.makePreview(
          "",
          tool.content,
          tool.path || "file",
          tool.id,
        );
      }
      tool.appliesTo = snap.full || tool.path || "file";
      return tool;
    }
    tool.error = "Unsupported tool: " + tool.name;
    return tool;
  },
  iconFor(name) {
    if (name === "create_file") return "＋";
    if (name === "append_file") return "↧";
    if (name === "delete_file") return "✕";
    if (name === "rename_file") return "✎";
    if (name === "move_file") return "→";
    if (name === "create_directory") return "＋";
    if (name === "insert_after_line") return "↓";
    if (name === "replace_selection") return "▣";
    if (name === "insert_at_cursor") return "＋";
    if (name === "read_file") return "◉";
    if (name === "list_files") return "☰";
    if (name === "search_in_files") return "⌕";
    if (name === "open_file") return "↗";
    if (name === "run_command") return "⌘";
    return "◆";
  },
  targetOf(tool) {
    return tool.preview?.target || tool.path || tool.appliesTo || "active file";
  },
  selectedTools() {
    return State.pendingTools.filter((tool) => this.toolHasSelectedHunks(tool));
  },
  operationKind(tool) {
    const name = String(tool?.name || "");
    if (name === "append_file") return "append only";
    if (name === "replace_selection") return "edit selection";
    if (name === "insert_at_cursor") return "insert at cursor";
    if (name === "replace_file" || name === "write_file")
      return tool?.path ? "replace file" : "replace active tab";
    if (name === "create_file") return "create file";
    if (name === "delete_file") return "delete";
    if (name === "rename_file") return "rename file";
    if (name === "move_file") return "move file";
    if (name === "create_directory") return "create directory";
    if (name === "insert_after_line") return "insert after line";
    if (name === "run_command") return "run command";
    return name || "change";
  },
  renderFileTree(options) {
    if (!State.pendingTools.length) return "";
    const showActions = !options || options.actions !== false;
    const rows = State.pendingTools
      .map((tool) => {
        const checked = tool.selected !== false && !tool.error ? "checked" : "";
        const disabled = tool.error ? "disabled" : "";
        const hunkText = this.hunkSummary(tool);
        const status = tool.error
          ? "blocked"
          : tool.selected === false
            ? "skipped"
            : hunkText || "selected";
        const target = this.targetOf(tool);
        const icon = this.iconFor(tool.name);
        return `<label class="ace-ai-tree-row ${tool.error ? "blocked" : ""}"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}><span class="ace-ai-tree-icon">${Util.html(icon)}</span><span class="ace-ai-tree-path">${Util.html(target)}</span><span class="ace-ai-tree-status">${Util.html(status)}</span></label>`;
      })
      .join("");
    const selected = this.selectedTools().length;
    const total = State.pendingTools.length;
    const actions = showActions
      ? '<div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-act="select-all-tools">Select all</button><button class="ace-ai-btn" data-act="select-no-tools">None</button></div>'
      : "";
    return `<div class="ace-ai-card ace-ai-tree"><div class="ace-ai-row" style="justify-content:space-between"><div><div class="ace-ai-label">Proposed file tree</div><div class="ace-ai-mini">${selected}/${total} selected · review before applying</div></div>${actions}</div><div class="ace-ai-tree-list">${rows}</div></div>`;
  },
  renderList(options) {
    if (!State.pendingTools.length) {
      return '<div class="ace-ai-empty">No pending changes yet.</div>';
    }
    const embedded = Boolean(options && options.embedded);
    const total = State.pendingTools.length;
    const selected = this.selectedTools().length;
    const rows = State.pendingTools
      .map((tool) => {
        const error = tool.error
          ? `<div class="ace-ai-tool-error">${Util.html(tool.error)}</div>`
          : "";
        const warning = tool.warning
          ? `<div class="ace-ai-tool-warn">${Util.html(tool.warning)}</div>`
          : "";
        const target = this.targetOf(tool);
        const rows = tool.preview?.rows || [];
        const hunks = tool.preview?.hunks || [];
        const hunkText = this.hunkSummary(tool);
        const diff = hunks.length
          ? Patch.renderHunks(hunks, tool.id)
          : rows.length
            ? `<div class="ace-ai-tool-diff">${Patch.render(rows)}</div>`
            : `<pre>${Util.html((tool.content || "").slice(0, 1600))}</pre>`;
        const checked = tool.selected !== false && !tool.error ? "checked" : "";
        const disabled = tool.error ? "disabled" : "";
        const icon = this.iconFor(tool.name);
        const kind = this.operationKind(tool);
        const state = tool.error
          ? "blocked"
          : tool.selected === false
            ? "skipped"
            : "ready";
        const open =
          State.reviewToolId && String(State.reviewToolId) === String(tool.id)
            ? " open"
            : "";
        const modeNote =
          tool.name === "append_file"
            ? "Append only: adds text at the end."
            : tool.name === "replace_selection"
              ? "Edit selection: replaces the captured selected range only."
              : tool.name === "replace_file" || tool.name === "write_file"
                ? "Replace: overwrites the previewed target with the new content."
                : kind;
        return `<details class="ace-ai-tool ace-ai-tool-slim ${tool.error ? "blocked" : ""}" data-tool-card="${tool.id}"${open}><summary class="ace-ai-tool-summary"><span class="ace-ai-disclosure" aria-hidden="true"></span><label class="ace-ai-tool-check" onclick="event.stopPropagation()"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}></label><span class="ace-ai-tree-icon">${Util.html(icon)}</span><span class="ace-ai-tool-main"><b>${Util.html(target)}</b><small>${Util.html(kind)}${hunkText ? " · " + Util.html(hunkText) : ""}</small></span><span class="ace-ai-tool-state ${state}">${Util.html(state)}</span></summary>${error}${warning}<div class="ace-ai-mini ace-ai-apply-note">${Util.html(modeNote)}</div>${diff}</details>`;
      })
      .join("");
    if (embedded) return `<div class="ace-ai-review-list">${rows}</div>`;
    return `<div class="ace-ai-card ace-ai-review-simple"><div class="ace-ai-row" style="justify-content:space-between;align-items:flex-start"><div><div class="ace-ai-label">Review changes</div><div class="ace-ai-mini">${selected}/${total} selected · tap a row to expand diff</div></div><div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-act="select-all-tools">All</button><button class="ace-ai-btn" data-act="select-no-tools">None</button></div></div><div class="ace-ai-tree-list compact">${rows}</div></div>`;
  },
  async makeUndoRecord(tool) {
    const path = String(tool.path || "").trim();
    const record = {
      id: tool.id,
      name: tool.name,
      path,
      type: "editor",
      existed: true,
      oldText: "",
      target: this.targetOf(tool),
      time: new Date().toISOString(),
    };
    if (
      tool.name === "create_file" &&
      path &&
      this.isRelativePath(path) &&
      !this.baseDir()
    ) {
      record.type = "notice";
      record.existed = false;
      record.note = this.noProjectRootCreateError(path);
      return record;
    }
    if (tool.name === "run_command") {
      record.type = "notice";
      record.existed = false;
      record.note =
        "Terminal command was run in a visible Acode terminal; undo is not automatic.";
      return record;
    }
    if (tool.name === "delete_file") {
      const targetPath = path || this.activePath();
      const snap =
        tool.deleteSnapshot || (await this.snapshotForDelete(targetPath));
      record.type = "delete_file";
      record.fullPath = snap.full || this.resolvePath(targetPath);
      record.existed = Boolean(snap.exists);
      record.wasDirectory = Boolean(snap.isDirectory);
      record.snapshot = snap;
      record.oldText = snap.isDirectory
        ? this.snapshotTreeLines(snap).join("\n")
        : String(snap.content || "");
      return record;
    }
    if (
      tool.name === "replace_selection" ||
      tool.name === "insert_at_cursor" ||
      (tool.name === "replace_file" && !path)
    ) {
      record.type = "editor";
      record.oldText = Editor.text();
      return record;
    }
    if (path) {
      const snap = await this.fileSnapshot(path);
      record.type = "file";
      record.fullPath = snap.full || this.resolvePath(path);
      record.existed = Boolean(snap.exists);
      record.oldText = String(snap.content || "");
      return record;
    }
    return record;
  },
  async restoreRecord(record) {
    if (record.type === "notice")
      return record.note || "Nothing to undo automatically for this operation";
    if (record.type === "editor") {
      if (!Editor.replaceAll(record.oldText || ""))
        throw new Error("Undo editor change failed");
      return "Restored editor";
    }
    if (record.type === "delete_file") {
      const snapshot = record.snapshot || {
        full: record.fullPath,
        exists: true,
        isDirectory: Boolean(record.wasDirectory),
        content: record.oldText || "",
        children: [],
      };
      if (!snapshot.full) throw new Error("Undo path is empty");
      await this.restoreSnapshot(snapshot);
      return snapshot.isDirectory
        ? "Restored deleted folder"
        : "Restored deleted file";
    }
    const path = record.fullPath || record.path;
    if (!path) throw new Error("Undo path is empty");
    if (!record.existed) {
      try {
        await this.deleteFsEntry(path);
        return "Deleted created file";
      } catch (_) {}
      try {
        await this.writeFile(path, "", false, { requireExists: false });
        return "Cleared created file";
      } catch (error) {
        throw new Error(
          "Undo create_file failed; delete manually: " + (record.path || path),
        );
      }
    }
    await this.writeFile(path, record.oldText || "", false, {
      requireExists: false,
    });
    return "Restored " + (record.path || path);
  },
  async undoLast() {
    const batch = State.undoStack.pop();
    if (!batch || !batch.records || !batch.records.length)
      return Acode.toast("No undo batch");
    const results = [];
    for (const record of batch.records.slice().reverse()) {
      try {
        results.push({ ok: true, result: await this.restoreRecord(record) });
      } catch (error) {
        results.push({ ok: false, result: error.message || String(error) });
      }
    }
    State.toolResults = results.map((r) => ({
      ok: r.ok,
      tool: "undo",
      result: r.result,
    }));
    State.lastAppliedSummary =
      "Undo attempted for " + batch.records.length + " operation(s).";
    return results;
  },
  async run(tool) {
    if (tool.error) throw new Error(tool.error);
    const content = this.effectiveContent(tool);
    const path = String(tool.path || "").trim();
    if (tool.name === "replace_selection") {
      if (!content) throw new Error("replace_selection.content is empty");
      const snapshot =
        tool.selectionSnapshot || State.lastSelectionSnapshot || null;
      const live = Editor.selectedText();
      const expected = String(snapshot?.text || "");
      const info = Editor.info();
      const currentFileKey = String(info.uri || info.filename || "").trim();
      const snapshotKey = String(
        snapshot?.snapshotFileKey || snapshot?.fileKey || "",
      ).trim();
      if (snapshotKey && currentFileKey && snapshotKey !== currentFileKey) {
        throw new Error(
          "Active file changed since selection preview. Re-run Agent on the correct tab.",
        );
      }
      if (
        !snapshotKey &&
        snapshot?.filename &&
        info.filename &&
        snapshot.filename !== info.filename
      ) {
        throw new Error(
          "Active file changed since selection preview. Re-run Agent on the correct tab.",
        );
      }
      if (live) {
        if (!expected || live === expected || live.trim() === expected.trim()) {
          if (!Editor.replaceSelection(content))
            throw new Error("Replace selection failed");
          return live === expected
            ? "Selection replaced"
            : "Current selection replaced after whitespace-only drift";
        }
        throw new Error(
          "Current selected text no longer matches the reviewed preview. Re-run Agent before applying.",
        );
      }
      if (snapshot?.range && expected) {
        const text = Editor.text();
        const range = Editor.normalizeRange(snapshot.range);
        const slice = range ? text.slice(range.from, range.to) : "";
        if (range && (slice === expected || slice.trim() === expected.trim())) {
          if (!Editor.replaceRange(range, content))
            throw new Error("Replace selection range failed");
          return "Selection range replaced";
        }
        const first = text.indexOf(expected);
        const last = text.lastIndexOf(expected);
        if (first >= 0 && first === last) {
          if (
            !Editor.replaceRange(
              { from: first, to: first + expected.length },
              content,
            )
          )
            throw new Error("Replace matched preview text failed");
          return "Matched original selection text and replaced it";
        }
        const loose = expected.trim();
        if (loose && loose.length > 16) {
          const looseFirst = text.indexOf(loose);
          const looseLast = text.lastIndexOf(loose);
          if (looseFirst >= 0 && looseFirst === looseLast) {
            if (
              !Editor.replaceRange(
                { from: looseFirst, to: looseFirst + loose.length },
                content,
              )
            )
              throw new Error("Replace loosely matched preview text failed");
            return "Loosely matched original selection text and replaced it";
          }
        }
      }
      throw new Error(
        "Original selected text no longer matches the preview. Re-run Agent before applying.",
      );
    }
    if (tool.name === "insert_at_cursor") {
      if (!Editor.insertAtCursor(content))
        throw new Error("Insert at cursor failed");
      return "Inserted at cursor";
    }
    if (tool.name === "run_command") {
      const cmd = tool.safeCommand || this.safeCommand(tool.command);
      if (!cmd)
        throw new Error(
          "Command blocked by Ace AI safety policy: " +
            (tool.command || "(empty)"),
        );
      const ok = await Acode.confirm(
        "Run command in Acode terminal?",
        cmd + "\n\nThe command will be typed into a visible terminal tab.",
      );
      if (!ok) throw new Error("Command cancelled by user");
      await Acode.runVisibleTerminal(cmd, { name: "Ace AI Run" });
      State.terminalHistory.unshift({
        command: cmd,
        time: new Date().toISOString(),
      });
      State.terminalHistory = State.terminalHistory.slice(0, 10);
      return "Sent command to visible terminal: " + cmd;
    }
    if (tool.name === "replace_file") {
      if (!path) {
        if (!Editor.replaceAll(content))
          throw new Error("Replace active file failed");
        return "Active file replaced";
      }
      return await this.writeFile(path, content, false, {
        requireExists: true,
      });
    }
    if (tool.name === "write_file")
      return await this.writeFile(path, content, false, {
        requireExists: false,
      });
    if (tool.name === "append_file") {
      if (tool.preview?.hunks?.length)
        return await this.writeFile(path, content, false, {
          requireExists: true,
        });
      return await this.writeFile(path, content, true, { requireExists: true });
    }
    if (tool.name === "create_file")
      return await this.createFile(path, content, { failIfExists: true });
    if (tool.name === "rename_file") {
      const newName = String(tool.newName || "").trim();
      if (!path) throw new Error("rename_file.path is empty");
      if (!newName) throw new Error("rename_file.new_name is empty");
      const full = this.resolvePath(path);
      const parts = this.splitPath(full);
      const newFull = (parts.dir ? parts.dir + "/" : "") + newName;
      return await this.renameOrMoveFile(full, newFull, "Renamed");
    }
    if (tool.name === "move_file") {
      const newPath = String(tool.newPath || "").trim();
      if (!path) throw new Error("move_file.path is empty");
      if (!newPath) throw new Error("move_file.new_path is empty");
      const full = this.resolvePath(path);
      const newFull = this.resolvePath(newPath);
      return await this.renameOrMoveFile(full, newFull, "Moved");
    }
    if (tool.name === "delete_file") {
      const targetPath = path || this.activePath();
      if (!targetPath) throw new Error("delete_file.path is empty");
      const snap =
        tool.deleteSnapshot || (await this.snapshotForDelete(targetPath));
      if (!snap.exists)
        throw new Error("File or folder not found: " + targetPath);
      const full = snap.full || this.resolvePath(targetPath);
      await this.deleteFsEntry(full);
      try {
        const active = Editor.activeFile();
        const activeInfo = Editor.info();
        const activePath = String(
          activeInfo.uri || activeInfo.location || activeInfo.filename || "",
        ).trim();
        if (active && typeof active.remove === "function" && activePath) {
          const matchesDeleted =
            activePath === full ||
            activePath.startsWith(full.replace(/\/+$/, "") + "/");
          if (matchesDeleted) await active.remove(true);
        }
      } catch (_) {}
      return snap.isDirectory
        ? "Deleted folder " + targetPath
        : "Deleted file " + targetPath;
    }
    if (tool.name === "create_directory") {
      if (!path) throw new Error("create_directory.path is empty");
      const full = this.resolvePath(path);
      const parts = this.splitPath(full);
      if (!parts.name)
        throw new Error("Invalid create_directory path: " + path);
      if (!parts.dir)
        throw new Error(
          this.relativePathError(path) ||
            "Parent folder for create_directory is unavailable: " + path,
        );
      const parent = await this.fsFactory()(parts.dir);
      if (typeof parent.createDirectory !== "function")
        throw new Error(
          "Acode fs.createDirectory is unavailable for: " + parts.dir,
        );
      await parent.createDirectory(parts.name);
      return "Created directory " + path;
    }
    if (tool.name === "insert_after_line") {
      if (!path) throw new Error("insert_after_line.path is empty");
      if (tool.insertAfterLine < 0)
        throw new Error("insert_after_line.line must be >= 0");
      const snap = await this.fileSnapshot(path);
      if (!snap.exists) throw new Error("File not found: " + path);
      const lines = String(snap.content || "").split("\n");
      const at = Math.max(0, Math.min(tool.insertAfterLine, lines.length));
      const insertedLines = String(content || "")
        .replace(/\r\n/g, "\n")
        .split("\n");
      lines.splice(at, 0, ...insertedLines);
      return await this.writeFile(path, lines.join("\n"), false, {
        requireExists: true,
      });
    }
  },
  createUnsavedEditorFile(path, content) {
    const filename =
      Util.filenameFromPath(path) ||
      String(path || "untitled.txt")
        .split("/")
        .filter(Boolean)
        .pop() ||
      "untitled.txt";
    const options = {
      text: String(content || ""),
      isUnsaved: true,
      render: true,
      uri: String(path || filename),
    };
    const manager = window.editorManager || window.acode?.editorManager;
    try {
      if (manager && typeof manager.addNewFile === "function") {
        manager.addNewFile(filename, options);
        return true;
      }
    } catch (_) {}
    try {
      if (window.acode && typeof window.acode.newEditorFile === "function") {
        window.acode.newEditorFile(filename, options);
        return true;
      }
    } catch (_) {}
    return false;
  },
  async createFile(path, content, options) {
    if (!path) throw new Error("create_file.path is empty");
    if (this.isRelativePath(path) && !this.baseDir()) {
      throw new Error(this.noProjectRootCreateError(path));
    }
    const snap = await this.fileSnapshot(path);
    if (options?.failIfExists && snap.exists)
      throw new Error(
        "File already exists, create_file was cancelled: " + path,
      );
    const fs = this.fsFactory();
    const full = this.resolvePath(path);
    const parts = this.splitPath(full);
    if (!parts.name) throw new Error("Invalid create_file path: " + path);
    if (!parts.dir)
      throw new Error(
        this.relativePathError(path) ||
          "Target folder for create_file is unavailable: " + path,
      );
    const dir = await fs(parts.dir);
    if (typeof dir.exists === "function" && !(await dir.exists()))
      throw new Error("Parent folder not found: " + parts.dir);
    if (typeof dir.stat === "function") {
      try {
        const stat = await dir.stat();
        if (stat && stat.isFile)
          throw new Error("Parent path is not a folder: " + parts.dir);
      } catch (error) {
        if (/Parent path/.test(error.message || "")) throw error;
      }
    }
    if (typeof dir.createFile !== "function")
      throw new Error(
        "Acode fs.createFile is unavailable for folder: " + parts.dir,
      );
    await dir.createFile(parts.name, content);
    try {
      await Acode.openFileAt(full, { line: 1, column: 1 });
    } catch (_) {}
    return "Created " + path;
  },
  async writeFile(path, content, append, options) {
    if (!path)
      throw new Error(
        (append ? "append_file" : "write_file") + ".path is empty",
      );
    if (this.isRelativePath(path) && !this.baseDir()) {
      throw new Error(this.noProjectRootCreateError(path));
    }
    const snap = await this.fileSnapshot(path);
    if (options?.requireExists && !snap.exists)
      throw new Error("File not found: " + path);
    const fs = this.fsFactory();
    const full = this.resolvePath(path);
    // If file does not exist, create it first
    if (!snap.exists && !append) {
      return await this.createFile(path, content, { failIfExists: false });
    }
    const file = await fs(full);
    if (typeof file.writeFile !== "function")
      throw new Error("Acode fs.writeFile is unavailable for: " + path);
    if (append) {
      await file.writeFile(String(snap.content || "") + content);
      return "Appended " + path;
    }
    await file.writeFile(content);
    return "Wrote " + path;
  },
  async renameOrMoveFile(fromFull, toFull, verb) {
    const fs = this.fsFactory();
    const fromFile = await fs(fromFull);
    // Try native rename/move methods in order of preference
    const renameMethods = ["rename", "move", "moveTo", "renameTo"];
    let lastError = null;
    for (const method of renameMethods) {
      if (typeof fromFile[method] !== "function") continue;
      try {
        await fromFile[method](toFull);
        return verb + " to " + toFull;
      } catch (error) {
        lastError = error;
      }
    }
    // Fallback: read → create at new path → delete old
    let content = "";
    try {
      content = await fromFile.readFile("utf-8");
    } catch (_) {
      content = await fromFile.readFile();
    }
    content = this.toTextContent(content);
    await this.createFile(toFull, content, { failIfExists: false });
    await this.deleteFsEntry(fromFull);
    return verb + " (copy+delete) to " + toFull;
  },
  resultMeta(tool) {
    const hunks = tool?.preview?.hunks || [];
    const selectedHunks = hunks.filter((h) => h.selected !== false);
    const rows = selectedHunks.length
      ? selectedHunks
          .flatMap((h) => h.rows || [])
          .filter((row) => row.type !== "same")
      : (tool?.preview?.rows || []).filter((row) => row.type !== "same");
    const added = rows.filter((row) => row.type === "add").length;
    const removed = rows.filter((row) => row.type === "del").length;
    return {
      target: this.targetOf(tool),
      operation: this.operationKind(tool),
      hunks: hunks.length ? `${selectedHunks.length}/${hunks.length}` : "",
      added,
      removed,
    };
  },
  diagnostic(step, ok, message, meta) {
    const entry = {
      step,
      ok: Boolean(ok),
      message: String(message || ""),
      time: Util.nowLabel(),
      meta: meta || null,
    };
    State.applyDiagnostics = State.applyDiagnostics || [];
    State.applyDiagnostics.push(entry);
    return entry;
  },
  clearDiagnostics() {
    State.applyDiagnostics = [];
  },
  pushUndoBatch(records) {
    if (!records || !records.length) return;
    State.undoStack.push({
      time: new Date().toISOString(),
      records,
    });
    State.undoStack = State.undoStack.slice(-10);
  },
  preflightPathError(tool) {
    if (!tool || !this.isWriteName(tool.name)) return "";
    if (
      ["replace_selection", "insert_at_cursor", "run_command"].includes(
        tool.name,
      )
    )
      return "";
    if (!tool.path) return "";
    if (
      tool.name === "delete_file" &&
      this.canUseActiveDeleteFallback(tool.path)
    )
      return "";
    return this.relativePathError(tool.path);
  },
  canConvertToActiveEditor(tool) {
    if (!tool || !tool.content) return false;
    if (
      !["create_file", "write_file", "append_file", "replace_file"].includes(
        tool.name,
      )
    )
      return false;
    if (tool.name === "append_file") return false;
    return Boolean(
      Editor.info().filename || Editor.text() || Editor.selectedText(),
    );
  },
  convertToActiveEditor(tool) {
    if (!this.canConvertToActiveEditor(tool)) return false;
    tool.name = "replace_file";
    tool.path = "";
    tool.appliesTo = "active file";
    tool.error = "";
    tool.warning =
      "Converted to active-editor update. This will replace the current Acode tab, not create a separate project file.";
    tool.title = "AI wants to update the active editor";
    tool.selected = true;
    const oldText = Editor.text();
    tool.preview = this.makePreview(
      oldText,
      tool.content,
      "active file",
      tool.id,
    );
    return true;
  },
  convertBlockedToActiveEditor() {
    let converted = 0;
    for (const tool of State.pendingTools || []) {
      if (tool.error && this.convertToActiveEditor(tool)) converted++;
    }
    if (converted) {
      this.diagnostic(
        "fallback",
        true,
        "Converted " + converted + " blocked tool(s) to active-editor updates.",
      );
    }
    return converted;
  },
  async applyAll() {
    if (!State.pendingTools.length)
      return Acode.toast("No pending agent tools");
    this.clearDiagnostics();
    State.toolResults = [];
    State.reviewNotice = "";
    State.lastError = null;
    this.diagnostic("permission", true, "Apply requested for pending changes.");
    const tools = this.selectedTools();
    if (!tools.length) {
      this.diagnostic(
        "selection",
        false,
        "No unblocked selected tools are available.",
      );
      return Acode.toast("No selected tools");
    }

    const preflightErrors = [];
    for (const tool of tools) {
      if (tool.error)
        preflightErrors.push({
          ok: false,
          tool: tool.name,
          result: tool.error,
          ...this.resultMeta(tool),
        });
      const pathError = this.preflightPathError(tool);
      if (pathError)
        preflightErrors.push({
          ok: false,
          tool: tool.name,
          result: pathError,
          ...this.resultMeta(tool),
        });
    }
    if (preflightErrors.length) {
      State.toolResults = preflightErrors;
      this.diagnostic(
        "preflight",
        false,
        preflightErrors[0].result,
        preflightErrors,
      );
      throw ErrorKit.create({
        code: "TOOL_PREFLIGHT_FAILED",
        title: "Agent tool blocked before apply",
        message: preflightErrors[0].result,
        hint: "No changes were applied yet. To create project files, set Project Root in Settings first, then retry. Or use “Use active editor” to write to the current tab.",
        details: JSON.stringify(preflightErrors, null, 2),
      });
    }
    this.diagnostic(
      "preflight",
      true,
      "Preflight passed for " + tools.length + " selected operation(s).",
    );

    const results = [];
    const undoRecords = [];
    const appliedIds = new Set();
    const selectedIds = new Set(tools.map((tool) => String(tool.id)));
    const persistPartialState = (message) => {
      State.toolResults = results;
      this.pushUndoBatch(undoRecords);
      if (appliedIds.size) {
        State.pendingTools = State.pendingTools.filter(
          (pending) => !appliedIds.has(String(pending.id)),
        );
      }
      State.lastAppliedSummary = appliedIds.size
        ? "Partially applied " +
          appliedIds.size +
          " operation(s) before an error."
        : "No changes were applied.";
      State.reviewNotice = message || State.lastAppliedSummary;
    };

    for (const tool of tools) {
      try {
        this.diagnostic(
          "snapshot",
          true,
          "Creating undo snapshot for " + tool.name + ".",
        );
        const undo = await this.makeUndoRecord(tool);
        this.diagnostic(
          "execute",
          true,
          "Applying " + tool.name + " to " + this.targetOf(tool) + ".",
        );
        const result = await this.run(tool);
        undoRecords.push(undo);
        appliedIds.add(String(tool.id));
        results.push(
          Object.assign(
            { ok: true, tool: tool.name, result },
            this.resultMeta(tool),
          ),
        );
        State.toolResults = results;
        this.diagnostic("execute", true, result || tool.name + " applied");
      } catch (error) {
        const failed = Object.assign(
          {
            ok: false,
            tool: tool.name,
            result: error.message || String(error),
          },
          this.resultMeta(tool),
        );
        results.push(failed);
        tool.error = error.message || String(error);
        tool.selected = false;
        this.diagnostic(
          "execute",
          false,
          `${tool.name}: ${error.message || error}`,
        );
        persistPartialState(
          appliedIds.size
            ? "Some changes were applied before the error. Review the remaining pending tools before applying again."
            : "No changes were applied before this error.",
        );
        throw ErrorKit.create({
          code: "TOOL_FAILED",
          title: "Agent tool failed",
          message: `${tool.name}: ${error.message || error}`,
          hint: appliedIds.size
            ? "Some changes were applied before the error. The applied tools were removed from Review; use Undo Last Apply if needed."
            : "No changes were applied before this error.",
          details: JSON.stringify(
            { results, diagnostics: State.applyDiagnostics },
            null,
            2,
          ),
          cause: error,
        });
      }
    }
    this.pushUndoBatch(undoRecords);
    State.toolResults = results;
    const acceptedHunks = tools.reduce(
      (sum, tool) =>
        sum +
        (tool.preview?.hunks?.length
          ? Patch.selectedHunkCount(tool.preview)
          : 0),
      0,
    );
    State.lastAppliedSummary =
      "Applied " +
      results.length +
      " selected operation(s)" +
      (acceptedHunks ? " with " + acceptedHunks + " accepted hunk(s)." : ".");
    State.reviewNotice = "";
    this.diagnostic("summary", true, State.lastAppliedSummary);
    State.pendingTools = State.pendingTools.filter(
      (tool) => !selectedIds.has(String(tool.id)),
    );
    return results;
  },
};
