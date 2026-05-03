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
