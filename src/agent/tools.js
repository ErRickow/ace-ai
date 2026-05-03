const AgentTools = {
  writeNames: ['replace_selection', 'insert_at_cursor', 'replace_file', 'create_file', 'write_file', 'append_file'],
  readNames: ['read_file', 'list_files', 'search_in_files'],
  names: ['replace_selection', 'insert_at_cursor', 'replace_file', 'create_file', 'write_file', 'append_file', 'read_file', 'list_files', 'search_in_files'],
  // Native function definitions for /v1/responses "tools" parameter.
  // Each entry maps 1-to-1 with the existing tool names so parse/normalize/run work unchanged.
  nativeSchema() {
    const pathProp = { type: 'string', description: 'File path (relative to Project Root, or absolute).' };
    const contentProp = { type: 'string', description: 'Complete file or snippet content.' };
    return [
      {
        type: 'function',
        name: 'replace_selection',
        description: 'Replace the currently selected code in the active Acode editor tab. Use when the user has a selection and the change is local to that selection.',
        parameters: {
          type: 'object',
          properties: { content: { type: 'string', description: 'Complete replacement text for the selected code.' } },
          required: ['content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'insert_at_cursor',
        description: 'Insert text at the current cursor position in the active editor. Use for small insertions when nothing is selected.',
        parameters: {
          type: 'object',
          properties: { content: { type: 'string', description: 'Text to insert at the cursor.' } },
          required: ['content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'replace_file',
        description: 'Replace the complete content of an existing file, or of the active editor when path is empty. Always send the full file content.',
        parameters: {
          type: 'object',
          properties: { path: Object.assign({}, pathProp, { description: 'Path to the target file. Leave empty to replace the active editor tab.' }), content: contentProp },
          required: ['content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'create_file',
        description: 'Create a brand-new file. Fails if the file already exists. If Project Root is unavailable for a relative path, Ace AI may open a new unsaved Acode tab for review/apply instead of writing to storage.',
        parameters: {
          type: 'object',
          properties: { path: pathProp, content: contentProp },
          required: ['path', 'content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'write_file',
        description: 'Overwrite an existing file with complete new content. Requires the file to already exist.',
        parameters: {
          type: 'object',
          properties: { path: pathProp, content: contentProp },
          required: ['path', 'content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'append_file',
        description: 'Append content to the end of an existing file without touching the rest.',
        parameters: {
          type: 'object',
          properties: { path: pathProp, content: { type: 'string', description: 'Content to append.' } },
          required: ['path', 'content'],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'read_file',
        description: 'Read a file from the workspace. Leave path empty to read the active editor. Use optional 1-based line bounds for focused reads. If the file is missing, the tool returns an ok:false observation; continue by searching/listing or asking the user instead of guessing.',
        parameters: {
          type: 'object',
          properties: {
            path: Object.assign({}, pathProp, { description: 'File path. Leave empty for the active editor.' }),
            start_line: { type: 'number', description: 'Optional 1-based start line.' },
            end_line: { type: 'number', description: 'Optional 1-based end line.' }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'list_files',
        description: 'List files under the Project Root or a folder. Use before multi-file edits when project structure is unknown.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.' },
            max_depth: { type: 'number', description: 'Optional recursion depth, default 2.' },
            glob: { type: 'string', description: 'Optional simple extension/glob hint, e.g. *.js or src/*.ts.' }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        type: 'function',
        name: 'search_in_files',
        description: 'Search text across files in the workspace. Use for @codebase-like lookup before changing related code.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text or regex-like literal to search for.' },
            path: { type: 'string', description: 'Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.' },
            max_results: { type: 'number', description: 'Maximum result matches, default 30.' },
            include_glob: { type: 'string', description: 'Optional extension/glob hint such as *.js.' }
          },
          required: ['query'],
          additionalProperties: false
        }
      }
    ];
  },
  // Parse native function_call items collected from a /v1/responses stream.
  // Each item looks like: { name, arguments } where arguments is a JSON string.
  parseNativeCalls(calls) {
    const tools = [];
    (calls || []).forEach((call, index) => {
      const name = String(call.name || '').trim();
      if (!this.names.includes(name)) return;
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch (_) {}
      if (args && typeof args === 'object') {
        tools.push(this.normalize({ id: index + 1, name, args }));
      }
    });
    return tools;
  },
  schemaText() {
    return [
      'You are in Ace AI Agent mode. You may answer in normal plain text for discussion, explanations, debugging, and planning.',
      'Only return JSON when you need to propose reviewable file/editor tools. If no tools are needed, return plain text.',
      'When returning tool calls, return JSON only, no markdown fences, with this shape:',
      'Every write/edit/create operation MUST be represented as a pending tool call. Nothing is applied automatically.',
      '{',
      '  "message": "short plan and summary for the user",',
      '  "tools": [',
      '    { "name": "replace_selection", "args": { "content": "complete replacement text for selected code" } },',
      '    { "name": "insert_at_cursor", "args": { "content": "text to insert at cursor" } },',
      '    { "name": "replace_file", "args": { "path": "optional existing file path", "content": "complete file content" } },',
      '    { "name": "create_file", "args": { "path": "new relative/or absolute file path", "content": "complete file content" } },',
      '    { "name": "write_file", "args": { "path": "existing relative/or absolute file path", "content": "complete file content" } },',
      '    { "name": "append_file", "args": { "path": "existing relative/or absolute file path", "content": "content to append" } },',
      '    { "name": "read_file", "args": { "path": "optional file path", "start_line": 1, "end_line": 120 } },',
      '    { "name": "list_files", "args": { "path": "optional folder path", "max_depth": 2 } },',
      '    { "name": "search_in_files", "args": { "query": "text to find", "path": "optional folder path" } }',
      '  ]',
      '}',
      'Rules:',
      '- The user must approve tools after seeing diffs. Do not say changes are applied.',
      '- If selected code exists, treat it as the default edit target. Prefer replace_selection. Do not call replace_file/write_file for the active filename unless the user explicitly asked to rewrite the whole file.',
      '- Use create_file only for brand-new files. If the file may exist, use write_file and include complete content.',
      '- Use read_file/list_files/search_in_files before editing files that are not already included in context. If a read tool returns ok:false, continue safely by trying another read/search/list or ask the user; never invent file contents.',
      '- Use write_file/replace_file only with complete file content, not partial fragments.',
      '- Never invent delete, rename, chmod, terminal, npm, or network tools.',
      '- Keep paths relative to the active file folder or Project Root when possible.',
      '- If the active Acode tab is unsaved or Project Root is unknown, do NOT create a file with the active filename. Use replace_selection for local edits or replace_file with an empty path to replace the active editor content.',
      '- For tests for selected code: in Agent mode, answer normally unless the user clearly wants the editor/file changed. If Project Root is unknown, update the active editor/selection instead of creating a separate relative file.',
      '- For multi-file tasks, provide one tool per file/action.'
    ].join('\n');
  },
  cleanJson(raw) {
    let text = Util.stripFence(raw || '').trim();
    if (text.startsWith('```')) text = Util.stripFence(text);
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    return text.trim();
  },
  parse(raw) {
    const original = String(raw || '').trim();
    const source = this.cleanJson(original);
    let data = null;
    try { data = JSON.parse(source); } catch (error) {
      return { message: original, tools: [], raw: original };
    }
    let tools = data.tools || data.tool_calls || data.actions || [];
    if (!Array.isArray(tools)) tools = [];
    tools = tools.map((tool, index) => {
      const name = String(tool.name || tool.tool || tool.type || '').trim();
      const args = tool.args || tool.arguments || tool.input || {};
      return this.normalize({ id: index + 1, name, args: args && typeof args === 'object' ? args : {} });
    }).filter((tool) => this.writeNames.includes(tool.name));
    return { message: String(data.message || data.summary || ''), tools, raw: source };
  },
  normalize(tool) {
    const args = tool.args || {};
    const content = String(args.content ?? args.text ?? args.code ?? '');
    const path = String(args.path || args.file || args.filename || '').trim();
    const query = String(args.query || args.pattern || '').trim();
    const startLine = Number(args.start_line || args.startLine || args.line_start || 0) || 0;
    const endLine = Number(args.end_line || args.endLine || args.line_end || 0) || 0;
    const maxDepth = Number(args.max_depth || args.maxDepth || 0) || 0;
    const maxResults = Number(args.max_results || args.maxResults || 0) || 0;
    const glob = String(args.glob || args.include_glob || args.includeGlob || '').trim();
    return Object.assign({}, tool, {
      path,
      content,
      query,
      startLine,
      endLine,
      maxDepth,
      maxResults,
      glob,
      title: this.titleFor(tool.name, path || query),
      preview: null,
      warning: '',
      error: '',
      selected: true,
      appliesTo: path || (tool.name.includes('selection') ? 'selection' : tool.name.includes('cursor') ? 'cursor' : tool.name.includes('search') ? 'workspace search' : 'active file')
    });
  },
  titleFor(name, path) {
    const target = path ? ' ' + path : '';
    const map = {
      replace_selection: 'AI wants to replace selected code',
      insert_at_cursor: 'AI wants to insert code at cursor',
      replace_file: 'AI wants to replace a file',
      create_file: 'AI wants to create a file',
      write_file: 'AI wants to write a file',
      append_file: 'AI wants to append to a file',
      read_file: 'AI wants to read a file',
      list_files: 'AI wants to list files',
      search_in_files: 'AI wants to search files'
    };
    return (map[name] || 'AI wants to run a tool') + target;
  },
  fsFactory() {
    const fs = Acode.require('fs') || Acode.require('fsOperation');
    if (typeof fs !== 'function') {
      throw ErrorKit.create({
        code: 'FS_UNAVAILABLE',
        title: 'Acode fs API tidak tersedia',
        message: 'File create/write membutuhkan acode.require("fs") atau fsOperation.',
        hint: 'Editor-only tools seperti replace_selection dan insert_at_cursor tetap bisa dipakai.'
      });
    }
    return fs;
  },
  isAbsolutePath(path) {
    const value = String(path || '').trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/');
  },
  sanitizeProjectRoot(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  },
  baseDir() {
    const configured = this.sanitizeProjectRoot(Store.settings().projectRoot || '');
    if (configured) return configured;
    const info = Editor.info();
    let base = String(info.location || info.uri || '').trim().replace(/\\/g, '/');
    if (!base) return '';
    // Acode can report an unsaved tab URI as just `file.js`. That is not a
    // writable project root. Only trust absolute URLs/paths as storage roots.
    if (!this.isAbsolutePath(base)) return '';
    const clean = base.replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!clean) return '';
    if (/\.[a-z0-9]+$/i.test(clean)) return clean.replace(/\/[^/]*$/, '').replace(/\/+$/, '');
    return clean;
  },
  activeFilenameMatches(path) {
    const value = String(path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!value || value.includes('/')) return false;
    const active = String(Editor.info().filename || '').trim();
    return Boolean(active && active !== 'untitled' && value === active);
  },
  canUseActiveEditorFallback(path) {
    // Mobile-friendly fallback: when the current Acode tab is new/unsaved, an AI model
    // often proposes create_file/write_file/replace_file with the active filename.
    // Treat that as an active-editor operation so the user is not forced to configure
    // Project Root just to edit the current tab.
    return !this.baseDir() && this.activeFilenameMatches(path);
  },
  shouldPreferSelectionEdit() {
    const snap = State.lastSelectionSnapshot;
    if (!snap || !String(snap.text || '').trim()) return false;
    const prompt = String(State.lastRequest?.prompt || '').toLowerCase();
    return !/(whole|entire|full)\s+(file|document)|replace\s+(the\s+)?file|rewrite\s+(the\s+)?file|overwrite\s+(the\s+)?file|semua\s+file|seluruh\s+file/i.test(prompt);
  },
  convertToSelectionReplacement(tool, reason) {
    const snap = State.lastSelectionSnapshot || {};
    tool.name = 'replace_selection';
    tool.path = '';
    tool.appliesTo = 'selection';
    tool.title = 'AI wants to replace selected code';
    tool.warning = reason || 'Converted to selection edit because code is selected. Clear the selection if you want a whole-file rewrite.';
    tool.selectionSnapshot = {
      text: snap.text || Editor.selectedText(),
      range: snap.range || Editor.selectionRange(),
      fileKey: snap.fileKey || (Editor.info().uri || Editor.info().filename || ''),
      snapshotFileKey: snap.fileKey || '',
      filename: snap.filename || Editor.info().filename || '',
      fromSnapshot: Boolean(snap.text)
    };
    return tool;
  },
  convertToActiveEditorReplacement(tool, reason) {
    tool.name = 'replace_file';
    tool.path = '';
    tool.appliesTo = 'active file';
    tool.title = 'AI wants to update the active editor';
    tool.warning = reason || 'Project Root is not available, so this will update the current Acode tab instead of creating a separate file.';
    return tool;
  },
  relativePathError(path) {
    const value = String(path || '').trim();
    if (!value || this.isAbsolutePath(value)) return '';
    if (this.baseDir()) return '';
    return 'Project Root belum terdeteksi untuk path relatif: ' + value + '. Buka file yang sudah tersimpan di folder project, atau isi Project Root di Settings.';
  },
  resolvePath(path) {
    const value = String(path || '').trim();
    if (!value) return String(Editor.info().uri || Editor.info().location || '').trim();
    if (this.isAbsolutePath(value)) return value;
    const base = this.baseDir();
    return base ? base + '/' + value.replace(/^\/+/, '') : value;
  },
  splitPath(fullPath) {
    const path = String(fullPath || '').replace(/\/+$/, '');
    const idx = path.lastIndexOf('/');
    if (idx < 0) return { dir: this.baseDir(), name: path };
    return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
  },
  activePath() {
    const info = Editor.info();
    return String(info.uri || info.location || info.filename || '').trim();
  },
  isRelativePath(path) {
    const value = String(path || '').trim();
    return Boolean(value && !this.isAbsolutePath(value));
  },
  toTextContent(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      if (value instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(value);
      if (ArrayBuffer.isView(value)) return new TextDecoder('utf-8').decode(value);
    } catch (_) {}
    return String(value || '');
  },
  async fileSnapshot(path) {
    const requested = String(path || '').trim();
    if (requested && !this.baseDir() && this.activeFilenameMatches(requested)) {
      return { full: this.activePath() || requested, exists: true, content: Editor.text(), active: true, stat: null };
    }
    const full = this.resolvePath(path);
    if (!full) return { full, exists: false, content: '', error: 'Path kosong' };
    try {
      const fs = this.fsFactory();
      const file = await fs(full);
      let exists = true;
      if (typeof file.exists === 'function') exists = await file.exists();
      if (!exists) return { full, exists: false, content: '' };
      let stat = null;
      if (typeof file.stat === 'function') {
        try { stat = await file.stat(); } catch (_) {}
        if (stat && stat.isDirectory) return { full, exists: true, isDirectory: true, content: '', stat, error: 'Path adalah folder, bukan file' };
      }
      if (typeof file.readFile !== 'function') return { full, exists: true, content: '', stat, error: 'Acode fs.readFile tidak tersedia untuk path ini' };
      let content = '';
      try { content = await file.readFile('utf-8'); }
      catch (_) { content = await file.readFile(); }
      return { full, exists: true, content: this.toTextContent(content), stat };
    } catch (error) {
      return { full, exists: false, content: '', error: error.message || String(error) };
    }
  },
  isReadOnlyName(name) {
    return this.readNames.includes(String(name || '').trim());
  },
  isWriteName(name) {
    return this.writeNames.includes(String(name || '').trim());
  },
  parseCallArgs(call) {
    let args = {};
    try { args = JSON.parse(call.arguments || call.args || '{}'); } catch (_) {}
    return args && typeof args === 'object' ? args : {};
  },
  callId(call, index) {
    return String(call.call_id || call.callId || call.id || call.item_id || ('call_' + (index + 1)));
  },
  readCallKey(call) {
    return String(call?.name || '') + ':' + String(call?.arguments || call?.args || '{}');
  },
  readCallTarget(call) {
    const name = String(call?.name || '').trim();
    const args = this.parseCallArgs(call || {});
    if (name === 'read_file') return String(args.path || Editor.info().filename || 'active editor').trim();
    if (name === 'list_files') return String(args.path || 'project files').trim();
    if (name === 'search_in_files') return String(args.query || args.path || 'codebase').trim();
    return name || 'tool';
  },
  readCallGroup(call) {
    const name = String(call?.name || '').trim();
    if (name === 'read_file') return 'reading';
    if (name === 'list_files') return 'listing';
    if (name === 'search_in_files') return 'searching';
    return 'using tools';
  },
  uniqueReadCalls(calls) {
    const out = [];
    const seen = new Set();
    (calls || []).forEach((call) => {
      if (!this.isReadOnlyName(call?.name)) return;
      const key = this.readCallKey(call);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(call);
    });
    return out;
  },
  readActivityFromCalls(calls, status) {
    return this.uniqueReadCalls(calls).map((call) => ({
      group: this.readCallGroup(call),
      tool: String(call?.name || '').trim(),
      target: this.readCallTarget(call),
      status: status || 'running'
    }));
  },
  outputForToolResult(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return Util.truncate(text, C.MAX_TOOL_READ_CHARS);
  },
  async runReadCalls(calls) {
    const readCalls = (calls || []).filter((call) => this.isReadOnlyName(call?.name));
    const cache = new Map();
    const out = [];
    for (let index = 0; index < readCalls.length; index++) {
      const call = readCalls[index];
      const key = this.readCallKey(call);
      let result = cache.get(key);
      if (!result) {
        result = await this.runReadCall(call, index);
        cache.set(key, result);
      }
      // Responses API needs an output for every function call id. Duplicate
      // calls reuse the cached observation but keep their own call_id.
      out.push(Object.assign({}, result, { call_id: this.callId(call, index), name: String(call.name || result.name || '') }));
    }
    return out;
  },
  async runReadCall(call, index) {
    const name = String(call.name || '').trim();
    const args = this.parseCallArgs(call);
    const tool = this.normalize({ id: index + 1, name, args });
    try {
      const result = await this.runRead(tool);
      const ok = result && result.ok === false ? false : true;
      return { ok, name, call_id: this.callId(call, index), output: this.outputForToolResult(result) };
    } catch (error) {
      return { ok: false, name, call_id: this.callId(call, index), output: this.outputForToolResult({ ok: false, tool: name, error: error.message || String(error), recoverable: true, instruction: 'Continue without hallucinating. Use another read/search/list call if useful, or ask the user for the correct path.' }) };
    }
  },
  async runRead(tool) {
    if (tool.name === 'read_file') return await this.readFileTool(tool);
    if (tool.name === 'list_files') return await this.listFilesTool(tool);
    if (tool.name === 'search_in_files') return await this.searchInFilesTool(tool);
    throw new Error('Unsupported read tool: ' + tool.name);
  },
  readSlice(content, startLine, endLine) {
    const lines = String(content || '').split('\n');
    const total = lines.length;
    const start = Math.max(1, Number(startLine || 1));
    const end = Math.min(total, Number(endLine || 0) > 0 ? Number(endLine) : total);
    const width = String(end).length;
    const out = [];
    for (let line = start; line <= end; line++) out.push(String(line).padStart(width, ' ') + ' | ' + (lines[line - 1] || ''));
    return { startLine: start, endLine: end, totalLines: total, content: out.join('\n') };
  },
  async readFileTool(tool) {
    const path = String(tool.path || '').trim();
    let content = '';
    let fullPath = '';
    let exists = true;
    if (!path) {
      content = Editor.text();
      fullPath = this.activePath() || 'active editor';
    } else {
      const snap = await this.fileSnapshot(path);
      exists = Boolean(snap.exists && !snap.isDirectory && !snap.error);
      fullPath = snap.full || this.resolvePath(path);
      if (!exists) {
        return {
          ok: false,
          tool: 'read_file',
          path,
          fullPath,
          exists: Boolean(snap.exists),
          error: snap.error || ('File tidak ditemukan: ' + path),
          recoverable: true,
          next_step: 'Do not guess this file. Try list_files/search_in_files, use the active editor if it matches, or ask the user for the correct path.'
        };
      }
      content = String(snap.content || '');
    }
    const slice = this.readSlice(content, tool.startLine, tool.endLine);
    return { ok: true, tool: 'read_file', path: path || '(active editor)', fullPath, exists, language: Util.lang(path || Editor.info().filename), line_count: slice.totalLines, start_line: slice.startLine, end_line: slice.endLine, content: Util.truncate(slice.content, C.MAX_TOOL_READ_CHARS) };
  },
  async readDirectoryEntries(fullPath) {
    const fs = this.fsFactory();
    const dir = await fs(fullPath);
    const methods = ['lsDir', 'readDir', 'readdir', 'listDir', 'list', 'ls', 'children'];
    for (const method of methods) {
      try {
        const candidate = typeof dir[method] === 'function' ? await dir[method]() : dir[method];
        if (Array.isArray(candidate)) return candidate;
      } catch (_) {}
    }
    throw new Error('Acode fs directory listing API is unavailable for: ' + fullPath);
  },
  normalizeDirEntry(entry, parent) {
    if (typeof entry === 'string') {
      const name = entry.replace(/\/+$/, '').split('/').filter(Boolean).pop() || entry;
      const fullPath = this.isAbsolutePath(entry) ? entry : (String(parent || '').replace(/\/+$/, '') + '/' + entry.replace(/^\/+/, ''));
      return { name, path: fullPath, isDirectory: !/\.[A-Za-z0-9_+-]+$/.test(name) };
    }
    if (!entry || typeof entry !== 'object') return null;
    const rawPath = String(entry.url || entry.uri || entry.path || entry.location || entry.fullPath || entry.filename || entry.name || '').trim();
    const name = String(entry.name || entry.filename || Util.filenameFromPath(rawPath) || '').trim();
    if (!name && !rawPath) return null;
    const fullPath = this.isAbsolutePath(rawPath) ? rawPath : (String(parent || '').replace(/\/+$/, '') + '/' + (rawPath || name).replace(/^\/+/, ''));
    const isDirectory = Boolean(entry.isDirectory || entry.directory || entry.type === 'dir' || entry.type === 'directory' || entry.isFolder || entry.mime === 'inode/directory' || entry.isFile === false);
    return { name: name || Util.filenameFromPath(fullPath), path: fullPath, isDirectory, size: entry.size || 0 };
  },
  globMatches(name, glob) {
    const g = String(glob || '').trim();
    if (!g) return true;
    if (g.startsWith('*.')) return String(name || '').toLowerCase().endsWith(g.slice(1).toLowerCase());
    if (g.includes('*')) {
      let escaped = '';
      const specials = '.+?^${}()|[]\\';
      for (let i = 0; i < g.length; i++) {
        const ch = g[i];
        escaped += ch === '*' ? '.*' : (specials.includes(ch) ? '\\' + ch : ch);
      }
      return new RegExp('^' + escaped + '$', 'i').test(String(name || ''));
    }
    return String(name || '').toLowerCase().includes(g.toLowerCase());
  },
  shouldSkipDir(name) {
    return ['.git','node_modules','dist','build','.next','.nuxt','.cache','coverage','.gradle'].includes(String(name || '').toLowerCase());
  },
  virtualWorkspaceFiles() {
    const active = Editor.info();
    const files = [];
    const add = (path, name, activeFlag) => {
      const filename = String(name || Util.filenameFromPath(path) || '').trim();
      if (!filename) return;
      const key = String(path || filename);
      if (files.some((f) => (f.path || f.name) === key)) return;
      files.push({ path: path || filename, name: filename, active: Boolean(activeFlag), virtual: true });
    };
    add(active.uri || active.location || active.filename, active.filename, true);
    (Editor.openFiles() || []).forEach((f) => add(f.uri || f.filename, f.filename, false));
    (State.recentFiles || []).forEach((f) => add(f.uri || f.filename, f.filename, false));
    return files;
  },
  async collectFiles(folder, maxDepth, glob, limit) {
    const root = String(folder || '').trim() ? this.resolvePath(folder) : this.baseDir();
    if (!root) return { root: 'active/open editors (Project Root unavailable)', files: this.virtualWorkspaceFiles().filter((f) => this.globMatches(f.name, glob)) };
    const max = Math.max(1, Math.min(Number(limit || 120), 400));
    const seen = new Set();
    const out = [];
    const walk = async (dirPath, depth) => {
      if (out.length >= max || seen.has(dirPath) || depth < 0) return;
      seen.add(dirPath);
      let entries = [];
      try { entries = await this.readDirectoryEntries(dirPath); }
      catch (error) {
        if (dirPath === root) throw error;
        return;
      }
      for (const entry of entries) {
        const item = this.normalizeDirEntry(entry, dirPath);
        if (!item) continue;
        if (item.isDirectory) {
          if (depth > 0 && !this.shouldSkipDir(item.name)) await walk(item.path, depth - 1);
        } else if (this.globMatches(item.name, glob)) {
          out.push(item);
          if (out.length >= max) break;
        }
      }
    };
    await walk(root, Math.max(0, Number(maxDepth || 2)));
    return { root, files: out };
  },
  async listFilesTool(tool) {
    try {
      const collected = await this.collectFiles(tool.path, tool.maxDepth || 2, tool.glob || '', 200);
      return { ok: true, tool: 'list_files', root: collected.root, count: collected.files.length, files: collected.files.slice(0, 200).map((f) => ({ path: f.path, name: f.name, active: Boolean(f.active), virtual: Boolean(f.virtual) })) };
    } catch (error) {
      const fallback = this.virtualWorkspaceFiles();
      return { ok: false, tool: 'list_files', root: this.baseDir() || '(unknown)', error: error.message || String(error), recoverable: true, fallback_files: fallback.map((f) => ({ path: f.path, name: f.name, active: Boolean(f.active), virtual: true })) };
    }
  },
  isLikelyTextFile(path) {
    const ext = String(path || '').split('.').pop().toLowerCase();
    if (!ext) return false;
    return !['png','jpg','jpeg','gif','webp','ico','pdf','zip','gz','tar','7z','mp3','mp4','mov','apk','dex','so','ttf','otf','woff','woff2'].includes(ext);
  },
  async searchInFilesTool(tool) {
    const query = String(tool.query || '').trim();
    if (!query) throw new Error('search_in_files.query kosong');
    let files = [];
    let root = this.baseDir();
    try {
      const collected = await this.collectFiles(tool.path, tool.maxDepth || 3, tool.glob || '', C.MAX_TOOL_SEARCH_FILES);
      files = collected.files;
      root = collected.root;
    } catch (error) {
      const active = Editor.info();
      files = [{ path: '', name: active.filename || 'active editor', active: true }];
      root = 'active editor fallback: ' + (error.message || error);
    }
    const q = query.toLowerCase();
    const maxResults = Math.max(1, Math.min(Number(tool.maxResults || 30), C.MAX_TOOL_SEARCH_RESULTS));
    const results = [];
    for (const file of files) {
      if (results.length >= maxResults) break;
      if (!file.active && !this.isLikelyTextFile(file.path || file.name)) continue;
      let content = '';
      try {
        content = file.active ? Editor.text() : (await this.fileSnapshot(file.path)).content;
      } catch (_) { continue; }
      const lines = String(content || '').split('\n');
      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({ path: file.active ? '(active editor)' : file.path, line: i + 1, text: lines[i].trim().slice(0, 500) });
        }
      }
    }
    return { ok: true, tool: 'search_in_files', query, root, count: results.length, results };
  },
  makePreview(oldText, newText, target, toolId) {
    const preview = Patch.withHunks(oldText, newText, { toolId: toolId || 'tool' });
    preview.target = target || preview.target || '';
    return preview;
  },
  toolHasSelectedHunks(tool) {
    if (!tool || tool.error || tool.selected === false) return false;
    return Patch.hasSelectedHunks(tool.preview);
  },
  hunkSummary(tool) {
    const hunks = tool?.preview?.hunks || [];
    if (!hunks.length) return '';
    const selected = hunks.filter((h) => h.selected !== false).length;
    return selected + '/' + hunks.length + ' hunks accepted';
  },
  setHunkSelection(toolId, hunkId, selected) {
    const tool = (State.pendingTools || []).find((item) => String(item.id) === String(toolId));
    if (!tool) return false;
    const hunk = (tool.preview?.hunks || []).find((item) => String(item.id) === String(hunkId));
    if (!hunk) return false;
    hunk.selected = Boolean(selected);
    const any = (tool.preview?.hunks || []).some((item) => item.selected !== false);
    tool.selected = any;
    return true;
  },
  setAllHunks(toolId, selected) {
    const tool = (State.pendingTools || []).find((item) => String(item.id) === String(toolId));
    if (!tool || !tool.preview?.hunks?.length) return false;
    tool.preview.hunks.forEach((hunk) => { hunk.selected = Boolean(selected); });
    tool.selected = Boolean(selected);
    return true;
  },
  effectiveContent(tool) {
    if (tool?.preview?.hunks?.length) return Patch.applySelectedHunks(tool.preview);
    return String(tool?.content ?? '');
  },
  sanitizeWriteTools(tools) {
    const normalized = (tools || []).map((raw, index) => this.normalize(Object.assign({ id: index + 1 }, raw || {}))).filter((tool) => this.isWriteName(tool.name));
    const exactSeen = new Set();
    const exactDeduped = [];
    for (const tool of normalized) {
      const exactKey = [tool.name, String(tool.path || ''), String(tool.content || '')].join('\u0000');
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
      if (['replace_file', 'write_file', 'create_file'].includes(tool.name)) {
        const target = (tool.path || '').trim() || '__active_editor__';
        lastByTarget.set(target, index);
      }
    });
    return exactDeduped.filter((tool, index) => {
      if (!['replace_file', 'write_file', 'create_file'].includes(tool.name)) return true;
      const target = (tool.path || '').trim() || '__active_editor__';
      return lastByTarget.get(target) === index;
    }).map((tool, index) => Object.assign(tool, { id: index + 1 }));
  },
  async preparePreviews(tools) {
    const prepared = [];
    for (const tool of this.sanitizeWriteTools(tools)) {
      try { await this.preparePreview(tool); }
      catch (error) { tool.error = error.message || String(error); }
      tool.selected = !tool.error;
      prepared.push(tool);
    }
    return prepared;
  },
  async preparePreview(tool) {
    const content = tool.content;
    if (!content && !['insert_at_cursor'].includes(tool.name)) tool.warning = 'Content kosong; tool ini kemungkinan tidak berguna.';
    if (tool.name === 'replace_selection') {
      const liveText = Editor.selectedText();
      const snapshot = State.lastSelectionSnapshot || null;
      const oldText = liveText || snapshot?.text || '';
      if (!oldText) tool.error = 'Tidak ada selection aktif. Pilih kode dulu atau minta agent memakai replace_file/write_file.';
      tool.selectionSnapshot = {
        text: oldText,
        range: liveText ? Editor.selectionRange() : (snapshot?.range || null),
        fileKey: (Editor.info().uri || Editor.info().filename || ''),
        snapshotFileKey: snapshot?.fileKey || '',
        filename: Editor.info().filename || snapshot?.filename || '',
        fromSnapshot: !liveText && Boolean(snapshot?.text)
      };
      const target = 'selection' + (snapshot?.line ? ' around line ' + snapshot.line : '');
      tool.preview = this.makePreview(oldText, content, target, tool.id);
      return tool;
    }
    if (tool.name === 'insert_at_cursor') {
      tool.preview = this.makePreview('', content, 'cursor', tool.id);
      return tool;
    }
    if (tool.name === 'replace_file') {
      if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(tool, 'Converted to selected-code edit because text is selected and the target matches the active tab.');
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(oldText, content, 'selection', tool.id);
          return tool;
        }
        this.convertToActiveEditorReplacement(tool, 'No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead.');
        const oldText = Editor.text();
        tool.preview = this.makePreview(oldText, content, 'active file', tool.id);
        return tool;
      }
      const pathError = tool.path ? this.relativePathError(tool.path) : '';
      if (pathError) tool.error = pathError;
      if (!tool.path) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(tool, 'Converted to selected-code edit because code is selected. Clear the selection to rewrite the whole active file.');
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(oldText, content, 'selection', tool.id);
          return tool;
        }
        const oldText = Editor.text();
        tool.preview = this.makePreview(oldText, content, 'active file', tool.id);
        return tool;
      }
      const snap = await this.fileSnapshot(tool.path);
      if (!snap.exists) tool.error = 'Target file tidak ditemukan untuk replace_file: ' + tool.path;
      tool.preview = this.makePreview(snap.content, content, snap.full, tool.id);
      return tool;
    }
    if (tool.name === 'create_file') {
      if (!tool.path) tool.error = 'create_file.path kosong';
      if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(tool, 'Converted to selected-code edit because text is selected and the target matches the active tab.');
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(oldText, content, 'selection', tool.id);
          return tool;
        }
        this.convertToActiveEditorReplacement(tool, 'No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of creating a new file.');
        const oldText = Editor.text();
        tool.preview = this.makePreview(oldText, content, 'active file', tool.id);
        return tool;
      }
      const noRootRelative = tool.path && this.isRelativePath(tool.path) && !this.baseDir();
      if (noRootRelative) {
        tool.warning = 'Project Root belum tersedia. Apply akan membuka file baru sebagai unsaved Acode tab, bukan menyimpan langsung ke storage.';
        tool.appliesTo = 'new unsaved tab: ' + tool.path;
        tool.preview = this.makePreview('', content, tool.appliesTo, tool.id);
        return tool;
      }
      const pathError = tool.path ? this.relativePathError(tool.path) : '';
      if (pathError) tool.error = pathError;
      const snap = tool.path && !pathError ? await this.fileSnapshot(tool.path) : { exists: false, content: '' };
      if (snap.exists) tool.error = 'File sudah ada. create_file diblokir supaya tidak overwrite: ' + tool.path;
      tool.preview = this.makePreview(snap.content || '', content, tool.path || 'new file', tool.id);
      return tool;
    }
    if (tool.name === 'write_file') {
      if (!tool.path) tool.error = 'write_file.path kosong';
      if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
        if (this.shouldPreferSelectionEdit()) {
          this.convertToSelectionReplacement(tool, 'Converted to selected-code edit because text is selected and the target matches the active tab.');
          const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
          tool.preview = this.makePreview(oldText, content, 'selection', tool.id);
          return tool;
        }
        this.convertToActiveEditorReplacement(tool, 'No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of writing a project file.');
        const oldText = Editor.text();
        tool.preview = this.makePreview(oldText, content, 'active file', tool.id);
        return tool;
      }
      const pathError = tool.path ? this.relativePathError(tool.path) : '';
      if (pathError) tool.error = pathError;
      const snap = tool.path && !pathError ? await this.fileSnapshot(tool.path) : { exists: false, content: '' };
      if (!snap.exists) tool.error = 'write_file butuh file yang sudah ada. Untuk file baru pakai create_file: ' + tool.path;
      tool.preview = this.makePreview(snap.content, content, snap.full || tool.path, tool.id);
      return tool;
    }
    if (tool.name === 'append_file') {
      if (!tool.path) tool.error = 'append_file.path kosong';
      const pathError = tool.path ? this.relativePathError(tool.path) : '';
      if (pathError) tool.error = pathError;
      const snap = tool.path && !pathError ? await this.fileSnapshot(tool.path) : { exists: false, content: '' };
      if (!snap.exists) tool.error = 'append_file butuh file yang sudah ada: ' + tool.path;
      const oldText = snap.content || '';
      const newText = oldText + content;
      tool.preview = this.makePreview(oldText, newText, snap.full || tool.path, tool.id);
      return tool;
    }
    tool.error = 'Unsupported tool: ' + tool.name;
    return tool;
  },
  iconFor(name) {
    if (name === 'create_file') return '+';
    if (name === 'append_file') return 'A';
    if (name === 'replace_selection') return 'S';
    if (name === 'insert_at_cursor') return 'I';
    if (name === 'read_file') return 'R';
    if (name === 'list_files') return 'L';
    if (name === 'search_in_files') return '?';
    return 'M';
  },
  targetOf(tool) {
    return tool.preview?.target || tool.path || tool.appliesTo || 'active file';
  },
  selectedTools() {
    return State.pendingTools.filter((tool) => this.toolHasSelectedHunks(tool));
  },
  renderFileTree() {
    const rows = State.pendingTools.map((tool) => {
      const checked = tool.selected !== false && !tool.error ? 'checked' : '';
      const disabled = tool.error ? 'disabled' : '';
      const hunkText = this.hunkSummary(tool);
      const status = tool.error ? 'blocked' : (tool.selected === false ? 'skipped' : (hunkText || 'selected'));
      const target = this.targetOf(tool);
      const icon = this.iconFor(tool.name);
      return `<label class="ace-ai-tree-row ${tool.error ? 'blocked' : ''}"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}><span class="ace-ai-tree-icon">${Util.html(icon)}</span><span class="ace-ai-tree-path">${Util.html(target)}</span><span class="ace-ai-tree-status">${Util.html(status)}</span></label>`;
    }).join('');
    const selected = this.selectedTools().length;
    const total = State.pendingTools.length;
    return `<div class="ace-ai-card ace-ai-tree"><div class="ace-ai-row" style="justify-content:space-between"><div><div class="ace-ai-label">Proposed file tree</div><div class="ace-ai-mini">${selected}/${total} selected · review before applying</div></div><div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-act="select-all-tools">Select all</button><button class="ace-ai-btn" data-act="select-no-tools">None</button></div></div><div class="ace-ai-tree-list">${rows}</div></div>`;
  },
  renderList() {
    if (!State.pendingTools.length) {
      return '<div class="ace-ai-empty">No pending tools yet. Run Agent to generate reviewable edit/create/write actions.</div>';
    }
    const cards = State.pendingTools.map((tool) => {
      const error = tool.error ? `<div class="ace-ai-tool-error">Blocked: ${Util.html(tool.error)}</div>` : '';
      const warning = tool.warning ? `<div class="ace-ai-tool-warn">Warning: ${Util.html(tool.warning)}</div>` : '';
      const target = this.targetOf(tool);
      const rows = tool.preview?.rows || [];
      const hunks = tool.preview?.hunks || [];
      const hunkText = this.hunkSummary(tool);
      const diff = hunks.length ? Patch.renderHunks(hunks, tool.id) : (rows.length ? `<div class="ace-ai-tool-diff">${Patch.render(rows)}</div>` : `<pre>${Util.html((tool.content || '').slice(0, 1600))}</pre>`);
      const checked = tool.selected !== false && !tool.error ? 'checked' : '';
      const disabled = tool.error ? 'disabled' : '';
      const hunkActions = hunks.length ? `<button class="ace-ai-btn" data-act="accept-all-hunks" data-tool-id="${tool.id}">Accept all hunks</button><button class="ace-ai-btn" data-act="reject-all-hunks" data-tool-id="${tool.id}">Reject all hunks</button>` : '';
      return `<div class="ace-ai-tool ${tool.error ? 'blocked' : ''}" data-tool-card="${tool.id}"><div class="ace-ai-row" style="justify-content:space-between;align-items:flex-start"><label class="ace-ai-row nowrap" style="gap:7px"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}><b>${Util.html(tool.title || tool.name)}</b></label><span class="ace-ai-mini">#${tool.id}</span></div><div class="ace-ai-mini">Tool: ${Util.html(tool.name)}${target ? ' · Target: ' + Util.html(target) : ''}${hunkText ? ' · ' + Util.html(hunkText) : ''}</div>${error}${warning}<div class="ace-ai-row nowrap ace-ai-tool-actions"><button class="ace-ai-btn" data-act="explain-tool" data-tool-id="${tool.id}">Explain change</button>${hunkActions}<button class="ace-ai-btn ace-ai-danger" data-act="reject-tool" data-tool-id="${tool.id}">Reject this file</button></div>${diff}</div>`;
    }).join('');
    return this.renderFileTree() + `<div class="ace-ai-card"><div class="ace-ai-label">Diff review</div><div class="ace-ai-mini" style="margin-bottom:8px">Each card below is a proposed operation. Only checked, unblocked tools will be applied.</div>${cards}</div>`;
  },
  async makeUndoRecord(tool) {
    const path = String(tool.path || '').trim();
    const record = { id: tool.id, name: tool.name, path, type: 'editor', existed: true, oldText: '', target: this.targetOf(tool), time: new Date().toISOString() };
    if (tool.name === 'create_file' && path && this.isRelativePath(path) && !this.baseDir()) {
      record.type = 'notice';
      record.existed = false;
      record.note = 'Created an unsaved Acode tab; auto-undo cannot safely close tabs across Acode versions.';
      return record;
    }
    if (tool.name === 'replace_selection' || tool.name === 'insert_at_cursor' || (tool.name === 'replace_file' && !path)) {
      record.type = 'editor';
      record.oldText = Editor.text();
      return record;
    }
    if (path) {
      const snap = await this.fileSnapshot(path);
      record.type = 'file';
      record.fullPath = snap.full || this.resolvePath(path);
      record.existed = Boolean(snap.exists);
      record.oldText = String(snap.content || '');
      return record;
    }
    return record;
  },
  async restoreRecord(record) {
    if (record.type === 'notice') return record.note || 'Nothing to undo automatically for this operation';
    if (record.type === 'editor') {
      if (!Editor.replaceAll(record.oldText || '')) throw new Error('Undo editor change failed');
      return 'Restored editor';
    }
    const path = record.fullPath || record.path;
    if (!path) throw new Error('Undo path kosong');
    if (!record.existed) {
      try {
        const fs = this.fsFactory();
        const file = await fs(path);
        if (typeof file.delete === 'function') { await file.delete(); return 'Deleted created file'; }
        if (typeof file.remove === 'function') { await file.remove(); return 'Deleted created file'; }
        if (typeof file.deleteFile === 'function') { await file.deleteFile(); return 'Deleted created file'; }
      } catch (_) {}
      try { await this.writeFile(path, '', false, { requireExists: false }); return 'Cleared created file'; }
      catch (error) { throw new Error('Undo create_file failed; delete manually: ' + (record.path || path)); }
    }
    await this.writeFile(path, record.oldText || '', false, { requireExists: false });
    return 'Restored ' + (record.path || path);
  },
  async undoLast() {
    const batch = State.undoStack.pop();
    if (!batch || !batch.records || !batch.records.length) return Acode.toast('No undo batch');
    const results = [];
    for (const record of batch.records.slice().reverse()) {
      try { results.push({ ok: true, result: await this.restoreRecord(record) }); }
      catch (error) { results.push({ ok: false, result: error.message || String(error) }); }
    }
    State.toolResults = results.map((r) => ({ ok: r.ok, tool: 'undo', result: r.result }));
    State.lastAppliedSummary = 'Undo attempted for ' + batch.records.length + ' operation(s).';
    return results;
  },
  async run(tool) {
    if (tool.error) throw new Error(tool.error);
    const content = this.effectiveContent(tool);
    const path = String(tool.path || '').trim();
    if (tool.name === 'replace_selection') {
      if (!content) throw new Error('replace_selection.content kosong');
      const snapshot = tool.selectionSnapshot || State.lastSelectionSnapshot || null;
      const live = Editor.selectedText();
      const expected = String(snapshot?.text || '');
      const currentFileKey = Editor.info().uri || Editor.info().filename || '';
      const snapshotKey = snapshot?.snapshotFileKey || snapshot?.fileKey || '';
      if (snapshotKey && currentFileKey && snapshotKey !== currentFileKey && snapshot?.filename && snapshot.filename !== Editor.info().filename) {
        throw new Error('Active file changed since selection preview. Re-run Agent on the correct tab.');
      }
      if (live) {
        if (expected && live !== expected) throw new Error('Selection changed since preview. Re-run Agent or reselect the original code.');
        if (!Editor.replaceSelection(content)) throw new Error('Replace selection gagal');
        return 'Selection replaced';
      }
      if (snapshot?.range && expected) {
        const text = Editor.text();
        const range = Editor.normalizeRange(snapshot.range);
        const slice = range ? text.slice(range.from, range.to) : '';
        if (slice !== expected) throw new Error('Original selection text no longer matches. Re-run Agent before applying.');
        if (!Editor.replaceRange(range, content)) throw new Error('Replace selection range gagal');
        return 'Selection range replaced';
      }
      throw new Error('Tidak ada selection aktif saat apply');
    }
    if (tool.name === 'insert_at_cursor') {
      if (!Editor.insertAtCursor(content)) throw new Error('Insert cursor gagal');
      return 'Inserted at cursor';
    }
    if (tool.name === 'replace_file') {
      if (!path) {
        if (!Editor.replaceAll(content)) throw new Error('Replace active file gagal');
        return 'Active file replaced';
      }
      return await this.writeFile(path, content, false, { requireExists: true });
    }
    if (tool.name === 'write_file') return await this.writeFile(path, content, false, { requireExists: true });
    if (tool.name === 'append_file') {
      if (tool.preview?.hunks?.length) return await this.writeFile(path, content, false, { requireExists: true });
      return await this.writeFile(path, content, true, { requireExists: true });
    }
    if (tool.name === 'create_file') return await this.createFile(path, content, { failIfExists: true });
    throw new Error('Unknown tool: ' + tool.name);
  },
  createUnsavedEditorFile(path, content) {
    const filename = Util.filenameFromPath(path) || String(path || 'untitled.txt').split('/').filter(Boolean).pop() || 'untitled.txt';
    const options = { text: String(content || ''), isUnsaved: true, render: true, uri: String(path || filename) };
    const manager = window.editorManager || window.acode?.editorManager;
    try {
      if (manager && typeof manager.addNewFile === 'function') {
        manager.addNewFile(filename, options);
        return true;
      }
    } catch (_) {}
    try {
      if (window.acode && typeof window.acode.newEditorFile === 'function') {
        window.acode.newEditorFile(filename, options);
        return true;
      }
    } catch (_) {}
    return false;
  },
  async createFile(path, content, options) {
    if (!path) throw new Error('create_file.path kosong');
    if (this.isRelativePath(path) && !this.baseDir()) {
      if (this.createUnsavedEditorFile(path, content)) return 'Created unsaved Acode tab ' + path;
      throw new Error('Project Root belum tersedia dan Acode addNewFile/newEditorFile tidak tersedia untuk membuat tab unsaved: ' + path);
    }
    const snap = await this.fileSnapshot(path);
    if (options?.failIfExists && snap.exists) throw new Error('File sudah ada, create_file dibatalkan: ' + path);
    const fs = this.fsFactory();
    const full = this.resolvePath(path);
    const parts = this.splitPath(full);
    if (!parts.name) throw new Error('Path create_file tidak valid: ' + path);
    if (!parts.dir) throw new Error(this.relativePathError(path) || 'Folder target create_file tidak tersedia: ' + path);
    const dir = await fs(parts.dir);
    if (typeof dir.exists === 'function' && !(await dir.exists())) throw new Error('Parent folder tidak ditemukan: ' + parts.dir);
    if (typeof dir.stat === 'function') {
      try {
        const stat = await dir.stat();
        if (stat && stat.isFile) throw new Error('Parent path bukan folder: ' + parts.dir);
      } catch (error) {
        if (/Parent path/.test(error.message || '')) throw error;
      }
    }
    if (typeof dir.createFile !== 'function') throw new Error('Acode fs.createFile tidak tersedia untuk folder: ' + parts.dir);
    await dir.createFile(parts.name, content);
    return 'Created ' + path;
  },
  async writeFile(path, content, append, options) {
    if (!path) throw new Error((append ? 'append_file' : 'write_file') + '.path kosong');
    const snap = await this.fileSnapshot(path);
    if (options?.requireExists && !snap.exists) throw new Error('File tidak ditemukan: ' + path);
    const fs = this.fsFactory();
    const full = this.resolvePath(path);
    const file = await fs(full);
    if (typeof file.writeFile !== 'function') throw new Error('Acode fs.writeFile tidak tersedia untuk: ' + path);
    if (append) {
      await file.writeFile(String(snap.content || '') + content);
      return 'Appended ' + path;
    }
    await file.writeFile(content);
    return 'Wrote ' + path;
  },
  diagnostic(step, ok, message, meta) {
    const entry = { step, ok: Boolean(ok), message: String(message || ''), time: Util.nowLabel(), meta: meta || null };
    State.applyDiagnostics = State.applyDiagnostics || [];
    State.applyDiagnostics.push(entry);
    return entry;
  },
  clearDiagnostics() {
    State.applyDiagnostics = [];
  },
  canConvertToActiveEditor(tool) {
    if (!tool || !tool.content) return false;
    if (!['create_file', 'write_file', 'append_file', 'replace_file'].includes(tool.name)) return false;
    if (tool.name === 'append_file') return false;
    return Boolean(Editor.info().filename || Editor.text() || Editor.selectedText());
  },
  convertToActiveEditor(tool) {
    if (!this.canConvertToActiveEditor(tool)) return false;
    tool.name = 'replace_file';
    tool.path = '';
    tool.appliesTo = 'active file';
    tool.error = '';
    tool.warning = 'Converted to active-editor update. This will replace the current Acode tab, not create a separate project file.';
    tool.title = 'AI wants to update the active editor';
    tool.selected = true;
    const oldText = Editor.text();
    tool.preview = this.makePreview(oldText, tool.content, 'active file', tool.id);
    return true;
  },
  convertBlockedToActiveEditor() {
    let converted = 0;
    for (const tool of State.pendingTools || []) {
      if (tool.error && this.convertToActiveEditor(tool)) converted++;
    }
    if (converted) {
      this.diagnostic('fallback', true, 'Converted ' + converted + ' blocked tool(s) to active-editor updates.');
    }
    return converted;
  },
  async applyAll() {
    if (!State.pendingTools.length) return Acode.toast('No pending agent tools');
    this.clearDiagnostics();
    this.diagnostic('permission', true, 'Apply requested for pending changes.');
    const tools = this.selectedTools();
    if (!tools.length) {
      this.diagnostic('selection', false, 'No unblocked selected tools are available.');
      return Acode.toast('No selected tools');
    }

    const preflightErrors = [];
    for (const tool of tools) {
      if (tool.error) preflightErrors.push({ ok: false, tool: tool.name, result: tool.error });
      if (['write_file', 'append_file', 'replace_file'].includes(tool.name) && tool.path) {
        const pathError = this.relativePathError(tool.path);
        if (pathError) preflightErrors.push({ ok: false, tool: tool.name, result: pathError });
      }
    }
    if (preflightErrors.length) {
      State.toolResults = preflightErrors;
      this.diagnostic('preflight', false, preflightErrors[0].result, preflightErrors);
      throw ErrorKit.create({
        code: 'TOOL_PREFLIGHT_FAILED',
        title: 'Agent tool diblokir sebelum apply',
        message: preflightErrors[0].result,
        hint: 'Belum ada perubahan diterapkan. Pakai “Use active editor” untuk tab aktif, buka folder project, atau isi Project Root di Settings.',
        details: JSON.stringify(preflightErrors, null, 2)
      });
    }
    this.diagnostic('preflight', true, 'Preflight passed for ' + tools.length + ' selected operation(s).');

    const results = [];
    const undoRecords = [];
    const selectedIds = new Set(tools.map((tool) => String(tool.id)));
    for (const tool of tools) {
      try {
        this.diagnostic('snapshot', true, 'Creating undo snapshot for ' + tool.name + '.');
        const undo = await this.makeUndoRecord(tool);
        this.diagnostic('execute', true, 'Applying ' + tool.name + ' to ' + this.targetOf(tool) + '.');
        const result = await this.run(tool);
        undoRecords.push(undo);
        results.push({ ok: true, tool: tool.name, result });
        this.diagnostic('execute', true, result || (tool.name + ' applied'));
      } catch (error) {
        if (undoRecords.length) State.undoStack.push({ time: new Date().toISOString(), records: undoRecords });
        results.push({ ok: false, tool: tool.name, result: error.message || String(error) });
        this.diagnostic('execute', false, `${tool.name}: ${error.message || error}`);
        throw ErrorKit.create({
          code: 'TOOL_FAILED',
          title: 'Agent tool gagal',
          message: `${tool.name}: ${error.message || error}`,
          hint: undoRecords.length ? 'Sebagian perubahan mungkin sudah diterapkan sebelum error. Gunakan Undo Last Apply jika perlu.' : 'Belum ada perubahan diterapkan sebelum error ini.',
          details: JSON.stringify({ results, diagnostics: State.applyDiagnostics }, null, 2),
          cause: error
        });
      }
    }
    if (undoRecords.length) State.undoStack.push({ time: new Date().toISOString(), records: undoRecords });
    State.toolResults = results;
    const acceptedHunks = tools.reduce((sum, tool) => sum + (tool.preview?.hunks?.length ? Patch.selectedHunkCount(tool.preview) : 0), 0);
    State.lastAppliedSummary = 'Applied ' + results.length + ' selected operation(s)' + (acceptedHunks ? ' with ' + acceptedHunks + ' accepted hunk(s).' : '.');
    this.diagnostic('summary', true, State.lastAppliedSummary);
    State.pendingTools = State.pendingTools.filter((tool) => !selectedIds.has(String(tool.id)));
    return results;
  }
};
