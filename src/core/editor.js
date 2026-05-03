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
