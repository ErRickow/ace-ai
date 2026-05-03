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
