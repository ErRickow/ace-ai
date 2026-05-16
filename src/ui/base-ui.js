const ACE_AI_LOGO =
  "data:image/png;base64,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";
const UI = {
  css() {
    if (document.getElementById("ace-ai-style-v8_38-base")) return;
    const style = document.createElement("style");
    style.id = "ace-ai-style-v8_38-base";
    style.textContent = `
:root{--ace-ai-bg:#101114;--ace-ai-surface:#17191d;--ace-ai-surface-2:#1d2026;--ace-ai-border:#30343c;--ace-ai-text:#eef0f3;--ace-ai-muted:#a4a9b3;--ace-ai-accent:#4da3ff;--ace-ai-danger:#e06c75;--ace-ai-warn:#d7a64a;--ace-ai-ok:#7ccf91}
.ace-ai-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;background:var(--ace-ai-surface);color:var(--ace-ai-text);padding:10px 14px;border:1px solid var(--ace-ai-border);border-radius:12px;font:13px system-ui;box-shadow:0 12px 30px #0008;max-width:88vw}
.ace-ai-fab{position:fixed;right:10px;bottom:86px;z-index:2147483000;min-width:48px;min-height:48px;border:1px solid var(--ace-ai-border);border-radius:12px;background:var(--ace-ai-surface-2);color:var(--ace-ai-text);font-weight:800;font:12px system-ui;padding:10px 11px;box-shadow:0 10px 26px #0007}
.ace-ai-panel{position:fixed;left:8px;right:8px;bottom:8px;height:min(82vh,760px);z-index:99991;background:var(--ace-ai-bg);color:var(--ace-ai-text);border:1px solid var(--ace-ai-border);border-radius:16px;box-shadow:0 18px 60px #000a;display:flex;flex-direction:column;overflow:hidden;font:13px system-ui,-apple-system,Segoe UI,sans-serif}
.ace-ai-panel.is-max{top:0;left:0;right:0;bottom:0;height:auto;border-radius:0;border-width:0}.ace-ai-panel[data-sidebar="1"]{position:relative;inset:auto;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}.ace-ai-panel[data-sidebar="1"]{max-height:100dvh;min-height:0;overflow:hidden}.ace-ai-panel[data-sidebar="1"] .ace-ai-body{min-height:0;overflow:hidden}.ace-ai-panel[data-sidebar="1"] .ace-ai-body [data-view].ace-ai-view-active{overflow:hidden;max-height:calc(100dvh - 118px)}.ace-ai-panel[data-sidebar="1"] .ace-ai-col{height:100%;min-height:0}.ace-ai-panel[data-sidebar="1"] .ace-ai-chatlog,.ace-ai-panel[data-sidebar="1"] .ace-ai-conversation{max-height:55dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}
.ace-ai-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--ace-ai-surface);border-bottom:1px solid var(--ace-ai-border);gap:8px;flex:0 0 auto}.ace-ai-head-main{min-width:0;flex:1 1 auto}.ace-ai-brand-wrap{display:flex;align-items:center;gap:10px;min-width:0}.ace-ai-brand-logo{width:28px;height:28px;border-radius:8px;flex:0 0 auto;object-fit:cover;box-shadow:0 8px 20px rgba(0,0,0,.28)}.ace-ai-brand{font-weight:850;letter-spacing:.2px;font-size:15px}.ace-ai-sub{font-size:11px;color:var(--ace-ai-muted);margin-top:2px;max-width:68vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ace-ai-actions{display:flex;gap:7px;flex:0 0 auto}.ace-ai-iconbtn,.ace-ai-btn{border:1px solid var(--ace-ai-border);background:var(--ace-ai-surface-2);color:var(--ace-ai-text);border-radius:11px;padding:8px 10px;font:12px system-ui;line-height:1}.ace-ai-iconbtn{min-width:38px;min-height:38px;border-radius:13px}.ace-ai-btn:disabled,.ace-ai-iconbtn:disabled{opacity:.55}.ace-ai-primary{border-color:var(--ace-ai-accent);background:rgba(77,163,255,.16);color:#dcebff;font-weight:800}.ace-ai-danger{background:rgba(224,108,117,.12);border-color:rgba(224,108,117,.5);color:#ffdadd}
.ace-ai-tabs{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid var(--ace-ai-border);background:var(--ace-ai-bg);flex:0 0 auto}.ace-ai-tab{border:0;background:transparent;color:var(--ace-ai-muted);padding:10px 6px;font-weight:800;font-size:13px}.ace-ai-tab.active{color:var(--ace-ai-text);background:var(--ace-ai-surface-2);box-shadow:inset 0 -2px 0 var(--ace-ai-accent)}
.ace-ai-body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column}.ace-ai-body [data-view]{display:none;flex:1 1 auto;min-height:0;overflow:hidden}.ace-ai-body [data-view].ace-ai-view-active{display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:8px 8px 12px;box-sizing:border-box}
.ace-ai-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ace-ai-row.nowrap{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.ace-ai-col{display:flex;flex-direction:column;gap:9px;min-height:0;flex:1 1 auto}.ace-ai-scroll-col{flex:0 0 auto;min-height:auto;overflow:visible;padding-bottom:12px}.ace-ai-card{background:var(--ace-ai-surface);border:1px solid var(--ace-ai-border);border-radius:14px;padding:10px}.ace-ai-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ace-ai-muted);font-weight:900}.ace-ai-input,.ace-ai-textarea,.ace-ai-select{width:100%;box-sizing:border-box;border:1px solid var(--ace-ai-border);background:#0d0f12;color:var(--ace-ai-text);border-radius:12px;padding:10px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}.ace-ai-textarea{min-height:82px;max-height:145px;resize:vertical}.ace-ai-input:focus,.ace-ai-textarea:focus{border-color:var(--ace-ai-accent)}
.ace-ai-chat-shell{display:flex;flex-direction:column;min-height:0;flex:1 1 auto;gap:9px}.ace-ai-chatlog{display:flex;flex-direction:column;gap:9px;flex:1 1 auto;overflow:auto;min-height:120px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-right:2px}.ace-ai-msg{border:1px solid var(--ace-ai-border);border-radius:14px;padding:10px;background:var(--ace-ai-surface);white-space:normal;line-height:1.42;font-size:13px}.ace-ai-msg.user{margin-left:18px;background:var(--ace-ai-surface-2)}.ace-ai-msg.assistant{margin-right:18px}.ace-ai-msg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ace-ai-msg-role{font-weight:800;font-size:12px}.ace-ai-msg-body{white-space:normal;word-break:break-word}.ace-ai-msg-body p,.ace-ai-md p{margin:0 0 8px}.ace-ai-msg-body p:last-child,.ace-ai-md p:last-child{margin-bottom:0}
.ace-ai-chip{border:1px solid var(--ace-ai-border);background:var(--ace-ai-surface-2);color:var(--ace-ai-text);border-radius:999px;padding:7px 10px;font-size:12px;white-space:nowrap}.ace-ai-context{display:flex;gap:6px;overflow-x:auto;padding-bottom:1px}.ace-ai-empty{color:var(--ace-ai-muted);padding:12px;text-align:center;border:1px dashed var(--ace-ai-border);border-radius:12px}.ace-ai-result{white-space:pre-wrap;background:#0d0f12;border:1px solid var(--ace-ai-border);border-radius:14px;padding:12px;line-height:1.45;overflow:auto;flex:1 1 auto;min-height:0}
.ace-ai-diff{background:#0d0f12;border:1px solid var(--ace-ai-border);border-radius:14px;overflow:auto;flex:1 1 auto;min-height:180px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.ace-ai-diff-line{display:grid;grid-template-columns:24px 1fr;gap:8px;min-height:21px;line-height:1.5;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.ace-ai-diff-line span{text-align:center;color:var(--ace-ai-muted)}.ace-ai-diff-line code{font:inherit;color:inherit}.ace-ai-add{background:rgba(124,207,145,.13);color:#dff8e5}.ace-ai-del{background:rgba(224,108,117,.14);color:#ffe0e3}.ace-ai-same{color:#c4c8d0}
.ace-ai-footer{border-top:1px solid var(--ace-ai-border);padding:9px 10px;background:var(--ace-ai-surface);flex:0 0 auto}.ace-ai-footer .ace-ai-row{flex-wrap:nowrap;overflow-x:auto}.ace-ai-settings{position:absolute;inset:50px 10px 10px 10px;background:var(--ace-ai-bg);border:1px solid var(--ace-ai-border);border-radius:14px;z-index:5;overflow:auto;padding:12px;box-shadow:0 18px 60px #0009}.ace-ai-hidden{display:none!important}.ace-ai-mini{font-size:11px;color:var(--ace-ai-muted)}.ace-ai-status-shimmer{display:inline-block;color:#f4a274;background-image:linear-gradient(100deg,#f4a274 0%,#f4a274 36%,#ffd6ba 49%,#f4a274 62%,#f4a274 100%);background-size:260% 100%;background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ace-ai-textshine 2.35s ease-in-out infinite;text-shadow:none}.ace-ai-streaming::after{content:"▌";display:inline-block;margin-left:2px;animation:ace-ai-blink 1s steps(2,start) infinite}@keyframes ace-ai-blink{50%{opacity:0}}@keyframes ace-ai-textshine{0%{background-position:180% 50%}100%{background-position:-80% 50%}}.ace-ai-error-card{border-color:rgba(224,108,117,.6);background:rgba(224,108,117,.08)}
.ace-ai-tree-list{margin-top:9px;display:flex;flex-direction:column;gap:5px}.ace-ai-tree-row{display:grid;grid-template-columns:auto 24px minmax(0,1fr) auto;gap:7px;align-items:center;border:1px solid var(--ace-ai-border);background:#0d0f12;border-radius:10px;padding:7px}.ace-ai-tree-row.blocked{opacity:.72}.ace-ai-tree-icon{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ace-ai-accent);font-weight:900;text-align:center}.ace-ai-tree-path{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ace-ai-tree-status{font-size:10px;color:var(--ace-ai-muted)}
.ace-ai-tool{border:1px solid var(--ace-ai-border);background:#0d0f12;border-radius:12px;padding:10px;margin-bottom:8px}.ace-ai-tool.blocked{border-color:rgba(224,108,117,.5);background:rgba(224,108,117,.06)}.ace-ai-tool pre{margin:8px 0 0;white-space:pre-wrap;max-height:180px;overflow:auto;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ace-ai-text)}.ace-ai-tool-diff{margin-top:8px;border:1px solid var(--ace-ai-border);border-radius:10px;overflow:auto;max-height:260px}.ace-ai-hunks{display:flex;flex-direction:column;gap:9px;margin-top:9px}.ace-ai-hunk{border:1px solid rgba(77,163,255,.32);background:#101114;border-radius:12px;padding:8px}.ace-ai-hunk.rejected{border-color:rgba(224,108,117,.45);opacity:.78}.ace-ai-hunk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.ace-ai-hunk-head b{display:block;font-size:12px}.ace-ai-hunk-state{display:block;font-size:11px;color:var(--ace-ai-muted);margin-top:2px}.ace-ai-hunk-actions{flex:0 0 auto}.ace-ai-tool-error{margin-top:8px;color:#ffe0e3;background:rgba(224,108,117,.10);border:1px solid rgba(224,108,117,.5);border-radius:10px;padding:7px}.ace-ai-tool-warn{margin-top:8px;color:#ffe7b5;background:rgba(215,166,74,.12);border:1px solid rgba(215,166,74,.45);border-radius:10px;padding:7px}.ace-ai-loading-card{border-color:rgba(242,138,92,.34);background:linear-gradient(180deg,rgba(242,138,92,.10),rgba(242,138,92,.04));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.ace-ai-loading-main{display:flex;flex-direction:column;gap:7px}.ace-ai-loading-title{font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.01em}.ace-ai-loading-tree{display:flex;flex-direction:column;gap:4px}.ace-ai-tree-branch{display:flex;gap:7px;align-items:center;min-width:0}.ace-ai-tree-chr{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#f28a5c;flex:0 0 auto}.ace-ai-tree-item{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8d0dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ace-ai-tree-item.active{color:#fff1e8}.ace-ai-tree-detail{display:block;color:var(--ace-ai-muted);font-size:11px;margin-top:2px;white-space:pre-wrap}.ace-ai-skeleton-line{height:10px;border-radius:6px;background:linear-gradient(90deg,#1e2530 25%,#2d3a4a 50%,#1e2530 75%);background-size:200% 100%;animation:ace-ai-skeleton-sweep 1.4s ease infinite}@keyframes ace-ai-skeleton-sweep{0%{background-position:200% 0}100%{background-position:-200% 0}}.ace-ai-sep{height:1px;background:var(--ace-ai-border);margin:10px 0}
.ace-ai-md-code code .ace-ai-hl-keyword,.ace-ai-hl-keyword{color:#ffb86c}.ace-ai-md-code code .ace-ai-hl-string,.ace-ai-hl-string{color:#a7e3a1}.ace-ai-md-code code .ace-ai-hl-comment,.ace-ai-hl-comment{color:#6f7d91;font-style:italic}.ace-ai-md-code code .ace-ai-hl-number,.ace-ai-hl-number{color:#bd93f9}.ace-ai-md-code code .ace-ai-hl-tag,.ace-ai-hl-tag{color:#ff8f70}.ace-ai-md-code code .ace-ai-hl-property,.ace-ai-hl-property{color:#8be9fd}.ace-ai-md-code code .ace-ai-hl-variable,.ace-ai-hl-variable{color:#f1fa8c}
@media(max-width:760px){.ace-ai-panel{left:0;right:0;bottom:0;height:76vh;border-radius:16px 16px 0 0;border-left-width:0;border-right-width:0;border-bottom-width:0}.ace-ai-sub{max-width:50vw}.ace-ai-iconbtn{min-width:36px;min-height:36px;border-radius:12px}.ace-ai-textarea{min-height:74px;max-height:120px}}
@media(max-height:680px){.ace-ai-panel{height:72vh}.ace-ai-textarea{min-height:68px;max-height:100px}}
`;
    document.head.appendChild(style);
  },
  mountPanel(container, asSidebar) {
    this.css();
    const panel = document.createElement("div");
    panel.className = "ace-ai-panel";
    if (asSidebar) panel.dataset.sidebar = "1";
    panel.innerHTML = this.layout();
    container.innerHTML = "";
    container.appendChild(panel);
    if (!asSidebar) State.panel = panel;
    this.bind(panel);
    this.render(panel);
    return panel;
  },
  layout() {
    return `
<div class="ace-ai-head"><div class="ace-ai-head-main"><div class="ace-ai-brand-wrap"><img class="ace-ai-brand-logo" src="${ACE_AI_LOGO}" alt="Ace AI logo"><div><div class="ace-ai-brand">Ace AI <span class="ace-ai-mini">v${C.VERSION}</span></div><div class="ace-ai-sub" data-role="context-line">Acode-native AI coding assistant</div></div></div></div><div class="ace-ai-actions"><button class="ace-ai-iconbtn" data-act="quick-menu" aria-label="Quick menu">⋮</button><button class="ace-ai-iconbtn" data-act="settings" aria-label="Settings">⚙</button><button class="ace-ai-iconbtn" data-act="toggle-max" aria-label="Maximize">⤢</button><button class="ace-ai-iconbtn" data-act="close" aria-label="Close panel">×</button></div></div>
<div class="ace-ai-tabs"><button class="ace-ai-tab" data-tab="chat">Chat</button><button class="ace-ai-tab" data-tab="edit">Edit</button><button class="ace-ai-tab" data-tab="agent">Agent</button><button class="ace-ai-tab" data-tab="changes">Review</button></div>
<div class="ace-ai-body"><div data-view="chat"></div><div data-view="edit"></div><div data-view="agent"></div><div data-view="changes"></div></div>
<div class="ace-ai-footer" data-role="footer"></div>
<div class="ace-ai-settings ace-ai-hidden" data-role="settings"></div>`;
  },
  bind(root) {
    root.addEventListener("click", (ev) => {
      // Handle code block copy button
      const copyBtn = ev.target.closest("[data-copy-code]");
      if (copyBtn) {
        const pre = copyBtn
          .closest(".ace-ai-md-code")
          ?.querySelector("pre code");
        if (pre) {
          const txt = pre.textContent || "";
          Util.copy(txt).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.textContent = orig;
            }, 1500);
          });
        }
        return;
      }
      const el = ev.target.closest(
        "[data-act],[data-tab],[data-preset],[data-tool]",
      );
      if (!el) return;
      const tab = el.getAttribute("data-tab");
      const act = el.getAttribute("data-act");
      const preset = el.getAttribute("data-preset");
      const tool = el.getAttribute("data-tool");
      State.lastActionMeta = {
        toolId: el.getAttribute("data-tool-id") || "",
        hunkId: el.getAttribute("data-hunk-id") || "",
        path: el.getAttribute("data-path") || "",
        command: el.getAttribute("data-cmd") || "",
        attachmentIndex: el.getAttribute("data-attachment-index") || "",
      };
      if (tab) return this.switchTab(tab, root);
      if (preset) return this.usePreset(Number(preset), root);
      if (tool) return this.useTool(tool, root);
      if (act) return this.handle(act, root);
    });
    root.addEventListener(
      "input",
      Util.debounce((ev) => {
        const prompt =
          ev.target && ev.target.closest
            ? ev.target.closest('textarea[data-role="prompt"]')
            : null;
        if (prompt) State.draftPrompt = prompt.value;
        this.updateContext(root);
      }, 200),
    );
    root.addEventListener("change", (ev) => {
      const hunkCheck =
        ev.target && ev.target.closest
          ? ev.target.closest("[data-hunk-check]")
          : null;
      if (hunkCheck) {
        const toolId = String(hunkCheck.getAttribute("data-hunk-check") || "");
        const hunkId = String(hunkCheck.getAttribute("data-hunk-id") || "");
        AgentTools.setHunkSelection(toolId, hunkId, Boolean(hunkCheck.checked));
        return this.render(root);
      }
      const check =
        ev.target && ev.target.closest
          ? ev.target.closest("[data-tool-check]")
          : null;
      if (!check) return;
      const id = String(check.getAttribute("data-tool-check") || "");
      const tool = State.pendingTools.find((item) => String(item.id) === id);
      if (tool && !tool.error) {
        tool.selected = Boolean(check.checked);
        if (
          tool.selected &&
          tool.preview?.hunks?.length &&
          !tool.preview.hunks.some((h) => h.selected !== false)
        ) {
          AgentTools.setAllHunks(id, true);
        }
      }
      this.render(root);
    });
    root.addEventListener("keydown", (ev) => {
      const input =
        ev.target && ev.target.closest
          ? ev.target.closest('textarea[data-role="prompt"]')
          : null;
      if (!input) return;
      if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        this.send(root);
      }
    });
  },
  openPanel(tab, mode, seed) {
    this.css();
    if (!State.panel) {
      const wrap = document.createElement("div");
      document.body.appendChild(wrap);
      this.mountPanel(wrap, false);
    }
    State.panel.classList.remove("ace-ai-hidden");
    if (mode) State.activeMode = mode;
    if (tab) State.activeTab = tab;
    this.render(State.panel);
    if (seed) {
      const input = State.panel.querySelector('[data-role="prompt"]');
      if (input && !input.value) input.value = seed;
    }
    Acode.pushBackAction();
    setTimeout(
      () => State.panel?.querySelector('[data-role="prompt"]')?.focus(),
      80,
    );
  },
  closePanel() {
    if (State.panel) State.panel.classList.add("ace-ai-hidden");
    State.quickMenuOpen = false;
    Acode.removeBackAction();
    Editor.focus();
  },
  panelVisible() {
    return Boolean(
      State.panel && !State.panel.classList.contains("ace-ai-hidden"),
    );
  },
  handleBackAction() {
    const root = State.panel;
    if (!this.panelVisible()) return this.closePanel();
    const settings = root?.querySelector('[data-role="settings"]');
    if (settings && !settings.classList.contains("ace-ai-hidden")) {
      settings.classList.add("ace-ai-hidden");
      this.render(root);
      Acode.pushBackAction();
      return true;
    }
    if (State.reviewOpen) {
      State.reviewOpen = false;
      Store.saveSettings({ reviewOpen: false });
      this.render(root);
      Acode.pushBackAction();
      return true;
    }
    if (State.maximized) {
      State.maximized = false;
      this.render(root);
      Acode.pushBackAction();
      return true;
    }
    this.closePanel();
    return true;
  },
  openQuickMenu(root) {
    const items = [
      {
        id: "new-chat",
        label: "New chat",
        action: () => this.handle("new-chat", root),
      },
      {
        id: "review-current",
        label: "Review current file",
        action: () =>
          this.startPrompt(
            root,
            "Review the current file for bugs, risky code, and small improvements. Do not edit yet unless I ask.",
          ),
      },
      {
        id: "diagnose-project",
        label: "Diagnose project",
        action: () =>
          this.startPrompt(
            root,
            "Diagnose this project. Use project_overview first, then inspect only the files needed to summarize framework, scripts, risks, and safe validation commands. Do not edit files unless I ask.",
          ),
      },
      {
        id: "attach-current",
        label: "Attach current file context",
        action: () => this.attachCurrentFile(root),
      },
      {
        id: "fix-selection",
        label: "Fix selection",
        action: () =>
          this.startPrompt(
            root,
            "Fix the selected code. Keep the change minimal and reviewable.",
          ),
      },
      {
        id: "run-lint",
        label: "Run npm lint",
        action: () => this.requestRunCommand(root, "npm run lint"),
      },
      {
        id: "run-test",
        label: "Run npm test",
        action: () => this.requestRunCommand(root, "npm test"),
      },
    ];
    if (!Acode.showContextMenu(items, { top: 58, right: 10 })) {
      const labels = items
        .map((item, i) => `${i + 1}. ${item.label}`)
        .join("\n");
      Acode.alert("Ace AI menu", labels);
    }
  },
  startPrompt(root, prompt, mode) {
    State.draftPrompt = String(prompt || "");
    if (mode) State.aiMode = mode;
    State.activeTab = "chat";
    this.render(root || State.panel);
    const target = (root || State.panel)?.querySelector('[data-role="prompt"]');
    if (target) {
      target.value = State.draftPrompt;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setTimeout(() => target.focus(), 0);
    }
  },
  safeCommand(command) {
    return AgentTools.safeCommand(command);
  },
  async openToolTarget(root) {
    const id = String(State.lastActionMeta?.toolId || "");
    const path = String(State.lastActionMeta?.path || "").trim();
    const tool = id
      ? State.pendingTools.find((item) => String(item.id) === id)
      : null;
    const target = path || tool?.path || "";
    if (!target && tool?.name !== "replace_file")
      return Acode.toast("No file target to open");
    try {
      const openPath = target
        ? AgentTools.resolvePath(target)
        : AgentTools.activePath();
      await Acode.openFileAt(openPath, {
        line: tool?.openLine || 1,
        column: 1,
      });
      Acode.toast("Opened " + (target || "active file"));
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      this.render(root || State.panel);
      Acode.toast(
        State.lastError.title || State.lastError.message || "Open failed",
      );
    }
  },
  attachmentKey(item) {
    return String(item?.path || item?.filename || "").trim();
  },
  attachCurrentFile(root) {
    const ctx = Editor.context();
    const filename =
      ctx.file?.filename || Editor.info().filename || "active file";
    const path =
      ctx.file?.uri || Editor.info().uri || Editor.info().location || filename;
    const content = Editor.text();
    if (!String(content || "").trim())
      return Acode.toast("Current file is empty");
    const item = {
      path,
      filename,
      language: ctx.file?.language || Util.lang(filename),
      content: Util.truncate(content, C.MAX_FULL_FILE),
      line_count: String(content || "").split("\n").length,
      time: new Date().toISOString(),
    };
    const key = this.attachmentKey(item);
    State.contextAttachments = (State.contextAttachments || []).filter(
      (existing) => this.attachmentKey(existing) !== key,
    );
    State.contextAttachments.unshift(item);
    State.contextAttachments = State.contextAttachments.slice(0, 6);
    Acode.toast("Attached context: " + filename);
    return this.render(root || State.panel);
  },
  removeAttachment(root) {
    const idx = Number(State.lastActionMeta?.attachmentIndex || -1);
    if (!Array.isArray(State.contextAttachments) || idx < 0) return;
    const removed = State.contextAttachments.splice(idx, 1)[0];
    Acode.toast("Removed context: " + (removed?.filename || "attachment"));
    return this.render(root || State.panel);
  },
  clearAttachments(root) {
    State.contextAttachments = [];
    Acode.toast("Cleared pinned context");
    return this.render(root || State.panel);
  },

  async requestRunCommand(root, command) {
    const cmd = this.safeCommand(
      command || State.lastActionMeta?.command || "",
    );
    if (!cmd) return Acode.toast("Command blocked by Ace AI safety policy");
    const ok = await Acode.confirm(
      "Run command in Acode terminal?",
      cmd + "\n\nThe command will be typed into a visible terminal tab.",
    );
    if (!ok) return;
    try {
      await Acode.runVisibleTerminal(cmd, { name: "Ace AI Run" });
      State.terminalHistory.unshift({
        command: cmd,
        time: new Date().toISOString(),
      });
      State.terminalHistory = State.terminalHistory.slice(0, 10);
      Acode.toast("Command sent to terminal");
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      this.render(root || State.panel);
      Acode.toast(
        State.lastError.title || State.lastError.message || "Terminal failed",
      );
    }
  },
  switchTab(tab, root) {
    if (tab === "changes" && State.lastResultKind !== "edit") {
      State.activeTab = "changes";
      this.render(root || State.panel);
      return;
    }
    State.activeTab = tab;
    this.render(root || State.panel);
  },
  updateContext(root) {
    const ctx = Editor.context();
    const line = root?.querySelector('[data-role="context-line"]');
    if (!line) return;
    const cursor = ctx.cursor?.line || 1;
    const around = ctx.cursorContext
      ? `${ctx.cursorContext.startLine || cursor}-${ctx.cursorContext.endLine || cursor}`
      : `${cursor}`;
    const focus = ctx.hasSelection
      ? `${ctx.selectionLines} selected line${ctx.selectionLines > 1 ? "s" : ""}`
      : `around cursor ${around}`;
    line.textContent = `${ctx.file.filename} · ${focus}${ctx.dirty?.dirty ? " · unsaved" : ""}`;
  },
  render(root) {
    if (!root) return;
    this.updateContext(root);
    root
      .querySelectorAll(".ace-ai-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.tab === State.activeTab),
      );
    root
      .querySelectorAll("[data-view]")
      .forEach((v) =>
        v.classList.toggle(
          "ace-ai-view-active",
          v.dataset.view === State.activeTab,
        ),
      );
    // Lazy render: only render the active view + settings to avoid unnecessary
    // DOM thrashing on hidden tabs. Other views render when switched to.
    const active = State.activeTab || "chat";
    if (active === "chat")
      this.renderChat(root.querySelector('[data-view="chat"]'));
    else if (active === "edit")
      this.renderEdit(root.querySelector('[data-view="edit"]'));
    else if (active === "agent")
      this.renderAgent(root.querySelector('[data-view="agent"]'));
    else if (active === "changes")
      this.renderChanges(root.querySelector('[data-view="changes"]'));
    this.renderSettings(root.querySelector('[data-role="settings"]'));
    this.updateFooter(root);
    this.scrollChatToBottom(root);
    if (State.sidebarContainer) {
      const sidebarRoot = State.sidebarContainer.querySelector(".ace-ai-panel");
      if (sidebarRoot && sidebarRoot !== root)
        this.scrollChatToBottom(sidebarRoot);
    }
    root.classList.toggle("is-max", Boolean(State.maximized));
  },
  scrollChatToBottom(root) {
    if (!root) return;
    const log = root.querySelector(".ace-ai-chatlog, .ace-ai-conversation");
    if (!log) return;
    setTimeout(() => {
      log.scrollTop = log.scrollHeight;
    }, 0);
  },
  updateFooter(root) {
    const footer = root.querySelector('[data-role="footer"]');
    if (!footer) return;
    const hasEditableReview =
      State.lastResultKind === "edit" &&
      Boolean(State.lastPatch || State.lastResult);
    const hasAgentReview = State.pendingTools.length > 0;
    if (State.busy) {
      const label =
        State.streamingMode === "agent"
          ? "Running Agent…"
          : State.streamingMode === "edit"
            ? "Generating Edit…"
            : "Streaming…";
      footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" disabled><span class="ace-ai-status-shimmer">${label}</span></button></div>`;
      return;
    }
    if (State.activeTab === "changes") {
      if (hasAgentReview) {
        const selected = AgentTools.selectedTools().length;
        const loopLabel = State.autoLoopEnabled
          ? ` ⟳${State.autoLoopCount > 0 ? " " + State.autoLoopCount + "/" + State.autoLoopMax : ""}`
          : "";
        footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="apply-tools">Apply (${selected})${loopLabel}</button><button class="ace-ai-btn" data-act="select-all-tools">All</button><button class="ace-ai-btn" data-act="select-no-tools">None</button><button class="ace-ai-btn" data-act="copy-tools">Copy</button>${State.undoStack.length ? '<button class="ace-ai-btn" data-act="undo-tools">Undo</button>' : ""}<button class="ace-ai-btn ace-ai-danger" data-act="clear-tools">Reject</button></div>`;
        return;
      }
      if (!hasEditableReview) {
        footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug</button><button class="ace-ai-btn" data-act="undo-tools">Undo Last</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear State</button></div>`;
        return;
      }
      const label = State.lastPatch ? "Apply Patch" : "Replace Selection";
      footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="apply-main">${label}</button><button class="ace-ai-btn" data-act="copy-result">Copy</button><button class="ace-ai-btn" data-act="insert-result">Insert</button><button class="ace-ai-btn ace-ai-danger" data-act="reject">Reject</button></div>`;
      return;
    }
    if (State.activeTab === "edit") {
      footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Generate Edit</button></div>`;
      return;
    }
    if (State.activeTab === "agent") {
      footer.innerHTML = hasAgentReview
        ? `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="open-review">Open Review</button><button class="ace-ai-btn" data-act="send">Run Again</button></div>`
        : `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Run Agent</button></div>`;
      return;
    }
    footer.innerHTML = `<div class="ace-ai-row"><button class="ace-ai-btn ace-ai-primary" data-act="send">Send</button></div>`;
  },
  errorBanner() {
    if (!State.lastError) return "";
    const e = ErrorKit.normalize(State.lastError);
    const why =
      e.code === "RATE_LIMITED"
        ? "This is usually temporary. The API may be limiting request rate or quota."
        : e.code === "NETWORK_OR_CORS"
          ? "The app could not reach the API endpoint."
          : e.code === "REQUEST_TIMEOUT"
            ? "The request took too long to finish."
            : "";
    return `<div class="ace-ai-card ace-ai-error-card"><div class="ace-ai-label">Error · ${Util.html(e.code || "UNKNOWN")}${e.status ? " · HTTP " + e.status : ""}</div><div style="font-weight:800;margin-top:4px">${Util.html(e.title || "Ace AI error")}</div><div class="ace-ai-mini" style="margin-top:6px;white-space:pre-wrap">${Util.html(e.message || "")}</div>${why ? `<div class="ace-ai-mini" style="margin-top:6px;color:#ffd78a">${Util.html(why)}</div>` : ""}${e.hint ? `<div class="ace-ai-mini" style="margin-top:6px;color:#ffd78a">${Util.html(e.hint)}</div>` : ""}<div class="ace-ai-row nowrap" style="margin-top:9px"><button class="ace-ai-btn ace-ai-primary" data-act="retry-last">Retry</button><button class="ace-ai-btn" data-act="copy-error">Copy Error</button><button class="ace-ai-btn" data-act="settings">Settings</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-error">Clear</button></div></div>`;
  },
  busyBanner() {
    if (!State.busy) return "";
    const activities = Array.isArray(State.toolActivity)
      ? State.toolActivity
      : [];
    const explored = Array.from(
      new Set(
        activities
          .map((item) => String(item.target || item.tool || "").trim())
          .filter(Boolean),
      ),
    );

    const stage = State.flowStage || "drafting";
    const stageMap = {
      drafting: {
        label: "exploring...",
        rows: [],
      },
      inspecting: {
        label: "Inspecting project",
        rows: ["reading files", "building context", "analysing codebase"],
      },
      proposing: {
        label: "Planning edits",
        rows: ["checking intent", "drafting tool calls", "preparing diff"],
      },
      review: {
        label: "Preparing review",
        rows: ["building file tree", "rendering diff", "waiting for approval"],
      },
      applying: {
        label:
          State.autoLoopEnabled && State.autoLoopCount > 0
            ? "Applying · loop " + State.autoLoopCount + "/" + State.autoLoopMax
            : "Applying changes",
        rows: ["writing changes", "updating editor", "refreshing review"],
      },
      done: {
        label: "Finishing",
        rows: ["saving result", "refreshing UI", "ready"],
      },
      error: {
        label: "Recovering",
        rows: ["collecting error", "keeping changes safe", "waiting for retry"],
      },
    };

    const data = stageMap[stage] || stageMap.drafting;
    const label = State.toolProgress || data.label || "exploring...";
    let lines = data.rows.slice();

    if (explored.length) {
      lines = explored.slice(0, 3).map((target) => {
        const clean = String(target).trim();
        if (/^(run_command|command)$/i.test(clean)) return "running command";
        if (/^(project_overview)$/i.test(clean))
          return "reading project overview";
        if (/^(search_in_files)$/i.test(clean)) return "searching codebase";
        if (/^(list_files)$/i.test(clean)) return "listing files";
        if (/^(open_file)$/i.test(clean)) return "opening file";
        return "reading " + Util.truncate(clean, 42);
      });
      if (explored.length > 3) {
        lines[2] = "+" + (explored.length - 2) + " more context items";
      }
    }

    const showTree =
      lines.length > 0 &&
      (stage !== "drafting" ||
        explored.length > 0 ||
        State.streamingMode === "agent");

    const detail =
      State.retryStatus ||
      State.flowDetail ||
      (State.streamingContent
        ? Util.truncate(
            String(State.streamingContent).replace(/\s+/g, " ").trim(),
            90,
          )
        : "");

    const rows = showTree
      ? `<div class="ace-ai-loading-tree">${lines
          .map((line, index) => {
            const branch = index < lines.length - 1 ? "├─" : "└─";
            const active = index === 0 ? " active" : "";
            return `<div class="ace-ai-tree-branch"><span class="ace-ai-tree-chr">${branch}</span><span class="ace-ai-tree-item${active}">${Util.html(line)}</span></div>`;
          })
          .join("")}</div>`
      : "";

    return `<div class="ace-ai-card ace-ai-loading-card"><div class="ace-ai-loading-main"><div class="ace-ai-loading-title ace-ai-status-shimmer">✦ ${Util.html(label)}</div>${rows}<span class="ace-ai-tree-detail" data-role="busy-detail">${Util.html(detail || (showTree ? "Working…" : ""))}</span></div></div>`;
  },
  updateStreaming(root) {
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
    if (!streamNode && State.streamingContent) {
      this.render(root);
      return;
    }
    if (streamNode)
      streamNode.innerHTML = Util.markdown(State.streamingContent || "");
    const editStream = root.querySelector('[data-role="streaming-edit"]');
    if (editStream)
      editStream.innerHTML = Util.markdown(State.streamingContent || "");
    const agentStream = root.querySelector('[data-role="streaming-agent"]');
    if (agentStream)
      agentStream.innerHTML = Util.markdown(State.streamingContent || "");
    if (State.streamingContent || State.busy) this.scrollChatToBottom(root);
  },
  contextBadges() {
    const ctx = Editor.context();
    const cursor = ctx.cursor?.line || 1;
    const around = ctx.cursorContext
      ? `${ctx.cursorContext.startLine || cursor}-${ctx.cursorContext.endLine || cursor}`
      : `${cursor}`;
    const focus = ctx.hasSelection
      ? `${ctx.selectionLines} selected line${ctx.selectionLines > 1 ? "s" : ""}`
      : `around cursor ${around}`;
    return `<div class="ace-ai-context"><span class="ace-ai-chip">${Util.html(ctx.file.filename)}</span><span class="ace-ai-chip">${Util.html(ctx.file.language)}</span><span class="ace-ai-chip">cursor line ${cursor}</span><span class="ace-ai-chip">${Util.html(focus)}</span><span class="ace-ai-chip">visible ${ctx.visibleRange?.startLine || 1}-${ctx.visibleRange?.endLine || 1}</span><span class="ace-ai-chip">${ctx.openFiles?.length || 1} open</span>${ctx.dirty?.dirty ? '<span class="ace-ai-chip">unsaved</span>' : ""}</div>`;
  },
  renderChat(el) {
    if (!el) return;
    const chat = Store.chat();
    const streamRow =
      State.streamingMode === "chat" && State.streamingContent
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
            const body =
              m.role === "assistant"
                ? Util.markdown(m.content)
                : Util.html(m.content);
            return `<div class="ace-ai-msg ${m.role} ${m.streaming ? "streaming ace-ai-streaming" : ""}"><div class="ace-ai-msg-head"><span class="ace-ai-msg-role">${m.role === "user" ? "You" : "Ace AI"}</span><span class="ace-ai-mini">${Util.html(m.time || "")}</span></div><div class="ace-ai-msg-body">${body}</div></div>`;
          })
          .join("")
      : '<div class="ace-ai-empty">Ask about the active file, selected code, or tap a quick action.</div>';
    el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}<div class="ace-ai-chat-shell"><div class="ace-ai-chatlog">${rows}${this.busyBanner()}</div><div class="ace-ai-card"><div class="ace-ai-label">Chat prompt</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="Ask Ace AI... Use @path/to/file.js or @codebase">${Util.html(State.draftPrompt || "")}</textarea><div class="ace-ai-mini" style="margin-top:6px">Enter = send · Shift+Enter = newline</div><div class="ace-ai-row nowrap" style="margin-top:8px">${Store.presets()
      .slice(0, 5)
      .map(
        (p, i) =>
          `<button class="ace-ai-chip" data-preset="${i}">${Util.html(p.name)}</button>`,
      )
      .join("")}</div></div></div></div>`;
    this.attachHints(el.querySelector('[data-role="prompt"]'));
  },
  renderEdit(el) {
    if (!el) return;
    const s = Store.settings();
    const streaming =
      State.streamingMode === "edit" && State.streamingContent
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Streaming edit result</div><div class="ace-ai-result ace-ai-md ace-ai-streaming" data-role="streaming-edit">${Util.markdown(State.streamingContent)}</div></div>`
        : "";
    el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Inline edit instruction</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="e.g. fix this, make it cleaner, convert to PHP template">${Util.html(State.draftPrompt || "")}</textarea><div class="ace-ai-mini" style="margin-top:6px">Enter = generate · Shift+Enter = newline</div><div class="ace-ai-sep"></div><div class="ace-ai-row nowrap"><label class="ace-ai-chip"><input type="radio" name="ace-output" value="patch" ${s.preferPatch ? "checked" : ""}> Patch</label><label class="ace-ai-chip"><input type="radio" name="ace-output" value="replacement" ${!s.preferPatch ? "checked" : ""}> Replacement</label><label class="ace-ai-chip"><input type="checkbox" data-role="include-full" ${s.includeFullFile ? "checked" : ""}> Full file</label></div></div>${streaming}<div class="ace-ai-card"><div class="ace-ai-label">Quick actions</div><div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-tool="fix">Fix</button><button class="ace-ai-btn" data-tool="explain">Explain</button><button class="ace-ai-btn" data-tool="refactor">Refactor</button><button class="ace-ai-btn" data-tool="html-section">HTML/CSS/JS</button><button class="ace-ai-btn" data-tool="php-template">HTML → PHP</button><button class="ace-ai-btn" data-tool="acode-plugin">Acode Plugin</button><button class="ace-ai-btn" data-tool="widget">Widget Embed</button></div></div></div>`;
    this.attachHints(el.querySelector('[data-role="prompt"]'));
  },
  renderAgent(el) {
    if (!el) return;
    const streaming =
      State.streamingMode === "agent" && State.streamingContent
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Streaming agent plan</div><div class="ace-ai-result ace-ai-md ace-ai-streaming" data-role="streaming-agent">${Util.markdown(State.streamingContent)}</div></div>`
        : "";
    const message = State.agentMessage
      ? `<div class="ace-ai-card"><div class="ace-ai-label">Agent summary</div><div class="ace-ai-mini" style="white-space:pre-wrap">${Util.html(State.agentMessage)}</div></div>`
      : "";
    const loopBanner = State.autoLoopEnabled
      ? `<div class="ace-ai-card" style="border-color:rgba(77,163,255,.4);background:rgba(77,163,255,.07)"><div class="ace-ai-mini" style="color:#a8d4ff">⟳ Auto-loop ON${State.autoLoopCount > 0 ? " · iteration " + State.autoLoopCount + "/" + State.autoLoopMax : " · will continue after each apply"} · tap ⟳ to stop</div></div>`
      : "";
    const readResults =
      !State.pendingTools.length && State.readToolResults.length
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Read results</div>${State.readToolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)}${r.path ? " · " + Util.html(r.path) : ""} — ${Util.html(r.result)}</div>`).join("")}</div>`
        : "";
    const results = State.toolResults.length
      ? `<div class="ace-ai-card"><div class="ace-ai-label">Tool results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join("")}</div>`
      : "";
    el.innerHTML = `<div class="ace-ai-col">${this.contextBadges()}${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Agent instruction</div><textarea class="ace-ai-textarea" data-role="prompt" enterkeyhint="send" placeholder="e.g. edit safely, read @src/app.js first, or search @codebase for widget">${Util.html(State.draftPrompt || "")}</textarea><div class="ace-ai-mini" style="margin-top:6px">Agent returns tool calls. Ace AI shows diffs first; nothing is applied until you tap Approve & Apply Tools.</div><div class="ace-ai-row nowrap" style="margin-top:8px"><label class="ace-ai-chip"><input type="checkbox" data-role="include-full" ${Store.settings().includeFullFile ? "checked" : ""}> Full file context</label><button class="ace-ai-btn${State.autoLoopEnabled ? " ace-ai-primary" : ""}" data-act="toggle-auto-loop" title="Auto-loop: apply tools then continue until done or max ${State.autoLoopMax} iterations">${State.autoLoopEnabled ? (State.autoLoopCount > 0 ? "⟳ " + State.autoLoopCount + "/" + State.autoLoopMax : "⟳ Auto") : "⟳"}</button><button class="ace-ai-btn" data-tool="agent-create">Create file</button><button class="ace-ai-btn" data-tool="agent-edit">Edit active file</button><button class="ace-ai-btn" data-tool="agent-widget">Widget embed</button></div></div>${loopBanner}${streaming}${message}<div class="ace-ai-card"><div class="ace-ai-label">Review</div><div class="ace-ai-mini">Open Review for file tree, diffs, and hunk approval. Changes are never applied automatically.</div>${State.pendingTools.length ? '<div class="ace-ai-row" style="margin-top:8px"><button class="ace-ai-btn ace-ai-primary" data-act="open-review">Open Review</button></div>' : ""}</div>${readResults}${results}</div>`;
    this.attachHints(el.querySelector('[data-role="prompt"]'));
  },
  renderChanges(el) {
    if (!el) return;
    if (State.pendingTools.length) {
      const results = State.toolResults.length
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Apply results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join("")}</div>`
        : "";
      const applied = State.lastAppliedSummary
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Last apply</div><div class="ace-ai-mini">${Util.html(State.lastAppliedSummary)}</div></div>`
        : "";
      const readResults = State.readToolResults.length
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Read results</div>${State.readToolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)}${r.path ? " · " + Util.html(r.path) : ""} — ${Util.html(r.result)}</div>`).join("")}</div>`
        : "";
      const loopInfo = State.autoLoopEnabled
        ? `<div class="ace-ai-card" style="border-color:rgba(77,163,255,.4);background:rgba(77,163,255,.07)"><div class="ace-ai-mini" style="color:#a8d4ff">⟳ Auto-loop${State.autoLoopCount > 0 ? " · iteration " + State.autoLoopCount + "/" + State.autoLoopMax : " ON"} · review then tap Apply to continue</div></div>`
        : "";
      el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}${loopInfo}${State.agentMessage ? `<div class="ace-ai-card"><div class="ace-ai-label">Agent summary</div><div class="ace-ai-mini" style="white-space:pre-wrap">${Util.html(State.agentMessage)}</div></div>` : ""}${AgentTools.renderList()}${readResults}<div class="ace-ai-card"><div class="ace-ai-label">Review</div><div class="ace-ai-mini">Waiting for approval before applying changes.</div></div>${applied}${results}</div>`;
      return;
    }
    if (
      State.lastResultKind !== "edit" ||
      !(State.lastPatch || State.lastResult)
    ) {
      const results = State.toolResults.length
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Tool results</div>${State.toolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)} — ${Util.html(r.result)}</div>`).join("")}</div>`
        : "";
      const readResults = State.readToolResults.length
        ? `<div class="ace-ai-card"><div class="ace-ai-label">Read results</div>${State.readToolResults.map((r) => `<div class="ace-ai-mini">${r.ok ? "✓" : "×"} ${Util.html(r.tool)}${r.path ? " · " + Util.html(r.path) : ""} — ${Util.html(r.result)}</div>`).join("")}</div>`
        : "";
      el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Review</div><div class="ace-ai-mini">No pending review. Chat answers stay in Chat. Agent proposals show here only after Run Agent.</div></div>${State.lastAppliedSummary ? `<div class="ace-ai-card"><div class="ace-ai-label">Last apply</div><div class="ace-ai-mini">${Util.html(State.lastAppliedSummary)}</div></div>` : ""}${readResults}${results}<div class="ace-ai-card"><div class="ace-ai-label">Debug</div><div class="ace-ai-mini">Version ${C.VERSION} · last result kind: ${Util.html(State.lastResultKind || "none")}</div><div class="ace-ai-row" style="margin-top:8px"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug State</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear Runtime State</button></div></div></div>`;
      return;
    }
    const original =
      State.lastOriginal ||
      (State.lastTarget === "file" ? Editor.text() : Editor.selectedText());
    const patch = State.lastPatch;
    const result = State.lastResult;
    let rows = [];
    if (patch) rows = Patch.previewPatch(patch);
    else rows = Patch.simpleDiff(original, result);
    el.innerHTML = `<div class="ace-ai-col ace-ai-scroll-col">${this.errorBanner()}${this.busyBanner()}<div class="ace-ai-card"><div class="ace-ai-label">Edit review</div><div class="ace-ai-mini">${Util.html(State.lastSummary || "Review generated edit before applying.")}</div></div><div class="ace-ai-diff">${Patch.render(rows)}</div></div>`;
  },
  renderSettings(el) {
    if (!el) return;
    const s = Store.settings();
    el.innerHTML = `<div class="ace-ai-col"><div class="ace-ai-row" style="justify-content:space-between"><div class="ace-ai-brand">Settings</div><button class="ace-ai-iconbtn" data-act="settings" aria-label="Close settings">×</button></div><label><div class="ace-ai-label">NAI API Key</div><input class="ace-ai-input" data-set="apiKey" type="password" value="${Util.html(s.apiKey)}" placeholder="nsk_..."></label><label><div class="ace-ai-label">Base URL</div><input class="ace-ai-input" data-set="baseUrl" value="${Util.html(s.baseUrl)}"></label><div class="ace-ai-mini">Endpoint: /v1/responses only. Ace AI stores previous_response_id for conversation continuity and also keeps local history on this device.</div><label><div class="ace-ai-label">Model</div><input class="ace-ai-input" data-set="model" value="${Util.html(s.model)}"></label><label><div class="ace-ai-label">Project Root / Folder URL</div><input class="ace-ai-input" data-set="projectRoot" value="${Util.html(s.projectRoot || "")}" placeholder="optional, e.g. content://... or file:///storage/..."></label><div class="ace-ai-mini">Used when the agent creates relative files such as index.js and the active file does not already have a folder.</div><div class="ace-ai-row"><label style="flex:1"><div class="ace-ai-label">Temperature</div><input class="ace-ai-input" data-set="temperature" value="${Util.html(s.temperature)}"></label><label style="flex:1"><div class="ace-ai-label">Max Tokens</div><input class="ace-ai-input" data-set="maxTokens" value="${Util.html(s.maxTokens)}"></label></div><label class="ace-ai-chip"><input type="checkbox" data-set="includeFullFile" ${s.includeFullFile ? "checked" : ""}> Include full file by default</label><label class="ace-ai-chip"><input type="checkbox" data-set="preferPatch" ${s.preferPatch ? "checked" : ""}> Prefer patch output</label><button class="ace-ai-btn ace-ai-primary" data-act="save-settings">Save Settings</button><div class="ace-ai-row"><button class="ace-ai-btn" data-act="copy-debug">Copy Debug State</button><button class="ace-ai-btn" data-act="new-chat">Clear Chat History</button><button class="ace-ai-btn ace-ai-danger" data-act="clear-state">Clear Runtime State</button></div></div>`;
  },
  attachHints(input) {
    // Acode inputHints opens a large native dropdown on some Android builds and
    // can steal Enter from textareas. Ace AI keeps hints as compact chips instead.
    if (!input || input.dataset.hints === "1") return;
    input.dataset.hints = "1";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
  },
  usePreset(index, root) {
    const preset = Store.presets()[index];
    const input = root.querySelector('[data-role="prompt"]');
    if (preset && input) {
      State.draftPrompt = preset.prompt;
      input.value = preset.prompt;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      this.render(root);
      setTimeout(() => {
        const next = root.querySelector('[data-role="prompt"]');
        if (next) {
          next.focus();
          try {
            next.setSelectionRange(next.value.length, next.value.length);
          } catch (_) {}
        }
      }, 0);
    }
  },
  useTool(tool, root) {
    const input = root.querySelector('[data-role="prompt"]');
    const map = {
      fix: "Fix bugs in the selected code. Keep the change minimal.",
      explain: "Explain the selected error/code and give the smallest fix.",
      refactor:
        "Refactor the selected code for clarity without changing behavior.",
      "html-section":
        "Generate a polished responsive HTML/CSS/JS section for this file.",
      "php-template":
        "Convert the selected HTML to a PHP template using htmlspecialchars for dynamic values.",
      "acode-plugin":
        "Generate a complete Acode plugin skeleton with manifest, main.js, lifecycle, commands, UI, and cleanup.",
      widget: "Generate a clean Neosantara widget embed section.",
      "agent-create":
        "Create the files needed for this feature. Return reviewable tool calls only and keep each file minimal.",
      "agent-edit":
        "Modify the active file safely using reviewable tool calls only. Prefer minimal diffs and preserve existing style.",
      "agent-widget":
        "Create or insert a Neosantara widget embed using reviewable tool calls only.",
      "agent-codebase":
        "Use list_files and search_in_files first to inspect the relevant codebase context, then answer or propose reviewable edits only if needed.",
      "agent-review-file":
        "Review the current file for bugs, unclear code, risky patterns, and small improvements. Do not edit yet unless I explicitly ask.",
      "agent-diagnose":
        "Diagnose this project. Use project_overview first, then inspect only the files needed to summarize likely framework, scripts, risks, and safe validation commands. Do not edit files unless I ask.",
    };
    if (input) {
      if (String(tool || "").startsWith("agent-")) State.aiMode = "agent";
      const value = map[tool] || "";
      State.draftPrompt = value;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      this.render(root);
      setTimeout(() => {
        const next = root.querySelector('[data-role="prompt"]');
        if (next) {
          next.focus();
          try {
            next.setSelectionRange(next.value.length, next.value.length);
          } catch (_) {}
        }
      }, 0);
    }
  },
  getPrompt(root) {
    return root.querySelector('[data-role="prompt"]')?.value.trim() || "";
  },
  outputMode(root) {
    if (State.activeTab === "agent") return "tools";
    if (State.activeTab !== "edit") return "chat";
    const checked = root.querySelector('input[name="ace-output"]:checked');
    return checked
      ? checked.value
      : Store.settings().preferPatch
        ? "patch"
        : "replacement";
  },
  async handle(act, root) {
    if (act === "close") return this.closePanel();
    if (act === "quick-menu") return this.openQuickMenu(root);
    if (act === "run-command")
      return this.requestRunCommand(root, State.lastActionMeta?.command || "");
    if (act === "attach-current-file") return this.attachCurrentFile(root);
    if (act === "remove-attachment") return this.removeAttachment(root);
    if (act === "clear-attachments") return this.clearAttachments(root);
    if (act === "open-tool-target") return this.openToolTarget(root);
    if (act === "settings")
      return root
        .querySelector('[data-role="settings"]')
        ?.classList.toggle("ace-ai-hidden");
    if (act === "toggle-max") {
      State.maximized = !State.maximized;
      return this.render(root);
    }
    if (act === "save-settings") return this.saveSettings(root);
    if (act === "clear-error") {
      State.lastError = null;
      return this.render(root);
    }
    if (act === "copy-debug") return Acode.copy(Runtime.debugState());
    if (act === "clear-state") {
      Runtime.clearTransientState();
      return this.render(root);
    }
    if (act === "copy-error")
      return Acode.copy(ErrorKit.report(State.lastError));
    if (act === "retry-last") return this.retryLast(root);
    if (act === "send") return this.send(root);
    if (act === "apply-tools") return this.applyTools(root);
    if (act === "undo-tools") return this.undoTools(root);
    if (act === "toggle-auto-loop") {
      State.autoLoopEnabled = !State.autoLoopEnabled;
      State.autoLoopCount = 0;
      State.autoLoopStartedAt = State.autoLoopEnabled ? Date.now() : 0;
      Acode.toast(
        State.autoLoopEnabled
          ? "Auto-loop ON (max " + State.autoLoopMax + " iterations)"
          : "Auto-loop OFF",
      );
      return this.render(root);
    }
    if (act === "select-all-tools") {
      State.pendingTools.forEach((t) => {
        if (!t.error) {
          t.selected = true;
          if (t.preview?.hunks?.length)
            t.preview.hunks.forEach((h) => {
              h.selected = true;
            });
        }
      });
      return this.render(root);
    }
    if (act === "select-no-tools") {
      State.pendingTools.forEach((t) => {
        t.selected = false;
      });
      return this.render(root);
    }
    if (act === "open-review") {
      State.activeTab = "changes";
      return this.render(root);
    }
    if (act === "accept-hunk" || act === "reject-hunk") {
      const toolId = String(State.lastActionMeta?.toolId || "");
      const hunkId = String(State.lastActionMeta?.hunkId || "");
      const ok = AgentTools.setHunkSelection(
        toolId,
        hunkId,
        act === "accept-hunk",
      );
      State.reviewNotice = ok
        ? (act === "accept-hunk" ? "Accepted hunk " : "Rejected hunk ") +
          hunkId +
          "."
        : "Hunk not found.";
      if (ok) Acode.toast(State.reviewNotice);
      return this.render(root);
    }
    if (act === "accept-all-hunks" || act === "reject-all-hunks") {
      const toolId = String(State.lastActionMeta?.toolId || "");
      const ok = AgentTools.setAllHunks(toolId, act === "accept-all-hunks");
      State.reviewNotice = ok
        ? (act === "accept-all-hunks"
            ? "Accepted all hunks for change #"
            : "Rejected all hunks for change #") +
          toolId +
          "."
        : "Change not found.";
      if (ok) Acode.toast(State.reviewNotice);
      return this.render(root);
    }
    if (act === "reject-tool") {
      const id = String(State.lastActionMeta?.toolId || "");
      State.pendingTools = State.pendingTools.filter(
        (t) => String(t.id) !== id,
      );
      State.reviewNotice = id
        ? "Rejected proposed change #" + id + "."
        : "Rejected proposed change.";
      return this.render(root);
    }
    if (act === "explain-tool") {
      const id = String(State.lastActionMeta?.toolId || "");
      const t = State.pendingTools.find((item) => String(item.id) === id);
      if (!t) return Acode.toast("Tool not found");
      const diff = (t.preview?.rows || [])
        .slice(0, 160)
        .map(
          (row) =>
            (row.type === "add" ? "+ " : row.type === "del" ? "- " : "  ") +
            row.text,
        )
        .join("\n");
      const target = AgentTools.targetOf(t);
      const prompt = `Explain this proposed change before I apply it. Be concise, mention risk, and describe what will change.\n\nTool: ${t.name}\nTarget: ${target}\n\nDiff preview:\n${diff}`;
      return this.send(root, {
        mode: "chat",
        outputMode: "chat",
        prompt,
        displayPrompt: "Explain change: " + target,
      });
    }
    if (act === "copy-tools")
      return Acode.copy(
        State.lastToolJson ||
          JSON.stringify(
            { message: State.agentMessage, tools: State.pendingTools },
            null,
            2,
          ),
      );
    if (act === "clear-tools") {
      State.pendingTools = [];
      State.selectedToolIds = [];
      State.lastToolJson = "";
      State.agentMessage = "";
      State.toolResults = [];
      State.agentPlan = "";
      State.lastAppliedSummary = "";
      State.reviewNotice = "Rejected pending agent tools.";
      return this.render(root);
    }
    if (act === "copy-result")
      return Acode.copy(State.lastPatch || State.lastResult || "");
    if (act === "insert-result") return this.insertResult();
    if (act === "apply-main") return this.applyMain();
    if (act === "reject") return this.reject(root);
  },
  retryLast(root) {
    if (!State.lastRequest) return Acode.toast("No failed request to retry");
    State.activeTab = State.lastRequest.tab || State.activeTab;
    State.draftPrompt =
      State.lastRequest.userPrompt ||
      State.lastRequest.displayPrompt ||
      State.lastRequest.prompt ||
      State.draftPrompt;
    this.render(root);
    return this.send(
      root,
      Object.assign({}, State.lastRequest, { skipUserHistory: true }),
    );
  },
  saveSettings(root) {
    const next = {};
    root.querySelectorAll("[data-set]").forEach((el) => {
      const key = el.getAttribute("data-set");
      next[key] = el.type === "checkbox" ? el.checked : el.value;
    });
    Store.saveSettings(next);
    root
      .querySelector('[data-role="settings"]')
      ?.classList.add("ace-ai-hidden");
    Acode.toast("Ace AI settings saved");
  },
  async send(root, forcedRequest) {
    if (State.busy) return;
    const prompt = forcedRequest?.prompt || this.getPrompt(root);
    const mode =
      forcedRequest?.mode ||
      (State.activeTab === "edit"
        ? "edit"
        : State.activeTab === "agent"
          ? "agent"
          : "chat");
    const outputMode =
      mode === "edit"
        ? forcedRequest?.outputMode || this.outputMode(root)
        : mode === "agent"
          ? "tools"
          : "chat";
    if (!prompt) return Acode.toast("Type an instruction first");
    const includeFull = root.querySelector('[data-role="include-full"]');
    if (includeFull && (mode === "edit" || mode === "agent"))
      Store.saveSettings({
        includeFullFile: includeFull.checked,
        preferPatch: outputMode === "patch",
      });

    State.busy = true;
    State.lastError = null;
    State.draftPrompt = forcedRequest?.displayPrompt || prompt;
    State.streamingContent = "";
    State.streamingMode = mode;
    State.suppressStreamingPreview = false;
    State.suppressedToolDraft = "";
    State.streamRenderTimer = 0;
    const renderToken = Number(State.streamRenderToken || 0) + 1;
    State.streamRenderToken = renderToken;
    State.flowStage = "drafting";
    State.flowDetail =
      mode === "agent" ? "Agent request started" : "Request started";
    // Reset auto-loop counter/window on every fresh (non-loop) send.
    if (!forcedRequest?.autoLoop) {
      State.autoLoopCount = 0;
      State.autoLoopStartedAt = State.autoLoopEnabled ? Date.now() : 0;
    }
    State.lastRequest = {
      tab: State.activeTab,
      mode,
      outputMode,
      prompt,
      transportPrompt: prompt,
      userPrompt: forcedRequest?.displayPrompt || prompt,
      displayPrompt: forcedRequest?.displayPrompt || prompt,
      endpoint: "/v1/responses",
      filename: Editor.info().filename,
      time: new Date().toISOString(),
      streaming: true,
    };

    const originalCtx = Editor.context();
    State.lastOriginal =
      outputMode === "patch"
        ? originalCtx.text
        : originalCtx.selection || originalCtx.text;
    State.lastTarget = originalCtx.hasSelection ? "selection" : "file";
    State.lastSelectionSnapshot = originalCtx.hasSelection
      ? {
          text: originalCtx.selection,
          range: originalCtx.selectionRange || null,
          fileKey: originalCtx.file?.uri || originalCtx.file?.filename || "",
          filename: originalCtx.file?.filename || "",
          line: originalCtx.cursor?.line || 1,
          time: new Date().toISOString(),
        }
      : null;
    State.lastResult = "";
    State.lastPatch = "";
    State.lastResultKind = "";
    if (mode === "agent") {
      State.pendingTools = [];
      State.selectedToolIds = [];
      State.lastToolJson = "";
      State.agentMessage = "";
      State.toolResults = [];
      State.readToolResults = [];
      State.toolActivity = [];
      State.toolProgress = "";
      State.agentPlan = "";
      State.lastAppliedSummary = "";
      State.reviewNotice = "";
      State.showRunDetails = false;
    }

    if (!forcedRequest?.skipUserHistory) {
      const chat = Store.chat();
      const displayPrompt = forcedRequest?.displayPrompt || prompt;
      chat.push({
        role: "user",
        content: displayPrompt,
        time: Util.nowLabel(),
        mode: State.aiMode || mode,
      });
      Store.saveChat(chat);
      State.currentHistoryPrompt = String(displayPrompt || "").trim();
      State.activeTab = "chat";
    }

    const scheduleRender = () => {
      if (State.streamRenderTimer) return;
      State.streamRenderTimer = requestAnimationFrame(() => {
        State.streamRenderTimer = 0;
        if (State.streamRenderToken !== renderToken) return;
        if (typeof this.updateStreaming === "function")
          this.updateStreaming(root);
        else this.render(root);
      });
    };

    this.render(root);
    this.setBusy(root, true);
    try {
      const res = await Client.streamComplete(
        mode === "agent" ? "agent" : outputMode === "patch" ? "patch" : mode,
        prompt,
        outputMode,
        (_delta, full) => {
          State.streamingContent = full;
          State.lastResult = full;
          scheduleRender();
        },
      );
      State.lastResult = res.content;
      State.lastPatch =
        mode === "edit" && Util.isPatch(res.content)
          ? Patch.clean(res.content)
          : "";
      State.lastError = null;
      State.draftPrompt = "";
      State.streamingMode = "";
      State.suppressStreamingPreview = false;
      State.suppressedToolDraft = "";
      State.flowStage = State.pendingTools.length ? "review" : "done";
      State.flowDetail = State.pendingTools.length
        ? "Pending review"
        : "Request completed";
      State.lastSummary = `${mode === "edit" ? "Edit" : "Chat"} · ${res.ctx.file.filename} · ${Util.nowLabel()}`;

      if (mode === "chat") {
        const chat = Store.chat();
        chat.push({
          role: "assistant",
          content: res.content,
          time: Util.nowLabel(),
        });
        Store.saveChat(chat);
        State.lastResultKind = "chat";
        State.lastPatch = "";
        State.activeTab = "chat";
      } else if (mode === "agent") {
        const parsed =
          res.nativeToolResults && res.nativeToolResults.length
            ? {
                message: res.content || "",
                tools: res.nativeToolResults,
                raw: JSON.stringify(
                  { native: true, tools: res.nativeToolResults },
                  null,
                  2,
                ),
              }
            : AgentTools.parse(res.content);
        State.lastToolJson = parsed.raw;
        State.agentMessage =
          parsed.message ||
          (parsed.tools.length
            ? ""
            : "Agent returned no supported tool calls.");
        State.pendingTools = await AgentTools.preparePreviews(parsed.tools);
        State.lastResultKind = "agent";
        State.lastPatch = "";
        State.activeTab = parsed.tools.length ? "changes" : "agent";
        if (!parsed.tools.length && !parsed.message)
          Acode.toast("Agent returned no supported tools");
      } else {
        State.lastResultKind = "edit";
        State.activeTab = "changes";
      }
      this.render(root);
      State.streamingContent = "";
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      State.draftPrompt = forcedRequest?.displayPrompt || prompt;
      State.streamingContent = "";
      State.streamingMode = "";
      State.suppressStreamingPreview = false;
      State.suppressedToolDraft = "";
      State.flowStage = "error";
      State.flowDetail = State.lastError.title || "Request failed";
      this.render(root);
      Acode.toast(State.lastError.title || "Ace AI error");
    } finally {
      State.busy = false;
      State.streamRenderToken = Number(State.streamRenderToken || 0) + 1;
      if (State.streamRenderTimer) {
        cancelAnimationFrame(State.streamRenderTimer);
        State.streamRenderTimer = 0;
      }
      State.currentHistoryPrompt = "";
      State.toolProgress = "";
      State.retryStatus = "";
      this.setBusy(root, false);
      this.render(root);
    }
  },
  setBusy(root, yes) {
    root.querySelectorAll("button,textarea,input").forEach((el) => {
      if (!el.matches('[data-act="close"]')) el.disabled = Boolean(yes);
    });
    const send = root.querySelector('[data-act="send"]');
    if (send)
      send.textContent = yes
        ? "Streaming…"
        : State.activeTab === "edit"
          ? "Generate Edit"
          : State.activeTab === "agent"
            ? "Run Agent"
            : "Send";
  },
  async applyTools(root) {
    try {
      this.setBusy(root, true);
      State.flowStage = "applying";
      State.flowDetail = "Applying approved tools";
      State.lastError = null;
      State.toolResults = [];
      const selected = AgentTools.selectedTools().length;
      if (!selected) {
        Acode.toast("No selected tools");
        return [];
      }
      const results = await AgentTools.applyAll();
      State.toolResults = results;
      State.activeTab = "changes";
      Acode.toast("Applied selected tools: " + results.length);
      State.flowStage = State.pendingTools.length ? "review" : "done";
      State.flowDetail = State.pendingTools.length
        ? "Pending review"
        : "No more pending tools";
      this.render(root);

      // Agentic auto-loop: after apply, feed results back and let agent continue.
      // Continue only after a clean successful batch; failed/partial apply needs
      // explicit user review instead of automatic follow-up.
      if (
        State.autoLoopEnabled &&
        !State.pendingTools.length &&
        results.length &&
        results.every((r) => r && r.ok)
      ) {
        const loopStarted = Number(State.autoLoopStartedAt || 0) || Date.now();
        State.autoLoopStartedAt = loopStarted;
        const elapsed = Date.now() - loopStarted;
        if (
          State.autoLoopCount >= State.autoLoopMax ||
          elapsed > C.AUTO_LOOP_TOTAL_TIMEOUT_MS
        ) {
          const timedOut = elapsed > C.AUTO_LOOP_TOTAL_TIMEOUT_MS;
          State.autoLoopEnabled = false;
          State.autoLoopCount = 0;
          State.autoLoopStartedAt = 0;
          Acode.toast(
            timedOut
              ? "Auto-loop stopped after total time limit"
              : "Auto-loop stopped after " + State.autoLoopMax + " iterations",
          );
          this.render(root);
          return results;
        }
        State.autoLoopCount += 1;
        const summary = results
          .map(
            (r) =>
              (r.ok ? "✓" : "✗") +
              " " +
              r.tool +
              (r.path ? " " + r.path : "") +
              ": " +
              String(r.result || "").slice(0, 120),
          )
          .join("\n");
        const loopPrompt =
          "[Auto-loop " +
          State.autoLoopCount +
          "/" +
          State.autoLoopMax +
          "] Applied tools:\n" +
          summary +
          "\n\nIf the original task is fully complete, reply with a short plain-text summary and no tool calls. Otherwise continue with the next needed tool calls.";
        Acode.toast(
          "Auto-loop " + State.autoLoopCount + "/" + State.autoLoopMax,
        );
        await this.send(root, {
          mode: "agent",
          outputMode: "tools",
          prompt: loopPrompt,
          displayPrompt:
            "↻ Auto-loop " +
            State.autoLoopCount +
            "/" +
            State.autoLoopMax +
            " — continuing…",
          skipUserHistory: false,
          autoLoop: true,
        });
      }
      return results;
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      State.flowStage = "error";
      State.flowDetail = State.lastError.title || "Apply failed";
      this.render(root);
      Acode.toast(State.lastError.title || "Tool error");
      throw State.lastError;
    } finally {
      this.setBusy(root, false);
      this.render(root);
    }
  },
  async undoTools(root) {
    try {
      this.setBusy(root, true);
      State.flowStage = "applying";
      State.flowDetail = "Undoing last apply batch";
      const results = await AgentTools.undoLast();
      if (results) Acode.toast("Undo completed");
      State.activeTab = "changes";
      State.flowStage = "review";
      State.flowDetail = "Review state restored";
      this.render(root);
      State.streamingContent = "";
    } catch (error) {
      State.lastError = ErrorKit.normalize(error);
      State.flowStage = "error";
      State.flowDetail = State.lastError.title || "Undo failed";
      this.render(root);
      Acode.toast(State.lastError.title || "Undo error");
    } finally {
      this.setBusy(root, false);
      this.render(root);
    }
  },
  insertResult() {
    const value = State.lastPatch || State.lastResult;
    if (!value) return Acode.toast("No result yet");
    if (Editor.insertAtCursor("\n" + value + "\n")) Acode.toast("Inserted");
  },
  applyMain() {
    try {
      if (State.lastResultKind !== "edit")
        return Acode.toast("No editable change to apply");
      if (State.lastPatch) {
        const next = Patch.applyUnified(Editor.text(), State.lastPatch);
        if (Editor.replaceAll(next)) Acode.toast("Patch applied");
        return;
      }
      if (!State.lastResult) return Acode.toast("No result yet");
      if (State.lastTarget === "file" && !Editor.selectedText()) {
        if (Editor.replaceAll(State.lastResult)) Acode.toast("File replaced");
      } else if (Editor.replaceSelection(State.lastResult)) {
        Acode.toast("Selection replaced");
      }
    } catch (error) {
      Acode.alert("Apply failed", error.message || String(error));
    }
  },
  reject(root) {
    State.lastResult = "";
    State.lastPatch = "";
    State.lastResultKind = "";
    State.lastSummary = "Change rejected";
    this.render(root || State.panel);
  },
};

/*
 * Ace AI v0.8 UI layer
 * Single agentic chat with mode + permission picker. Legacy Chat/Edit/Agent/Review
 * tabs are intentionally replaced with one conversation surface and inline review.
 */
