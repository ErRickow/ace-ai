const Native = {
  install() {
    UI.css();
    this.installSideButton();
    this.installSidebarApp();
    this.installSelectionMenu();
    this.ensureSelectionMenuCompactCss();
    this.installSelectionMenuSanitizer();
    this.installCommands();
    Editor.onChange(() => {
      if (State.panel && !State.panel.classList.contains("ace-ai-hidden"))
        UI.render(State.panel);
      if (State.sidebarContainer)
        UI.render(State.sidebarContainer.querySelector(".ace-ai-panel"));
    });
  },
  installSideButton() {
    const SideButton = Acode.require("sideButton");
    if (typeof SideButton === "function") {
      try {
        State.sideButton = SideButton({
          text: "AI",
          icon: "ace-ai",
          backgroundColor: "#1d2026",
          textColor: "#fff",
          onclick: () => {
            try {
              UI.openPanel("chat");
            } catch (e) {
              try {
                Acode.toast("Ace AI open failed: " + (e.message || e));
              } catch (_) {}
            }
          },
        });
        State.sideButton.show?.();
        return;
      } catch (_) {}
    }
    const btn = document.createElement("button");
    btn.className = "ace-ai-fab";
    btn.textContent = "AI";
    btn.addEventListener("click", () => UI.openPanel("chat"));
    document.body.appendChild(btn);
    State.fallbackButton = btn;
  },
  installSidebarApp() {
    const sideBarApps = Acode.require("sidebarApps");
    if (!sideBarApps || typeof sideBarApps.add !== "function") return;
    try {
      sideBarApps.add(
        "ace-ai",
        C.SIDEBAR_ID,
        "Ace AI",
        (container) => {
          State.sidebarContainer = container;
          UI.mountPanel(container, true);
        },
        false,
        (container) => {
          State.sidebarContainer = container;
          const existing = container.querySelector(".ace-ai-panel");
          if (!existing) UI.mountPanel(container, true);
          else UI.render(existing);
        },
      );
    } catch (_) {}
  },
  selectionMenuLabels() {
    return [
      "Ace Fix",
      "Ace Explain",
      "Ace Refactor",
      "Ace Agent",
      "Ace Plan",
      "✎",
      "ⓘ",
      "↻",
      "✦",
      "◇",
    ];
  },
  cleanupSelectionMenuItems() {
    const selectionMenu = Acode.require("selectionMenu");
    if (!selectionMenu) return;
    const labels = this.selectionMenuLabels();
    labels.forEach((label) => {
      try {
        selectionMenu.remove?.(label);
      } catch (_) {}
      try {
        selectionMenu.delete?.(label);
      } catch (_) {}
      try {
        selectionMenu.removeItem?.(label);
      } catch (_) {}
    });
    const pools = [
      "items",
      "list",
      "menus",
      "menu",
      "selectionMenu",
      "_items",
      "_list",
      "_menus",
      "_menu",
    ];
    pools.forEach((key) => {
      try {
        const value = selectionMenu[key];
        if (Array.isArray(value)) {
          selectionMenu[key] = value.filter((item) => {
            const text = String(
              item?.text || item?.label || item?.name || item || "",
            );
            return (
              !labels.includes(text) &&
              !/^Ace (Fix|Explain|Refactor|Agent|Plan)$/i.test(text)
            );
          });
        }
      } catch (_) {}
    });
  },
  installSelectionMenu() {
    const selectionMenu = Acode.require("selectionMenu");
    if (!selectionMenu || typeof selectionMenu.add !== "function") return;
    this.cleanupSelectionMenuItems();
    try {
      const handle = selectionMenu.add(
        () =>
          UI.openPanel(
            "chat",
            "agent",
            "Discuss, plan, or use tools with review.",
          ),
        "✦",
        "all",
        false,
      );
      State.registeredSelectionItems.push("✦");
      if (handle) State.registeredSelectionItems.push(handle);
    } catch (_) {}
  },
  legacySelectionTextMap() {
    return [
      [/Ace\s*Fix/gi, "✎"],
      [/Ace\s*Explain/gi, "ⓘ"],
      [/Ace\s*Refactor/gi, "↻"],
      [/Ace\s*Agent/gi, "✦"],
      [/Ace\s*Plan/gi, "◇"],
    ];
  },
  compactLegacySelectionText(value) {
    let next = String(value == null ? "" : value);
    this.legacySelectionTextMap().forEach(([pattern, icon]) => {
      next = next.replace(pattern, icon);
    });
    next = next.replace(/\s+/g, " ").trim();
    if (/^[✎ⓘ↻✦◇ ]+$/.test(next)) {
      return Array.from(new Set(next.replace(/\s+/g, "").split(""))).join(" ");
    }
    return next;
  },
  isLegacySelectionText(value) {
    return /Ace\s*(Fix|Explain|Refactor|Agent|Plan)/i.test(String(value || ""));
  },
  styleSelectionIconNode(node) {
    if (!node?.style) return;
    try {
      node.style.maxWidth = "120px";
      node.style.overflow = "hidden";
      node.style.textOverflow = "clip";
      node.style.textAlign = "center";
      node.style.whiteSpace = "nowrap";
      node.style.letterSpacing = "0.08em";
    } catch (_) {}
  },
  sanitizeSelectionTextNodes(root) {
    if (!root || !document.createTreeWalker) return;
    try {
      const walker = document.createTreeWalker(
        root,
        window.NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const value = node.nodeValue || "";
            if (!this.isLegacySelectionText(value))
              return window.NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || parent.closest?.(".ace-ai-panel"))
              return window.NodeFilter.FILTER_REJECT;
            return window.NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const next = this.compactLegacySelectionText(node.nodeValue || "");
        if (next && next !== node.nodeValue) {
          node.nodeValue = next;
          this.styleSelectionIconNode(node.parentElement);
          this.stripSelectionTooltip(node.parentElement);
        }
      });
    } catch (_) {}
  },
  stripSelectionTooltip(node) {
    if (!node) return;
    const attrs = [
      "title",
      "aria-label",
      "data-tooltip",
      "data-title",
      "data-text",
      "data-description",
      "tooltip",
    ];
    attrs.forEach((attr) => {
      try {
        const value = String(node.getAttribute?.(attr) || "");
        if (this.isLegacySelectionText(value)) {
          const compact = this.compactLegacySelectionText(value);
          if (compact && /^[✎ⓘ↻✦◇ ]+$/.test(compact)) {
            node.setAttribute(attr, compact);
          } else {
            node.removeAttribute(attr);
          }
        }
      } catch (_) {}
    });
    try {
      node.classList?.remove?.("tooltipped");
    } catch (_) {}
  },
  sanitizeSelectionMenuDom() {
    const legacyRe = /Ace\s*(Fix|Explain|Refactor|Agent|Plan)/i;
    const selector = [
      "body [title]",
      "body [aria-label]",
      "body [data-tooltip]",
      "body [data-title]",
      "body [data-text]",
      "body [data-description]",
      "body [tooltip]",
      ".material-tooltip",
      ".tooltip",
      ".ace-tooltip",
      ".tooltipped",
      "[role='tooltip']",
      "body button",
      "body a",
      "body span",
      "body li",
      "body div[role='button']",
      "body .button",
      "body .btn",
      "body .menu-item",
      "body .selection-menu",
      "body .selection-menu *",
      "body .select-menu",
      "body .select-menu *",
      "body .context-menu",
      "body .context-menu *",
      "body .popup-menu",
      "body .popup-menu *",
    ].join(",");
    try {
      document.querySelectorAll(selector).forEach((node) => {
        if (node.closest?.(".ace-ai-panel")) return;
        this.stripSelectionTooltip(node);
        const text = String(node.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!text || !legacyRe.test(text)) {
          legacyRe.lastIndex = 0;
          return;
        }
        const compact = this.compactLegacySelectionText(text);
        if (/^[✎ⓘ↻✦◇ ]+$/.test(compact)) {
          node.textContent = compact;
          this.styleSelectionIconNode(node);
        } else if (text.length <= 180) {
          node.textContent = compact;
          this.styleSelectionIconNode(node);
        }
        legacyRe.lastIndex = 0;
      });
    } catch (_) {}
    try {
      this.sanitizeSelectionTextNodes(document.body);
    } catch (_) {}
  },
  ensureSelectionMenuCompactCss() {
    try {
      if (document.getElementById("ace-ai-selection-compact-style")) return;
      const style = document.createElement("style");
      style.id = "ace-ai-selection-compact-style";
      style.textContent = `
.material-tooltip,.tooltip,.ace-tooltip,[role="tooltip"]{max-width:160px!important;overflow:hidden!important;text-overflow:clip!important;white-space:nowrap!important}
.selection-menu,.select-menu,.context-menu,.popup-menu{max-width:min(92vw,360px)!important;overflow:hidden!important}
.selection-menu *,.select-menu *,.context-menu *,.popup-menu *{text-overflow:clip!important}
`;
      document.head.appendChild(style);
    } catch (_) {}
  },
  installSelectionMenuSanitizer() {
    this.ensureSelectionMenuCompactCss();
    if (State.selectionMenuObserver) return;
    const run = () => this.sanitizeSelectionMenuDom();
    try {
      const observer = new window.MutationObserver(() => {
        try {
          requestAnimationFrame(run);
        } catch (_) {
          setTimeout(run, 0);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      State.selectionMenuObserver = observer;
    } catch (_) {}
    try {
      document.addEventListener("selectionchange", run, { passive: true });
      State.selectionMenuSanitizer = run;
    } catch (_) {}
    run();
    [20, 120, 350, 800, 1500].forEach((delay) => {
      try {
        setTimeout(run, delay);
      } catch (_) {}
    });
  },
  commandDescriptor(name, description, tab, mode, seed) {
    return this.commandAction(name, description, () => {
      UI.openPanel(tab, mode, seed);
    });
  },
  commandAction(name, description, action) {
    return {
      name,
      description,
      bindKey: null,
      exec: () => {
        try {
          if (typeof action === "function") action();
        } catch (error) {
          Acode.toast("Ace AI command failed: " + (error.message || error));
        }
        return true;
      },
    };
  },
  installCommands() {
    const open = (seed, mode) => UI.openPanel("chat", mode || "agent", seed);
    const items = [
      this.commandDescriptor(
        "ace-ai.agent",
        "Ace AI: Agent",
        "chat",
        "agent",
        "",
      ),
      this.commandDescriptor("ace-ai.plan", "Ace AI: Plan", "chat", "plan", ""),
      this.commandDescriptor(
        "ace-ai.explainError",
        "Ace AI: Explain Error",
        "chat",
        "agent",
        "Explain the selected error/code and give the smallest fix.",
      ),
      this.commandDescriptor(
        "ace-ai.generateWidget",
        "Ace AI: Generate Neosantara Widget",
        "chat",
        "agent",
        "Generate a clean Neosantara widget embed section.",
      ),
      this.commandDescriptor(
        "ace-ai.agentTools",
        "Ace AI: Agent Tools",
        "chat",
        "agent",
        "Use tools to edit/create/write files.",
      ),
      this.commandAction("ace-ai.newChat", "Ace AI: New Chat", () => {
        open("", "agent");
        UI.handle("new-chat", State.panel);
      }),
      this.commandAction(
        "ace-ai.reviewCurrentFile",
        "Ace AI: Review Current File",
        () => {
          open(
            "Review the current file for bugs, risky patterns, and small improvements. Do not edit yet unless I ask.",
            "agent",
          );
        },
      ),
      this.commandAction(
        "ace-ai.diagnoseProject",
        "Ace AI: Diagnose Project",
        () => {
          open(
            "Diagnose this project. Use project_overview first, then inspect only the files needed to summarize framework, scripts, risks, and safe validation commands. Do not edit files unless I ask.",
            "agent",
          );
        },
      ),
      this.commandAction(
        "ace-ai.applyPending",
        "Ace AI: Apply Pending Tools",
        () => {
          open("", "agent");
          UI.applyTools(State.panel);
        },
      ),
      this.commandAction(
        "ace-ai.undoLastApply",
        "Ace AI: Undo Last Apply",
        () => {
          open("", "agent");
          UI.undoTools(State.panel);
        },
      ),
      this.commandAction("ace-ai.runLint", "Ace AI: Run npm lint", () => {
        open("", "agent");
        UI.requestRunCommand(State.panel, "npm run lint");
      }),
      this.commandAction("ace-ai.runTests", "Ace AI: Run npm test", () => {
        open("", "agent");
        UI.requestRunCommand(State.panel, "npm test");
      }),
      this.commandAction(
        "ace-ai.checkCurrentFile",
        "Ace AI: Syntax Check Current File",
        () => {
          const file = Editor.info().filename || "";
          open("", "agent");
          if (/^[\w./-]+\.m?js$/i.test(file))
            UI.requestRunCommand(State.panel, "node --check " + file);
          else UI.requestRunCommand(State.panel, "npm run lint");
        },
      ),
    ];
    items.forEach((cmd) => this.addCommand(cmd));
  },
  addCommand(cmd) {
    const commands = Acode.require("commands");
    try {
      if (commands && typeof commands.addCommand === "function") {
        commands.addCommand(cmd);
        State.registeredCommands.push(["commands", cmd.name]);
        return;
      }
      if (commands?.registry && typeof commands.registry.add === "function") {
        commands.registry.add(cmd);
        State.registeredCommands.push(["registry", cmd.name]);
        return;
      }
    } catch (_) {}
    try {
      if (window.acode && typeof window.acode.addCommand === "function") {
        window.acode.addCommand(cmd);
        State.registeredCommands.push(["acode", cmd.name]);
        return;
      }
    } catch (_) {}
    try {
      const view = Editor.view();
      if (view?.commands && typeof view.commands.addCommand === "function") {
        view.commands.addCommand(cmd);
        State.registeredCommands.push(["editor", cmd.name]);
      }
    } catch (_) {}
  },
  cleanupCommands() {
    State.registeredCommands.forEach(([kind, name]) => {
      try {
        if (kind === "acode" && window.acode?.removeCommand)
          window.acode.removeCommand(name);
        else if (kind === "commands")
          Acode.require("commands")?.removeCommand?.(name);
        else if (kind === "registry")
          Acode.require("commands")?.registry?.remove?.(name);
        else if (kind === "editor")
          Editor.view()?.commands?.removeCommand?.(name);
      } catch (_) {}
    });
    State.registeredCommands = [];
  },
  cleanup() {
    try {
      State.sideButton?.hide?.();
    } catch (_) {}
    try {
      State.fallbackButton?.remove?.();
    } catch (_) {}
    try {
      Acode.require("sidebarApps")?.remove?.(C.SIDEBAR_ID);
    } catch (_) {}
    try {
      State.contextMenu?.destroy?.();
    } catch (_) {}
    try {
      this.cleanupSelectionMenuItems();
    } catch (_) {}
    try {
      State.selectionMenuObserver?.disconnect?.();
      State.selectionMenuObserver = null;
    } catch (_) {}
    try {
      if (State.selectionMenuSanitizer)
        document.removeEventListener(
          "selectionchange",
          State.selectionMenuSanitizer,
        );
      State.selectionMenuSanitizer = null;
    } catch (_) {}
    this.cleanupCommands();
    Editor.removeListeners();
    Acode.removeBackAction();
    try {
      State.panel?.parentElement?.remove?.();
    } catch (_) {}
    try {
      document.getElementById("ace-ai-style-v8_3-base")?.remove?.();
      document.getElementById("ace-ai-style-v8_20")?.remove?.();
      document.getElementById("ace-ai-style-v8_23")?.remove?.();
      document.getElementById("ace-ai-style-v8_24")?.remove?.();
      document.getElementById("ace-ai-style-v8_25")?.remove?.();
      document.getElementById("ace-ai-style-v8_26")?.remove?.();
      document.getElementById("ace-ai-style-v8_27")?.remove?.();
      document.getElementById("ace-ai-style-v8_28")?.remove?.();
      document.getElementById("ace-ai-style-v8_29")?.remove?.();
    } catch (_) {}
  },
};
