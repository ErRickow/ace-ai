const V8 = {
  ensure() {
    if (!State.v8Ready) {
      State.aiMode = State.aiMode || Store.settings().agentMode || "agent";
      if (
        State.aiMode === "ask" ||
        State.aiMode === "chat" ||
        State.aiMode === "edit"
      )
        State.aiMode = "agent";
      State.permissionMode =
        State.permissionMode || Store.settings().permissionMode || "safe";
      State.reviewOpen = Boolean(
        State.reviewOpen || Store.settings().reviewOpen,
      );
      State.activeTab = "chat";
      State.v8Ready = true;
    }
  },
  modeLabel() {
    const mode = State.aiMode || "agent";
    if (mode === "plan") return "Plan";
    return "Agent";
  },
  permissionLabel() {
    const mode = State.permissionMode || "safe";
    if (mode === "balanced") return "Balanced";
    if (mode === "autopilot") return "Autopilot";
    return "Safe";
  },
  contextMeta(ctx) {
    const title = ctx.file?.filename || "untitled";
    const line = ctx.cursor?.line || 1;
    const around = ctx.cursorContext
      ? `${ctx.cursorContext.startLine || line}-${ctx.cursorContext.endLine || line}`
      : `${line}`;
    const selection = ctx.hasSelection
      ? `${ctx.selectionLines} selected line${ctx.selectionLines > 1 ? "s" : ""}`
      : `around cursor ${around}`;
    const visible = ctx.visibleRange
      ? `visible ${ctx.visibleRange.startLine || 1}-${ctx.visibleRange.endLine || 1}`
      : "visible range unknown";
    const openFiles = `${ctx.openFiles?.length || 1} open`;
    const state = ctx.dirty?.dirty ? "unsaved" : "saved";
    return {
      title,
      detail: `${selection} · ${visible} · ${openFiles} · ${state}`,
    };
  },
  modeHelp() {
    const mode = State.aiMode || "agent";
    if (mode === "plan")
      return "Plan first. Discuss the approach and do not edit files.";
    const perm = State.permissionMode || "safe";
    if (perm === "autopilot")
      return "Agent can discuss, plan, and use tools. Write actions may be automated only when explicitly allowed.";
    return "Agent can discuss normally and propose reviewable changes when needed.";
  },
  toolSummary() {
    if (!State.pendingTools.length) return "";
    const selected = AgentTools.selectedTools().length;
    const total = State.pendingTools.length;
    const blocked = State.pendingTools.filter((t) => t.error).length;
    const decision = PermissionModel.evaluateSelection();
    const canApply = selected > 0;
    const applyAct =
      decision.action === "ask" ? "allow-once-tools" : "apply-tools";
    const applyLabel = !canApply ? "No changes" : `Apply ${selected}`;
    const applyDisabled = canApply ? "" : " disabled";
    const notice = State.reviewNotice
      ? `<div class="ace-ai-mini ace-ai-review-notice">${Util.html(State.reviewNotice)}</div>`
      : "";
    const subtitle = blocked
      ? `${selected}/${total} selected · ${blocked} blocked · diff shown below`
      : `${selected}/${total} selected · diff shown below`;
    return `<div class="ace-ai-card ace-ai-pending-card ace-ai-review-compact"><div class="ace-ai-review-top"><div class="ace-ai-review-copy"><div class="ace-ai-label">Review changes</div><div class="ace-ai-mini">${Util.html(subtitle)}</div></div></div>${notice}${V8.reviewTimeline()}<div class="ace-ai-review-drawer inline">${AgentTools.renderFileTree({ actions: false })}${AgentTools.renderList({ embedded: true })}</div><div class="ace-ai-review-actions"><button class="ace-ai-btn ace-ai-primary" data-act="${applyAct}"${applyDisabled}>${applyLabel}</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div></div>`;
  },
  reviewDrawer() {
    return "";
  },
  reviewTimeline() {
    const rows = [];
    const add = (kind, label, status, detail) => {
      rows.push(
        `<div class="ace-ai-timeline-row ${Util.html(status || "todo")}"><span></span><b>${Util.html(label)}</b><em>${Util.html(detail || kind || "")}</em></div>`,
      );
    };
    const activities = Array.isArray(State.toolActivity)
      ? State.toolActivity
      : [];
    activities.slice(-4).forEach((item) => {
      add(
        item.group || item.tool || "tool",
        item.target || item.tool || "tool",
        item.status || "done",
        item.group || item.tool || "observed",
      );
    });
    (State.pendingTools || []).slice(0, 6).forEach((tool) => {
      add(
        tool.name,
        AgentTools.targetOf(tool),
        tool.error ? "blocked" : tool.selected === false ? "skipped" : "ready",
        AgentTools.operationKind(tool),
      );
    });
    if ((State.pendingTools || []).length > 6)
      add("more", `+${State.pendingTools.length - 6} more`, "todo", "pending");
    return rows.length
      ? `<div class="ace-ai-timeline">${rows.join("")}</div>`
      : "";
  },
  appliedSummary() {
    const rows = [];
    const failedResults = (State.toolResults || []).filter((r) => r && !r.ok);
    if (failedResults.length)
      rows.push(
        `<div class="ace-ai-card ace-ai-error-card"><div class="ace-ai-label">Tool error</div>${failedResults.map((r) => `<div class="ace-ai-mini">× ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join("")}</div>`,
      );
    const hasDiagFailure = (State.applyDiagnostics || []).some(
      (d) => d && d.ok === false,
    );
    if (State.showDiagnostics || hasDiagFailure)
      rows.push(V8.diagnosticsCard());
    return rows.join("");
  },
  diagnosticsCard() {
    const rows = (State.applyDiagnostics || [])
      .slice(-12)
      .map(
        (d) =>
          `<div class="ace-ai-diag-row ${d.ok ? "ok" : "fail"}"><span>${d.ok ? "✓" : "×"}</span><b>${Util.html(d.step || "step")}</b><div class="ace-ai-mini">${Util.html(d.message || "")}</div></div>`,
      )
      .join("");
    const reads = (State.readToolResults || [])
      .slice(-4)
      .map(
        (r) =>
          `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)} ${r.path ? "· " + Util.html(r.path) : ""}</div>`,
      )
      .join("");
    const u = State.lastUsage || {};
    const total =
      u.total_tokens ||
      u.totalTokenCount ||
      (u.output_tokens || 0) + (u.input_tokens || 0) ||
      "";
    const usage = State.lastUsage
      ? `<div class="ace-ai-mini">Tokens: input ${Util.html(u.input_tokens || u.prompt_tokens || "-")} · output ${Util.html(u.output_tokens || u.completion_tokens || "-")}${total ? " · total " + Util.html(total) : ""}</div>`
      : "";
    return `<div class="ace-ai-card"><div class="ace-ai-row" style="justify-content:space-between"><div><div class="ace-ai-label">Run details</div><div class="ace-ai-mini">Hidden by default to keep the chat clean.</div></div><button class="ace-ai-btn" data-act="copy-diagnostics">Copy</button></div>${usage}${reads ? `<div class="ace-ai-read-tools">${reads}</div>` : ""}<div class="ace-ai-diagnostics">${rows}</div></div>`;
  },
  modeControls() {
    let mode = State.aiMode || Store.settings().agentMode || "agent";
    if (mode === "ask" || mode === "chat" || mode === "edit") mode = "agent";
    const permission =
      State.permissionMode || Store.settings().permissionMode || "safe";
    const themePref = ThemeSystem.preference();
    return `<details class="ace-ai-options"><summary>Options · ${Util.html(mode === "plan" ? "Plan" : "Agent")} · ${Util.html(permission)}</summary><div class="ace-ai-toolbar">
        <label><span>Mode</span><select class="ace-ai-select ace-ai-mini-select" data-role="ai-mode">
          <option value="agent" ${mode !== "plan" ? "selected" : ""}>Agent</option>
          <option value="plan" ${mode === "plan" ? "selected" : ""}>Plan</option>
        </select></label>
        <label><span>Permission</span><select class="ace-ai-select ace-ai-mini-select" data-role="permission-mode">
          <option value="safe" ${permission === "safe" ? "selected" : ""}>Safe</option>
          <option value="balanced" ${permission === "balanced" ? "selected" : ""}>Balanced</option>
          <option value="autopilot" ${permission === "autopilot" ? "selected" : ""}>Autopilot</option>
        </select></label>
        <label><span>Theme</span><select class="ace-ai-select ace-ai-mini-select" data-role="theme-mode">
          <option value="auto" ${themePref === "auto" ? "selected" : ""}>Auto</option>
          <option value="dark" ${themePref === "dark" ? "selected" : ""}>Dark</option>
          <option value="light" ${themePref === "light" ? "selected" : ""}>Light</option>
        </select></label>
        <label class="ace-ai-chip ace-ai-include-full"><input type="checkbox" data-role="include-full" ${Store.settings().includeFullFile ? "checked" : ""}> Include full file</label>
      </div></details>`;
  },
  actionChips() {
    const items = Store.presets()
      .slice(0, 3)
      .map(
        (p, i) =>
          `<button class="ace-ai-chip" data-preset="${i}">${Util.html(p.name)}</button>`,
      )
      .join("");
    const active = Editor.info();
    const currentFile =
      active?.filename && active.filename !== "untitled"
        ? active.filename
        : "current file";
    const checkCmd = /^[\w./-]+\.m?js$/i.test(currentFile)
      ? `node --check ${currentFile}`
      : "npm run lint";
    return `<div class="ace-ai-row nowrap ace-ai-action-chips">${items}${VoiceInput.buttonHtml()}<button class="ace-ai-chip" data-act="attach-current-file">Attach file</button><button class="ace-ai-chip" data-tool="agent-codebase">@codebase</button><button class="ace-ai-chip" data-tool="agent-review-file">Review file</button><button class="ace-ai-chip" data-tool="agent-diagnose">Diagnose</button><button class="ace-ai-chip" data-act="run-command" data-cmd="npm run lint">Run lint</button><button class="ace-ai-chip" data-act="run-command" data-cmd="npm test">Run tests</button><button class="ace-ai-chip" data-act="run-command" data-cmd="${Util.html(checkCmd)}">Syntax</button></div>`;
  },
  contextStrip() {
    const ctx = Editor.context();
    const meta = this.contextMeta(ctx);
    const attached = Array.isArray(State.contextAttachments)
      ? State.contextAttachments
      : [];
    const chips = attached
      .slice(0, 6)
      .map(
        (item, index) =>
          `<button class="ace-ai-context-chip attached" data-act="remove-attachment" data-attachment-index="${index}" title="Remove pinned context"><span>📌</span><b>${Util.html(item.filename || item.path || "context")}</b><small>${Number(item.line_count || 0) || ""} lines · tap to remove</small></button>`,
      )
      .join("");
    const clear = attached.length
      ? `<button class="ace-ai-context-chip muted" data-act="clear-attachments"><span>×</span><b>Clear pins</b><small>${attached.length}</small></button>`
      : "";
    return `<div class="ace-ai-context-strip compact"><span class="ace-ai-context-chip primary"><span>📄</span><b>${Util.html(meta.title)}</b><small>${Util.html(meta.detail)}</small></span>${chips}${clear}</div>`;
  },
  emptyState() {
    const presets = Store.presets();
    const fixChip =
      presets.length > 0
        ? `<button class="ace-ai-chip" data-preset="0">${Util.html(presets[0]?.name || "/fix")}</button>`
        : "";
    const explainChip =
      presets.length > 1
        ? `<button class="ace-ai-chip" data-preset="1">${Util.html(presets[1]?.name || "/explain")}</button>`
        : "";
    return `<div class="ace-ai-empty-hero compact"><div><h3>Ready.</h3><p>Ask normally, use <b>@codebase</b> to search, or select code and tap a quick action. Writes open Review first.</p></div><div class="ace-ai-empty-actions"><button class="ace-ai-chip" data-tool="agent-codebase">@codebase</button><button class="ace-ai-chip" data-tool="agent-diagnose">Diagnose</button>${fixChip}${explainChip}</div></div>`;
  },
  shouldShowStreaming() {
    if (!State.streamingContent) return false;
    if (State.suppressStreamingPreview) return false;
    // Agent/tool mode commonly emits provisional text before tool observations.
    // Keep the chat clean: show the structured working stepper first, then the
    // final answer after read tools complete.
    if (State.streamingMode === "agent" && State.busy) return false;
    return true;
  },
  activityLabel(item) {
    const name = String(item?.tool || item?.group || "tool");
    const map = {
      project_overview: "Diagnose project",
      read_file: "Read file",
      list_files: "List files",
      search_in_files: "Search codebase",
      open_file: "Open file",
      reading: "Read file",
      listing: "List files",
      searching: "Search codebase",
      diagnosing: "Diagnose project",
      opening: "Open file",
    };
    return map[name] || map[String(item?.group || "")] || "Use tool";
  },
  activityTree() {
    const activities = Array.isArray(State.toolActivity)
      ? State.toolActivity
      : [];
    if (!activities.length) return "";
    const rows = activities.slice(-8).map((item) => {
      const status = String(item.status || "running");
      const target = Util.truncate(
        String(item.target || item.path || item.tool || "target"),
        88,
      ).replace(/\n/g, " ");
      const count = item.count ? ` · ${item.count}` : "";
      const label = this.activityLabel(item);
      return `<div class="ace-ai-step-row ${Util.html(status)}"><span class="ace-ai-step-dot"></span><div><b>${Util.html(label)}</b><em>${Util.html(target)}${Util.html(count)}</em></div><small>${Util.html(status)}</small></div>`;
    });
    return `<div class="ace-ai-step-list">${rows.join("")}</div>`;
  },
  activityBlock() {
    if (!State.busy) return "";
    const tree = this.activityTree();
    const inspecting = State.flowStage === "inspecting" || Boolean(tree);
    const label = inspecting
      ? "Inspecting project"
      : State.flowStage === "proposing"
        ? "Preparing answer"
        : State.flowStage === "applying"
          ? "Applying changes"
          : "Thinking";
    const detail =
      State.retryStatus ||
      State.flowDetail ||
      State.toolProgress ||
      (State.suppressStreamingPreview
        ? "Waiting for tool results before showing the final answer…"
        : "Waiting for model response…");
    const phases = [
      [
        "thinking",
        "Thinking",
        State.flowStage !== "drafting" ? "done" : "active",
      ],
      [
        "tools",
        "Inspect",
        inspecting
          ? "active"
          : State.flowStage === "proposing"
            ? "done"
            : "todo",
      ],
      ["answer", "Answer", State.flowStage === "proposing" ? "active" : "todo"],
    ];
    const phaseHtml = phases
      .map(
        ([key, text, status]) =>
          `<span class="ace-ai-phase ${key} ${status}">${Util.html(text)}</span>`,
      )
      .join("");
    return `<div class="ace-ai-activity-inline structured"><div class="ace-ai-activity-head"><span class="ace-ai-activity-dot" aria-hidden="true"></span><div><b>${Util.html(label)}</b><em>${Util.html(detail)}</em></div></div><div class="ace-ai-phases">${phaseHtml}</div>${tree}</div>`;
  },
  pushAssistant(content) {
    const value = Util.normalizeModelText(content || "");
    if (!value) return;
    const chat = Store.chat();
    const last = chat[chat.length - 1];
    const lastText = Util.normalizeModelText(last?.content || "");
    // Guard against double-save after streaming completion or a stale render
    // timer. This avoids two identical assistant cards or repeated content.
    if (last?.role === "assistant" && lastText === value) return;
    chat.push({ role: "assistant", content: value, time: Util.nowLabel() });
    Store.saveChat(chat);
  },
  meaningfulAgentNote(text) {
    const value = Util.normalizeModelText(text || "");
    if (!value) return "";
    if (/^Agent (proposed|generated) \d+ .*tool/i.test(value)) return "";
    if (/^Review proposed change/i.test(value)) return "";
    return value;
  },
  applySummary(results, options) {
    const list = Array.isArray(results) ? results : [];
    const ok = list.filter((r) => r && r.ok);
    const failed = list.filter((r) => r && !r.ok);
    const lines = [];
    if (options?.failed && ok.length)
      lines.push(
        `### Partially applied ${ok.length} change${ok.length === 1 ? "" : "s"}`,
      );
    else if (options?.failed) lines.push("### Apply failed");
    else if (ok.length)
      lines.push(
        `### Applied ${ok.length} change${ok.length === 1 ? "" : "s"}`,
      );
    else lines.push("### No changes were applied");
    ok.forEach((r) => {
      const target = r.target || r.path || "active editor";
      const operation = r.operation || r.tool || "change";
      const stats = [];
      if (r.hunks) stats.push(`${r.hunks} hunks`);
      if (
        Number.isFinite(Number(r.added)) ||
        Number.isFinite(Number(r.removed))
      )
        stats.push(`+${Number(r.added || 0)} −${Number(r.removed || 0)}`);
      const detail = stats.length ? ` (${stats.join(", ")})` : "";
      lines.push(
        `- **${target}** — ${operation}${detail}. ${r.result || "Applied."}`,
      );
    });
    failed.forEach((r) =>
      lines.push(
        `- **${r.target || r.path || r.tool || "tool"}** failed: ${r.result || "unknown error"}`,
      ),
    );
    const note = this.meaningfulAgentNote(
      options?.agentMessage || State.agentMessage || "",
    );
    if (note) lines.push("", "### Agent note", note);
    if (State.undoStack.length)
      lines.push("", "_Undo is available for this apply batch._");
    return lines.join("\n");
  },
  async applyWithPermission(root, reply) {
    const decision = PermissionModel.evaluateSelection();
    State.lastPermissionReply = reply;
    if (!AgentTools.selectedTools().length)
      return Acode.toast("No applicable changes. Open Review for details.");
    if (decision.action === "deny")
      return Acode.toast(decision.reason || "Permission denied");
    if (decision.action === "ask" && reply === "allow")
      return Acode.toast("Approval required. Choose Allow once or Always.");
    if (reply === "always") PermissionModel.rememberAlways();
    return UI.applyTools(root);
  },
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
    if (document.getElementById("ace-ai-style-v8_38")) return;
    const style = document.createElement("style");
    style.id = "ace-ai-style-v8_38";
    style.textContent = `
.ace-ai-panel.v8{--ace-ai-bg:#0f1117;--ace-ai-surface:#161a22;--ace-ai-surface-2:#202633;--ace-ai-border:#2f3542;--ace-ai-text:#f3f6fb;--ace-ai-muted:#aab3c2;--ace-ai-code-bg:#0b0e13;letter-spacing:.01em}
.ace-ai-panel.v8 .ace-ai-tabs{display:none!important}
.ace-ai-panel.v8 .ace-ai-body{overflow:hidden;background:linear-gradient(180deg,#0f1117 0%,#11141b 100%)}
.ace-ai-panel.v8 .ace-ai-body [data-view]{display:flex!important;flex-direction:column;min-height:0;overflow:hidden}
.ace-ai-panel.v8 [data-view]:not([data-view="chat"]){display:none!important}
.ace-ai-panel.v8 .ace-ai-head{padding:11px 12px;background:rgba(22,26,34,.96);backdrop-filter:blur(12px);border-bottom-color:#333a49}
.ace-ai-head-main{min-width:0;flex:1 1 auto}.ace-ai-panel.v8 .ace-ai-brand-wrap{display:flex;align-items:center;gap:10px;min-width:0}.ace-ai-panel.v8 .ace-ai-brand-logo{width:30px;height:30px;border-radius:9px;box-shadow:0 10px 24px rgba(0,0,0,.3)}.ace-ai-panel.v8 .ace-ai-brand{font-size:15px;line-height:1.2}.ace-ai-panel.v8 .ace-ai-sub{max-width:100%;font-size:11px;color:#9fa8b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ace-ai-panel.v8 .ace-ai-actions{gap:6px}.ace-ai-header-new{font-weight:850;min-width:42px}.ace-ai-panel.v8 .ace-ai-iconbtn,.ace-ai-panel.v8 .ace-ai-btn{min-height:36px;border-radius:12px;touch-action:manipulation}.ace-ai-panel.v8 .ace-ai-btn{padding:8px 11px}.ace-ai-panel.v8 button:focus-visible,.ace-ai-panel.v8 textarea:focus-visible,.ace-ai-panel.v8 select:focus-visible,.ace-ai-panel.v8 input:focus-visible{outline:2px solid rgba(77,163,255,.8);outline-offset:2px}
.ace-ai-panel.v8 .ace-ai-card{padding:10px;border-radius:16px;background:rgba(22,26,34,.98);border-color:#303745}.ace-ai-panel.v8 .ace-ai-label{font-size:10px;letter-spacing:.09em;color:#aeb7c8}.ace-ai-panel.v8 .ace-ai-mini{line-height:1.45;color:#aab3c2}
.ace-ai-chat-surface{gap:10px;min-height:0}.ace-ai-context-strip{display:flex;gap:6px;overflow-x:auto;flex:0 0 auto;padding:0 1px 2px;scrollbar-width:none}.ace-ai-context-strip::-webkit-scrollbar{display:none}.ace-ai-context-chip{display:inline-flex;align-items:center;gap:5px;max-width:210px;min-height:26px;padding:5px 9px;border:1px solid #303745;border-radius:999px;background:#121720;color:#dce5f3;font-size:11px;white-space:nowrap}.ace-ai-context-chip b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px}.ace-ai-context-chip.muted{color:#aab3c2;background:#10141b}.ace-ai-context-chip.warn{border-color:rgba(215,166,74,.55);background:rgba(215,166,74,.12);color:#ffe2a2}
.ace-ai-conversation{display:flex;flex-direction:column;gap:10px;min-height:0;flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:1px 2px 2px 1px;scrollbar-gutter:stable}.ace-ai-panel.v8 .ace-ai-conversation{min-height:180px}.ace-ai-panel.v8[data-sidebar="1"]{max-height:100dvh;min-height:0;overflow:hidden}.ace-ai-panel.v8[data-sidebar="1"] .ace-ai-body{min-height:0;overflow:hidden}.ace-ai-panel.v8[data-sidebar="1"] .ace-ai-body [data-view]{max-height:calc(100dvh - 118px);overflow:hidden}.ace-ai-panel.v8[data-sidebar="1"] .ace-ai-chat-surface{height:100%;min-height:0}.ace-ai-panel.v8[data-sidebar="1"] .ace-ai-conversation{min-height:120px;max-height:55dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}.ace-ai-panel.v8[data-sidebar="1"] .ace-ai-composer{flex:0 0 auto}
.ace-ai-panel.v8 .ace-ai-msg{border-radius:16px;padding:10px 11px;background:#161b24;border-color:#2d3442;white-space:normal;line-height:1.48;font-size:13px;box-shadow:0 1px 0 rgba(255,255,255,.02)}.ace-ai-panel.v8 .ace-ai-msg.user{margin-left:14px;background:#1d2533}.ace-ai-panel.v8 .ace-ai-msg.assistant{margin-right:14px;background:#151a22}.ace-ai-msg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:#f3f6fb}.ace-ai-msg-role{font-weight:850;font-size:12px}.ace-ai-msg-body{white-space:normal;word-break:break-word;color:#eef3fa}.ace-ai-md{white-space:normal}.ace-ai-md p{margin:0 0 10px;white-space:normal}.ace-ai-md p:last-child{margin-bottom:0}.ace-ai-md ul,.ace-ai-md ol{margin:6px 0 10px;padding-left:20px}.ace-ai-md li{margin:3px 0}.ace-ai-md strong{font-weight:850;color:#f7fbff}.ace-ai-md code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b0e13;border:1px solid #2e3746;border-radius:6px;padding:1px 4px;color:#dfeaff}.ace-ai-md h1,.ace-ai-md h2,.ace-ai-md h3{margin:10px 0 6px;line-height:1.25;font-weight:850;color:#f7fbff}.ace-ai-md h1{font-size:16px}.ace-ai-md h2{font-size:14px}.ace-ai-md h3{font-size:13px}.ace-ai-md hr{border:none;border-top:1px solid #2d3442;margin:10px 0}.ace-ai-md-bq{border-left:3px solid #4da3ff;margin:8px 0;padding:6px 10px;background:rgba(77,163,255,.07);border-radius:0 8px 8px 0;color:#aabdd6;font-style:italic}.ace-ai-md-link{color:#79b8ff;text-decoration:underline;text-underline-offset:2px}.ace-ai-md-link:hover{color:#a8d1ff}.ace-ai-md-code{border:1px solid #303a4b;border-radius:13px;background:#0a0d12;margin:10px 0;overflow:hidden}.ace-ai-md-code-head{display:flex;align-items:center;justify-content:space-between;padding:6px 9px;border-bottom:1px solid #26303e;color:#9fb0c8;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.ace-ai-md-copy{background:transparent;border:1px solid #2e3a4b;color:#9fb0c8;border-radius:7px;padding:2px 7px;font-size:10px;cursor:pointer;letter-spacing:normal;text-transform:none}.ace-ai-md-copy:hover{background:#1a2230;color:#dce5f3}.ace-ai-md-code pre{margin:0;padding:10px;overflow:auto;white-space:pre;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.ace-ai-md-code code{background:transparent;border:0;padding:0;color:#e8f1ff}
.ace-ai-activity-inline.structured{align-self:stretch;max-width:none;border:1px solid #2f3a4d;background:linear-gradient(180deg,#121824,#0f141d);border-radius:17px;padding:11px;box-shadow:0 1px 0 rgba(255,255,255,.02)}.ace-ai-activity-head{display:grid;grid-template-columns:18px minmax(0,1fr);gap:9px;align-items:start}.ace-ai-activity-dot{width:10px;height:10px;margin-top:3px;border-radius:999px;background:#4da3ff;box-shadow:0 0 0 4px rgba(77,163,255,.13);animation:ace-ai-pulse 1.1s ease-in-out infinite}.ace-ai-activity-head b{display:block;font-size:12px;line-height:1.25;color:#eef6ff;font-weight:850}.ace-ai-activity-head em{display:block;margin-top:3px;font-style:normal;font-size:11px;line-height:1.35;color:#9fa8b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ace-ai-phases{display:flex;gap:6px;overflow-x:auto;margin-top:9px;padding-bottom:1px;scrollbar-width:none}.ace-ai-phases::-webkit-scrollbar{display:none}.ace-ai-phase{flex:0 0 auto;border:1px solid #303948;background:#0d121a;color:#8894a8;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}.ace-ai-phase.done{color:#9add8a;border-color:rgba(154,221,138,.38);background:rgba(154,221,138,.08)}.ace-ai-phase.active{color:#dcecff;border-color:rgba(77,163,255,.62);background:rgba(77,163,255,.12)}.ace-ai-step-list{display:flex;flex-direction:column;gap:6px;margin-top:9px}.ace-ai-step-row{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #293241;background:#0b1017;border-radius:12px;padding:7px 8px}.ace-ai-step-dot{width:9px;height:9px;border-radius:999px;background:#667085;box-shadow:0 0 0 3px rgba(102,112,133,.12)}.ace-ai-step-row.running .ace-ai-step-dot{background:#4da3ff;box-shadow:0 0 0 3px rgba(77,163,255,.14);animation:ace-ai-pulse 1.1s ease-in-out infinite}.ace-ai-step-row.done .ace-ai-step-dot{background:#9add8a;box-shadow:0 0 0 3px rgba(154,221,138,.12)}.ace-ai-step-row.failed .ace-ai-step-dot{background:#ff9aa5;box-shadow:0 0 0 3px rgba(255,154,165,.12)}.ace-ai-step-row b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#e9f1fb}.ace-ai-step-row em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:normal;font-size:10px;color:#9fa8b8;margin-top:1px}.ace-ai-step-row small{font-size:10px;color:#8d98aa}.ace-ai-step-row.running small{color:#8fbfff}.ace-ai-step-row.done small{color:#9add8a}.ace-ai-step-row.failed small{color:#ff9aa5}@keyframes ace-ai-pulse{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}@keyframes ace-ai-textshine{0%{background-position:200% 50%}100%{background-position:-40% 50%}}
.ace-ai-empty-hero{border:1px dashed #343c4b;background:#121720;border-radius:18px;padding:14px;text-align:left}.ace-ai-empty-hero h3{margin:0 0 6px;font-size:15px;line-height:1.25}.ace-ai-empty-hero p{margin:0;color:#aab3c2;line-height:1.45}.ace-ai-empty-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.ace-ai-empty-tip{border:1px solid #2c3340;background:#0f141c;border-radius:13px;padding:9px;font-size:12px;line-height:1.35;color:#dce5f3}.ace-ai-empty-tip span{display:block;color:#aab3c2;font-size:11px;margin-top:3px}
.ace-ai-composer{flex:0 0 auto;border-color:#384152;background:linear-gradient(180deg,#171d27,#131820);box-shadow:0 -12px 30px rgba(0,0,0,.18)}.ace-ai-panel.v8 .ace-ai-composer{padding:10px}.ace-ai-composer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.ace-ai-composer-head .ace-ai-row{flex-wrap:nowrap;overflow-x:auto}.ace-ai-panel.v8 .ace-ai-textarea{min-height:40px;max-height:90px;resize:none;line-height:1.45;font-size:13px;width:100%;max-width:100%;display:block;box-sizing:border-box;border-radius:15px;background:var(--ace-ai-code-bg);border-color:#343c4b;padding:9px 12px}.ace-ai-panel.v8 .ace-ai-textarea::placeholder{color:#788398}.ace-ai-kbd{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid #3a4353;background:#111720;border-radius:6px;padding:1px 5px;color:#cbd5e6}
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

.ace-ai-review-compact{padding:10px;display:flex;flex-direction:column;gap:9px}.ace-ai-review-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ace-ai-review-list{display:flex;flex-direction:column;gap:7px}.ace-ai-review-actions{display:flex;gap:7px;align-items:center;overflow-x:auto;scrollbar-width:none}.ace-ai-review-actions::-webkit-scrollbar{display:none}.ace-ai-review-actions .ace-ai-btn{flex:0 0 auto}.ace-ai-tool-slim{border:1px solid #303745;border-radius:13px;background:#10151d;overflow:hidden}.ace-ai-tool-slim[open]{border-color:#3d4b60;background:#10161f}.ace-ai-tool-slim summary{list-style:none}.ace-ai-tool-slim summary::-webkit-details-marker{display:none}.ace-ai-tool-summary{display:grid;grid-template-columns:18px auto 24px minmax(0,1fr) auto;gap:7px;align-items:center;padding:8px 9px;cursor:pointer;min-height:42px}.ace-ai-tool-summary .ace-ai-tool-check{display:flex;align-items:center;justify-content:center}.ace-ai-tool-summary .ace-ai-tool-check input{width:16px;height:16px}.ace-ai-disclosure::before{content:'▸';display:inline-block;color:#9fa8b8;transition:transform .15s ease}.ace-ai-tool-slim[open] .ace-ai-disclosure::before{transform:rotate(90deg)}.ace-ai-tool-main{min-width:0;display:flex;flex-direction:column;gap:2px}.ace-ai-tool-main b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef3fa}.ace-ai-tool-main small{color:#9fa8b8;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ace-ai-tool-state{font-size:10px;border:1px solid #344153;border-radius:999px;padding:2px 6px;color:#aab3c2}.ace-ai-tool-state.ready{color:#9dd8ff;border-color:rgba(77,163,255,.4)}.ace-ai-tool-state.blocked{color:#ffb5bd;border-color:rgba(224,108,117,.45)}.ace-ai-tool-state.skipped{color:#aab3c2}.ace-ai-apply-note{margin:0 9px 8px;color:#b8c2d3}.ace-ai-hunks{display:flex;flex-direction:column;gap:8px;padding:0 9px 9px}.ace-ai-hunk{border:1px solid #2d3747;border-radius:12px;background:#0f141c;overflow:hidden}.ace-ai-hunk.rejected{opacity:.62}.ace-ai-hunk-head{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06)}.ace-ai-hunk-toggle{display:flex;align-items:flex-start;gap:8px;color:#eaf2ff}.ace-ai-hunk-toggle input{margin-top:2px}.ace-ai-hunk-toggle span{display:flex;flex-direction:column;gap:2px}.ace-ai-hunk-toggle b{font-size:12px}.ace-ai-hunk-toggle em{font-style:normal;color:#9fa8b8;font-size:10px}.ace-ai-tool-diff{max-height:260px;overflow:auto;border-top:0;border-radius:0;background:#090c11}.ace-ai-tool-error,.ace-ai-tool-warn{margin:0 9px 8px}.ace-ai-panel.v8 .ace-ai-footer:empty{display:none}

.ace-ai-timeline{display:flex;flex-direction:column;gap:5px;border:1px solid #2f3848;background:#10151d;border-radius:13px;padding:8px;margin-top:8px}.ace-ai-timeline-row{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:7px;align-items:center;font-size:11px;color:#aab3c2}.ace-ai-timeline-row span{width:9px;height:9px;border-radius:99px;border:1px solid #48546a;background:#151b25}.ace-ai-timeline-row.ready span{border-color:#4da3ff;background:rgba(77,163,255,.35)}.ace-ai-timeline-row.done span{border-color:#7ccf91;background:rgba(124,207,145,.35)}.ace-ai-timeline-row.blocked span,.ace-ai-timeline-row.failed span{border-color:#e06c75;background:rgba(224,108,117,.35)}.ace-ai-timeline-row.skipped span{opacity:.45}.ace-ai-timeline-row b{font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9f1fb}.ace-ai-timeline-row em{font-style:normal;font-size:10px;color:#8995a8;white-space:nowrap}.ace-ai-review-drawer{display:flex;flex-direction:column;gap:9px}.ace-ai-review-drawer.inline{margin-top:2px}.ace-ai-review-drawer .ace-ai-review-simple,.ace-ai-review-drawer .ace-ai-tree{margin:0}.ace-ai-composer-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#8f9caf;font-size:11px}
.ace-ai-md-code code .ace-ai-hl-keyword,.ace-ai-hl-keyword{color:#ffb86c}.ace-ai-md-code code .ace-ai-hl-string,.ace-ai-hl-string{color:#a7e3a1}.ace-ai-md-code code .ace-ai-hl-comment,.ace-ai-hl-comment{color:#6f7d91;font-style:italic}.ace-ai-md-code code .ace-ai-hl-number,.ace-ai-hl-number{color:#bd93f9}.ace-ai-md-code code .ace-ai-hl-tag,.ace-ai-hl-tag{color:#ff8f70}.ace-ai-md-code code .ace-ai-hl-property,.ace-ai-hl-property{color:#8be9fd}.ace-ai-md-code code .ace-ai-hl-variable,.ace-ai-hl-variable{color:#f1fa8c}
@media(max-width:520px){.ace-ai-empty-grid{grid-template-columns:1fr}.ace-ai-panel.v8 .ace-ai-msg.user{margin-left:6px}.ace-ai-panel.v8 .ace-ai-msg.assistant{margin-right:6px}.ace-ai-context-chip{max-width:170px}.ace-ai-composer-head{align-items:flex-start;flex-direction:column}.ace-ai-composer-head .ace-ai-row{width:100%}}
@media(max-height:720px){.ace-ai-panel.v8 .ace-ai-textarea{min-height:34px;max-height:72px}.ace-ai-panel.v8 .ace-ai-card{padding:8px}.ace-ai-panel.v8 .ace-ai-conversation{min-height:140px}}
`;
    document.head.appendChild(style);
  };

  UI.mountPanel = function (container, sidebar) {
    V8.ensure();
    this.css();
    container.innerHTML = this.shell();
    const root = container.querySelector(".ace-ai-panel");
    if (!root) return null;
    root.classList.add("v8");
    if (sidebar) {
      root.dataset.sidebar = "1";
      root.classList.remove("ace-ai-hidden");
      container.classList?.add?.("ace-ai-sidebar-host");
      try {
        container.style.minHeight = "0";
        container.style.maxHeight = "100dvh";
        container.style.overflow = "hidden";
        container.style.display = "flex";
        container.style.flexDirection = "column";
      } catch (_) {}
      State.sidebarContainer = container;
    } else {
      State.panel = root;
    }
    this.bind(root);
    this.render(root);
    MobileUX.installSwipe(root);
    MobileUX.installCompactMode(root);
    return root;
  };

  UI.shell = function () {
    return `<div class="ace-ai-panel ace-ai-hidden">
<div class="ace-ai-head"><div class="ace-ai-head-main"><div class="ace-ai-brand-wrap"><img class="ace-ai-brand-logo" src="data:image/png;base64,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" alt="Ace AI logo"><div><div class="ace-ai-brand">Ace AI <span class="ace-ai-mini">v${C.VERSION}</span></div><div class="ace-ai-sub" data-role="context-line">Agent · review before apply</div></div></div></div><div class="ace-ai-actions"><button class="ace-ai-iconbtn ace-ai-header-new" data-act="new-chat" title="Start a clean chat" aria-label="New chat">＋</button><button class="ace-ai-iconbtn" data-act="quick-menu" title="Quick menu" aria-label="Quick menu">⋮</button><button class="ace-ai-iconbtn" data-act="settings" title="Settings" aria-label="Settings">⚙</button><button class="ace-ai-iconbtn" data-act="toggle-max" title="Maximize" aria-label="Maximize">⤢</button><button class="ace-ai-iconbtn" data-act="close" title="Close" aria-label="Close panel">×</button></div></div>
<div class="ace-ai-tabs"></div>
<div class="ace-ai-body"><div data-view="chat"></div></div>
<div class="ace-ai-footer" data-role="footer"></div>
<div class="ace-ai-settings ace-ai-hidden" data-role="settings"></div></div>`;
  };

  UI.openPanel = function (tab, mode, seed) {
    V8.ensure();
    State.activeTab = "chat";
    if (mode) State.aiMode = mode === "plan" ? "plan" : "agent";
    const result = baseOpenPanel("chat", State.aiMode, seed);
    if (State.panel) {
      State.panel.classList.remove("ace-ai-hidden");
      State.panel.classList.add("v8");
      this.render(State.panel);
    }
    return result;
  };

  UI.updateContext = function (root) {
    const ctx = Editor.context();
    const line = root?.querySelector('[data-role="context-line"]');
    if (!line) return;
    const meta = V8.contextMeta(ctx);
    line.textContent = `${meta.title} · ${meta.detail}`;
  };

  UI.render = Util.rafDebounce(function (root) {
    if (!root) return;
    V8.ensure();
    State.activeTab = "chat";
    this.updateContext(root);
    this.renderChat(root.querySelector('[data-view="chat"]'));
    this.renderSettings(root.querySelector('[data-role="settings"]'));
    this.updateFooter(root);
    this.scrollChatToBottom(root);
    if (State.sidebarContainer) {
      const sidebarRoot = State.sidebarContainer.querySelector(".ace-ai-panel");
      if (sidebarRoot && sidebarRoot !== root)
        this.scrollChatToBottom(sidebarRoot);
    }
    root.classList.toggle("is-max", Boolean(State.maximized));
  });

  UI.renderChat = function (el) {
    if (!el) return;
    V8.ensure();
    const chat = Store.chat();
    const streamRow = V8.shouldShowStreaming()
      ? [
          {
            role: "assistant",
            content: State.streamingContent,
            time: "streaming",
            streaming: true,
          },
        ]
      : [];
    const allRows = chat.concat(streamRow);
    const rows = allRows.length
      ? allRows
          .map((m) => {
            const role = m.role === "user" ? "You" : "Ace AI";
            const mode = m.mode ? ` · ${Util.html(m.mode)}` : "";
            const body =
              m.role === "assistant"
                ? Util.markdown(m.content)
                : Util.html(m.content);
            return `<div class="ace-ai-msg ${Util.html(m.role)} ${m.streaming ? "streaming ace-ai-streaming" : ""}"><div class="ace-ai-msg-head"><span class="ace-ai-msg-role">${role}</span><span class="ace-ai-mini">${Util.html(m.time || "")}${mode}</span></div><div class="ace-ai-msg-body ace-ai-md">${body}</div></div>`;
          })
          .join("")
      : V8.emptyState();
    const modePill = `<span class="ace-ai-mode-pill"><b>${Util.html(V8.modeLabel())}</b>${State.aiMode === "agent" ? " · " + Util.html(V8.permissionLabel()) : ""}</span>`;
    el.innerHTML = `<div class="ace-ai-col ace-ai-chat-surface">${V8.contextStrip()}${this.errorBanner()}<div class="ace-ai-conversation">${rows}${this.busyBanner()}${V8.toolSummary()}${V8.reviewDrawer()}${V8.appliedSummary()}</div><div class="ace-ai-card ace-ai-composer"><div class="ace-ai-composer-head compact"><div><div class="ace-ai-label">Prompt</div><div class="ace-ai-mini">${modePill} · edits open review first</div></div></div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="Ask, edit selection, or use @codebase...">${Util.html(State.draftPrompt || "")}</textarea><div class="ace-ai-composer-meta"><span><span class="ace-ai-kbd">Enter</span> send · Shift+Enter newline</span></div>${V8.actionChips()}${V8.modeControls()}</div></div>`;
    this.attachHints(el.querySelector('[data-role="prompt"]'));
  };

  UI.updateStreaming = function (root) {
    if (!root) return;
    const busy = root.querySelector('[data-role="busy-detail"]');
    if (busy && State.busy) {
      busy.textContent =
        State.toolProgress ||
        State.retryStatus ||
        (State.streamingContent
          ? `${State.streamingContent.length} chars received`
          : "Waiting for first token…");
    }
    const streamNode = root.querySelector(
      ".ace-ai-msg.streaming .ace-ai-msg-body, .ace-ai-msg.ace-ai-streaming .ace-ai-msg-body",
    );
    if (!streamNode && V8.shouldShowStreaming()) {
      this.render(root);
      return;
    }
    if (streamNode)
      streamNode.innerHTML = V8.shouldShowStreaming()
        ? Util.markdown(State.streamingContent || "")
        : "";
    if (State.streamingContent || State.busy) this.scrollChatToBottom(root);
  };

  UI.updateFooter = function (root) {
    const footer = root.querySelector('[data-role="footer"]');
    if (!footer) return;
    if (State.busy) {
      footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-danger" data-act="cancel-request">Stop</button></div>`;
      return;
    }
    // Always show Send + Undo buttons; pendingTools review is shown inline in the conversation
    footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">${State.aiMode === "plan" ? "Create plan" : "Send"}</button>${State.undoStack.length ? '<button class="ace-ai-btn" data-act="undo-tools">Undo</button>' : ""}</div>`;
  };

  UI.handle = async function (act, root) {
    if (act === "cancel-request") {
      State.cancelRequested = true;
      if (State._abortController) {
        try {
          State._abortController.abort();
        } catch (_) {}
      }
      State.busy = false;
      State.streamingContent = "";
      State.streamingMode = "";
      State.flowStage = "idle";
      State.flowDetail = "Request cancelled";
      this.setBusy(root, false);
      this.render(root);
      Acode.toast("Request cancelled");
      return;
    }
    if (act === "allow-once-tools" || act === "apply-tools") {
      const decision = PermissionModel.evaluateSelection();
      const reply =
        act === "allow-once-tools"
          ? "once"
          : decision.action === "ask"
            ? "once"
            : "allow";
      return V8.applyWithPermission(root, reply);
    }
    if (act === "allow-always-tools") {
      PermissionModel.rememberAlways();
      return V8.applyWithPermission(root, "always");
    }
    if (act === "toggle-review" || act === "open-review") {
      State.reviewOpen = act === "toggle-review" ? !State.reviewOpen : true;
      Store.saveSettings({ reviewOpen: State.reviewOpen });
      return this.render(root);
    }
    if (act === "use-active-editor") {
      const count = AgentTools.convertBlockedToActiveEditor();
      State.reviewOpen = true;
      Store.saveSettings({ reviewOpen: true });
      this.render(root);
      return Acode.toast(
        count
          ? "Converted " + count + " change(s) to active editor"
          : "No blocked change can use active editor",
      );
    }
    if (act === "toggle-diagnostics") {
      State.showDiagnostics = !State.showDiagnostics;
      return this.render(root);
    }
    if (act === "copy-diagnostics") {
      await Util.copy(JSON.stringify(State.applyDiagnostics || [], null, 2));
      return Acode.toast("Diagnostics copied");
    }
    if (act === "new-chat") {
      Store.clearChat();
      Runtime.clearTransientState();
      State.pendingTools = [];
      State.selectedToolIds = [];
      State.agentMessage = "";
      State.draftPrompt = "";
      State.lastAppliedSummary = "";
      State.lastSelectionSnapshot = null;
      State.lastResult = "";
      State.lastPatch = "";
      State.lastResultKind = "";
      State.lastUsage = null;
      State.readToolResults = [];
      State.toolActivity = [];
      State.reviewNotice = "";
      State.showRunDetails = false;
      State.showDiagnostics = false;
      State.applyDiagnostics = [];
      State.lastRequest = null;
      State.reviewOpen = false;
      Store.saveSettings({ reviewOpen: false });
      State.flowStage = "idle";
      State.flowDetail = "";
      this.render(root);
      setTimeout(() => root?.querySelector('[data-role="prompt"]')?.focus(), 0);
      return Acode.toast("New chat started");
    }
    if (act === "clear-tools") {
      State.pendingTools = [];
      State.selectedToolIds = [];
      State.lastToolJson = "";
      State.agentMessage = "";
      State.toolResults = [];
      State.agentPlan = "";
      State.lastAppliedSummary = "";
      State.reviewNotice = "Rejected pending agent tools.";
      State.showDiagnostics = false;
      State.showRunDetails = false;
      State.reviewOpen = false;
      Store.saveSettings({ reviewOpen: false });
      State.activeTab = "chat";
      State.flowStage = "idle";
      State.flowDetail = "";
      return this.render(root);
    }
    if (act === "voice-input") {
      const textarea = root.querySelector('[data-role="prompt"]');
      VoiceInput.toggle(
        (transcript, isFinal) => {
          if (textarea) {
            textarea.value = (State.draftPrompt || "") + transcript;
            if (isFinal) State.draftPrompt = textarea.value;
          }
        },
        () => this.render(root),
      );
      this.render(root);
      return;
    }
    const out = await baseHandle(act, root);
    State.activeTab = "chat";
    return out;
  };

  UI.send = async function (root, forcedRequest) {
    V8.ensure();
    const modeSelect = root.querySelector('[data-role="ai-mode"]');
    const permSelect = root.querySelector('[data-role="permission-mode"]');
    if (modeSelect) State.aiMode = modeSelect.value || "agent";
    if (
      State.aiMode === "ask" ||
      State.aiMode === "chat" ||
      State.aiMode === "edit"
    )
      State.aiMode = "agent";
    if (permSelect) State.permissionMode = permSelect.value || "safe";
    const themeSelect = root.querySelector('[data-role="theme-mode"]');
    if (themeSelect) ThemeSystem.setPreference(themeSelect.value || "auto");
    Store.saveSettings({
      agentMode: State.aiMode,
      permissionMode: State.permissionMode,
    });

    const mode =
      forcedRequest?.mode || (State.aiMode === "plan" ? "chat" : "agent");
    const displayPrompt =
      forcedRequest?.displayPrompt ||
      forcedRequest?.prompt ||
      this.getPrompt(root);
    let prompt = forcedRequest?.prompt || displayPrompt;
    if (State.aiMode === "plan" && !forcedRequest) {
      prompt =
        "Create a concise implementation plan only. Discuss tradeoffs and steps. Do not propose file writes or tool calls yet. Task: " +
        prompt;
    }
    if (
      State.aiMode === "agent" &&
      State.permissionMode === "safe" &&
      !forcedRequest
    ) {
      prompt =
        prompt +
        "\n\nPermission: Safe mode. You may answer normally in plain text. Return reviewable tool-call JSON only for file/create/edit/write actions. Do not claim changes are applied. If selected code exists, edit the selection with replace_selection unless the user explicitly asks for the whole file or says codebase/code base/project/workspace/repo/@codebase. For codebase/project requests, treat the selection as context only and inspect/edit the relevant file(s). If Project Root is unknown or the active tab is unsaved, prefer replace_selection or replace_file with empty path for active-editor edits instead of create_file/write_file/replace_file with the active filename. Use read_file/list_files/search_in_files only when @file/@codebase or real codebase inspection is needed; use open_file only for navigation. Use run_command only when the user asks to run/check/validate tests, lint, typecheck, format check, or syntax; do not call tools for greetings or capability questions.";
    }
    State.activeTab = mode === "agent" ? "agent" : "chat";
    State.flowStage = "drafting";
    State.flowDetail =
      mode === "agent" ? "Agent request started" : "Request started";
    await baseSend(
      root,
      Object.assign({}, forcedRequest || {}, {
        mode,
        outputMode: mode === "agent" ? "tools" : "chat",
        prompt,
        displayPrompt,
      }),
    );
    State.activeTab = "chat";
    if (mode === "agent" && State.agentMessage && !State.pendingTools.length) {
      V8.pushAssistant(State.agentMessage);
      State.agentMessage = "";
    }
    if (State.pendingTools.length) {
      State.reviewOpen = false;
      Store.saveSettings({ reviewOpen: false });
      State.flowStage = "review";
      State.flowDetail = "Pending review";
    } else if (!State.lastError) {
      State.flowStage = "done";
      State.flowDetail = "Request completed";
    }
    this.render(root);
  };

  UI.setBusy = function (root, yes) {
    if (!root) return;
    root.querySelectorAll("button,textarea,input,select").forEach((el) => {
      if (el.matches('[data-act="close"],[data-act="toggle-max"]')) return;
      el.disabled = Boolean(yes);
    });
    root.querySelectorAll('[data-act="send"]').forEach((send) => {
      send.textContent = State.aiMode === "plan" ? "Create plan" : "Send";
    });
  };

  UI.applyTools = async function (root) {
    const beforeCount = State.pendingTools.length;
    State.flowStage = "applying";
    State.flowDetail = "Applying approved tools";
    let results = [];
    try {
      results = (await baseApplyTools(root)) || State.toolResults || [];
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      results = State.toolResults || [];
      State.activeTab = "chat";
      State.reviewOpen = Boolean(State.pendingTools.length);
      Store.saveSettings({ reviewOpen: State.reviewOpen });
      if (results.length) {
        V8.pushAssistant(
          V8.applySummary(results, {
            agentMessage: State.agentMessage,
            failed: true,
          }),
        );
      }
      State.agentMessage = "";
      State.flowStage = State.pendingTools.length ? "review" : "error";
      State.flowDetail = State.pendingTools.length
        ? "Review remaining changes"
        : State.lastError.title || "Apply failed";
      this.render(root);
      return;
    }
    State.activeTab = "chat";
    State.reviewOpen = Boolean(State.pendingTools.length);
    Store.saveSettings({ reviewOpen: State.reviewOpen });
    const failed = (results || []).some((r) => r && !r.ok);
    if (results && results.length) {
      V8.pushAssistant(
        V8.applySummary(results, {
          agentMessage: State.agentMessage,
          failed,
        }),
      );
    } else if (beforeCount && !State.pendingTools.length && !State.lastError) {
      V8.pushAssistant(
        "### Apply finished\n- No detailed tool result was returned.",
      );
    }
    State.agentMessage = "";
    State.flowStage = State.pendingTools.length ? "review" : "done";
    State.flowDetail = State.pendingTools.length
      ? "Pending review"
      : "No more pending tools";
    this.render(root);
  };

  UI.undoTools = async function (root) {
    State.flowStage = "applying";
    State.flowDetail = "Undoing last apply batch";
    await baseUndoTools(root);
    State.activeTab = "chat";
    State.reviewOpen = true;
    Store.saveSettings({ reviewOpen: true });
    State.flowStage = "review";
    State.flowDetail = "Review state restored";
    this.render(root);
  };

  UI.saveSettings = function (root) {
    let mode =
      root.querySelector('[data-role="ai-mode"]')?.value ||
      State.aiMode ||
      "agent";
    if (mode === "ask" || mode === "chat" || mode === "edit") mode = "agent";
    const permission =
      root.querySelector('[data-role="permission-mode"]')?.value ||
      State.permissionMode ||
      "safe";
    Store.saveSettings({ agentMode: mode, permissionMode: permission });
    return baseSaveSettings(root);
  };
})();
