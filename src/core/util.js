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
