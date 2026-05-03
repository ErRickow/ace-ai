/*
 * Ace AI for Acode
 * v0.8.15 — modular source bundle.
 * Source modules are concatenated by tools/build.mjs for Acode compatibility.
 */
(function () {
  'use strict';


  // ---- core/constants.js ----
  const C = Object.freeze({
      PLUGIN_ID: 'ace.ai.neosantara',
      VERSION: '0.8.16',
      STORAGE_KEY: 'ace-ai.settings.v8_8',
      PRESETS_KEY: 'ace-ai.presets.v8_8',
      CHAT_KEY: 'ace-ai.chat.v8_8',
      RUNTIME_KEY: 'ace-ai.runtime.v8_8',
      RESPONSE_KEY: 'ace-ai.responses.v8_8',
      DEFAULT_BASE_URL: 'https://api.neosantara.xyz/v1',
      DEFAULT_MODEL: 'grok-4.1-fast-non-reasoning',
      MAX_SELECTION: 18000,
      MAX_FULL_FILE: 42000,
      MAX_CHAT_MESSAGES: 50,
      REQUEST_TIMEOUT_MS: 60000,
      REQUEST_RETRY_COUNT: 2,
      REQUEST_RETRY_BASE_MS: 750,
      MAX_CONTEXT_WINDOW: 18000,
      MAX_TOOL_READ_CHARS: 30000,
      MAX_TOOL_SEARCH_FILES: 40,
      MAX_TOOL_SEARCH_RESULTS: 80,
      PANEL_ACTION_ID: 'ace-ai.close-panel',
      SIDEBAR_ID: 'ace-ai-sidebar'
    });

  // ---- core/defaults.js ----
  const Defaults = Object.freeze({
    apiKey: '',
    baseUrl: C.DEFAULT_BASE_URL,
    model: C.DEFAULT_MODEL,
    temperature: '0.2',
    maxTokens: '3200',
    projectRoot: '',
    includeFullFile: false,
    preferPatch: true,
    autoStripFence: true,
    autoOpenChanges: false,
    agentMode: 'agent',
    permissionMode: 'safe',
    reviewOpen: false,
    systemPrompt: [
      'You are Ace AI, a Cursor-like AI coding assistant running inside Acode on Android.',
      'Use the active editor context, cursor line, visible range, selected code, open-file list, and workspace hints when provided.',
      'Prefer minimal diffs. Preserve the user\'s existing code style, naming, formatting, framework choices, and file organization.',
      'Never hallucinate files, APIs, imports, package names, routes, or project structure. If context is missing, use read_file, list_files, or search_in_files when available before editing. If a read tool reports ok:false or a missing file, treat it as recoverable observation and continue with search/list or ask the user rather than guessing.',
      'For edits, change only what is needed, keep unrelated code untouched, and avoid broad rewrites unless explicitly requested.',
      'When writing JavaScript/TypeScript, keep module style consistent, avoid unnecessary dependencies, and handle errors defensively.',
      'When writing HTML/CSS/PHP templates, keep the output paste-ready, safe, responsive, and compatible with plain templates.',
      'Never claim changes were applied before tool results confirm it. In Agent mode, discuss normally first and use reviewable tools only when the user asks for code/file changes or explicit codebase inspection. Do not call tools for greetings or capability questions such as what can you do. In Plan mode, produce plans only.'
    ].join(' ')
  });

  const DefaultPresets = Object.freeze([
    { name: '/fix', prompt: 'Fix bugs in the selected code. Keep the result minimal and directly usable.' },
    { name: '/explain', prompt: 'Explain the selected code or error. Include likely cause and smallest fix.' },
    { name: '/refactor', prompt: 'Refactor the selected code for readability without changing behavior.' },
    { name: '/tests', prompt: 'Generate focused tests for the selected code.' },
    { name: '/html-section', prompt: 'Generate a polished responsive HTML/CSS/JS section for the current page.' },
    { name: '/php-template', prompt: 'Convert the selected HTML into a PHP-friendly template. Escape dynamic values with htmlspecialchars.' },
    { name: '/acode-plugin', prompt: 'Generate a complete Acode plugin skeleton with plugin.json, main.js, readme.md, changelogs.md, safe lifecycle, commands, and cleanup.' },
    { name: '/neosantara-widget', prompt: 'Generate a clean Neosantara AI chat widget embed section. Preserve the script tag format and keep it PHP-friendly.' }
  ]);

  // ---- core/state.js ----
  const State = {
    baseUrl: '',
    cache: null,
    page: null,
    panel: null,
    sidebarContainer: null,
    sideButton: null,
    fallbackButton: null,
    contextMenu: null,
    activeTab: 'chat',
    activeMode: 'chat',
    busy: false,
    lastOriginal: '',
    lastResult: '',
    lastPatch: '',
    lastTarget: 'selection',
    lastSelectionSnapshot: null,
    lastSummary: '',
    lastResultKind: '',
    registeredCommands: [],
    registeredSelectionItems: [],
    editorListeners: [],
    hints: null,
    maximized: false,
    lastError: null,
    lastRequest: null,
    draftPrompt: '',
    streamingContent: '',
    streamingMode: '',
    streamRenderTimer: 0,
    pendingTools: [],
    lastToolJson: '',
    agentMessage: '',
    toolResults: [],
    agentPlan: '',
    agentApprovalRequired: true,
    selectedToolIds: [],
    reviewToolId: null,
    undoStack: [],
    lastAppliedSummary: '',
    applyDiagnostics: [],
    recentFiles: [],
    toolProgress: '',
    retryStatus: '',
    lastUsage: null,
    readToolResults: [],
    toolActivity: [],
    reviewNotice: '',
    showRunDetails: false,
    lastActionMeta: null
  };

  // ---- core/util.js ----
  const Util = {
    html(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    normalizeModelText(text) {
      const value = String(text || '').trim();
      if (!value) return '';
      // Collapse accidental duplicated full responses that can happen when a
      // streaming proxy sends both deltas and a final full snapshot. Keep this
      // conservative: only remove exact repeated halves after trimming spacing.
      const compact = value.replace(/\s+/g, ' ').trim();
      const half = Math.floor(value.length / 2);
      if (value.length > 80) {
        for (let pad = -4; pad <= 4; pad++) {
          const cut = half + pad;
          if (cut <= 20 || cut >= value.length - 20) continue;
          const a = value.slice(0, cut).trim();
          const b = value.slice(cut).trim();
          if (a && b && a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ')) return a;
        }
      }
      const lines = value.split(/\r?\n/);
      if (lines.length >= 4 && lines.length % 2 === 0) {
        const left = lines.slice(0, lines.length / 2).join('\n').trim();
        const right = lines.slice(lines.length / 2).join('\n').trim();
        if (left && left.replace(/\s+/g, ' ') === right.replace(/\s+/g, ' ')) return left;
      }
      return value;
    },
    inlineMarkdown(text) {
      let out = this.html(text);
      out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      return out;
    },
    markdown(text) {
      const source = this.normalizeModelText(text);
      const blocks = [];
      let last = 0;
      const fence = /```([a-zA-Z0-9_+.-]*)\s*\n([\s\S]*?)```/g;
      let match;
      const renderText = (chunk) => {
        const rawBlocks = String(chunk || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
        return rawBlocks.map((block) => {
          const trimmed = block.trim();
          if (!trimmed) return '';
          const lines = trimmed.split('\n');
          if (/^#{1,3}\s+/.test(trimmed)) {
            const level = Math.min(3, (trimmed.match(/^#+/) || ['#'])[0].length);
            return `<h${level}>${this.inlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ''))}</h${level}>`;
          }
          if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
            return '<ul>' + lines.map((line) => `<li>${this.inlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
          }
          if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
            return '<ol>' + lines.map((line) => `<li>${this.inlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
          }
          return `<p>${lines.map((line) => this.inlineMarkdown(line)).join('<br>')}</p>`;
        }).join('');
      };
      while ((match = fence.exec(source))) {
        if (match.index > last) blocks.push(renderText(source.slice(last, match.index)));
        const lang = this.html(match[1] || 'text');
        const code = this.html(match[2] || '').replace(/\n$/, '');
        blocks.push(`<div class="ace-ai-md-code"><div class="ace-ai-md-code-head">${lang || 'code'}</div><pre><code>${code}</code></pre></div>`);
        last = fence.lastIndex;
      }
      if (last < source.length) blocks.push(renderText(source.slice(last)));
      return blocks.join('') || '';
    },
    baseUrl(value) {
      return String(value || C.DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
    },
    stripFence(text) {
      let value = String(text || '').trim();
      const fenced = value.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/);
      return fenced ? fenced[1].trim() : value;
    },
    truncate(text, max) {
      const value = String(text || '');
      if (!max || value.length <= max) return value;
      const keep = Math.max(800, Math.floor((max - 160) / 2));
      return value.slice(0, keep) + '\n\n/* ... Ace AI truncated long context ... */\n\n' + value.slice(-keep);
    },
    filenameFromPath(path) {
      const clean = String(path || '').replace(/[?#].*$/, '').replace(/\/$/, '');
      return clean.split('/').filter(Boolean).pop() || 'untitled';
    },
    lang(filename) {
      const ext = String(filename || '').split('.').pop().toLowerCase();
      const map = {
        js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact',
        ts: 'typescript', tsx: 'typescriptreact', html: 'html', htm: 'html', css: 'css', scss: 'scss',
        php: 'php', py: 'python', json: 'json', md: 'markdown', xml: 'xml', vue: 'vue', svelte: 'svelte',
        java: 'java', kt: 'kotlin', swift: 'swift', go: 'go', rs: 'rust', rb: 'ruby', dart: 'dart',
        c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', sh: 'bash', yml: 'yaml', yaml: 'yaml', sql: 'sql'
      };
      return map[ext] || ext || 'text';
    },
    nowLabel() {
      try { return new Date().toLocaleTimeString(); } catch (_) { return ''; }
    },
    isPatch(text) {
      const v = String(text || '');
      return /^---\s+/m.test(v) && /^\+\+\+\s+/m.test(v) && /^@@\s/m.test(v);
    },
    debounce(fn, wait) {
      let t = 0;
      return function () {
        clearTimeout(t);
        const args = arguments;
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    }
  };

  // ---- core/runtime.js ----
  const Runtime = {
    resetReviewState() {
      State.lastOriginal = '';
      State.lastResult = '';
      State.lastPatch = '';
      State.lastTarget = 'selection';
      State.lastSummary = '';
      State.lastResultKind = '';
    },
    clearAgentState() {
      State.pendingTools = [];
      State.lastToolJson = '';
      State.agentMessage = '';
      State.toolResults = [];
      State.agentPlan = '';
      State.selectedToolIds = [];
      State.reviewToolId = null;
      State.readToolResults = [];
      State.toolActivity = [];
      State.reviewNotice = '';
      State.showRunDetails = false;
      State.toolProgress = '';
    },
    clearTransientState() {
      this.resetReviewState();
      this.clearAgentState();
      State.lastError = null;
      State.draftPrompt = '';
      State.streamingContent = '';
      State.streamingMode = '';
      State.busy = false;
      State.retryStatus = '';
      State.toolActivity = [];
      State.toolProgress = '';
      State.lastUsage = null;
      State.lastRequest = null;
      State.applyDiagnostics = [];
      State.lastAppliedSummary = '';
      State.reviewNotice = '';
      State.showRunDetails = false;
      State.currentHistoryPrompt = '';
      State.activeTab = 'chat';
      try { localStorage.setItem(C.RUNTIME_KEY, JSON.stringify({ version: C.VERSION, resetAt: new Date().toISOString() })); } catch (_) {}
    },
    debugState() {
      const ctx = Editor.context();
      return JSON.stringify({
        version: C.VERSION,
        activeTab: State.activeTab,
        busy: State.busy,
        lastResultKind: State.lastResultKind,
        hasLastResult: Boolean(State.lastResult),
        hasLastPatch: Boolean(State.lastPatch),
        pendingTools: State.pendingTools.length,
        selectedTools: State.pendingTools.filter((t) => t.selected !== false && !t.error).length,
        undoBatches: State.undoStack.length,
        hasError: Boolean(State.lastError),
        responses: Store.responseState(),
        chatMessages: Store.chat().length,
        file: ctx.file,
        cursor: ctx.cursor,
        visibleRange: ctx.visibleRange,
        openFiles: ctx.openFiles,
        dirty: ctx.dirty,
        usage: State.lastUsage,
        readToolResults: State.readToolResults,
        toolActivity: State.toolActivity,
        hasSelection: ctx.hasSelection,
        selectionLines: ctx.selectionLines,
        textLines: ctx.textLines,
        timestamp: new Date().toISOString()
      }, null, 2);
    }
  };

  // ---- core/error-kit.js ----
  const ErrorKit = {
    create(input) {
      const err = new Error(input.message || input.title || 'Ace AI error');
      err.name = 'AceAIError';
      err.code = input.code || 'UNKNOWN';
      err.title = input.title || 'Ace AI Error';
      err.hint = input.hint || '';
      err.status = input.status || 0;
      err.details = input.details || '';
      err.raw = input.raw || null;
      err.cause = input.cause || null;
      err.time = new Date().toISOString();
      return err;
    },
    fromHttp(status, data, rawText) {
      const message =
        data?.error?.message ||
        data?.message ||
        data?.error ||
        String(rawText || '').slice(0, 600) ||
        ('HTTP ' + status);
      if (status === 400) return this.create({ code: 'BAD_REQUEST', status, title: 'Request tidak valid', message, hint: 'Cek model, base URL, max tokens, atau format request.' });
      if (status === 401) return this.create({ code: 'UNAUTHORIZED', status, title: 'API key ditolak', message, hint: 'Buka Settings dan pastikan NAI API Key benar, aktif, dan diawali format yang sesuai.' });
      if (status === 403) return this.create({ code: 'FORBIDDEN', status, title: 'Akses API ditolak', message, hint: 'Key mungkin tidak punya akses ke model/base URL ini. Coba model lain atau cek dashboard Neosantara.' });
      if (status === 404) return this.create({ code: 'NOT_FOUND', status, title: 'Endpoint tidak ditemukan', message, hint: 'Cek Base URL. Default yang benar: https://api.neosantara.xyz/v1' });
      if (status === 408) return this.create({ code: 'REQUEST_TIMEOUT', status, title: 'Request timeout', message, hint: 'Koneksi lambat atau server lama merespons. Coba Retry.' });
      if (status === 413) return this.create({ code: 'CONTEXT_TOO_LARGE', status, title: 'Context terlalu besar', message, hint: 'Matikan Include full file atau pilih kode yang lebih kecil.' });
      if (status === 429) return this.create({ code: 'RATE_LIMITED', status, title: 'Rate limit / kuota', message, hint: 'Tunggu sebentar lalu Retry, atau cek kuota API.' });
      if (status >= 500) return this.create({ code: 'SERVER_ERROR', status, title: 'Server API bermasalah', message, hint: 'Coba Retry. Kalau tetap gagal, copy error report dan cek status endpoint/proxy.' });
      return this.create({ code: 'HTTP_ERROR', status, title: 'API error', message, hint: 'Cek Settings, model, base URL, dan API key.' });
    },
    normalize(error) {
      if (error && error.name === 'AceAIError') return error;
      const msg = String(error?.message || error || '');
      if (error?.name === 'AbortError' || /aborted|timeout/i.test(msg)) {
        return this.create({ code: 'TIMEOUT', title: 'Request terlalu lama', message: 'Ace AI menghentikan request karena melewati batas waktu.', hint: 'Coba Retry. Kalau sering terjadi, turunkan max tokens atau matikan full file context.', cause: error });
      }
      if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) {
        return this.create({ code: 'NETWORK_OR_CORS', title: 'Tidak bisa menghubungi API', message: msg || 'Fetch gagal.', hint: 'Cek internet, Base URL, CORS WebView, atau pakai proxy backend Neosantara kamu.', cause: error });
      }
      if (/api key kosong|api key/i.test(msg)) {
        return this.create({ code: 'MISSING_API_KEY', title: 'API key belum diisi', message: msg, hint: 'Buka Settings Ace AI lalu isi NAI API Key.', cause: error });
      }
      return this.create({ code: 'UNKNOWN', title: 'Ace AI gagal', message: msg || 'Unknown error', hint: 'Coba ulang. Kalau tetap gagal, copy error report.', cause: error });
    },
    report(error) {
      const e = this.normalize(error || State.lastError);
      const ctx = Editor.context();
      const settings = Store.settings();
      return [
        'Ace AI Error Report',
        '===================',
        'Plugin version: ' + C.VERSION,
        'Time: ' + (e.time || new Date().toISOString()),
        'Code: ' + e.code,
        'Status: ' + (e.status || '-'),
        'Title: ' + e.title,
        'Message: ' + e.message,
        'Hint: ' + (e.hint || '-'),
        '',
        'Context',
        '-------',
        'File: ' + ctx.file.filename,
        'Language: ' + ctx.file.language,
        'Cursor: line ' + (ctx.cursor?.line || '-') + ', column ' + (ctx.cursor?.column || '-'),
        'Visible range: ' + (ctx.visibleRange ? (ctx.visibleRange.startLine + '-' + ctx.visibleRange.endLine) : '-'),
        'Open files: ' + ((ctx.openFiles || []).map((f) => f.filename).join(', ') || '-'),
        'Unsaved/dirty: ' + Boolean(ctx.dirty?.dirty),
        'Has selection: ' + ctx.hasSelection,
        'Selection lines: ' + ctx.selectionLines,
        'File lines: ' + ctx.textLines,
        '',
        'Settings',
        '--------',
        'Base URL: ' + settings.baseUrl,
        'Endpoint: /v1/responses only',
        'Responses last id: ' + (Store.responseState().lastResponseId || '-'),
        'Project Root: ' + (settings.projectRoot || '-'),
        'Model: ' + settings.model,
        'Max tokens: ' + settings.maxTokens,
        'Temperature: ' + settings.temperature,
        'Include full file: ' + settings.includeFullFile,
        'Last usage: ' + JSON.stringify(State.lastUsage || null),
        'API key set: ' + Boolean(settings.apiKey),
        '',
        'Last request',
        '------------',
        JSON.stringify(State.lastRequest || null, null, 2),
        '',
        'Details',
        '-------',
        String(e.details || e.stack || e.cause?.stack || '')
      ].join('\n');
    }
  };

  // ---- core/store.js ----
  const Store = {
    hasKey(key) {
      try { return localStorage.getItem(key) !== null; } catch (_) { return false; }
    },
    getJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
      } catch (_) { return fallback; }
    },
    setJson(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    },
    settings() {
      return Object.assign({}, Defaults, this.getJson(C.STORAGE_KEY, {}));
    },
    saveSettings(value) {
      const next = Object.assign({}, this.settings(), value || {});
      this.setJson(C.STORAGE_KEY, next);
      return next;
    },
    presets() {
      const items = this.getJson(C.PRESETS_KEY, null);
      return Array.isArray(items) && items.length ? items : DefaultPresets.slice();
    },
    savePresets(items) {
      const clean = (items || []).filter((x) => x && x.name && x.prompt).slice(0, 40);
      this.setJson(C.PRESETS_KEY, clean);
      return clean;
    },
    chat() {
      const hasCurrentChat = this.hasKey(C.CHAT_KEY);
      let items = this.getJson(C.CHAT_KEY, []);
      if (!hasCurrentChat && (!Array.isArray(items) || !items.length)) {
        const legacyKeys = [
          'ace-ai.chat.v8_7',
          'ace-ai.chat.v8_6',
          'ace-ai.chat.v8_5',
          'ace-ai.chat.v8_4',
          'ace-ai.chat.v8_3'
        ];
        for (const key of legacyKeys) {
          const legacy = this.getJson(key, []);
          if (Array.isArray(legacy) && legacy.length) { items = legacy; break; }
        }
      }
      return Array.isArray(items) ? items.slice(-C.MAX_CHAT_MESSAGES) : [];
    },
    saveChat(items) {
      const clean = [];
      (items || []).forEach((item) => {
        if (!item || !item.role) return;
        const next = Object.assign({}, item);
        if (next.role === 'assistant') next.content = Util.normalizeModelText(next.content || '');
        if (!String(next.content || '').trim()) return;
        const prev = clean[clean.length - 1];
        if (prev && prev.role === next.role && prev.role === 'assistant' && Util.normalizeModelText(prev.content || '') === Util.normalizeModelText(next.content || '')) return;
        clean.push(next);
      });
      this.setJson(C.CHAT_KEY, clean.slice(-C.MAX_CHAT_MESSAGES));
    },
    responseState() {
      return this.getJson(C.RESPONSE_KEY, { lastResponseId: '', mode: '', updatedAt: '' });
    },
    saveResponseState(value) {
      const next = Object.assign({}, this.responseState(), value || {}, { updatedAt: new Date().toISOString() });
      this.setJson(C.RESPONSE_KEY, next);
      return next;
    },
    clearResponseState() {
      try { localStorage.removeItem(C.RESPONSE_KEY); } catch (_) {}
    },
    clearChat() {
      // Keep an explicit empty array so New Chat does not resurrect migrated v8_3-v8_7 history.
      this.setJson(C.CHAT_KEY, []);
      this.clearResponseState();
    }
  };

  // ---- core/acode.js ----
  const Acode = {
    require(name) {
      try { return window.acode && window.acode.require ? window.acode.require(name) : null; } catch (_) { return null; }
    },
    toast(message, duration) {
      const text = String(message || '');
      try {
        const toast = this.require('toast');
        if (typeof toast === 'function') return toast(text, duration || 2500);
        if (window.toast) return window.toast(text, duration || 2500);
        if (window.acode && typeof window.acode.toast === 'function') return window.acode.toast(text);
      } catch (_) {}
      const el = document.createElement('div');
      el.className = 'ace-ai-toast';
      el.textContent = text;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), duration || 2400);
    },
    alert(title, message) {
      try {
        if (window.acode && typeof window.acode.alert === 'function') return window.acode.alert(title, message);
      } catch (_) {}
      alert((title ? title + '\n\n' : '') + String(message || ''));
    },
    copy(text) {
      const value = String(text || '');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value).then(() => this.toast('Copied'));
      } catch (_) {}
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); this.toast('Copied'); } catch (_) {}
      area.remove();
      return Promise.resolve();
    },
    pushBackAction() {
      try {
        const stack = this.require('actionStack');
        if (!stack || typeof stack.push !== 'function') return;
        if (typeof stack.has === 'function' && stack.has(C.PANEL_ACTION_ID)) return;
        stack.push({ id: C.PANEL_ACTION_ID, action: () => UI.closePanel() });
      } catch (_) {}
    },
    removeBackAction() {
      try {
        const stack = this.require('actionStack');
        if (stack && typeof stack.remove === 'function') stack.remove(C.PANEL_ACTION_ID);
      } catch (_) {}
    }
  };

  // ---- core/editor.js ----
  const Editor = {
    manager() {
      return window.editorManager || window.acode?.editorManager || null;
    },
    view() {
      const m = this.manager();
      return (m && m.editor) || window.editor || null;
    },
    activeFile() {
      const m = this.manager();
      return (m && (m.activeFile || m.active || m.file || m.currentFile || m.editorFile)) || null;
    },
    text() {
      const view = this.view();
      try {
        if (view && view.state && view.state.doc && typeof view.state.doc.toString === 'function') return view.state.doc.toString();
        if (view && typeof view.getValue === 'function') return view.getValue();
        if (view && view.session && typeof view.session.getValue === 'function') return view.session.getValue();
      } catch (_) {}
      return '';
    },
    normalizeRange(range) {
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
      const from = Math.min(range.from, range.to);
      const to = Math.max(range.from, range.to);
      return { from, to };
    },
    selectionRange() {
      const view = this.view();
      try {
        const sel = view?.state?.selection?.main;
        if (sel && Number.isFinite(sel.from) && Number.isFinite(sel.to)) return this.normalizeRange({ from: sel.from, to: sel.to });
      } catch (_) {}
      try {
        const range = view?.selection?.getRange?.();
        if (range && Number.isFinite(range.start?.row) && Number.isFinite(range.start?.column)) {
          const text = this.text();
          return this.normalizeRange({
            from: this.offsetFromLineColumn(text, range.start.row + 1, range.start.column + 1),
            to: this.offsetFromLineColumn(text, range.end.row + 1, range.end.column + 1)
          });
        }
      } catch (_) {}
      return null;
    },
    selectedText() {
      const view = this.view();
      const text = this.text();
      const range = this.selectionRange();
      if (range && range.from !== range.to) return text.slice(range.from, range.to);
      try { if (view && typeof view.getCopyText === 'function') return view.getCopyText() || ''; } catch (_) {}
      try { if (view && typeof view.getSelectedText === 'function') return view.getSelectedText() || ''; } catch (_) {}
      return '';
    },
    lineColumnFromOffset(text, offset) {
      const value = String(text || '');
      const safe = Math.max(0, Math.min(Number(offset || 0), value.length));
      let line = 1;
      let column = 1;
      for (let i = 0; i < safe; i++) {
        if (value.charCodeAt(i) === 10) { line++; column = 1; }
        else column++;
      }
      return { line, column, offset: safe };
    },
    offsetFromLineColumn(text, line, column) {
      const lines = String(text || '').split('\n');
      const targetLine = Math.max(1, Math.min(Number(line || 1), lines.length));
      let offset = 0;
      for (let i = 0; i < targetLine - 1; i++) offset += lines[i].length + 1;
      return offset + Math.max(0, Math.min(Number(column || 1) - 1, (lines[targetLine - 1] || '').length));
    },
    cursor() {
      const view = this.view();
      const text = this.text();
      try {
        const range = this.selectionRange();
        if (range) return this.lineColumnFromOffset(text, range.to);
      } catch (_) {}
      try {
        const cursor = view?.selection?.getCursor?.();
        if (cursor && Number.isFinite(cursor.row) && Number.isFinite(cursor.column)) {
          return { line: cursor.row + 1, column: cursor.column + 1, offset: this.offsetFromLineColumn(text, cursor.row + 1, cursor.column + 1) };
        }
      } catch (_) {}
      return { line: 1, column: 1, offset: 0 };
    },
    visibleRange() {
      const view = this.view();
      const text = this.text();
      const lines = Math.max(1, text.split('\n').length);
      try {
        const visible = view?.visibleRanges;
        if (visible && visible.length) {
          const start = this.lineColumnFromOffset(text, visible[0].from).line;
          const end = this.lineColumnFromOffset(text, visible[visible.length - 1].to).line;
          return { startLine: Math.max(1, start), endLine: Math.min(lines, end), source: 'codemirror-visibleRanges' };
        }
      } catch (_) {}
      try {
        const first = view?.renderer?.getFirstVisibleRow?.();
        const last = view?.renderer?.getLastVisibleRow?.();
        if (Number.isFinite(first) && Number.isFinite(last)) {
          return { startLine: Math.max(1, first + 1), endLine: Math.min(lines, last + 1), source: 'ace-renderer' };
        }
      } catch (_) {}
      const cursor = this.cursor();
      return { startLine: Math.max(1, cursor.line - 40), endLine: Math.min(lines, cursor.line + 40), source: 'cursor-fallback' };
    },
    numberedLines(text, startLine, endLine) {
      const lines = String(text || '').split('\n');
      const start = Math.max(1, Number(startLine || 1));
      const end = Math.min(lines.length, Math.max(start, Number(endLine || start)));
      const width = String(end).length;
      const out = [];
      for (let line = start; line <= end; line++) {
        out.push(String(line).padStart(width, ' ') + ' | ' + (lines[line - 1] || ''));
      }
      return out.join('\n');
    },
    contextWindow(radius) {
      const text = this.text();
      const total = Math.max(1, text.split('\n').length);
      const cursor = this.cursor();
      const startLine = Math.max(1, cursor.line - (radius || 35));
      const endLine = Math.min(total, cursor.line + (radius || 35));
      return { startLine, endLine, content: this.numberedLines(text, startLine, endLine) };
    },
    visibleContext(maxLines) {
      const text = this.text();
      const visible = this.visibleRange();
      const total = Math.max(1, text.split('\n').length);
      const limit = Math.max(10, Number(maxLines || 90));
      let startLine = visible.startLine;
      let endLine = visible.endLine;
      if (endLine - startLine + 1 > limit) endLine = Math.min(total, startLine + limit - 1);
      return { startLine, endLine, source: visible.source, content: this.numberedLines(text, startLine, endLine) };
    },
    normalizeFile(raw, fallbackIndex) {
      if (!raw) return null;
      try {
        const file = raw.file || raw.editorFile || raw;
        const uri = String(file.uri || file.url || file.path || file.location || file.filename || file.name || '').trim();
        const filename = String(file.filename || file.name || file.title || (uri ? Util.filenameFromPath(uri) : ('tab-' + fallbackIndex))).trim();
        const dirty = Boolean(file.dirty || file.isDirty || file.changed || file.modified || file.isUnsaved || file.unsaved || file.saved === false);
        return filename ? { filename, uri, language: Util.lang(filename), dirty } : null;
      } catch (_) { return null; }
    },
    openFiles() {
      const m = this.manager();
      const out = [];
      const add = (item) => {
        const normalized = this.normalizeFile(item, out.length + 1);
        if (!normalized) return;
        const key = normalized.uri || normalized.filename;
        if (!out.some((x) => (x.uri || x.filename) === key)) out.push(normalized);
      };
      try {
        const candidates = [m?.files, m?.openFiles, m?.tabs, m?.editors, m?.editorFiles, window.acode?.files];
        candidates.forEach((list) => {
          if (Array.isArray(list)) list.forEach(add);
          else if (list && typeof list === 'object') Object.keys(list).forEach((key) => add(list[key]));
        });
      } catch (_) {}
      const active = this.normalizeFile(this.activeFile(), 0) || this.info();
      if (active && active.filename && !out.some((x) => (x.uri || x.filename) === (active.uri || active.filename))) out.unshift(active);
      return out.slice(0, 12);
    },
    dirtyState() {
      const file = this.activeFile();
      const view = this.view();
      try {
        if (file && (file.dirty || file.isDirty || file.changed || file.modified || file.isUnsaved || file.unsaved || file.saved === false)) return { dirty: true, source: 'file' };
        if (view?.session?.getUndoManager && typeof view.session.getUndoManager().isClean === 'function') return { dirty: !view.session.getUndoManager().isClean(), source: 'undo-manager' };
      } catch (_) {}
      return { dirty: false, source: 'unknown' };
    },
    info() {
      const file = this.activeFile();
      const view = this.view();
      let filename = 'untitled';
      let uri = '';
      let location = '';
      let mode = '';
      try {
        filename = String((file && (file.filename || file.name || file.title)) || (view?.session?.name) || 'untitled');
        location = String((file && file.location) || '');
        uri = String((file && (file.uri || file.url || file.path)) || location || '');
        if (filename === 'untitled' && uri) filename = Util.filenameFromPath(uri);
        mode = String((file && (file.mode || file.syntax)) || view?.state?.facet?.languageData || view?.session?.getMode?.().$id || Util.lang(filename));
      } catch (_) {}
      return { filename, uri, location, language: Util.lang(filename) || mode };
    },
    rememberRecentFile(info) {
      try {
        const file = info || this.info();
        if (!file || !file.filename) return;
        State.recentFiles = State.recentFiles || [];
        const key = file.uri || file.filename;
        State.recentFiles = State.recentFiles.filter((item) => (item.uri || item.filename) !== key);
        State.recentFiles.unshift({ filename: file.filename, uri: file.uri || file.location || '', language: file.language || Util.lang(file.filename), time: new Date().toISOString() });
        State.recentFiles = State.recentFiles.slice(0, 10);
      } catch (_) {}
    },
    context() {
      const fullText = this.text();
      const selection = this.selectedText();
      const info = this.info();
      const cursor = this.cursor();
      const visibleRange = this.visibleRange();
      const cursorContext = this.contextWindow(35);
      const visibleContext = this.visibleContext(90);
      const openFiles = this.openFiles();
      const dirty = this.dirtyState();
      this.rememberRecentFile(info);
      return {
        file: info,
        text: fullText,
        selection,
        hasSelection: Boolean(selection),
        selectionLines: selection ? selection.split('\n').length : 0,
        textLines: fullText ? fullText.split('\n').length : 0,
        cursor,
        visibleRange,
        selectionRange: this.selectionRange(),
        cursorContext,
        visibleContext,
        openFiles,
        dirty,
        recentFiles: (State.recentFiles || []).slice(0, 8)
      };
    },
    replaceRange(range, insert) {
      const normalized = this.normalizeRange(range);
      const text = this.text();
      if (!normalized) return false;
      const from = Math.max(0, Math.min(normalized.from, text.length));
      const to = Math.max(from, Math.min(normalized.to, text.length));
      return this.replaceAll(text.slice(0, from) + String(insert || '') + text.slice(to));
    },
    replaceSelection(insert) {
      const view = this.view();
      const text = String(insert || '');
      const range = this.selectionRange();
      try {
        if (view && range && typeof view.dispatch === 'function') {
          view.dispatch({ changes: { from: range.from, to: range.to, insert: text } });
          this.rememberRecentFile();
          return true;
        }
        if (view && typeof view.insert === 'function') {
          view.insert(text);
          this.rememberRecentFile();
          return true;
        }
        if (view && view.session && typeof view.session.replace === 'function' && view.selection?.getRange) {
          view.session.replace(view.selection.getRange(), text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) {
        Acode.toast('Replace failed: ' + error.message);
      }
      return false;
    },
    insertAtCursor(insert) {
      const view = this.view();
      const text = String(insert || '');
      try {
        const range = this.selectionRange();
        if (view && range && typeof view.dispatch === 'function') {
          view.dispatch({ changes: { from: range.to, to: range.to, insert: text } });
          this.rememberRecentFile();
          return true;
        }
        if (view && typeof view.insert === 'function') {
          view.insert(text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) { Acode.toast('Insert failed: ' + error.message); }
      return false;
    },
    replaceAll(insert) {
      const view = this.view();
      const text = String(insert || '');
      try {
        if (view && view.state && view.state.doc && typeof view.dispatch === 'function') {
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
          this.rememberRecentFile();
          return true;
        }
        if (view && typeof view.setValue === 'function') {
          view.setValue(text, -1);
          this.rememberRecentFile();
          return true;
        }
        if (view && view.session && typeof view.session.setValue === 'function') {
          view.session.setValue(text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) { Acode.toast('Apply failed: ' + error.message); }
      return false;
    },
    focus() {
      try { this.view()?.focus?.(); } catch (_) {}
    },
    onChange(fn) {
      const m = this.manager();
      if (!m || typeof m.on !== 'function') return;
      ['switch-file', 'file-loaded', 'save-file', 'file-content-changed', 'rename-file', 'change', 'changeSelection'].forEach((event) => {
        try {
          m.on(event, fn);
          State.editorListeners.push([event, fn]);
        } catch (_) {}
      });
    },
    removeListeners() {
      const m = this.manager();
      if (!m || typeof m.off !== 'function') return;
      State.editorListeners.forEach(([event, fn]) => { try { m.off(event, fn); } catch (_) {} });
      State.editorListeners = [];
    }
  };

  // ---- core/patch.js ----
  const Patch = {
    clean(raw) {
      let text = Util.stripFence(raw || '');
      const idx = text.indexOf('--- ');
      if (idx > 0) text = text.slice(idx);
      return text.trim();
    },
    splitLines(text) {
      return String(text || '').split('\n');
    },
    canUseLcs(a, b) {
      const cells = (a.length + 1) * (b.length + 1);
      return cells <= 1600000;
    },
    lcsRows(a, b, oldOffset, newOffset) {
      const rows = [];
      if (!a.length && !b.length) return rows;
      if (!a.length) {
        for (let j = 0; j < b.length; j++) rows.push({ type: 'add', text: b[j], oldLine: 0, newLine: newOffset + j + 1 });
        return rows;
      }
      if (!b.length) {
        for (let i = 0; i < a.length; i++) rows.push({ type: 'del', text: a[i], oldLine: oldOffset + i + 1, newLine: 0 });
        return rows;
      }
      if (!this.canUseLcs(a, b)) {
        for (let i = 0; i < a.length; i++) rows.push({ type: 'del', text: a[i], oldLine: oldOffset + i + 1, newLine: 0 });
        for (let j = 0; j < b.length; j++) rows.push({ type: 'add', text: b[j], oldLine: 0, newLine: newOffset + j + 1 });
        return rows;
      }
      const n = a.length;
      const m = b.length;
      const width = m + 1;
      const dp = new Uint32Array((n + 1) * (m + 1));
      for (let i = n - 1; i >= 0; i--) {
        const row = i * width;
        const next = (i + 1) * width;
        for (let j = m - 1; j >= 0; j--) {
          dp[row + j] = a[i] === b[j] ? dp[next + j + 1] + 1 : Math.max(dp[next + j], dp[row + j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) {
          rows.push({ type: 'same', text: a[i], oldLine: oldOffset + i + 1, newLine: newOffset + j + 1 });
          i++;
          j++;
        } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
          rows.push({ type: 'del', text: a[i], oldLine: oldOffset + i + 1, newLine: 0 });
          i++;
        } else {
          rows.push({ type: 'add', text: b[j], oldLine: 0, newLine: newOffset + j + 1 });
          j++;
        }
      }
      while (i < n) rows.push({ type: 'del', text: a[i], oldLine: oldOffset + i++ + 1, newLine: 0 });
      while (j < m) rows.push({ type: 'add', text: b[j], oldLine: 0, newLine: newOffset + j++ + 1 });
      return rows;
    },
    lineDiff(oldText, newText) {
      const oldLines = this.splitLines(oldText);
      const newLines = this.splitLines(newText);
      let prefix = 0;
      while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
      let oldEnd = oldLines.length - 1;
      let newEnd = newLines.length - 1;
      while (oldEnd >= prefix && newEnd >= prefix && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
      }
      const rows = [];
      for (let i = 0; i < prefix; i++) rows.push({ type: 'same', text: oldLines[i], oldLine: i + 1, newLine: i + 1 });
      const midOld = oldLines.slice(prefix, oldEnd + 1);
      const midNew = newLines.slice(prefix, newEnd + 1);
      rows.push(...this.lcsRows(midOld, midNew, prefix, prefix));
      const suffixOldStart = oldEnd + 1;
      const suffixNewStart = newEnd + 1;
      const suffixCount = oldLines.length - suffixOldStart;
      for (let k = 0; k < suffixCount; k++) {
        rows.push({ type: 'same', text: oldLines[suffixOldStart + k], oldLine: suffixOldStart + k + 1, newLine: suffixNewStart + k + 1 });
      }
      return rows;
    },
    simpleDiff(oldText, newText) {
      const rows = this.lineDiff(oldText, newText);
      this.buildHunks(rows, { toolId: 'preview' });
      return rows;
    },
    buildHunks(rows, options) {
      const list = Array.isArray(rows) ? rows : [];
      const context = Math.max(0, Math.min(Number(options?.context ?? 3), 8));
      const toolId = String(options?.toolId || 'tool');
      const changes = [];
      for (let i = 0; i < list.length; i++) if (list[i].type !== 'same') changes.push(i);
      const hunks = [];
      let cursor = 0;
      while (cursor < changes.length) {
        let start = changes[cursor];
        let end = changes[cursor];
        cursor++;
        while (cursor < changes.length && changes[cursor] - end <= Math.max(1, context)) {
          end = changes[cursor];
          cursor++;
        }
        const id = toolId + ':h' + (hunks.length + 1);
        for (let i = start; i <= end; i++) list[i].hunkId = id;
        const bodyRows = list.slice(start, end + 1);
        const oldStart = bodyRows.find((r) => r.oldLine)?.oldLine || 0;
        const newStart = bodyRows.find((r) => r.newLine)?.newLine || 0;
        const added = bodyRows.filter((r) => r.type === 'add').length;
        const removed = bodyRows.filter((r) => r.type === 'del').length;
        const displayStart = Math.max(0, start - context);
        const displayEnd = Math.min(list.length - 1, end + context);
        hunks.push({
          id,
          index: hunks.length + 1,
          selected: true,
          oldStart,
          newStart,
          added,
          removed,
          startIndex: start,
          endIndex: end,
          rows: list.slice(displayStart, displayEnd + 1)
        });
      }
      return hunks;
    },
    withHunks(oldText, newText, options) {
      const rows = this.lineDiff(oldText, newText);
      const hunks = this.buildHunks(rows, options || {});
      return { oldText: String(oldText || ''), newText: String(newText || ''), rows, hunks };
    },
    hunkMap(preview) {
      const map = {};
      (preview?.hunks || []).forEach((h) => { map[String(h.id)] = h; });
      return map;
    },
    selectedHunkCount(preview) {
      const hunks = preview?.hunks || [];
      return hunks.filter((h) => h.selected !== false).length;
    },
    hasSelectedHunks(preview) {
      const hunks = preview?.hunks || [];
      return !hunks.length || hunks.some((h) => h.selected !== false);
    },
    applySelectedHunks(preview) {
      if (!preview || !Array.isArray(preview.rows) || !preview.rows.length) return String(preview?.newText || '');
      const hunks = preview.hunks || [];
      if (!hunks.length) return String(preview.newText || '');
      const byId = this.hunkMap(preview);
      const out = [];
      const rows = preview.rows;
      let i = 0;
      while (i < rows.length) {
        const row = rows[i];
        if (!row.hunkId) {
          if (row.type !== 'add') out.push(row.text || '');
          i++;
          continue;
        }
        const hunkId = String(row.hunkId);
        const selected = byId[hunkId]?.selected !== false;
        const group = [];
        while (i < rows.length && String(rows[i].hunkId || '') === hunkId) group.push(rows[i++]);
        group.forEach((r) => {
          if (selected) {
            if (r.type !== 'del') out.push(r.text || '');
          } else if (r.type !== 'add') {
            out.push(r.text || '');
          }
        });
      }
      return out.join('\n');
    },
    parseUnified(patchText) {
      const lines = this.clean(patchText).split(/\r?\n/);
      const hunks = [];
      let hunk = null;
      for (const line of lines) {
        const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (m) {
          hunk = { oldStart: Number(m[1]), oldCount: Number(m[2] || 1), newStart: Number(m[3]), newCount: Number(m[4] || 1), lines: [] };
          hunks.push(hunk);
          continue;
        }
        if (!hunk) continue;
        if (/^[ +\-]/.test(line) || line === '\\ No newline at end of file') hunk.lines.push(line);
      }
      return hunks;
    },
    applyUnified(oldText, patchText) {
      const oldLines = String(oldText || '').split('\n');
      const hunks = this.parseUnified(patchText);
      if (!hunks.length) throw new Error('No unified diff hunks found');
      const out = [];
      let oldIndex = 0;
      for (const h of hunks) {
        const start = Math.max(0, h.oldStart - 1);
        while (oldIndex < start) out.push(oldLines[oldIndex++]);
        for (const line of h.lines) {
          if (line === '\\ No newline at end of file') continue;
          const sign = line[0];
          const body = line.slice(1);
          if (sign === ' ') {
            out.push(oldLines[oldIndex] !== undefined ? oldLines[oldIndex] : body);
            oldIndex++;
          } else if (sign === '-') {
            oldIndex++;
          } else if (sign === '+') {
            out.push(body);
          }
        }
      }
      while (oldIndex < oldLines.length) out.push(oldLines[oldIndex++]);
      return out.join('\n');
    },
    previewPatch(patchText) {
      const text = this.clean(patchText || '');
      if (!text) return [];
      const rows = [];
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (/^(---|\+\+\+|@@)/.test(line)) {
          rows.push({ type: 'same', text: line });
        } else if (line.startsWith('+')) {
          rows.push({ type: 'add', text: line.slice(1) });
        } else if (line.startsWith('-')) {
          rows.push({ type: 'del', text: line.slice(1) });
        } else {
          rows.push({ type: 'same', text: line.startsWith(' ') ? line.slice(1) : line });
        }
      }
      return rows;
    },
    render(rows) {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return '<div class="ace-ai-empty">No diff yet.</div>';
      return list.slice(0, 1400).map((r) => '<div class="ace-ai-diff-line ace-ai-' + r.type + '"><span>' + (r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' ') + '</span><code>' + Util.html(r.text || '') + '</code></div>').join('');
    },
    renderHunks(hunks, toolId) {
      const list = Array.isArray(hunks) ? hunks : [];
      if (!list.length) return '';
      return '<div class="ace-ai-hunks">' + list.map((h) => {
        const selected = h.selected !== false;
        const status = selected ? 'accepted' : 'rejected';
        const counts = '+' + (h.added || 0) + ' −' + (h.removed || 0);
        return `<div class="ace-ai-hunk ${selected ? '' : 'rejected'}" data-hunk-card="${Util.html(h.id)}"><div class="ace-ai-hunk-head"><div><b>Hunk ${Util.html(h.index || '')}</b><span class="ace-ai-hunk-state">${Util.html(status)} · ${Util.html(counts)} · old ${Util.html(h.oldStart || '-')} / new ${Util.html(h.newStart || '-')}</span></div><div class="ace-ai-row nowrap ace-ai-hunk-actions"><button class="ace-ai-btn" data-act="accept-hunk" data-tool-id="${Util.html(toolId || '')}" data-hunk-id="${Util.html(h.id)}" ${selected ? 'disabled' : ''}>Accept hunk</button><button class="ace-ai-btn ace-ai-danger" data-act="reject-hunk" data-tool-id="${Util.html(toolId || '')}" data-hunk-id="${Util.html(h.id)}" ${selected ? '' : 'disabled'}>Reject hunk</button></div></div><div class="ace-ai-tool-diff">${this.render(h.rows || [])}</div></div>`;
      }).join('') + '</div>';
    }
  };

  // ---- core/prompt.js ----
  const Prompt = {
    extractFileMentions(text) {
      const value = String(text || '');
      const matches = value.match(/(^|\s)@([A-Za-z0-9_./\\:-]+\.[A-Za-z0-9_+-]+)/g) || [];
      return matches.map((m) => m.trim().replace(/^@/, '').replace(/^\s*@/, '')).filter(Boolean).slice(0, 12);
    },
    listLines(items, mapper) {
      return (items || []).map(mapper).filter(Boolean).join('\n');
    },
    contextHeader(ctx, instruction) {
      const dirty = ctx.dirty?.dirty ? 'dirty/unsaved' : 'saved or unknown';
      const visible = ctx.visibleRange ? `lines ${ctx.visibleRange.startLine}-${ctx.visibleRange.endLine}` : 'unknown';
      const cursor = ctx.cursor ? `line ${ctx.cursor.line}, column ${ctx.cursor.column}` : 'unknown';
      const open = this.listLines(ctx.openFiles, (f, i) => `- ${i + 1}. ${f.filename}${f.dirty ? ' (dirty)' : ''}${f.uri ? ' — ' + f.uri : ''}`);
      const recent = this.listLines(ctx.recentFiles, (f, i) => `- ${i + 1}. ${f.filename}${f.uri ? ' — ' + f.uri : ''}`);
      const mentions = this.extractFileMentions(instruction);
      return [
        `Active file: ${ctx.file.filename}`,
        `Active path/uri: ${ctx.file.uri || ctx.file.location || '(unknown)'}`,
        `Language: ${ctx.file.language}`,
        `Cursor: ${cursor}`,
        `Visible range: ${visible}`,
        `Unsaved state: ${dirty}`,
        `Target: ${ctx.hasSelection ? 'selected code' : 'cursor/visible context'}`,
        open ? `Open files/tabs:\n${open}` : 'Open files/tabs: active file only or unavailable',
        recent ? `Recently touched files:\n${recent}` : 'Recently touched files: unavailable',
        mentions.length ? `@file mentions detected: ${mentions.join(', ')}` : ''
      ].filter(Boolean).join('\n');
    },
    shouldAllowTools(kind, instruction, outputMode, ctx) {
      if (!(kind === 'agent' || outputMode === 'tools')) return false;
      // V8 appends internal permission policy after the user's prompt. Tool
      // gating must inspect only the human prompt; otherwise words like
      // write/edit/file in the policy accidentally enable tools for casual
      // questions such as “what can you do?”.
      const userInstruction = String(instruction || '').split(/\n\s*Permission:/i)[0];
      const text = userInstruction.toLowerCase();
      if (!text.trim()) return false;
      if (/@codebase|@[a-z0-9_./\:-]+\.[a-z0-9_+-]+/i.test(userInstruction || '')) return true;
      if (/\b(fix|repair|bug|implement|create|write|add|modify|change|update|replace|refactor|generate|tests?|unit test|make|build|convert|rewrite|insert|append|patch)\b/i.test(text)) return true;
      if (/\b(search|find|read|list|inspect|open|look through|codebase|project)\b/i.test(text)) return true;
      // Common casual/capability questions should stay plain text. Without this
      // gate, small models often call read_file even for “what can you do?”.
      return false;
    },
    messages(kind, instruction, outputMode) {
      const settings = Store.settings();
      const ctx = Editor.context();
      const selection = Util.truncate(ctx.selection, C.MAX_SELECTION);
      // Avoid duplicated context on mobile: when code is selected, send the selection as the primary target.
      // Full-file context can make the model propose whole-file rewrites instead of a focused selection edit.
      const fullFile = settings.includeFullFile && !ctx.hasSelection ? Util.truncate(ctx.text, C.MAX_FULL_FILE) : '';
      const cursorContext = Util.truncate(ctx.cursorContext?.content || '', C.MAX_CONTEXT_WINDOW);
      const visibleContext = Util.truncate(ctx.visibleContext?.content || '', C.MAX_CONTEXT_WINDOW);
      const mentions = this.extractFileMentions(instruction);
      let system = settings.systemPrompt || Defaults.systemPrompt;
      if (kind === 'edit' || kind === 'patch') {
        system += ' For code edits, return exactly the requested output format. Do not wrap in markdown unless asked.';
      }
      const targetText = ctx.hasSelection ? 'selected code' : (settings.includeFullFile ? 'active file' : 'cursor and visible editor context');
      let user = '';
      user += `Mode: ${kind}\n`;
      user += `Output mode: ${outputMode}\n`;
      user += this.contextHeader(ctx, instruction) + '\n';
      user += `Target: ${targetText}\n\n`;
      user += `User instruction:\n${instruction || '(no instruction)'}\n\n`;
      if (mentions.length) {
        user += 'The user referenced files with @file syntax. Use read_file for those paths before making assumptions if the contents are not already in context.\n\n';
      }
      if (selection) user += `Selected code/error:\n\`\`\`${ctx.file.language}\n${selection}\n\`\`\`\n\n`;
      if (!selection && cursorContext) user += `Context around cursor (${ctx.cursorContext.startLine}-${ctx.cursorContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${cursorContext}\n\`\`\`\n\n`;
      if (!selection && visibleContext && visibleContext !== cursorContext) user += `Visible editor range (${ctx.visibleContext.startLine}-${ctx.visibleContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${visibleContext}\n\`\`\`\n\n`;
      if (fullFile) user += `Full active file context:\n\`\`\`${ctx.file.language}\n${fullFile}\n\`\`\`\n\n`;
      if (kind === 'agent' || outputMode === 'tools') {
        // Native tools are injected into the /v1/responses payload by client.js.
        // Only add a brief reminder so the model knows it should use them.
        user += [
          'You are in Ace AI Agent mode. You can answer normally in plain text, or use tools when needed.',
          'Available read tools: read_file, list_files, search_in_files. Use them only when file/codebase inspection is actually needed: @file/@codebase references, imports/routes/components, project-wide behavior, or edits to files not already in context. Do not call tools for greetings, capability questions, or normal explanations that can be answered from the visible context. If a read_file/list_files/search_in_files result returns ok:false, treat it as recoverable observation: do not hallucinate the missing file, try another search/list if useful, or ask for the correct path.',
          'Available write tools: replace_selection, insert_at_cursor, replace_file, create_file, write_file, append_file.',
          'Rules:',
          '- The user must approve every write tool call before it is applied. Never claim write changes are already done.',
          '- Read tools are safe, but only use them when inspection is needed. Do not inspect files for greetings, “what can you do?”, or plain conversational answers.',
          '- If selected code exists, treat it as the default edit target. Prefer replace_selection. Do not use replace_file/write_file for the active filename unless the user explicitly asks for the whole/full/entire file rewrite.',
          '- Prefer minimal diffs. Do not rewrite unrelated code.',
          '- Use create_file only for brand-new files. Use write_file/replace_file with complete content. If Project Root is unknown and you are editing the current tab, leave replace_file.path empty or use replace_selection. Do not invent a relative path for the active unsaved tab.',
          '- For discussion, capability questions, greetings, explanations, debugging, or planning with no file change needed, reply in plain text without any tool calls.',
          '- For multi-file tasks, emit one tool call per file/action.'
        ].join('\n');
      } else if (kind === 'patch' || outputMode === 'patch') {
        user += [
          'Return only a unified diff patch against the active file.',
          `Use headers: --- a/${ctx.file.filename} and +++ b/${ctx.file.filename}.`,
          'No markdown fences. No explanation outside the patch.'
        ].join('\n');
      } else if (outputMode === 'replacement') {
        user += 'Return only replacement code/text. No markdown fences. No explanation.';
      } else if (outputMode === 'snippet') {
        user += 'Return paste-ready code/snippet. Prefer concise comments only when helpful.';
      } else {
        user += 'Answer clearly. Include code blocks only when useful.';
      }
      const messages = [{ role: 'system', content: system }];
      let history = Store.chat().filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content);
      const currentHistoryPrompt = String(State.currentHistoryPrompt || instruction || '').trim();
      if (history.length && history[history.length - 1].role === 'user' && String(history[history.length - 1].content || '').trim() === currentHistoryPrompt) {
        history = history.slice(0, -1);
      }
      history.slice(-24).forEach((m) => {
        messages.push({ role: m.role, content: String(m.content || '') });
      });
      messages.push({ role: 'user', content: user });
      return { messages, ctx, settings, allowTools: this.shouldAllowTools(kind, instruction, outputMode, ctx) };
    }
  };

  // ---- core/client.js ----
  const Client = {
    parseSseRecord(record) {
      const lines = String(record || '').split(/\r?\n/);
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || '';
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim();
      return { event, data };
    },
    deltaFromChunk(json) {
      if (!json) return '';
      const choice = json.choices && json.choices[0];
      if (!choice) return json.output_text || json.text || '';
      const delta = choice.delta || {};
      if (typeof delta.content === 'string') return delta.content;
      if (Array.isArray(delta.content)) {
        return delta.content.map((part) => part?.text || part?.content || '').join('');
      }
      if (typeof choice.text === 'string') return choice.text;
      if (typeof choice.message?.content === 'string') return choice.message.content;
      return '';
    },
    ensureNativeCall(nativeCallState, index) {
      if (!nativeCallState) return null;
      const idx = Number.isFinite(Number(index)) ? Number(index) : nativeCallState.calls.length;
      if (!nativeCallState.calls[idx]) nativeCallState.calls[idx] = { name: '', arguments: '', id: '', call_id: '', output_index: idx };
      return nativeCallState.calls[idx];
    },
    responseDeltaFromChunk(json, nativeCallState) {
      if (!json) return '';
      if (json.error) throw ErrorKit.fromHttp(500, json, JSON.stringify(json));

      if (json.type === 'response.output_item.added' && json.item && nativeCallState) {
        const item = json.item;
        if (item.type === 'function_call') {
          const idx = item.index != null ? item.index : (json.output_index != null ? json.output_index : nativeCallState.calls.length);
          const call = this.ensureNativeCall(nativeCallState, idx);
          call.name = item.name || call.name || '';
          call.arguments = item.arguments || call.arguments || '';
          call.id = item.id || call.id || '';
          call.call_id = item.call_id || item.callId || call.call_id || call.id || '';
          State.toolProgress = 'Model requested tool: ' + (call.name || 'function_call');
        }
      }
      if (json.type === 'response.function_call_arguments.delta' && nativeCallState) {
        const idx = json.output_index != null ? json.output_index : json.item_index;
        const call = this.ensureNativeCall(nativeCallState, idx);
        call.arguments += String(json.delta || '');
        if (json.call_id) call.call_id = json.call_id;
        if (json.name) call.name = json.name;
      }
      if (json.type === 'response.function_call_arguments.done' && nativeCallState) {
        const idx = json.output_index != null ? json.output_index : json.item_index;
        const call = this.ensureNativeCall(nativeCallState, idx);
        if (json.arguments) call.arguments = json.arguments;
        if (json.name) call.name = json.name;
        if (json.call_id) call.call_id = json.call_id;
      }
      if (json.type === 'response.output_item.done' && json.item && nativeCallState) {
        const item = json.item;
        if (item.type === 'function_call') {
          const idx = item.index != null ? item.index : (json.output_index != null ? json.output_index : nativeCallState.calls.length);
          const call = this.ensureNativeCall(nativeCallState, idx);
          if (item.name) call.name = item.name;
          if (item.arguments) call.arguments = item.arguments;
          if (item.id) call.id = item.id;
          if (item.call_id || item.callId) call.call_id = item.call_id || item.callId;
          State.toolProgress = 'Tool call ready: ' + (call.name || 'function_call');
        }
      }

      if (json.usage || json.response?.usage) State.lastUsage = json.usage || json.response.usage;
      if (json.type === 'response.completed' && json.response?.usage) State.lastUsage = json.response.usage;

      if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') return json.delta;
      if (json.type === 'response.refusal.delta' && typeof json.delta === 'string') return json.delta;
      // For typed Responses SSE events, only delta events should append text.
      // `response.completed` may contain a full snapshot and must not be appended.
      if (json.type) return '';
      // Untyped proxy chunks may still use snapshot fields. The append layer below
      // treats cumulative snapshots as replacements/deduped content.
      if (typeof json.output_text === 'string') return json.output_text;
      if (typeof json.text === 'string') return json.text;
      if (Array.isArray(json.output)) {
        return json.output.map((item) => {
          if (typeof item.content === 'string') return item.content;
          if (Array.isArray(item.content)) {
            return item.content.map((part) => part.text || part.content || '').join('');
          }
          return '';
        }).join('');
      }
      return '';
    },
    latestUserInput(messages) {
      const last = (messages || []).slice().reverse().find((m) => m.role === 'user');
      return String(last?.content || '').trim();
    },
    transcriptInput(messages, usePrevious) {
      const filtered = (messages || []).filter((m) => m.role !== 'system');
      if (usePrevious) return this.latestUserInput(filtered);
      return filtered.map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}:\n${m.content}`).join('\n\n');
    },
    async fetchWithTimeout(url, payload, settings, accept, signal) {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: accept || 'text/event-stream',
          Authorization: 'Bearer ' + settings.apiKey
        },
        body: JSON.stringify(payload),
        signal
      });
    },
    retryable(error) {
      const e = ErrorKit.normalize(error);
      if (e.code === 'TIMEOUT') return false;
      if (e.status === 408 || e.status === 429 || e.status >= 500) return true;
      return /NETWORK_OR_CORS|SERVER_ERROR|RATE_LIMITED|REQUEST_TIMEOUT/i.test(e.code || '');
    },
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async requestWithRetry(fn, onDelta) {
      const max = Math.max(0, Number(C.REQUEST_RETRY_COUNT || 0));
      let last = null;
      for (let attempt = 0; attempt <= max; attempt++) {
        try {
          State.retryStatus = attempt ? ('Retry attempt ' + attempt + '…') : '';
          if (attempt && typeof onDelta === 'function') onDelta('', State.streamingContent || '', null);
          const result = await fn(attempt);
          State.retryStatus = '';
          return result;
        } catch (error) {
          last = ErrorKit.normalize(error);
          if (attempt >= max || !this.retryable(last)) {
            State.retryStatus = '';
            throw last;
          }
          const wait = Math.min(8000, Number(C.REQUEST_RETRY_BASE_MS || 750) * Math.pow(2, attempt));
          State.retryStatus = 'Retrying after ' + last.code + ' in ' + Math.round(wait / 100) / 10 + 's…';
          if (typeof onDelta === 'function') onDelta('', State.streamingContent || '', null);
          await this.sleep(wait);
        }
      }
      throw last;
    },
    appendStreamText(current, incoming) {
      const content = String(current || '');
      const delta = String(incoming || '');
      if (!delta) return { content, changed: false, delta: '' };
      // Some Responses-compatible proxies emit cumulative snapshots (`output_text`)
      // in addition to delta events. Treat a full snapshot as replacement, not as
      // another delta, otherwise the final assistant card shows duplicated text.
      if (content && delta === content) return { content, changed: false, delta: '' };
      if (content && delta.startsWith(content)) {
        return { content: delta, changed: delta !== content, delta: delta.slice(content.length) };
      }
      if (content && content.endsWith(delta)) return { content, changed: false, delta: '' };
      const maxOverlap = Math.min(content.length, delta.length, 4000);
      for (let size = maxOverlap; size > 20; size--) {
        if (content.slice(-size) === delta.slice(0, size)) {
          const extra = delta.slice(size);
          return { content: content + extra, changed: Boolean(extra), delta: extra };
        }
      }
      return { content: content + delta, changed: true, delta };
    },
    async readSse(res, built, onDelta, mode, nativeCallState) {
      if (!res.ok) {
        let raw = '';
        try { raw = await res.text(); } catch (_) {}
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
        throw ErrorKit.fromHttp(res.status, data, raw);
      }
      if (!res.body || typeof res.body.getReader !== 'function') {
        throw ErrorKit.create({
          code: 'STREAM_UNSUPPORTED',
          title: 'Streaming tidak didukung WebView ini',
          message: 'Response.body.getReader() tidak tersedia, jadi Ace AI tidak bisa membaca streaming SSE.',
          hint: 'Update Android System WebView/Acode, atau gunakan proxy yang mengubah stream menjadi event yang didukung WebView.'
        });
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let content = '';
      let doneSignal = false;
      let responseId = '';
      let usage = null;
      const handleJson = (json) => {
        if (!json) return;
        const id = json.id || json.response?.id || json.item?.id;
        if (id && String(id).startsWith('resp')) responseId = String(id);
        if (json.type === 'response.completed' && json.response?.id) responseId = String(json.response.id);
        if (json.usage || json.response?.usage) usage = json.usage || json.response.usage;
        const delta = mode === 'responses' ? this.responseDeltaFromChunk(json, nativeCallState) : this.deltaFromChunk(json);
        if (delta) {
          const appended = this.appendStreamText(content, delta);
          if (appended.changed) {
            content = appended.content;
            if (typeof onDelta === 'function') onDelta(appended.delta, content, built.ctx);
          }
        }
      };
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        const records = buffer.split(/\r?\n\r?\n/);
        buffer = records.pop() || '';
        for (const record of records) {
          const parsed = this.parseSseRecord(record);
          const data = parsed.data;
          if (!data) continue;
          if (data === '[DONE]') { doneSignal = true; continue; }
          let json = null;
          try { json = JSON.parse(data); } catch (parseError) {
            throw ErrorKit.create({
              code: 'INVALID_STREAM_CHUNK',
              title: 'Chunk streaming tidak valid',
              message: 'Server mengirim data stream yang bukan JSON valid.',
              hint: 'Cek Base URL/proxy. Endpoint streaming harus OpenAI-compatible SSE.',
              details: data.slice(0, 1200),
              cause: parseError
            });
          }
          handleJson(json);
        }
      }
      const tail = this.parseSseRecord(buffer).data;
      if (tail && tail !== '[DONE]') {
        try { handleJson(JSON.parse(tail)); } catch (_) {}
      }
      if (!content && !(nativeCallState && nativeCallState.calls.filter(Boolean).length)) {
        throw ErrorKit.create({
          code: 'EMPTY_STREAM_RESPONSE',
          title: 'Stream selesai tapi response kosong',
          message: doneSignal ? 'Server mengirim [DONE] tanpa content.' : 'Server menutup stream tanpa content.',
          hint: 'Coba model lain, cek max tokens, atau copy error report.'
        });
      }
      return { content: Util.normalizeModelText(content), responseId, usage };
    },
    responseInputItems(built, previousId) {
      const messages = (built.messages || []).filter((m) => m.role !== 'system');
      const clean = messages.map((m) => ({ role: m.role, content: String(m.content || '') })).filter((m) => m.content.trim());
      if (previousId) {
        const latest = clean.slice().reverse().find((m) => m.role === 'user');
        return latest ? [{ role: 'user', content: latest.content }] : [];
      }
      return clean;
    },
    functionOutputsInput(toolResults) {
      return (toolResults || []).map((item) => ({
        type: 'function_call_output',
        call_id: item.call_id,
        output: item.output
      }));
    },
    async streamResponses(baseUrl, built, settings, onDelta, signal, options) {
      const opts = options || {};
      const responseState = Store.responseState();
      const previousId = opts.previousResponseId || (opts.ignorePrevious ? '' : (responseState.lastResponseId || ''));
      const system = built.messages.find((m) => m.role === 'system')?.content || '';
      const input = opts.toolOutputs ? this.functionOutputsInput(opts.toolOutputs) : (opts.inputOverride || this.responseInputItems(built, previousId));
      const isAgentMode = (built.kind === 'agent' || built.outputMode === 'tools') && built.allowTools !== false;
      const payload = {
        model: settings.model || C.DEFAULT_MODEL,
        input,
        instructions: system,
        temperature: Number(settings.temperature || 0.2),
        max_output_tokens: Number(settings.maxTokens || 3200),
        stream: true,
        store: true
      };
      if (previousId) payload.previous_response_id = previousId;
      let nativeCallState = null;
      if (isAgentMode) {
        payload.tools = AgentTools.nativeSchema();
        payload.tool_choice = 'auto';
        nativeCallState = { calls: [] };
      }
      const run = async () => {
        const res = await this.fetchWithTimeout(baseUrl + '/responses', payload, settings, 'text/event-stream', signal);
        return await this.readSse(res, built, onDelta, 'responses', nativeCallState);
      };
      const out = await this.requestWithRetry(run, onDelta);
      if (out.responseId) Store.saveResponseState({ lastResponseId: out.responseId, mode: built.kind || '' });
      if (out.usage) State.lastUsage = out.usage;
      const result = { content: out.content, ctx: built.ctx, endpoint: '/v1/responses', responseId: out.responseId || previousId, usage: out.usage || null };
      if (nativeCallState && nativeCallState.calls.filter(Boolean).length) {
        result.nativeCalls = nativeCallState.calls.filter(Boolean);
      }
      return result;
    },
    splitNativeCalls(calls) {
      const read = [];
      const write = [];
      (calls || []).forEach((call) => {
        const name = String(call?.name || '').trim();
        if (AgentTools.isReadOnlyName(name)) read.push(call);
        else if (AgentTools.isWriteName(name)) write.push(call);
      });
      return { read, write };
    },
    async completeWithReadTools(baseUrl, built, settings, onDelta, signal, initialOptions) {
      let result = null;
      let options = initialOptions || {};
      const maxRounds = 5;
      const collectedReadResults = [];
      for (let round = 0; round < maxRounds; round++) {
        result = await this.streamResponses(baseUrl, built, settings, onDelta, signal, options);
        const calls = result.nativeCalls || [];
        const split = this.splitNativeCalls(calls);
        if (!split.read.length) {
          if (collectedReadResults.length) result.readToolResults = collectedReadResults.slice();
          return result;
        }

        // Important: read/search/list tools are an observation step. Even if the
        // model emitted write calls in the same response, do not expose those writes
        // yet because the model has not seen the read outputs. Feed the observation
        // back first, including failures such as file-not-found, then let the model
        // continue with better context or ask the user.
        const uniqueReadCalls = AgentTools.uniqueReadCalls(split.read);
        State.toolProgress = uniqueReadCalls.map((c) => c.name).join(', ') || 'reading';
        State.toolActivity = AgentTools.readActivityFromCalls(uniqueReadCalls, 'running');
        if (typeof onDelta === 'function') onDelta('', State.streamingContent || '', built.ctx);
        const outputs = await AgentTools.runReadCalls(split.read);
        collectedReadResults.push(...outputs);
        const activityByKey = new Map();
        State.readToolResults = collectedReadResults.map((item) => {
          let parsed = null;
          try { parsed = JSON.parse(item.output || '{}'); } catch (_) {}
          const path = parsed?.path || parsed?.query || parsed?.root || '';
          const row = {
            ok: item.ok,
            tool: item.name,
            path,
            count: parsed?.count || parsed?.line_count || 0,
            result: String(item.output || '').slice(0, 800)
          };
          const group = item.name === 'read_file' ? 'reading' : item.name === 'list_files' ? 'listing' : item.name === 'search_in_files' ? 'searching' : 'using tools';
          const target = path || parsed?.fullPath || parsed?.tool || item.name || 'tool';
          const key = group + ':' + target;
          if (!activityByKey.has(key)) activityByKey.set(key, { group, tool: item.name, target, status: item.ok ? 'done' : 'failed' });
          return row;
        });
        State.toolActivity = Array.from(activityByKey.values());
        if (typeof onDelta === 'function') onDelta('', State.streamingContent || '', built.ctx);
        if (!result.responseId) {
          result.nativeCalls = [];
          result.readToolResults = collectedReadResults.slice();
          return result;
        }
        options = { previousResponseId: result.responseId, toolOutputs: outputs };
      }
      State.toolProgress = '';
      if (result) result.readToolResults = collectedReadResults.slice();
      return result;
    },
    async streamComplete(kind, instruction, outputMode, onDelta) {
      const built = Prompt.messages(kind, instruction, outputMode);
      built.kind = kind;
      built.outputMode = outputMode;
      const settings = built.settings;
      if (!settings.apiKey) {
        throw ErrorKit.create({
          code: 'MISSING_API_KEY',
          title: 'API key belum diisi',
          message: 'NAI API Key kosong.',
          hint: 'Buka Settings Ace AI lalu isi API key.'
        });
      }

      const baseUrl = Util.baseUrl(settings.baseUrl);
      if (!/^https?:\/\//i.test(baseUrl)) {
        throw ErrorKit.create({
          code: 'INVALID_BASE_URL',
          title: 'Base URL tidak valid',
          message: 'Base URL harus diawali http:// atau https://',
          hint: 'Default: https://api.neosantara.xyz/v1'
        });
      }

      let controller = null;
      let timer = null;
      State.toolProgress = '';
      State.toolActivity = [];
      State.retryStatus = '';
      try {
        if (typeof AbortController !== 'undefined') {
          controller = new AbortController();
          timer = setTimeout(() => controller.abort(), C.REQUEST_TIMEOUT_MS);
        }
        let result;
        try {
          result = await this.completeWithReadTools(baseUrl, built, settings, onDelta, controller ? controller.signal : undefined);
        } catch (error) {
          const normalized = ErrorKit.normalize(error);
          const msg = String(normalized.message || normalized.details || '');
          const stalePrevious = normalized.status === 404 || /previous_response_id|response.*not.*found|No response found|invalid.*response/i.test(msg);
          if (!stalePrevious) throw normalized;
          Store.clearResponseState();
          result = await this.completeWithReadTools(baseUrl, built, settings, onDelta, controller ? controller.signal : undefined, { ignorePrevious: true });
          result.recoveredConversation = true;
        }
        if (Store.settings().autoStripFence) result.content = Util.stripFence(result.content);
        if (result.nativeCalls && result.nativeCalls.length) {
          result.nativeToolResults = AgentTools.parseNativeCalls(result.nativeCalls).filter((tool) => AgentTools.isWriteName(tool.name));
        }
        return result;
      } catch (error) {
        throw ErrorKit.normalize(error);
      } finally {
        State.toolProgress = '';
        State.toolActivity = [];
        State.retryStatus = '';
        if (timer) clearTimeout(timer);
      }
    }
  };

  // ---- agent/tools.js ----
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

  // ---- agent/permission-model.js ----
  const PermissionModel = {
    sessionAllowed: {},
    permissionForTool(tool) {
      const name = String(tool?.name || '');
      if (name === 'replace_selection' || name === 'insert_at_cursor') return 'edit.selection';
      if (name === 'create_file') return 'edit.create';
      if (name === 'write_file' || name === 'replace_file' || name === 'append_file') return 'edit.file';
      return 'edit';
    },
    patternForTool(tool) {
      const target = tool?.path || tool?.appliesTo || tool?.name || '*';
      return String(target || '*');
    },
    actionFor(tool) {
      const permission = this.permissionForTool(tool);
      const pattern = this.patternForTool(tool);
      const mode = State.permissionMode || Store.settings().permissionMode || 'safe';
      const key = permission + ':' + pattern;
      if (this.sessionAllowed[key] || this.sessionAllowed[permission + ':*']) return 'allow';
      if (mode === 'autopilot') return 'allow';
      if (mode === 'balanced' && (permission === 'edit.selection')) return 'allow';
      return 'ask';
    },
    evaluateSelection() {
      const selected = AgentTools.selectedTools();
      if (!selected.length) return { action: 'deny', reason: 'No selected tools' };
      const actions = selected.map((tool) => this.actionFor(tool));
      if (actions.includes('deny')) return { action: 'deny', reason: 'A selected tool is denied by permission rules' };
      if (actions.includes('ask')) return { action: 'ask', reason: 'Approval required for selected write tools' };
      return { action: 'allow', reason: 'Selected tools are allowed by current permission mode' };
    },
    rememberAlways() {
      AgentTools.selectedTools().forEach((tool) => {
        const permission = this.permissionForTool(tool);
        const pattern = this.patternForTool(tool);
        this.sessionAllowed[permission + ':' + pattern] = true;
      });
    },
    resetSession() {
      this.sessionAllowed = {};
    },
    label() {
      const mode = State.permissionMode || Store.settings().permissionMode || 'safe';
      if (mode === 'autopilot') return 'Autopilot: selected write tools can be applied after review.';
      if (mode === 'balanced') return 'Balanced: selection edits are allowed after review; file writes still ask.';
      return 'Safe: write/edit/create tools ask before apply.';
    }
  };

  // ---- ui/templates.js ----
  const Templates = {
    neosantaraHtml(widgetId) {
      const id = String(widgetId || '').trim() || 'YOUR_WIDGET_ID';
      return `<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="${id}"\n  async\n></script>`;
    },
    neosantaraPhp(widgetId) {
      const id = String(widgetId || '').trim() || 'YOUR_WIDGET_ID';
      return `<?php\n$neosantaraWidgetId = htmlspecialchars('${id}', ENT_QUOTES, 'UTF-8');\n?>\n<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="<?= $neosantaraWidgetId ?>"\n  async\n></script>`;
    },
    acodeSkeleton() {
      return `// main.js\n(function () {\n  const PLUGIN_ID = 'your.plugin.id';\n\n  acode.setPluginInit(PLUGIN_ID, (baseUrl, $page, cache) => {\n    $page.innerHTML = '<h1>Hello Acode</h1>';\n    const open = () => $page.show();\n\n    try {\n      const commands = acode.require('commands');\n      commands.addCommand({ name: 'your-plugin.open', description: 'Open Your Plugin', exec: open });\n    } catch (_) {}\n  });\n\n  acode.setPluginUnmount(PLUGIN_ID, () => {\n    try { acode.require('commands').removeCommand('your-plugin.open'); } catch (_) {}\n  });\n})();`;
    }
  };

  // ---- ui/base-ui.js ----
    const UI = {
      css() {
        if (document.getElementById('ace-ai-style-v8_3-base')) return;
        const style = document.createElement('style');
        style.id = 'ace-ai-style-v8_3-base';
        style.textContent = `
  :root{--ace-ai-bg:#101114;--ace-ai-surface:#17191d;--ace-ai-surface-2:#1d2026;--ace-ai-border:#30343c;--ace-ai-text:#eef0f3;--ace-ai-muted:#a4a9b3;--ace-ai-accent:#4da3ff;--ace-ai-danger:#e06c75;--ace-ai-warn:#d7a64a;--ace-ai-ok:#7ccf91}
  .ace-ai-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;background:var(--ace-ai-surface);color:var(--ace-ai-text);padding:10px 14px;border:1px solid var(--ace-ai-border);border-radius:12px;font:13px system-ui;box-shadow:0 12px 30px #0008;max-width:88vw}
  .ace-ai-fab{position:fixed;right:10px;bottom:86px;z-index:2147483000;min-width:48px;min-height:48px;border:1px solid var(--ace-ai-border);border-radius:12px;background:var(--ace-ai-surface-2);color:var(--ace-ai-text);font-weight:800;font:12px system-ui;padding:10px 11px;box-shadow:0 10px 26px #0007}
  .ace-ai-panel{position:fixed;left:8px;right:8px;bottom:8px;height:min(82vh,760px);z-index:99991;background:var(--ace-ai-bg);color:var(--ace-ai-text);border:1px solid var(--ace-ai-border);border-radius:16px;box-shadow:0 18px 60px #000a;display:flex;flex-direction:column;overflow:hidden;font:13px system-ui,-apple-system,Segoe UI,sans-serif}
  .ace-ai-panel.is-max{top:0;left:0;right:0;bottom:0;height:auto;border-radius:0;border-width:0}.ace-ai-panel[data-sidebar="1"]{position:relative;inset:auto;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}
  .ace-ai-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--ace-ai-surface);border-bottom:1px solid var(--ace-ai-border);gap:8px;flex:0 0 auto}.ace-ai-brand{font-weight:850;letter-spacing:.2px;font-size:15px}.ace-ai-sub{font-size:11px;color:var(--ace-ai-muted);margin-top:2px;max-width:68vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ace-ai-actions{display:flex;gap:7px;flex:0 0 auto}.ace-ai-iconbtn,.ace-ai-btn{border:1px solid var(--ace-ai-border);background:var(--ace-ai-surface-2);color:var(--ace-ai-text);border-radius:11px;padding:8px 10px;font:12px system-ui;line-height:1}.ace-ai-iconbtn{min-width:38px;min-height:38px;border-radius:13px}.ace-ai-btn:disabled,.ace-ai-iconbtn:disabled{opacity:.55}.ace-ai-primary{border-color:var(--ace-ai-accent);background:rgba(77,163,255,.16);color:#dcebff;font-weight:800}.ace-ai-danger{background:rgba(224,108,117,.12);border-color:rgba(224,108,117,.5);color:#ffdadd}
  .ace-ai-tabs{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid var(--ace-ai-border);background:var(--ace-ai-bg);flex:0 0 auto}.ace-ai-tab{border:0;background:transparent;color:var(--ace-ai-muted);padding:10px 6px;font-weight:800;font-size:13px}.ace-ai-tab.active{color:var(--ace-ai-text);background:var(--ace-ai-surface-2);box-shadow:inset 0 -2px 0 var(--ace-ai-accent)}
  .ace-ai-body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column}.ace-ai-body [data-view]{display:none;flex:1 1 auto;min-height:0;overflow:hidden}.ace-ai-body [data-view].ace-ai-view-active{display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:8px 8px 12px;box-sizing:border-box}
  .ace-ai-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ace-ai-row.nowrap{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.ace-ai-col{display:flex;flex-direction:column;gap:9px;min-height:0;flex:1 1 auto}.ace-ai-scroll-col{flex:0 0 auto;min-height:auto;overflow:visible;padding-bottom:12px}.ace-ai-card{background:var(--ace-ai-surface);border:1px solid var(--ace-ai-border);border-radius:14px;padding:10px}.ace-ai-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ace-ai-muted);font-weight:900}.ace-ai-input,.ace-ai-textarea,.ace-ai-select{width:100%;box-sizing:border-box;border:1px solid var(--ace-ai-border);background:#0d0f12;color:var(--ace-ai-text);border-radius:12px;padding:10px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}.ace-ai-textarea{min-height:82px;max-height:145px;resize:vertical}.ace-ai-input:focus,.ace-ai-textarea:focus{border-color:var(--ace-ai-accent)}
  .ace-ai-chat-shell{display:flex;flex-direction:column;min-height:0;flex:1 1 auto;gap:9px}.ace-ai-chatlog{display:flex;flex-direction:column;gap:9px;flex:1 1 auto;overflow:auto;min-height:120px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-right:2px}.ace-ai-msg{border:1px solid var(--ace-ai-border);border-radius:14px;padding:10px;background:var(--ace-ai-surface);white-space:pre-wrap;line-height:1.42;font-size:13px}.ace-ai-msg.user{margin-left:18px;background:var(--ace-ai-surface-2)}.ace-ai-msg.assistant{margin-right:18px}
  .ace-ai-chip{border:1px solid var(--ace-ai-border);background:var(--ace-ai-surface-2);color:var(--ace-ai-text);border-radius:999px;padding:7px 10px;font-size:12px;white-space:nowrap}.ace-ai-context{display:flex;gap:6px;overflow-x:auto;padding-bottom:1px}.ace-ai-empty{color:var(--ace-ai-muted);padding:12px;text-align:center;border:1px dashed var(--ace-ai-border);border-radius:12px}.ace-ai-result{white-space:pre-wrap;background:#0d0f12;border:1px solid var(--ace-ai-border);border-radius:14px;padding:12px;line-height:1.45;overflow:auto;flex:1 1 auto;min-height:0}
  .ace-ai-diff{background:#0d0f12;border:1px solid var(--ace-ai-border);border-radius:14px;overflow:auto;flex:1 1 auto;min-height:180px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.ace-ai-diff-line{display:grid;grid-template-columns:24px 1fr;gap:8px;min-height:21px;line-height:1.5;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.ace-ai-diff-line span{text-align:center;color:var(--ace-ai-muted)}.ace-ai-diff-line code{font:inherit;color:inherit}.ace-ai-add{background:rgba(124,207,145,.13);color:#dff8e5}.ace-ai-del{background:rgba(224,108,117,.14);color:#ffe0e3}.ace-ai-same{color:#c4c8d0}
  .ace-ai-footer{border-top:1px solid var(--ace-ai-border);padding:9px 10px;background:var(--ace-ai-surface);flex:0 0 auto}.ace-ai-footer .ace-ai-row{flex-wrap:nowrap;overflow-x:auto}.ace-ai-settings{position:absolute;inset:50px 10px 10px 10px;background:var(--ace-ai-bg);border:1px solid var(--ace-ai-border);border-radius:14px;z-index:5;overflow:auto;padding:12px;box-shadow:0 18px 60px #0009}.ace-ai-hidden{display:none!important}.ace-ai-mini{font-size:11px;color:var(--ace-ai-muted)}.ace-ai-streaming::after{content:"▌";display:inline-block;margin-left:2px;animation:ace-ai-blink 1s steps(2,start) infinite}@keyframes ace-ai-blink{50%{opacity:0}}.ace-ai-error-card{border-color:rgba(224,108,117,.6);background:rgba(224,108,117,.08)}
  .ace-ai-tree-list{margin-top:9px;display:flex;flex-direction:column;gap:5px}.ace-ai-tree-row{display:grid;grid-template-columns:auto 24px minmax(0,1fr) auto;gap:7px;align-items:center;border:1px solid var(--ace-ai-border);background:#0d0f12;border-radius:10px;padding:7px}.ace-ai-tree-row.blocked{opacity:.72}.ace-ai-tree-icon{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ace-ai-accent);font-weight:900;text-align:center}.ace-ai-tree-path{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ace-ai-tree-status{font-size:10px;color:var(--ace-ai-muted)}
  .ace-ai-tool{border:1px solid var(--ace-ai-border);background:#0d0f12;border-radius:12px;padding:10px;margin-bottom:8px}.ace-ai-tool.blocked{border-color:rgba(224,108,117,.5);background:rgba(224,108,117,.06)}.ace-ai-tool pre{margin:8px 0 0;white-space:pre-wrap;max-height:180px;overflow:auto;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ace-ai-text)}.ace-ai-tool-diff{margin-top:8px;border:1px solid var(--ace-ai-border);border-radius:10px;overflow:auto;max-height:260px}.ace-ai-hunks{display:flex;flex-direction:column;gap:9px;margin-top:9px}.ace-ai-hunk{border:1px solid rgba(77,163,255,.32);background:#101114;border-radius:12px;padding:8px}.ace-ai-hunk.rejected{border-color:rgba(224,108,117,.45);opacity:.78}.ace-ai-hunk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.ace-ai-hunk-head b{display:block;font-size:12px}.ace-ai-hunk-state{display:block;font-size:11px;color:var(--ace-ai-muted);margin-top:2px}.ace-ai-hunk-actions{flex:0 0 auto}.ace-ai-tool-error{margin-top:8px;color:#ffe0e3;background:rgba(224,108,117,.10);border:1px solid rgba(224,108,117,.5);border-radius:10px;padding:7px}.ace-ai-tool-warn{margin-top:8px;color:#ffe7b5;background:rgba(215,166,74,.12);border:1px solid rgba(215,166,74,.45);border-radius:10px;padding:7px}.ace-ai-loading-card{border-color:rgba(77,163,255,.45);background:rgba(77,163,255,.08)}.ace-ai-spinner{width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:var(--ace-ai-accent);border-radius:999px;display:inline-block;animation:ace-ai-spin .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes ace-ai-spin{to{transform:rotate(360deg)}}.ace-ai-sep{height:1px;background:var(--ace-ai-border);margin:10px 0}
  @media(max-width:760px){.ace-ai-panel{left:0;right:0;bottom:0;height:76vh;border-radius:16px 16px 0 0;border-left-width:0;border-right-width:0;border-bottom-width:0}.ace-ai-sub{max-width:50vw}.ace-ai-iconbtn{min-width:36px;min-height:36px;border-radius:12px}.ace-ai-textarea{min-height:74px;max-height:120px}}
  @media(max-height:680px){.ace-ai-panel{height:72vh}.ace-ai-textarea{min-height:68px;max-height:100px}}
  `;
        document.head.appendChild(style);
      },
      mountPanel(container, asSidebar) {
        this.css();
        const panel = document.createElement('div');
        panel.className = 'ace-ai-panel';
        if (asSidebar) panel.dataset.sidebar = '1';
        panel.innerHTML = this.layout();
        container.innerHTML = '';
        container.appendChild(panel);
        if (!asSidebar) State.panel = panel;
        this.bind(panel);
        this.render(panel);
        return panel;
      },
      layout() {
        return `
  <div class="ace-ai-head"><div><div class="ace-ai-brand">Ace AI <span class="ace-ai-mini">v${C.VERSION}</span></div><div class="ace-ai-sub" data-role="context-line">Acode-native AI coding assistant</div></div><div class="ace-ai-actions"><button class="ace-ai-iconbtn" data-act="settings">⚙</button><button class="ace-ai-iconbtn" data-act="toggle-max">⤢</button><button class="ace-ai-iconbtn" data-act="close">×</button></div></div>
  <div class="ace-ai-tabs"><button class="ace-ai-tab" data-tab="chat">Chat</button><button class="ace-ai-tab" data-tab="edit">Edit</button><button class="ace-ai-tab" data-tab="agent">Agent</button><button class="ace-ai-tab" data-tab="changes">Review</button></div>
  <div class="ace-ai-body"><div data-view="chat"></div><div data-view="edit"></div><div data-view="agent"></div><div data-view="changes"></div></div>
  <div class="ace-ai-footer" data-role="footer"></div>
  <div class="ace-ai-settings ace-ai-hidden" data-role="settings"></div>`;
      },
      bind(root) {
        root.addEventListener('click', (ev) => {
          const el = ev.target.closest('[data-act],[data-tab],[data-preset],[data-tool]');
          if (!el) return;
          const tab = el.getAttribute('data-tab');
          const act = el.getAttribute('data-act');
          const preset = el.getAttribute('data-preset');
          const tool = el.getAttribute('data-tool');
          State.lastActionMeta = {
            toolId: el.getAttribute('data-tool-id') || '',
            hunkId: el.getAttribute('data-hunk-id') || '',
            path: el.getAttribute('data-path') || ''
          };
          if (tab) return this.switchTab(tab, root);
          if (preset) return this.usePreset(Number(preset), root);
          if (tool) return this.useTool(tool, root);
          if (act) return this.handle(act, root);
        });
        root.addEventListener('input', Util.debounce((ev) => {
          const prompt = ev.target && ev.target.closest ? ev.target.closest('textarea[data-role="prompt"]') : null;
          if (prompt) State.draftPrompt = prompt.value;
          this.updateContext(root);
        }, 200));
        root.addEventListener('change', (ev) => {
          const check = ev.target && ev.target.closest ? ev.target.closest('[data-tool-check]') : null;
          if (!check) return;
          const id = String(check.getAttribute('data-tool-check') || '');
          const tool = State.pendingTools.find((item) => String(item.id) === id);
          if (tool && !tool.error) {
            tool.selected = Boolean(check.checked);
            if (tool.selected && tool.preview?.hunks?.length && !tool.preview.hunks.some((h) => h.selected !== false)) {
              AgentTools.setAllHunks(id, true);
            }
          }
          this.render(root);
        });
        root.addEventListener('keydown', (ev) => {
          const input = ev.target && ev.target.closest ? ev.target.closest('textarea[data-role="prompt"]') : null;
          if (!input) return;
          if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
            ev.preventDefault();
            this.send(root);
          }
        });
      },
      openPanel(tab, mode, seed) {
        this.css();
        if (!State.panel) {
          const wrap = document.createElement('div');
          document.body.appendChild(wrap);
          this.mountPanel(wrap, false);
        }
        State.panel.classList.remove('ace-ai-hidden');
        if (mode) State.activeMode = mode;
        if (tab) State.activeTab = tab;
        this.render(State.panel);
        if (seed) {
          const input = State.panel.querySelector('[data-role="prompt"]');
          if (input && !input.value) input.value = seed;
        }
        Acode.pushBackAction();
        setTimeout(() => State.panel?.querySelector('[data-role="prompt"]')?.focus(), 80);
      },
      closePanel() {
        if (State.panel) State.panel.classList.add('ace-ai-hidden');
        Acode.removeBackAction();
        Editor.focus();
      },
      switchTab(tab, root) {
        if (tab === 'changes' && State.lastResultKind !== 'edit') {
          State.activeTab = 'changes';
          this.render(root || State.panel);
          return;
        }
        State.activeTab = tab;
        this.render(root || State.panel);
      },
      updateContext(root) {
        const ctx = Editor.context();
        const line = root?.querySelector('[data-role="context-line"]');
        if (line) line.textContent = `${ctx.file.filename} · line ${ctx.cursor?.line || 1} · ${ctx.hasSelection ? ctx.selectionLines + ' selected lines' : ctx.textLines + ' file lines'}${ctx.dirty?.dirty ? ' · unsaved' : ''}`;
      },
      render(root) {
        if (!root) return;
        this.updateContext(root);
        root.querySelectorAll('.ace-ai-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === State.activeTab));
        root.querySelectorAll('[data-view]').forEach((v) => v.classList.toggle('ace-ai-view-active', v.dataset.view === State.activeTab));
        this.renderChat(root.querySelector('[data-view="chat"]'));
        this.renderEdit(root.querySelector('[data-view="edit"]'));
        this.renderAgent(root.querySelector('[data-view="agent"]'));
        this.renderChanges(root.querySelector('[data-view="changes"]'));
        this.renderSettings(root.querySelector('[data-role="settings"]'));
        this.updateFooter(root);
        const log = root.querySelector('.ace-ai-chatlog');
        if (log && State.activeTab === 'chat') setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
        root.classList.toggle('is-max', Boolean(State.maximized));
      },
      updateFooter(root) {
        const footer = root.querySelector('[data-role="footer"]');
        if (!footer) return;
        const hasEditableReview = State.lastResultKind === 'edit' && Boolean(State.lastPatch || State.lastResult);
        const hasAgentReview = State.pendingTools.length > 0;
        if (State.busy) {
          const label = State.streamingMode === 'agent' ? 'Running Agent…' : State.streamingMode === 'edit' ? 'Generating Edit…' : 'Streaming…';
          footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" disabled><span class="ace-ai-spinner"></span>${label}</button></div>`;
          return;
        }
        if (State.activeTab === 'changes') {
          if (hasAgentReview) {
            const selected = AgentTools.selectedTools().length;
            footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="apply-tools">Apply Selected (${selected})</button><button class="ace-ai-btn" data-act="select-all-tools">Select all</button><button class="ace-ai-btn" data-act="select-no-tools">None</button><button class="ace-ai-btn" data-act="copy-tools">Copy JSON</button>${State.undoStack.length ? '<button class="ace-ai-btn" data-act="undo-tools">Undo Last</button>' : ''}<button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`;
            return;
          }
          if (!hasEditableReview) {
            footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug</button><button class="ace-ai-btn" data-act="undo-tools">Undo Last</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear State</button></div>`;
            return;
          }
          const label = State.lastPatch ? 'Apply Patch' : 'Replace Selection';
          footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="apply-main">${label}</button><button class="ace-ai-btn" data-act="copy-result">Copy</button><button class="ace-ai-btn" data-act="insert-result">Insert</button><button class="ace-ai-btn ace-ai-danger" data-act="reject">Reject</button></div>`;
          return;
        }
        if (State.activeTab === 'edit') {
          footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Generate Edit</button></div>`;
          return;
        }
        if (State.activeTab === 'agent') {
          footer.innerHTML = hasAgentReview
            ? `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="open-review">Open Review</button><button class="ace-ai-btn" data-act="send">Run Again</button></div>`
            : `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Run Agent</button></div>`;
          return;
        }
        footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Send</button></div>`;
      },
      errorBanner() {
        if (!State.lastError) return '';
        const e = ErrorKit.normalize(State.lastError);
        return `<div class="ace-ai-card ace-ai-error-card"><div class="ace-ai-label">Error · ${Util.html(e.code || 'UNKNOWN')}${e.status ? ' · HTTP ' + e.status : ''}</div><div style="font-weight:800;margin-top:4px">${Util.html(e.title || 'Ace AI error')}</div><div class="ace-ai-mini" style="margin-top:6px;white-space:pre-wrap">${Util.html(e.message || '')}</div>${e.hint ? `<div class="ace-ai-mini" style="margin-top:6px;color:#ffd78a">${Util.html(e.hint)}</div>` : ''}<div class="ace-ai-row nowrap" style="margin-top:9px"><button class="ace-ai-btn ace-ai-primary" data-act="retry-last">Retry</button><button class="ace-ai-btn" data-act="copy-error">Copy Error</button><button class="ace-ai-btn" data-act="settings">Settings</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-error">Clear</button></div></div>`;
      },
      busyBanner() {
        if (!State.busy) return '';
        const label = State.streamingMode === 'agent' ? 'Agent is planning tools' : State.streamingMode === 'edit' ? 'Generating edit' : 'Streaming response';
        const progress = State.toolProgress || State.retryStatus || '';
        const detail = progress || (State.streamingContent ? `${State.streamingContent.length} chars received` : 'Waiting for first token…');
        return `<div class="ace-ai-card ace-ai-loading-card"><div class="ace-ai-label"><span class="ace-ai-spinner"></span>${Util.html(label)}</div><div class="ace-ai-mini" style="margin-top:6px">${Util.html(detail)}</div></div>`;
      },
      contextBadges() {
        const ctx = Editor.context();
        return `<div class="ace-ai-context"><span class="ace-ai-chip">${Util.html(ctx.file.filename)}</span><span class="ace-ai-chip">${Util.html(ctx.file.language)}</span><span class="ace-ai-chip">line ${ctx.cursor?.line || 1}</span><span class="ace-ai-chip">visible ${ctx.visibleRange?.startLine || 1}-${ctx.visibleRange?.endLine || 1}</span><span class="ace-ai-chip">${ctx.openFiles?.length || 1} open</span><span class="ace-ai-chip">${ctx.hasSelection ? ctx.selectionLines + ' selected lines' : 'no selection'}</span>${ctx.dirty?.dirty ? '<span class="ace-ai-chip">unsaved</span>' : ''}</div>`;
      },
      renderChat(el) {
        if (!el) return;
        const chat = Store.chat();
        const streamRow = State.streamingMode === 'chat' && State.streamingContent
          ? [{ role: 'assistant', content: State.streamingContent, time: 'streaming', streaming: true }]
          : [];
        const allRows = chat.concat(streamRow);
        const rows = allRows.length ? allRows.map((m) => `<div class="ace-ai-msg ${m.role} ${m.streaming ? 'ace-ai-streaming' : ''}"><b>${m.role === 'user' ? 'You' : 'Ace AI'}</b> <span class="ace-ai-mini">${Util.html(m.time || '')}</span>
  ${Util.html(m.content)}</div>`).join('') : '<div class="ace-ai-empty">Ask about active file, selected code, or tap a quick action.</div>';
        el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-chat-shell"><div class="ace-ai-chatlog">${rows}</div><div class="ace-ai-card"><div class="ace-ai-label">Chat prompt</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="Ask Ace AI... Use @path/to/file.js or @codebase">${Util.html(State.draftPrompt || '')}</textarea><div class="ace-ai-mini" style="margin-top:6px">Enter = send · Shift+Enter = newline</div><div class="ace-ai-row nowrap" style="margin-top:8px">${Store.presets().slice(0, 5).map((p, i) => `<button class="ace-ai-chip" data-preset="${i}">${Util.html(p.name)}</button>`).join('')}</div></div></div></div>`;
        this.attachHints(el.querySelector('[data-role="prompt"]'));
      },
      renderEdit(el) {
        if (!el) return;
        const s = Store.settings();
        const streaming = State.streamingMode === 'edit' && State.streamingContent ? `<div class="ace-ai-card"><div class="ace-ai-label">Streaming edit result</div><div class="ace-ai-result ace-ai-streaming">${Util.html(State.streamingContent)}</div></div>` : '';
        el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Inline edit instruction</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="e.g. fix this, make it cleaner, convert to PHP template">${Util.html(State.draftPrompt || '')}</textarea><div class="ace-ai-mini" style="margin-top:6px">Enter = generate · Shift+Enter = newline</div><div class="ace-ai-sep"></div><div class="ace-ai-row nowrap"><label class="ace-ai-chip"><input type="radio" name="ace-output" value="patch" ${s.preferPatch ? 'checked' : ''}> Patch</label><label class="ace-ai-chip"><input type="radio" name="ace-output" value="replacement" ${!s.preferPatch ? 'checked' : ''}> Replacement</label><label class="ace-ai-chip"><input type="checkbox" data-role="include-full" ${s.includeFullFile ? 'checked' : ''}> Full file</label></div></div>${streaming}<div class="ace-ai-card"><div class="ace-ai-label">Quick actions</div><div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-tool="fix">Fix</button><button class="ace-ai-btn" data-tool="explain">Explain</button><button class="ace-ai-btn" data-tool="refactor">Refactor</button><button class="ace-ai-btn" data-tool="html-section">HTML/CSS/JS</button><button class="ace-ai-btn" data-tool="php-template">HTML → PHP</button><button class="ace-ai-btn" data-tool="acode-plugin">Acode Plugin</button><button class="ace-ai-btn" data-tool="widget">Widget Embed</button></div></div></div>`;
        this.attachHints(el.querySelector('[data-role="prompt"]'));
      },
      renderAgent(el) {
        if (!el) return;
        const streaming = State.streamingMode === 'agent' && State.streamingContent
          ? `<div class="ace-ai-card"><div class="ace-ai-label">Streaming agent plan</div><div class="ace-ai-result ace-ai-streaming">${Util.html(State.streamingContent)}</div></div>`
          : '';
        const message = State.agentMessage ? `<div class="ace-ai-card"><div class="ace-ai-label">Agent summary</div><div class="ace-ai-mini" style="white-space:pre-wrap">${Util.html(State.agentMessage)}</div></div>` : '';
        const results = State.toolResults.length ? `<div class="ace-ai-card"><div class="ace-ai-label">Tool results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? '✓' : '×'} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join('')}</div>` : '';
        el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Agent instruction</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="e.g. edit safely, read @src/app.js first, or search @codebase for widget">${Util.html(State.draftPrompt || '')}</textarea><div class="ace-ai-mini" style="margin-top:6px">Agent returns tool calls. Ace AI shows diffs first; nothing is applied until you tap Approve & Apply Tools.</div><div class="ace-ai-row nowrap" style="margin-top:8px"><label class="ace-ai-chip"><input type="checkbox" data-role="include-full" ${Store.settings().includeFullFile ? 'checked' : ''}> Full file context</label><button class="ace-ai-btn" data-tool="agent-create">Create file</button><button class="ace-ai-btn" data-tool="agent-edit">Edit active file</button><button class="ace-ai-btn" data-tool="agent-widget">Widget embed</button></div></div>${streaming}${message}<div class="ace-ai-card"><div class="ace-ai-label">Review flow</div><div class="ace-ai-mini">Agent proposals appear in the Review tab as a file tree and per-tool diffs. Nothing is applied automatically.</div>${State.pendingTools.length ? '<div class="ace-ai-row" style="margin-top:8px"><button class="ace-ai-btn ace-ai-primary" data-act="open-review">Open Review</button></div>' : ''}</div>${results}</div>`;
        this.attachHints(el.querySelector('[data-role="prompt"]'));
      },
      renderChanges(el) {
        if (!el) return;
        if (State.pendingTools.length) {
          const results = State.toolResults.length ? `<div class="ace-ai-card"><div class="ace-ai-label">Apply results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? '✓' : '×'} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join('')}</div>` : '';
          const applied = State.lastAppliedSummary ? `<div class="ace-ai-card"><div class="ace-ai-label">Last apply</div><div class="ace-ai-mini">${Util.html(State.lastAppliedSummary)}</div></div>` : '';
          el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}${State.agentMessage ? `<div class="ace-ai-card"><div class="ace-ai-label">Agent summary</div><div class="ace-ai-mini" style="white-space:pre-wrap">${Util.html(State.agentMessage)}</div></div>` : ''}${AgentTools.renderList()}${applied}${results}</div>`;
          return;
        }
        if (State.lastResultKind !== 'edit' || !(State.lastPatch || State.lastResult)) {
          const results = State.toolResults.length ? `<div class="ace-ai-card"><div class="ace-ai-label">Tool results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? '✓' : '×'} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join('')}</div>` : '';
          el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Review</div><div class="ace-ai-mini">No pending review. Chat answers stay in Chat. Agent proposals show here only after Run Agent.</div></div>${State.lastAppliedSummary ? `<div class="ace-ai-card"><div class="ace-ai-label">Last apply</div><div class="ace-ai-mini">${Util.html(State.lastAppliedSummary)}</div></div>` : ''}${results}<div class="ace-ai-card"><div class="ace-ai-label">Debug</div><div class="ace-ai-mini">Version ${C.VERSION} · last result kind: ${Util.html(State.lastResultKind || 'none')}</div><div class="ace-ai-row" style="margin-top:8px"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug State</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear Runtime State</button></div></div></div>`;
          return;
        }
        const original = State.lastOriginal || (State.lastTarget === 'file' ? Editor.text() : Editor.selectedText());
        const patch = State.lastPatch;
        const result = State.lastResult;
        let rows = [];
        if (patch) rows = Patch.previewPatch(patch);
        else rows = Patch.simpleDiff(original, result);
        el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Edit review</div><div class="ace-ai-mini">${Util.html(State.lastSummary || 'Review generated edit before applying.')}</div></div><div class="ace-ai-diff">${Patch.render(rows)}</div></div>`;
      },
      renderSettings(el) {
        if (!el) return;
        const s = Store.settings();
        el.innerHTML = `<div class="ace-ai-col"><div class="ace-ai-row" style="justify-content:space-between"><div class="ace-ai-brand">Settings</div><button class="ace-ai-iconbtn" data-act="settings">×</button></div><label><div class="ace-ai-label">NAI API Key</div><input class="ace-ai-input" data-set="apiKey" type="password" value="${Util.html(s.apiKey)}" placeholder="nsk_..."></label><label><div class="ace-ai-label">Base URL</div><input class="ace-ai-input" data-set="baseUrl" value="${Util.html(s.baseUrl)}"></label><div class="ace-ai-mini">Endpoint: /v1/responses only. Ace AI stores previous_response_id for conversation continuity and also keeps local history on this device.</div><label><div class="ace-ai-label">Model</div><input class="ace-ai-input" data-set="model" value="${Util.html(s.model)}"></label><label><div class="ace-ai-label">Project Root / Folder URL</div><input class="ace-ai-input" data-set="projectRoot" value="${Util.html(s.projectRoot || '')}" placeholder="optional, e.g. content://... or file:///storage/..."></label><div class="ace-ai-mini">Dipakai saat agent membuat file relatif seperti index.js kalau active file belum punya folder.</div><div class="ace-ai-row"><label style="flex:1"><div class="ace-ai-label">Temperature</div><input class="ace-ai-input" data-set="temperature" value="${Util.html(s.temperature)}"></label><label style="flex:1"><div class="ace-ai-label">Max Tokens</div><input class="ace-ai-input" data-set="maxTokens" value="${Util.html(s.maxTokens)}"></label></div><label class="ace-ai-chip"><input type="checkbox" data-set="includeFullFile" ${s.includeFullFile ? 'checked' : ''}> Include full file by default</label><label class="ace-ai-chip"><input type="checkbox" data-set="preferPatch" ${s.preferPatch ? 'checked' : ''}> Prefer patch output</label><button class="ace-ai-btn ace-ai-primary" data-act="save-settings">Save Settings</button><div class="ace-ai-row"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug State</button><button class="ace-ai-btn" data-act="new-chat">Clear Chat History</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear Runtime State</button></div></div>`;
      },
      attachHints(input) {
        // Acode inputHints opens a large native dropdown on some Android builds and
        // can steal Enter from textareas. Ace AI keeps hints as compact chips instead.
        if (!input || input.dataset.hints === '1') return;
        input.dataset.hints = '1';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('spellcheck', 'false');
      },
      usePreset(index, root) {
        const preset = Store.presets()[index];
        const input = root.querySelector('[data-role="prompt"]');
        if (preset && input) {
          State.draftPrompt = preset.prompt;
          input.value = preset.prompt;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          this.render(root);
          setTimeout(() => { const next = root.querySelector('[data-role="prompt"]'); if (next) { next.focus(); try { next.setSelectionRange(next.value.length, next.value.length); } catch (_) {} } }, 0);
        }
      },
      useTool(tool, root) {
        const input = root.querySelector('[data-role="prompt"]');
        const map = {
          fix: 'Fix bugs in the selected code. Keep the change minimal.',
          explain: 'Explain the selected error/code and give the smallest fix.',
          refactor: 'Refactor the selected code for clarity without changing behavior.',
          'html-section': 'Generate a polished responsive HTML/CSS/JS section for this file.',
          'php-template': 'Convert the selected HTML to a PHP template using htmlspecialchars for dynamic values.',
          'acode-plugin': 'Generate a complete Acode plugin skeleton with manifest, main.js, lifecycle, commands, UI, and cleanup.',
          widget: 'Generate a clean Neosantara widget embed section.',
          'agent-create': 'Create the files needed for this feature. Return reviewable tool calls only and keep each file minimal.',
          'agent-edit': 'Modify the active file safely using reviewable tool calls only. Prefer minimal diffs and preserve existing style.',
          'agent-widget': 'Create or insert a Neosantara widget embed using reviewable tool calls only.',
          'agent-codebase': 'Use list_files and search_in_files first to inspect the relevant codebase context, then answer or propose reviewable edits only if needed.'
        };
        if (input) {
          if (String(tool || '').startsWith('agent-')) State.aiMode = 'agent';
          const value = map[tool] || '';
          State.draftPrompt = value;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          this.render(root);
          setTimeout(() => { const next = root.querySelector('[data-role="prompt"]'); if (next) { next.focus(); try { next.setSelectionRange(next.value.length, next.value.length); } catch (_) {} } }, 0);
        }
      },
      getPrompt(root) {
        return root.querySelector('[data-role="prompt"]')?.value.trim() || '';
      },
      outputMode(root) {
        if (State.activeTab === 'agent') return 'tools';
        if (State.activeTab !== 'edit') return 'chat';
        const checked = root.querySelector('input[name="ace-output"]:checked');
        return checked ? checked.value : (Store.settings().preferPatch ? 'patch' : 'replacement');
      },
      async handle(act, root) {
        if (act === 'close') return this.closePanel();
        if (act === 'settings') return root.querySelector('[data-role="settings"]')?.classList.toggle('ace-ai-hidden');
        if (act === 'toggle-max') { State.maximized = !State.maximized; return this.render(root); }
        if (act === 'save-settings') return this.saveSettings(root);
        if (act === 'clear-error') { State.lastError = null; return this.render(root); }
        if (act === 'copy-debug') return Acode.copy(Runtime.debugState());
        if (act === 'clear-state') { Runtime.clearTransientState(); return this.render(root); }
        if (act === 'copy-error') return Acode.copy(ErrorKit.report(State.lastError));
        if (act === 'retry-last') return this.retryLast(root);
        if (act === 'send') return this.send(root);
        if (act === 'apply-tools') return this.applyTools(root);
        if (act === 'undo-tools') return this.undoTools(root);
        if (act === 'select-all-tools') { State.pendingTools.forEach((t) => { if (!t.error) { t.selected = true; if (t.preview?.hunks?.length) t.preview.hunks.forEach((h) => { h.selected = true; }); } }); return this.render(root); }
        if (act === 'select-no-tools') { State.pendingTools.forEach((t) => { t.selected = false; }); return this.render(root); }
        if (act === 'open-review') { State.activeTab = 'changes'; return this.render(root); }
        if (act === 'accept-hunk' || act === 'reject-hunk') {
          const toolId = String(State.lastActionMeta?.toolId || '');
          const hunkId = String(State.lastActionMeta?.hunkId || '');
          const ok = AgentTools.setHunkSelection(toolId, hunkId, act === 'accept-hunk');
          State.reviewNotice = ok ? (act === 'accept-hunk' ? 'Accepted hunk ' : 'Rejected hunk ') + hunkId + '.' : 'Hunk not found.'; if (ok) Acode.toast(State.reviewNotice);
          return this.render(root);
        }
        if (act === 'accept-all-hunks' || act === 'reject-all-hunks') {
          const toolId = String(State.lastActionMeta?.toolId || '');
          const ok = AgentTools.setAllHunks(toolId, act === 'accept-all-hunks');
          State.reviewNotice = ok ? (act === 'accept-all-hunks' ? 'Accepted all hunks for change #' : 'Rejected all hunks for change #') + toolId + '.' : 'Change not found.'; if (ok) Acode.toast(State.reviewNotice);
          return this.render(root);
        }
        if (act === 'reject-tool') {
          const id = String(State.lastActionMeta?.toolId || '');
          State.pendingTools = State.pendingTools.filter((t) => String(t.id) !== id);
          State.reviewNotice = id ? ('Rejected proposed change #' + id + '.') : 'Rejected proposed change.';
          return this.render(root);
        }
        if (act === 'explain-tool') {
          const id = String(State.lastActionMeta?.toolId || '');
          const t = State.pendingTools.find((item) => String(item.id) === id);
          if (!t) return Acode.toast('Tool not found');
          const diff = (t.preview?.rows || []).slice(0, 160).map((row) => (row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  ') + row.text).join('\n');
          const target = AgentTools.targetOf(t);
          const prompt = `Explain this proposed change before I apply it. Be concise, mention risk, and describe what will change.\n\nTool: ${t.name}\nTarget: ${target}\n\nDiff preview:\n${diff}`;
          return this.send(root, { mode: 'chat', outputMode: 'chat', prompt, displayPrompt: 'Explain change: ' + target });
        }
        if (act === 'copy-tools') return Acode.copy(State.lastToolJson || JSON.stringify({ message: State.agentMessage, tools: State.pendingTools }, null, 2));
        if (act === 'clear-tools') { State.pendingTools = []; State.selectedToolIds = []; State.lastToolJson = ''; State.agentMessage = ''; State.toolResults = []; State.agentPlan = ''; State.lastAppliedSummary = ''; State.reviewNotice = 'Rejected pending agent tools.'; return this.render(root); }
        if (act === 'copy-result') return Acode.copy(State.lastPatch || State.lastResult || '');
        if (act === 'insert-result') return this.insertResult();
        if (act === 'apply-main') return this.applyMain();
        if (act === 'reject') return this.reject(root);
      },
      retryLast(root) {
        if (!State.lastRequest) return Acode.toast('No failed request to retry');
        State.activeTab = State.lastRequest.tab || State.activeTab;
        State.draftPrompt = State.lastRequest.prompt || State.draftPrompt;
        this.render(root);
        return this.send(root, Object.assign({}, State.lastRequest, { skipUserHistory: true }));
      },
      saveSettings(root) {
        const next = {};
        root.querySelectorAll('[data-set]').forEach((el) => {
          const key = el.getAttribute('data-set');
          next[key] = el.type === 'checkbox' ? el.checked : el.value;
        });
        Store.saveSettings(next);
        root.querySelector('[data-role="settings"]')?.classList.add('ace-ai-hidden');
        Acode.toast('Ace AI settings saved');
      },
      async send(root, forcedRequest) {
        if (State.busy) return;
        const prompt = forcedRequest?.prompt || this.getPrompt(root);
        const mode = forcedRequest?.mode || (State.activeTab === 'edit' ? 'edit' : State.activeTab === 'agent' ? 'agent' : 'chat');
        const outputMode = mode === 'edit' ? (forcedRequest?.outputMode || this.outputMode(root)) : mode === 'agent' ? 'tools' : 'chat';
        if (!prompt) return Acode.toast('Tulis instruksi dulu');
        const includeFull = root.querySelector('[data-role="include-full"]');
        if (includeFull && (mode === 'edit' || mode === 'agent')) Store.saveSettings({ includeFullFile: includeFull.checked, preferPatch: outputMode === 'patch' });

        State.busy = true;
        State.lastError = null;
        State.draftPrompt = prompt;
        State.streamingContent = '';
        State.streamingMode = mode;
        State.streamRenderTimer = 0;
        State.lastRequest = {
          tab: State.activeTab,
          mode,
          outputMode,
          prompt,
          displayPrompt: forcedRequest?.displayPrompt || prompt,
          endpoint: '/v1/responses',
          filename: Editor.info().filename,
          time: new Date().toISOString(),
          streaming: true
        };

        const originalCtx = Editor.context();
        State.lastOriginal = outputMode === 'patch' ? originalCtx.text : (originalCtx.selection || originalCtx.text);
        State.lastTarget = originalCtx.hasSelection ? 'selection' : 'file';
        State.lastSelectionSnapshot = originalCtx.hasSelection ? {
          text: originalCtx.selection,
          range: originalCtx.selectionRange || null,
          fileKey: originalCtx.file?.uri || originalCtx.file?.filename || '',
          filename: originalCtx.file?.filename || '',
          line: originalCtx.cursor?.line || 1,
          time: new Date().toISOString()
        } : null;
        State.lastResult = '';
        State.lastPatch = '';
        State.lastResultKind = '';
        if (mode === 'agent') { State.pendingTools = []; State.selectedToolIds = []; State.lastToolJson = ''; State.agentMessage = ''; State.toolResults = []; State.agentPlan = ''; State.lastAppliedSummary = ''; State.reviewNotice = ''; State.showRunDetails = false; }

        if (!forcedRequest?.skipUserHistory) {
          const chat = Store.chat();
          const displayPrompt = forcedRequest?.displayPrompt || prompt;
          chat.push({ role: 'user', content: displayPrompt, time: Util.nowLabel(), mode: State.aiMode || mode });
          Store.saveChat(chat);
          State.currentHistoryPrompt = String(displayPrompt || '').trim();
          State.activeTab = 'chat';
        }

        const scheduleRender = () => {
          if (State.streamRenderTimer) return;
          State.streamRenderTimer = setTimeout(() => {
            State.streamRenderTimer = 0;
            this.render(root);
          }, 120);
        };

        this.render(root);
        this.setBusy(root, true);
        try {
          const res = await Client.streamComplete(mode === 'agent' ? 'agent' : outputMode === 'patch' ? 'patch' : mode, prompt, outputMode, (_delta, full) => {
            State.streamingContent = full;
            State.lastResult = full;
            scheduleRender();
          });
          State.lastResult = res.content;
          State.lastPatch = mode === 'edit' && Util.isPatch(res.content) ? Patch.clean(res.content) : '';
          State.lastError = null;
          State.draftPrompt = '';
          State.streamingContent = '';
          State.streamingMode = '';
          State.lastSummary = `${mode === 'edit' ? 'Edit' : 'Chat'} · ${res.ctx.file.filename} · ${Util.nowLabel()}`;

          if (mode === 'chat') {
            const chat = Store.chat();
            chat.push({ role: 'assistant', content: res.content, time: Util.nowLabel() });
            Store.saveChat(chat);
            State.lastResultKind = 'chat';
            State.lastPatch = '';
            State.activeTab = 'chat';
          } else if (mode === 'agent') {
            const parsed = res.nativeToolResults && res.nativeToolResults.length
              ? { message: res.content || 'Agent proposed ' + res.nativeToolResults.length + ' native tool call(s).', tools: res.nativeToolResults, raw: JSON.stringify({ native: true, tools: res.nativeToolResults }, null, 2) }
              : AgentTools.parse(res.content);
            State.lastToolJson = parsed.raw;
            State.agentMessage = parsed.message || 'Agent generated ' + parsed.tools.length + ' tool call(s).';
            State.pendingTools = await AgentTools.preparePreviews(parsed.tools);
            State.lastResultKind = 'agent';
            State.lastPatch = '';
            State.activeTab = parsed.tools.length ? 'changes' : 'agent';
            if (!parsed.tools.length && !parsed.message) Acode.toast('Agent returned no supported tools');
          } else {
            State.lastResultKind = 'edit';
            State.activeTab = 'changes';
          }
          this.render(root);
        } catch (error) {
          State.lastError = ErrorKit.normalize(error);
          State.draftPrompt = prompt;
          State.streamingContent = '';
          State.streamingMode = '';
          this.render(root);
          Acode.toast(State.lastError.title || 'Ace AI error');
        } finally {
          State.busy = false;
          if (State.streamRenderTimer) { clearTimeout(State.streamRenderTimer); State.streamRenderTimer = 0; }
          State.currentHistoryPrompt = '';
          State.toolProgress = '';
          State.retryStatus = '';
          this.setBusy(root, false);
          this.render(root);
        }
      },
      setBusy(root, yes) {
        root.querySelectorAll('button,textarea,input').forEach((el) => { if (!el.matches('[data-act="close"]')) el.disabled = Boolean(yes); });
        const send = root.querySelector('[data-act="send"]');
        if (send) send.textContent = yes ? 'Streaming…' : (State.activeTab === 'edit' ? 'Generate Edit' : State.activeTab === 'agent' ? 'Run Agent' : 'Send');
      },
      async applyTools(root) {
        try {
          this.setBusy(root, true);
          const selected = AgentTools.selectedTools().length;
          if (!selected) return Acode.toast('No selected tools');
          const results = await AgentTools.applyAll();
          State.toolResults = results;
          State.activeTab = 'changes';
          Acode.toast('Applied selected tools: ' + results.length);
          this.render(root);
        } catch (error) {
          State.lastError = ErrorKit.normalize(error);
          this.render(root);
          Acode.toast(State.lastError.title || 'Tool error');
        } finally {
          this.setBusy(root, false);
          this.render(root);
        }
      },
      async undoTools(root) {
        try {
          this.setBusy(root, true);
          const results = await AgentTools.undoLast();
          if (results) Acode.toast('Undo completed');
          State.activeTab = 'changes';
          this.render(root);
        } catch (error) {
          State.lastError = ErrorKit.normalize(error);
          this.render(root);
          Acode.toast(State.lastError.title || 'Undo error');
        } finally {
          this.setBusy(root, false);
          this.render(root);
        }
      },
      insertResult() {
        const value = State.lastPatch || State.lastResult;
        if (!value) return Acode.toast('No result yet');
        if (Editor.insertAtCursor('\n' + value + '\n')) Acode.toast('Inserted');
      },
      applyMain() {
        try {
          if (State.lastResultKind !== 'edit') return Acode.toast('No editable change to apply');
          if (State.lastPatch) {
            const next = Patch.applyUnified(Editor.text(), State.lastPatch);
            if (Editor.replaceAll(next)) Acode.toast('Patch applied');
            return;
          }
          if (!State.lastResult) return Acode.toast('No result yet');
          if (State.lastTarget === 'file' && !Editor.selectedText()) {
            if (Editor.replaceAll(State.lastResult)) Acode.toast('File replaced');
          } else if (Editor.replaceSelection(State.lastResult)) {
            Acode.toast('Selection replaced');
          }
        } catch (error) {
          Acode.alert('Apply failed', error.message || String(error));
        }
      },
      reject(root) {
        State.lastResult = '';
        State.lastPatch = '';
        State.lastResultKind = '';
        State.lastSummary = 'Change rejected';
        this.render(root || State.panel);
      }
    };


    /*
     * Ace AI v0.8 UI layer
     * Single agentic chat with mode + permission picker. Legacy Chat/Edit/Agent/Review
     * tabs are intentionally replaced with one conversation surface and inline review.
     */

  // ---- ui/v8-layer.js ----
    const V8 = {
      ensure() {
        if (!State.v8Ready) {
          State.aiMode = State.aiMode || Store.settings().agentMode || 'agent';
          if (State.aiMode === 'ask' || State.aiMode === 'chat' || State.aiMode === 'edit') State.aiMode = 'agent';
          State.permissionMode = State.permissionMode || Store.settings().permissionMode || 'safe';
          State.reviewOpen = Boolean(State.reviewOpen || Store.settings().reviewOpen);
          State.activeTab = 'chat';
          State.v8Ready = true;
        }
      },
      modeLabel() {
        const mode = State.aiMode || 'agent';
        if (mode === 'plan') return 'Plan';
        return 'Agent';
      },
      permissionLabel() {
        const mode = State.permissionMode || 'safe';
        if (mode === 'balanced') return 'Balanced';
        if (mode === 'autopilot') return 'Autopilot';
        return 'Safe';
      },
      modeHelp() {
        const mode = State.aiMode || 'agent';
        if (mode === 'plan') return 'Plan first. Discuss the approach and do not edit files.';
        const perm = State.permissionMode || 'safe';
        if (perm === 'autopilot') return 'Agent can discuss, plan, and use tools. Write actions may be automated only when explicitly allowed.';
        return 'Agent can discuss normally and propose reviewable changes when needed.';
      },
      toolSummary() {
        if (!State.pendingTools.length) return '';
        const selected = AgentTools.selectedTools().length;
        const blocked = State.pendingTools.filter((t) => t.error).length;
        const decision = PermissionModel.evaluateSelection();
        const canApply = selected > 0;
        const applyAct = decision.action === 'ask' ? 'allow-once-tools' : 'apply-tools';
        const applyLabel = !canApply ? 'No applicable changes' : (decision.action === 'ask' ? `Allow & apply (${selected})` : `Apply (${selected})`);
        const applyDisabled = canApply ? '' : ' disabled';
        const alwaysButton = decision.action === 'ask' && canApply ? '<button class="ace-ai-btn" data-act="allow-always-tools">Always</button>' : '';
        const canUseActive = (State.pendingTools || []).some((t) => t.error && AgentTools.canConvertToActiveEditor(t));
        const notice = State.reviewNotice ? `<div class="ace-ai-mini ace-ai-review-notice">${Util.html(State.reviewNotice)}</div>` : '';
        const blockedHint = blocked && !selected ? `<div class="ace-ai-mini ace-ai-blocked-mini">${canUseActive ? 'Blocked because the path is not writable yet. Tap Use active editor or set Project Root in Settings.' : 'Blocked. Open Review for the exact reason.'}</div>` : '';
        const items = State.pendingTools.slice(0, 5).map((tool) => {
          const type = tool.name === 'create_file' ? '+'
            : tool.name === 'append_file' ? 'A'
            : tool.name === 'replace_selection' ? 'S'
            : tool.name === 'insert_at_cursor' ? 'I'
            : 'M';
          const target = AgentTools.targetOf(tool) || tool.path || 'active editor';
          const status = tool.error ? 'blocked' : (tool.selected === false ? 'skipped' : (AgentTools.hunkSummary(tool) || 'ready'));
          return `<div class="ace-ai-pending-row ${tool.error ? 'blocked' : ''}"><span>${type}</span><b>${Util.html(target)}</b><em>${Util.html(status)}</em></div>`;
        }).join('');
        return `<div class="ace-ai-card ace-ai-pending-card compact"><div class="ace-ai-row" style="justify-content:space-between;align-items:flex-start"><div><div class="ace-ai-label">Pending changes</div><div class="ace-ai-mini">${selected}/${State.pendingTools.length} ready${blocked ? ' · ' + blocked + ' blocked' : ''}</div></div><button class="ace-ai-btn ace-ai-primary" data-act="toggle-review">${State.reviewOpen ? 'Hide' : 'Review'}</button></div>${notice}<div class="ace-ai-pending-list">${items}</div>${blockedHint}<div class="ace-ai-row nowrap ace-ai-pending-actions"><button class="ace-ai-btn ace-ai-primary" data-act="${applyAct}"${applyDisabled}>${applyLabel}</button>${alwaysButton}<button class="ace-ai-btn" data-act="select-all-tools">All</button><button class="ace-ai-btn" data-act="select-no-tools">None</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div></div>`;
      },
      reviewDrawer() {
        if (!State.reviewOpen || !State.pendingTools.length) return '';
        return `<div class="ace-ai-review-drawer">${AgentTools.renderList()}</div>`;
      },
      appliedSummary() {
        const rows = [];
        const actualApply = State.lastAppliedSummary && !State.pendingTools.length && /^(Applied|Undo)/i.test(State.lastAppliedSummary);
        if (actualApply) rows.push(`<div class="ace-ai-card ace-ai-compact-card"><div class="ace-ai-label">Last apply</div><div class="ace-ai-mini">${Util.html(State.lastAppliedSummary)}</div>${State.undoStack.length ? '<div class="ace-ai-row" style="margin-top:7px"><button class="ace-ai-btn" data-act="undo-tools">Undo</button></div>' : ''}</div>`);
        const failedResults = (State.toolResults || []).filter((r) => r && !r.ok);
        if (failedResults.length) rows.push(`<div class="ace-ai-card ace-ai-error-card"><div class="ace-ai-label">Tool error</div>${failedResults.map((r) => `<div class="ace-ai-mini">× ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join('')}</div>`);
        const hasDiagFailure = (State.applyDiagnostics || []).some((d) => d && d.ok === false);
        if (State.showDiagnostics || hasDiagFailure) rows.push(V8.diagnosticsCard());
        return rows.join('');
      },
      diagnosticsCard() {
        const rows = (State.applyDiagnostics || []).slice(-12).map((d) => `<div class="ace-ai-diag-row ${d.ok ? 'ok' : 'fail'}"><span>${d.ok ? '✓' : '×'}</span><b>${Util.html(d.step || 'step')}</b><div class="ace-ai-mini">${Util.html(d.message || '')}</div></div>`).join('');
        const reads = (State.readToolResults || []).slice(-4).map((r) => `<div class="ace-ai-mini">${r.ok ? '✓' : '×'} ${Util.html(r.tool)} ${r.path ? '· ' + Util.html(r.path) : ''}</div>`).join('');
        const u = State.lastUsage || {};
        const total = u.total_tokens || u.totalTokenCount || ((u.output_tokens || 0) + (u.input_tokens || 0)) || '';
        const usage = State.lastUsage ? `<div class="ace-ai-mini">Tokens: input ${Util.html(u.input_tokens || u.prompt_tokens || '-')} · output ${Util.html(u.output_tokens || u.completion_tokens || '-')}${total ? ' · total ' + Util.html(total) : ''}</div>` : '';
        return `<div class="ace-ai-card"><div class="ace-ai-row" style="justify-content:space-between"><div><div class="ace-ai-label">Run details</div><div class="ace-ai-mini">Hidden by default to keep the chat clean.</div></div><button class="ace-ai-btn" data-act="copy-diagnostics">Copy</button></div>${usage}${reads ? `<div class="ace-ai-read-tools">${reads}</div>` : ''}<div class="ace-ai-diagnostics">${rows}</div></div>`;
      },
      modeControls() {
        let mode = State.aiMode || Store.settings().agentMode || 'agent';
        if (mode === 'ask' || mode === 'chat' || mode === 'edit') mode = 'agent';
        const permission = State.permissionMode || Store.settings().permissionMode || 'safe';
        return `<details class="ace-ai-options"><summary>Options · ${Util.html(mode === 'plan' ? 'Plan' : 'Agent')} · ${Util.html(permission)}</summary><div class="ace-ai-toolbar">
          <label><span>Mode</span><select class="ace-ai-select ace-ai-mini-select" data-role="ai-mode">
            <option value="agent" ${mode !== 'plan' ? 'selected' : ''}>Agent</option>
            <option value="plan" ${mode === 'plan' ? 'selected' : ''}>Plan</option>
          </select></label>
          <label><span>Permission</span><select class="ace-ai-select ace-ai-mini-select" data-role="permission-mode">
            <option value="safe" ${permission === 'safe' ? 'selected' : ''}>Safe</option>
            <option value="balanced" ${permission === 'balanced' ? 'selected' : ''}>Balanced</option>
            <option value="autopilot" ${permission === 'autopilot' ? 'selected' : ''}>Autopilot</option>
          </select></label>
          <label class="ace-ai-chip ace-ai-include-full"><input type="checkbox" data-role="include-full" ${Store.settings().includeFullFile ? 'checked' : ''}> Include full file</label>
        </div></details>`;
      },
      actionChips() {
        const items = Store.presets().slice(0, 3).map((p, i) => `<button class="ace-ai-chip" data-preset="${i}">${Util.html(p.name)}</button>`).join('');
        return `<div class="ace-ai-row nowrap ace-ai-action-chips">${items}<button class="ace-ai-chip" data-tool="agent-codebase">@codebase</button></div>`;
      },
      contextStrip() {
        const ctx = Editor.context();
        const file = ctx.file?.filename || 'untitled';
        const line = ctx.cursor?.line || 1;
        const selected = ctx.hasSelection ? `selection ${ctx.selectionLines} line${ctx.selectionLines > 1 ? 's' : ''}` : '';
        const state = ctx.dirty?.dirty ? 'unsaved' : 'saved';
        const meta = ['line ' + line, selected, state].filter(Boolean).join(' · ');
        return `<div class="ace-ai-context-strip compact"><span class="ace-ai-context-chip primary"><span>📄</span><b>${Util.html(file)}</b><small>${Util.html(meta)}</small></span></div>`;
      },
      emptyState() {
        return `<div class="ace-ai-empty-hero compact"><div><h3>Ready.</h3><p>Ask normally, use <b>@codebase</b> to search, or select code and tap <b>/fix</b>. Writes open Review first.</p></div><div class="ace-ai-empty-actions"><button class="ace-ai-chip" data-tool="agent-codebase">@codebase</button><button class="ace-ai-chip" data-preset="0">/fix</button><button class="ace-ai-chip" data-preset="1">/explain</button></div></div>`;
      },
      activityBlock() {
        if (!State.busy) return '';
        const activities = Array.isArray(State.toolActivity) ? State.toolActivity : [];
        const retry = State.retryStatus ? `<div class="ace-ai-activity-detail">${Util.html(State.retryStatus)}</div>` : '';
        const progress = State.toolProgress && !activities.length ? `<div class="ace-ai-activity-detail">${Util.html(State.toolProgress)}</div>` : '';
        if (!activities.length && !State.retryStatus && !State.toolProgress && State.streamingContent) return '';
        const groups = [];
        activities.forEach((item) => {
          const group = item.group || 'using tools';
          let bucket = groups.find((g) => g.name === group);
          if (!bucket) { bucket = { name: group, items: [] }; groups.push(bucket); }
          bucket.items.push(item);
        });
        const tree = groups.map((group) => {
          const items = group.items.map((item, index) => {
            const branch = index === group.items.length - 1 ? '└─' : '├─';
            const status = item.status === 'failed' ? 'failed' : item.status === 'done' ? 'done' : 'running';
            return `<div class="ace-ai-tree-child ${Util.html(status)}"><span>${branch}</span><b>${Util.html(item.target || item.tool || 'tool')}</b><em>${Util.html(status)}</em></div>`;
          }).join('');
          return `<div class="ace-ai-tool-tree"><div class="ace-ai-tree-root">${Util.html(group.name)}</div>${items}</div>`;
        }).join('');
        const showTyping = !activities.length && !State.streamingContent;
        return `<div class="ace-ai-activity-inline"><div class="ace-ai-thinking"><span>${showTyping ? 'Thinking…' : 'Working…'}</span></div>${tree}${retry}${progress}</div>`;
      },
      pushAssistant(content) {
        const value = Util.normalizeModelText(content || '');
        if (!value) return;
        const chat = Store.chat();
        const last = chat[chat.length - 1];
        const lastText = Util.normalizeModelText(last?.content || '');
        // Guard against double-save after streaming completion or a stale render
        // timer. This avoids two identical assistant cards or repeated content.
        if (last?.role === 'assistant' && lastText === value) return;
        chat.push({ role: 'assistant', content: value, time: Util.nowLabel() });
        Store.saveChat(chat);
      },
      applySummary(results) {
        const list = Array.isArray(results) ? results : [];
        const ok = list.filter((r) => r && r.ok);
        const failed = list.filter((r) => r && !r.ok);
        const lines = ['Applied changes summary:'];
        if (!ok.length && !failed.length) lines.push('- No tool result was returned.');
        ok.forEach((r) => lines.push(`- ${r.tool || 'tool'}: ${r.result || 'applied'}`));
        failed.forEach((r) => lines.push(`- ${r.tool || 'tool'} failed: ${r.result || 'unknown error'}`));
        if (State.undoStack.length) lines.push('', 'You can use Undo to revert the last apply batch.');
        return lines.join('\n');
      },
      async applyWithPermission(root, reply) {
        const decision = PermissionModel.evaluateSelection();
        State.lastPermissionReply = reply;
        if (!AgentTools.selectedTools().length) return Acode.toast('No applicable changes. Open Review for details.');
        if (decision.action === 'deny') return Acode.toast(decision.reason || 'Permission denied');
        if (decision.action === 'ask' && reply === 'allow') return Acode.toast('Approval required. Choose Allow once or Always.');
        if (reply === 'always') PermissionModel.rememberAlways();
        return UI.applyTools(root);
      }
    };

    (function installV8Layer() {
      V8.ensure();
      const baseCss = UI.css.bind(UI);
      const baseBind = UI.bind.bind(UI);
      const baseHandle = UI.handle.bind(UI);
      const baseSend = UI.send.bind(UI);
      const baseApplyTools = UI.applyTools.bind(UI);
      const baseUndoTools = UI.undoTools.bind(UI);
      const baseOpenPanel = UI.openPanel.bind(UI);
      const baseSaveSettings = UI.saveSettings.bind(UI);

      UI.css = function () {
        baseCss();
        if (document.getElementById('ace-ai-style-v8_16')) return;
        const style = document.createElement('style');
        style.id = 'ace-ai-style-v8_16';
        style.textContent = `
  .ace-ai-panel.v8{--ace-ai-bg:#0f1117;--ace-ai-surface:#161a22;--ace-ai-surface-2:#202633;--ace-ai-border:#2f3542;--ace-ai-text:#f3f6fb;--ace-ai-muted:#aab3c2;--ace-ai-code-bg:#0b0e13;letter-spacing:.01em}
  .ace-ai-panel.v8 .ace-ai-tabs{display:none!important}
  .ace-ai-panel.v8 .ace-ai-body{overflow:hidden;background:linear-gradient(180deg,#0f1117 0%,#11141b 100%)}
  .ace-ai-panel.v8 .ace-ai-body [data-view]{display:flex!important;flex-direction:column;min-height:0;overflow:hidden}
  .ace-ai-panel.v8 [data-view]:not([data-view="chat"]){display:none!important}
  .ace-ai-panel.v8 .ace-ai-head{padding:11px 12px;background:rgba(22,26,34,.96);backdrop-filter:blur(12px);border-bottom-color:#333a49}
  .ace-ai-head-main{min-width:0;flex:1 1 auto}.ace-ai-panel.v8 .ace-ai-brand{font-size:15px;line-height:1.2}.ace-ai-panel.v8 .ace-ai-sub{max-width:100%;font-size:11px;color:#9fa8b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ace-ai-panel.v8 .ace-ai-actions{gap:6px}.ace-ai-header-new{font-weight:850;min-width:42px}.ace-ai-panel.v8 .ace-ai-iconbtn,.ace-ai-panel.v8 .ace-ai-btn{min-height:36px;border-radius:12px;touch-action:manipulation}.ace-ai-panel.v8 .ace-ai-btn{padding:8px 11px}.ace-ai-panel.v8 button:focus-visible,.ace-ai-panel.v8 textarea:focus-visible,.ace-ai-panel.v8 select:focus-visible,.ace-ai-panel.v8 input:focus-visible{outline:2px solid rgba(77,163,255,.8);outline-offset:2px}
  .ace-ai-panel.v8 .ace-ai-card{padding:10px;border-radius:16px;background:rgba(22,26,34,.98);border-color:#303745}.ace-ai-panel.v8 .ace-ai-label{font-size:10px;letter-spacing:.09em;color:#aeb7c8}.ace-ai-panel.v8 .ace-ai-mini{line-height:1.45;color:#aab3c2}
  .ace-ai-chat-surface{gap:10px;min-height:0}.ace-ai-context-strip{display:flex;gap:6px;overflow-x:auto;flex:0 0 auto;padding:0 1px 2px;scrollbar-width:none}.ace-ai-context-strip::-webkit-scrollbar{display:none}.ace-ai-context-chip{display:inline-flex;align-items:center;gap:5px;max-width:210px;min-height:26px;padding:5px 9px;border:1px solid #303745;border-radius:999px;background:#121720;color:#dce5f3;font-size:11px;white-space:nowrap}.ace-ai-context-chip b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px}.ace-ai-context-chip.muted{color:#aab3c2;background:#10141b}.ace-ai-context-chip.warn{border-color:rgba(215,166,74,.55);background:rgba(215,166,74,.12);color:#ffe2a2}
  .ace-ai-conversation{display:flex;flex-direction:column;gap:10px;min-height:0;flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:1px 2px 2px 1px;scrollbar-gutter:stable}.ace-ai-panel.v8 .ace-ai-conversation{min-height:180px}
  .ace-ai-panel.v8 .ace-ai-msg{border-radius:16px;padding:10px 11px;background:#161b24;border-color:#2d3442;white-space:normal;line-height:1.48;font-size:13px;box-shadow:0 1px 0 rgba(255,255,255,.02)}.ace-ai-panel.v8 .ace-ai-msg.user{margin-left:14px;background:#1d2533}.ace-ai-panel.v8 .ace-ai-msg.assistant{margin-right:14px;background:#151a22}.ace-ai-msg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:#f3f6fb}.ace-ai-msg-role{font-weight:850;font-size:12px}.ace-ai-msg-body{white-space:pre-wrap;word-break:break-word;color:#eef3fa}.ace-ai-md{white-space:normal}.ace-ai-md p{margin:0 0 10px;white-space:normal}.ace-ai-md p:last-child{margin-bottom:0}.ace-ai-md ul,.ace-ai-md ol{margin:6px 0 10px;padding-left:20px}.ace-ai-md li{margin:3px 0}.ace-ai-md strong{font-weight:850;color:#f7fbff}.ace-ai-md code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b0e13;border:1px solid #2e3746;border-radius:6px;padding:1px 4px;color:#dfeaff}.ace-ai-md h1,.ace-ai-md h2,.ace-ai-md h3{margin:10px 0 6px;line-height:1.25}.ace-ai-md-code{border:1px solid #303a4b;border-radius:13px;background:#0a0d12;margin:10px 0;overflow:hidden}.ace-ai-md-code-head{display:flex;align-items:center;justify-content:space-between;padding:6px 9px;border-bottom:1px solid #26303e;color:#9fb0c8;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.ace-ai-md-code pre{margin:0;padding:10px;overflow:auto;white-space:pre;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.ace-ai-md-code code{background:transparent;border:0;padding:0;color:#e8f1ff}.ace-ai-streaming .ace-ai-msg-body::after{content:"▌";display:inline-block;margin-left:2px;animation:ace-ai-blink 1s steps(2,start) infinite}
  .ace-ai-activity-inline{align-self:flex-start;max-width:92%;border:1px solid #2f3a4d;background:linear-gradient(180deg,#131923,#10151d);border-radius:16px;padding:10px 11px;box-shadow:0 1px 0 rgba(255,255,255,.02)}.ace-ai-thinking{display:flex;align-items:center;gap:7px;font-weight:850;font-size:12px;color:#e7f1ff}.ace-ai-thinking::before,.ace-ai-thinking::after{content:'';width:16px;height:1px;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(77,163,255,.85),transparent);animation:ace-ai-shine 1.25s linear infinite}.ace-ai-thinking::after{animation-delay:.25s}.ace-ai-thinking span{background:linear-gradient(90deg,#8fbfff,#eef6ff,#8fbfff);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ace-ai-textshine 1.4s linear infinite}.ace-ai-activity-detail{margin-top:6px;color:#aab3c2;font-size:11px;line-height:1.4}.ace-ai-tool-tree{margin-top:8px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#cdd7e6}.ace-ai-tree-root{font-weight:850;color:#dce9fb;margin-bottom:3px}.ace-ai-tree-child{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:5px;align-items:center;line-height:1.45;color:#aeb8c9}.ace-ai-tree-child b{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9f1fb}.ace-ai-tree-child em{font-style:normal;font-size:10px;color:#9fa8b8}.ace-ai-tree-child.running em{color:#8fbfff}.ace-ai-tree-child.done em{color:#9add8a}.ace-ai-tree-child.failed em{color:#ff9aa5}@keyframes ace-ai-shine{0%{opacity:.2;transform:scaleX(.6)}50%{opacity:1;transform:scaleX(1)}100%{opacity:.2;transform:scaleX(.6)}}@keyframes ace-ai-textshine{0%{background-position:0% 50%}100%{background-position:220% 50%}}
  .ace-ai-empty-hero{border:1px dashed #343c4b;background:#121720;border-radius:18px;padding:14px;text-align:left}.ace-ai-empty-hero h3{margin:0 0 6px;font-size:15px;line-height:1.25}.ace-ai-empty-hero p{margin:0;color:#aab3c2;line-height:1.45}.ace-ai-empty-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.ace-ai-empty-tip{border:1px solid #2c3340;background:#0f141c;border-radius:13px;padding:9px;font-size:12px;line-height:1.35;color:#dce5f3}.ace-ai-empty-tip span{display:block;color:#aab3c2;font-size:11px;margin-top:3px}
  .ace-ai-composer{flex:0 0 auto;border-color:#384152;background:linear-gradient(180deg,#171d27,#131820);box-shadow:0 -12px 30px rgba(0,0,0,.18)}.ace-ai-panel.v8 .ace-ai-composer{padding:10px}.ace-ai-composer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.ace-ai-composer-head .ace-ai-row{flex-wrap:nowrap;overflow-x:auto}.ace-ai-panel.v8 .ace-ai-textarea{min-height:62px;max-height:126px;resize:none;line-height:1.45;font-size:13px;width:100%;max-width:100%;display:block;box-sizing:border-box;border-radius:15px;background:var(--ace-ai-code-bg);border-color:#343c4b;padding:11px 12px}.ace-ai-panel.v8 .ace-ai-textarea::placeholder{color:#788398}.ace-ai-kbd{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid #3a4353;background:#111720;border-radius:6px;padding:1px 5px;color:#cbd5e6}
  .ace-ai-toolbar{display:flex;gap:8px;align-items:center;overflow-x:auto;padding:0 0 2px;flex-wrap:nowrap;scrollbar-width:none}.ace-ai-toolbar::-webkit-scrollbar{display:none}.ace-ai-toolbar label{display:flex;align-items:center;gap:6px;color:var(--ace-ai-muted);font-size:11px;white-space:nowrap;flex:0 0 auto}.ace-ai-mini-select{width:auto;min-width:86px;padding:7px 10px;border-radius:12px;font:12px system-ui;background:#0e131b}.ace-ai-mode-pill{display:inline-flex;align-items:center;border:1px solid #334055;background:#111720;border-radius:999px;padding:5px 8px;color:#dce5f3}.ace-ai-panel.v8 .ace-ai-include-full{padding:6px 9px;min-width:auto;white-space:nowrap;background:#111720}.ace-ai-panel.v8 .ace-ai-action-chips{margin-top:8px;gap:6px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}.ace-ai-panel.v8 .ace-ai-action-chips::-webkit-scrollbar{display:none}.ace-ai-panel.v8 .ace-ai-action-chips .ace-ai-chip{padding:7px 10px;flex:0 0 auto;background:#111720;border-color:#303847;color:#dce5f3}
  .ace-ai-pending-card{border-color:rgba(77,163,255,.5);background:linear-gradient(180deg,rgba(77,163,255,.10),rgba(22,26,34,.98))}.ace-ai-pending-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}.ace-ai-pending-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid #303745;border-radius:12px;background:#10151d}.ace-ai-pending-row span{color:var(--ace-ai-accent);font-weight:900;text-align:center}.ace-ai-pending-row b{font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ace-ai-pending-row em{font-style:normal;color:#aab3c2;font-size:11px}.ace-ai-pending-row.blocked{opacity:.65}.ace-ai-review-drawer{display:flex;flex-direction:column;gap:10px}.ace-ai-review-drawer .ace-ai-card{max-height:none}
  .ace-ai-panel.v8 .ace-ai-tree-row{grid-template-columns:auto 26px minmax(0,1fr) auto;padding:8px;border-radius:12px}.ace-ai-panel.v8 .ace-ai-tool{border-radius:15px;background:#10151d}.ace-ai-panel.v8 .ace-ai-tool-actions{margin-top:9px;gap:6px}.ace-ai-panel.v8 .ace-ai-tool-diff{background:#0a0d12;border-color:#303745}.ace-ai-panel.v8 .ace-ai-diff-line{grid-template-columns:28px 1fr;line-height:1.55}.ace-ai-panel.v8 .ace-ai-hunks{gap:10px}.ace-ai-panel.v8 .ace-ai-hunk{padding:9px;border-radius:14px;background:#0f141c}.ace-ai-panel.v8 .ace-ai-hunk.rejected{opacity:.66}.ace-ai-panel.v8 .ace-ai-hunk-head{align-items:flex-start}.ace-ai-panel.v8 .ace-ai-hunk-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.ace-ai-panel.v8 .ace-ai-hunk-actions .ace-ai-btn{padding:6px 8px;font-size:11px;min-height:30px}.ace-ai-panel.v8 .ace-ai-hunk .ace-ai-tool-diff{max-height:240px}.ace-ai-tool-error{margin-top:8px;color:#ffe0e3;background:rgba(224,108,117,.10);border:1px solid rgba(224,108,117,.5);border-radius:11px;padding:8px}.ace-ai-tool-warn{margin-top:8px;color:#ffe7b5;background:rgba(215,166,74,.12);border:1px solid rgba(215,166,74,.45);border-radius:11px;padding:8px}.ace-ai-blocked-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ace-ai-read-tools{display:flex;flex-direction:column;gap:5px;margin-top:8px}
  .ace-ai-diagnostics{display:flex;flex-direction:column;gap:5px}.ace-ai-diag-row{display:grid;grid-template-columns:18px 82px 1fr;gap:6px;align-items:start;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}.ace-ai-diag-row:first-child{border-top:0}.ace-ai-diag-row span{font-weight:900;text-align:center}.ace-ai-diag-row.ok span{color:#8bd17c}.ace-ai-diag-row.fail span{color:#ff9aa5}.ace-ai-diag-row b{font-size:11px;color:var(--ace-ai-muted);text-transform:uppercase;letter-spacing:.04em}
  .ace-ai-panel.v8 .ace-ai-footer{background:rgba(22,26,34,.98);border-top-color:#333a49}.ace-ai-panel.v8 .ace-ai-footer .ace-ai-row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.ace-ai-panel.v8 .ace-ai-footer .ace-ai-row::-webkit-scrollbar{display:none}
  .ace-ai-panel.v8 .ace-ai-body{background:#0f1117}
  .ace-ai-panel.v8 .ace-ai-head{padding:9px 11px}
  .ace-ai-header-new{font-size:18px;font-weight:750;min-width:38px;padding:0}
  .ace-ai-context-strip.compact{padding:0 1px 1px}
  .ace-ai-context-chip.primary{width:100%;max-width:none;justify-content:flex-start;border-radius:13px;background:#10151d}
  .ace-ai-context-chip.primary b{max-width:46%;font-size:12px}
  .ace-ai-context-chip.primary small{min-width:0;color:#9fa8b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
  .ace-ai-empty-hero.compact{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:15px}
  .ace-ai-empty-hero.compact h3{font-size:14px;margin:0 0 3px}
  .ace-ai-empty-hero.compact p{font-size:12px;line-height:1.4}
  .ace-ai-empty-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:0 0 auto}
  .ace-ai-panel.v8 .ace-ai-composer{padding:9px;border-radius:15px}
  .ace-ai-composer-head.compact{margin-bottom:6px}
  .ace-ai-composer-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#9fa8b8;font-size:11px}
  .ace-ai-options{margin-top:7px;border-top:1px solid rgba(255,255,255,.06);padding-top:7px}
  .ace-ai-options summary{cursor:pointer;color:#aab3c2;font-size:11px;list-style:none;user-select:none}
  .ace-ai-options summary::-webkit-details-marker{display:none}
  .ace-ai-options summary::before{content:'▸';display:inline-block;margin-right:6px;transition:transform .15s}
  .ace-ai-options[open] summary::before{transform:rotate(90deg)}
  .ace-ai-options .ace-ai-toolbar{margin-top:7px}
  .ace-ai-panel.v8 .ace-ai-action-chips{margin-top:7px}

  .ace-ai-pending-card.compact{padding:9px}.ace-ai-pending-actions{margin-top:8px}.ace-ai-review-notice{margin-top:6px;color:#cfe2ff}.ace-ai-blocked-mini{margin-top:7px;color:#ffdadd}.ace-ai-compact-card{padding:8px}.ace-ai-panel.v8 .ace-ai-pending-card .ace-ai-pending-list{gap:5px;margin-top:8px}.ace-ai-panel.v8 .ace-ai-pending-card .ace-ai-pending-row{padding:7px}
  @media(max-width:520px){.ace-ai-empty-grid{grid-template-columns:1fr}.ace-ai-panel.v8 .ace-ai-msg.user{margin-left:6px}.ace-ai-panel.v8 .ace-ai-msg.assistant{margin-right:6px}.ace-ai-context-chip{max-width:170px}.ace-ai-composer-head{align-items:flex-start;flex-direction:column}.ace-ai-composer-head .ace-ai-row{width:100%}}
  @media(max-height:720px){.ace-ai-panel.v8 .ace-ai-textarea{min-height:50px;max-height:92px}.ace-ai-panel.v8 .ace-ai-card{padding:8px}.ace-ai-panel.v8 .ace-ai-conversation{min-height:140px}}
  `
        document.head.appendChild(style);
      };

      UI.mountPanel = function (container, sidebar) {
        V8.ensure();
        this.css();
        container.innerHTML = this.shell();
        const root = container.querySelector('.ace-ai-panel');
        if (!root) return null;
        root.classList.add('v8');
        if (sidebar) {
          root.dataset.sidebar = '1';
          root.classList.remove('ace-ai-hidden');
          State.sidebarContainer = container;
        } else {
          State.panel = root;
        }
        this.bind(root);
        this.render(root);
        return root;
      };

      UI.shell = function () {
        return `<div class="ace-ai-panel ace-ai-hidden">
  <div class="ace-ai-head"><div class="ace-ai-head-main"><div class="ace-ai-brand">Ace AI <span class="ace-ai-mini">v${C.VERSION}</span></div><div class="ace-ai-sub" data-role="context-line">Agent · review before apply</div></div><div class="ace-ai-actions"><button class="ace-ai-iconbtn ace-ai-header-new" data-act="new-chat" title="Start a clean chat">＋</button><button class="ace-ai-iconbtn" data-act="settings" title="Settings">⚙</button><button class="ace-ai-iconbtn" data-act="toggle-max" title="Maximize">⤢</button><button class="ace-ai-iconbtn" data-act="close" title="Close">×</button></div></div>
  <div class="ace-ai-tabs"></div>
  <div class="ace-ai-body"><div data-view="chat"></div></div>
  <div class="ace-ai-footer" data-role="footer"></div>
  <div class="ace-ai-settings ace-ai-hidden" data-role="settings"></div></div>`;
      };

      UI.openPanel = function (tab, mode, seed) {
        V8.ensure();
        State.activeTab = 'chat';
        if (mode) State.aiMode = mode === 'plan' ? 'plan' : 'agent';
        const result = baseOpenPanel('chat', State.aiMode, seed);
        if (State.panel) {
          State.panel.classList.remove('ace-ai-hidden');
          State.panel.classList.add('v8');
          this.render(State.panel);
        }
        return result;
      };

      UI.updateContext = function (root) {
        const ctx = Editor.context();
        const line = root?.querySelector('[data-role="context-line"]');
        if (!line) return;
        const file = ctx.file?.filename || 'untitled';
        line.textContent = `${file} · line ${ctx.cursor?.line || 1}`;
      };

      UI.render = function (root) {
        if (!root) return;
        V8.ensure();
        State.activeTab = 'chat';
        this.updateContext(root);
        this.renderChat(root.querySelector('[data-view="chat"]'));
        this.renderSettings(root.querySelector('[data-role="settings"]'));
        this.updateFooter(root);
        const convo = root.querySelector('.ace-ai-conversation');
        if (convo) setTimeout(() => { convo.scrollTop = convo.scrollHeight; }, 0);
        root.classList.toggle('is-max', Boolean(State.maximized));
      };

      UI.renderChat = function (el) {
        if (!el) return;
        V8.ensure();
        const chat = Store.chat();
        const streamRow = State.streamingContent
          ? [{ role: 'assistant', content: State.streamingContent, time: 'streaming', streaming: true }]
          : [];
        const allRows = chat.concat(streamRow);
        const rows = allRows.length ? allRows.map((m) => {
          const role = m.role === 'user' ? 'You' : 'Ace AI';
          const mode = m.mode ? ` · ${Util.html(m.mode)}` : '';
          const body = m.role === 'assistant' ? Util.markdown(m.content) : Util.html(m.content);
          return `<div class="ace-ai-msg ${Util.html(m.role)} ${m.streaming ? 'ace-ai-streaming' : ''}"><div class="ace-ai-msg-head"><span class="ace-ai-msg-role">${role}</span><span class="ace-ai-mini">${Util.html(m.time || '')}${mode}</span></div><div class="ace-ai-msg-body ace-ai-md">${body}</div></div>`;
        }).join('') : V8.emptyState();
        const modePill = `<span class="ace-ai-mode-pill"><b>${Util.html(V8.modeLabel())}</b>${State.aiMode === 'agent' ? ' · ' + Util.html(V8.permissionLabel()) : ''}</span>`;
        el.innerHTML = `<div class="ace-ai-col ace-ai-chat-surface">${V8.contextStrip()}${this.errorBanner()}<div class="ace-ai-conversation">${rows}${V8.activityBlock()}${V8.toolSummary()}${V8.reviewDrawer()}${V8.appliedSummary()}</div><div class="ace-ai-card ace-ai-composer"><div class="ace-ai-composer-head compact"><div><div class="ace-ai-label">Prompt</div><div class="ace-ai-mini">${modePill} · edits open review first</div></div></div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="Ask, edit selection, or use @codebase...">${Util.html(State.draftPrompt || '')}</textarea><div class="ace-ai-composer-meta"><span><span class="ace-ai-kbd">Enter</span> send · Shift+Enter newline</span></div>${V8.actionChips()}${V8.modeControls()}</div></div>`;
        this.attachHints(el.querySelector('[data-role="prompt"]'));
      };

      UI.updateFooter = function (root) {
        const footer = root.querySelector('[data-role="footer"]');
        if (!footer) return;
        const selected = AgentTools.selectedTools().length;
        if (State.busy) {
          footer.innerHTML = '';
          return;
        }
        if (State.pendingTools.length) {
          const decision = PermissionModel.evaluateSelection();
          const reviewLabel = State.reviewOpen ? 'Hide review' : 'Review';
          if (!selected) {
            const canUseActive = (State.pendingTools || []).some((t) => t.error && AgentTools.canConvertToActiveEditor(t));
            footer.innerHTML = canUseActive
              ? `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="use-active-editor">Use active editor</button><button class="ace-ai-btn" data-act="toggle-review">${reviewLabel}</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`
              : `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" disabled>No applicable changes</button><button class="ace-ai-btn" data-act="toggle-review">${reviewLabel}</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`;
            return;
          }
          if (decision.action === 'allow') {
            footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="apply-tools">Apply selected (${selected})</button><button class="ace-ai-btn" data-act="toggle-review">${reviewLabel}</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`;
          } else {
            footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="allow-once-tools">Allow once & apply (${selected})</button><button class="ace-ai-btn" data-act="allow-always-tools">Always</button><button class="ace-ai-btn" data-act="toggle-review">${reviewLabel}</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`;
          }
          return;
        }
        footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">${State.aiMode === 'plan' ? 'Create plan' : 'Send'}</button>${State.undoStack.length ? '<button class="ace-ai-btn" data-act="undo-tools">Undo</button>' : ''}</div>`;
      };

      UI.handle = async function (act, root) {
        if (act === 'allow-once-tools' || act === 'apply-tools') {
          const decision = PermissionModel.evaluateSelection();
          const reply = act === 'allow-once-tools' ? 'once' : (decision.action === 'ask' ? 'once' : 'allow');
          return V8.applyWithPermission(root, reply);
        }
        if (act === 'allow-always-tools') {
          PermissionModel.rememberAlways();
          return V8.applyWithPermission(root, 'always');
        }
        if (act === 'toggle-review' || act === 'open-review') {
          State.reviewOpen = !State.reviewOpen;
          return this.render(root);
        }
        if (act === 'use-active-editor') {
          const count = AgentTools.convertBlockedToActiveEditor();
          State.reviewOpen = true;
          this.render(root);
          return Acode.toast(count ? ('Converted ' + count + ' change(s) to active editor') : 'No blocked change can use active editor');
        }
        if (act === 'toggle-diagnostics') {
          State.showDiagnostics = !State.showDiagnostics;
          return this.render(root);
        }
        if (act === 'copy-diagnostics') {
          await Util.copy(JSON.stringify(State.applyDiagnostics || [], null, 2));
          return Acode.toast('Diagnostics copied');
        }
        if (act === 'new-chat') {
          Store.clearChat();
          Runtime.clearTransientState();
          State.pendingTools = [];
          State.selectedToolIds = [];
          State.agentMessage = '';
          State.draftPrompt = '';
          State.lastAppliedSummary = '';
          State.lastSelectionSnapshot = null;
          State.lastResult = '';
          State.lastPatch = '';
          State.lastResultKind = '';
          State.lastUsage = null;
          State.readToolResults = [];
          State.toolActivity = [];
          State.reviewNotice = '';
          State.showRunDetails = false;
          State.applyDiagnostics = [];
          State.lastRequest = null;
          State.reviewOpen = false;
          Store.saveSettings({ reviewOpen: false });
          this.render(root);
          setTimeout(() => root?.querySelector('[data-role="prompt"]')?.focus(), 0);
          return Acode.toast('New chat started');
        }
        if (act === 'clear-tools') {
          State.pendingTools = [];
          State.selectedToolIds = [];
          State.lastToolJson = '';
          State.agentMessage = '';
          State.toolResults = [];
          State.agentPlan = '';
          State.lastAppliedSummary = ''; State.reviewNotice = 'Rejected pending agent tools.';
          State.showDiagnostics = false;
          State.showRunDetails = false;
          State.reviewOpen = false;
          State.activeTab = 'chat';
          return this.render(root);
        }
        const out = await baseHandle(act, root);
        State.activeTab = 'chat';
        return out;
      };

      UI.send = async function (root, forcedRequest) {
        V8.ensure();
        const modeSelect = root.querySelector('[data-role="ai-mode"]');
        const permSelect = root.querySelector('[data-role="permission-mode"]');
        if (modeSelect) State.aiMode = modeSelect.value || 'agent';
        if (State.aiMode === 'ask' || State.aiMode === 'chat' || State.aiMode === 'edit') State.aiMode = 'agent';
        if (permSelect) State.permissionMode = permSelect.value || 'safe';
        Store.saveSettings({ agentMode: State.aiMode, permissionMode: State.permissionMode });

        const mode = forcedRequest?.mode || (State.aiMode === 'plan' ? 'chat' : 'agent');
        const displayPrompt = forcedRequest?.displayPrompt || forcedRequest?.prompt || this.getPrompt(root);
        let prompt = forcedRequest?.prompt || displayPrompt;
        if (State.aiMode === 'plan' && !forcedRequest) {
          prompt = 'Create a concise implementation plan only. Discuss tradeoffs and steps. Do not propose file writes or tool calls yet. Task: ' + prompt;
        }
        if (State.aiMode === 'agent' && State.permissionMode === 'safe' && !forcedRequest) {
          prompt = prompt + '\n\nPermission: Safe mode. You may answer normally in plain text. Return reviewable tool-call JSON only for file/create/edit/write actions. Do not claim changes are applied. If selected code exists, edit the selection with replace_selection unless the user explicitly asks for the whole file. If Project Root is unknown or the active tab is unsaved, prefer replace_selection or replace_file with empty path for active-editor edits instead of create_file/write_file/replace_file with the active filename. Use read_file/list_files/search_in_files only when @file/@codebase or real codebase inspection is needed; do not call tools for greetings or capability questions.';
        }
        State.activeTab = mode === 'agent' ? 'agent' : 'chat';
        await baseSend(root, Object.assign({}, forcedRequest || {}, { mode, outputMode: mode === 'agent' ? 'tools' : 'chat', prompt, displayPrompt }));
        State.activeTab = 'chat';
        if (mode === 'agent' && State.agentMessage) {
          V8.pushAssistant(State.agentMessage);
          State.agentMessage = '';
        }
        if (State.pendingTools.length) State.reviewOpen = false;
        this.render(root);
      };

      UI.setBusy = function (root, yes) {
        if (!root) return;
        root.querySelectorAll('button,textarea,input,select').forEach((el) => {
          if (el.matches('[data-act="close"],[data-act="toggle-max"]')) return;
          el.disabled = Boolean(yes);
        });
        root.querySelectorAll('[data-act="send"]').forEach((send) => {
          send.textContent = State.aiMode === 'plan' ? 'Create plan' : 'Send';
        });
      };

      UI.applyTools = async function (root) {
        const beforeCount = State.pendingTools.length;
        await baseApplyTools(root);
        State.activeTab = 'chat';
        State.reviewOpen = Boolean(State.pendingTools.length);
        if (State.toolResults && State.toolResults.length) {
          V8.pushAssistant(V8.applySummary(State.toolResults));
        } else if (beforeCount && !State.pendingTools.length) {
          V8.pushAssistant('Applied selected changes. No detailed tool result was returned.');
        }
        this.render(root);
      };

      UI.undoTools = async function (root) {
        await baseUndoTools(root);
        State.activeTab = 'chat';
        State.reviewOpen = true;
        this.render(root);
      };

      UI.saveSettings = function (root) {
        let mode = root.querySelector('[data-role="ai-mode"]')?.value || State.aiMode || 'agent';
        if (mode === 'ask' || mode === 'chat' || mode === 'edit') mode = 'agent';
        const permission = root.querySelector('[data-role="permission-mode"]')?.value || State.permissionMode || 'safe';
        Store.saveSettings({ agentMode: mode, permissionMode: permission });
        return baseSaveSettings(root);
      };
    })();

  // ---- native/acode-integration.js ----
  const Native = {
    install() {
      UI.css();
      this.installSideButton();
      this.installSidebarApp();
      this.installSelectionMenu();
      this.installCommands();
      Editor.onChange(() => {
        if (State.panel && !State.panel.classList.contains('ace-ai-hidden')) UI.render(State.panel);
        if (State.sidebarContainer) UI.render(State.sidebarContainer.querySelector('.ace-ai-panel'));
      });
    },
    installSideButton() {
      const SideButton = Acode.require('sideButton');
      if (typeof SideButton === 'function') {
        try {
          State.sideButton = SideButton({
            text: 'AI',
            icon: 'ace-ai',
            backgroundColor: '#1d2026',
            textColor: '#fff',
            onclick: () => { try { UI.openPanel('chat'); } catch (e) { try { Acode.toast('Ace AI open failed: ' + (e.message || e)); } catch (_) {} } }
          });
          State.sideButton.show?.();
          return;
        } catch (_) {}
      }
      const btn = document.createElement('button');
      btn.className = 'ace-ai-fab';
      btn.textContent = 'AI';
      btn.addEventListener('click', () => UI.openPanel('chat'));
      document.body.appendChild(btn);
      State.fallbackButton = btn;
    },
    installSidebarApp() {
      const sideBarApps = Acode.require('sidebarApps');
      if (!sideBarApps || typeof sideBarApps.add !== 'function') return;
      try {
        sideBarApps.add('ace-ai', C.SIDEBAR_ID, 'Ace AI', (container) => {
          State.sidebarContainer = container;
          UI.mountPanel(container, true);
        }, false, (container) => {
          State.sidebarContainer = container;
          const existing = container.querySelector('.ace-ai-panel');
          if (!existing) UI.mountPanel(container, true);
          else UI.render(existing);
        });
      } catch (_) {}
    },
    installSelectionMenu() {
      const selectionMenu = Acode.require('selectionMenu');
      if (!selectionMenu || typeof selectionMenu.add !== 'function') return;
      const add = (label, mode, seed, aiMode) => {
        try {
          selectionMenu.add(() => UI.openPanel('chat', aiMode || 'agent', seed), label, mode || 'selected', false);
          State.registeredSelectionItems.push(label);
        } catch (_) {}
      };
      add('Ace Fix', 'selected', 'Fix the selected code.');
      add('Ace Explain', 'selected', 'Explain the selected code or error.');
      add('Ace Refactor', 'selected', 'Refactor the selected code safely.');
      add('Ace Agent', 'all', 'Discuss, plan, or use tools with review.');
      add('Ace Plan', 'all', 'Create a plan before editing.', 'plan');
    },
    commandDescriptor(name, description, tab, mode, seed) {
      return { name, description, bindKey: null, exec: () => { UI.openPanel(tab, mode, seed); return true; } };
    },
    installCommands() {
      const items = [
        this.commandDescriptor('ace-ai.agent', 'Ace AI: Agent', 'chat', 'agent', ''),
        this.commandDescriptor('ace-ai.plan', 'Ace AI: Plan', 'chat', 'plan', ''),
        this.commandDescriptor('ace-ai.explainError', 'Ace AI: Explain Error', 'chat', 'agent', 'Explain the selected error/code and give the smallest fix.'),
        this.commandDescriptor('ace-ai.generateWidget', 'Ace AI: Generate Neosantara Widget', 'chat', 'agent', 'Generate a clean Neosantara widget embed section.'),
        this.commandDescriptor('ace-ai.agentTools', 'Ace AI: Agent Tools', 'chat', 'agent', 'Use tools to edit/create/write files.')
      ];
      items.forEach((cmd) => this.addCommand(cmd));
    },
    addCommand(cmd) {
      try {
        if (window.acode && typeof window.acode.addCommand === 'function') {
          window.acode.addCommand(cmd); State.registeredCommands.push(['acode', cmd.name]); return;
        }
      } catch (_) {}
      const commands = Acode.require('commands');
      try {
        if (commands && typeof commands.addCommand === 'function') { commands.addCommand(cmd); State.registeredCommands.push(['commands', cmd.name]); return; }
        if (commands?.registry && typeof commands.registry.add === 'function') { commands.registry.add(cmd); State.registeredCommands.push(['registry', cmd.name]); return; }
      } catch (_) {}
      try {
        const view = Editor.view();
        if (view?.commands && typeof view.commands.addCommand === 'function') { view.commands.addCommand(cmd); State.registeredCommands.push(['editor', cmd.name]); }
      } catch (_) {}
    },
    cleanupCommands() {
      State.registeredCommands.forEach(([kind, name]) => {
        try {
          if (kind === 'acode' && window.acode?.removeCommand) window.acode.removeCommand(name);
          else if (kind === 'commands') Acode.require('commands')?.removeCommand?.(name);
          else if (kind === 'registry') Acode.require('commands')?.registry?.remove?.(name);
          else if (kind === 'editor') Editor.view()?.commands?.removeCommand?.(name);
        } catch (_) {}
      });
      State.registeredCommands = [];
    },
    cleanup() {
      try { State.sideButton?.hide?.(); } catch (_) {}
      try { State.fallbackButton?.remove?.(); } catch (_) {}
      try { Acode.require('sidebarApps')?.remove?.(C.SIDEBAR_ID); } catch (_) {}
      try { State.contextMenu?.destroy?.(); } catch (_) {}
      this.cleanupCommands();
      Editor.removeListeners();
      Acode.removeBackAction();
      try { State.panel?.parentElement?.remove?.(); } catch (_) {}
      try { document.getElementById('ace-ai-style-v8_3-base')?.remove?.(); } catch (_) {}
    }
  };

  // ---- lifecycle/page.js ----
  const Page = {
    render($page) {
      if (!$page) return;
      $page.innerHTML = `<div style="padding:18px;font-family:system-ui"><h2>Ace AI v${C.VERSION}</h2><p>Acode-native chat-first AI coding assistant with optional approval-first Agent mode. Use side button, selection menu, command palette, or sidebar app.</p><button id="ace-ai-open-page" style="padding:10px 14px;border-radius:12px;border:0;background:#1d2026;color:white;border:1px solid #30343c;font-weight:800">Open Ace AI</button><p style="opacity:.75;font-size:13px">Set your Neosantara API key from Ace AI → Settings.</p></div>`;
      $page.querySelector('#ace-ai-open-page')?.addEventListener('click', () => UI.openPanel('chat'));
    }
  };

  // ---- lifecycle/plugin.js ----
  function init(baseUrl, $page, cache) {
    State.baseUrl = baseUrl || '';
    State.cache = cache || null;
    State.page = $page || null;
    try { if (window.acode?.addIcon) window.acode.addIcon('ace-ai', State.baseUrl + 'icon.png', { monochrome: false }); } catch (_) {}
    Runtime.clearTransientState();
    PermissionModel.resetSession();
    Page.render($page);
    Native.install();
    Acode.toast('Ace AI v' + C.VERSION + ' ready');
  }

  function unmount() {
    Native.cleanup();
  }

  if (window.acode && typeof window.acode.setPluginInit === 'function') {
    window.acode.setPluginInit(C.PLUGIN_ID, init);
    window.acode.setPluginUnmount(C.PLUGIN_ID, unmount);
  } else {
    console.warn('Ace AI: acode global not found.');
  }


})();
