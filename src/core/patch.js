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
