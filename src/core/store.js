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
