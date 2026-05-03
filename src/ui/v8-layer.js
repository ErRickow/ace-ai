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
