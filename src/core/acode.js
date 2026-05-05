const Acode = {
  require(name) {
    try {
      return window.acode && window.acode.require
        ? window.acode.require(name)
        : null;
    } catch (_) {
      return null;
    }
  },
  toast(message, duration) {
    const text = String(message || "");
    try {
      const toast = this.require("toast");
      if (typeof toast === "function") return toast(text, duration || 2500);
      if (window.toast) return window.toast(text, duration || 2500);
      if (window.acode && typeof window.acode.toast === "function")
        return window.acode.toast(text);
    } catch (_) {}
    const el = document.createElement("div");
    el.className = "ace-ai-toast";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration || 2400);
  },
  alert(title, message) {
    try {
      if (window.acode && typeof window.acode.alert === "function")
        return window.acode.alert(title, message);
    } catch (_) {}
    alert((title ? title + "\n\n" : "") + String(message || ""));
  },
  confirm(title, message) {
    try {
      if (window.acode && typeof window.acode.confirm === "function")
        return Promise.resolve(window.acode.confirm(title, message));
    } catch (_) {}
    try {
      const confirmFn = this.require("confirm");
      if (typeof confirmFn === "function")
        return Promise.resolve(confirmFn(title, message));
    } catch (_) {}
    return Promise.resolve(
      window.confirm((title ? title + "\n\n" : "") + String(message || "")),
    );
  },
  copy(text) {
    const value = String(text || "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText)
        return navigator.clipboard
          .writeText(value)
          .then(() => this.toast("Copied"));
    } catch (_) {}
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      this.toast("Copied");
    } catch (_) {}
    area.remove();
    return Promise.resolve();
  },

  async openFileAt(path, options) {
    const target = String(path || "").trim();
    if (!target) throw new Error("open_file.path is empty");
    const line = Number(options?.line || 0) || 0;
    const column = Number(options?.column || 1) || 1;
    const filename =
      Util.filenameFromPath(target) ||
      target.split("/").filter(Boolean).pop() ||
      target;
    const manager = window.editorManager || window.acode?.editorManager || null;
    try {
      const opened =
        manager?.getFile?.(target, "uri") ||
        manager?.getFile?.(target, "id") ||
        manager?.getFile?.(filename, "name");
      const id = opened?.id || opened?.uri || opened?.filename || opened?.name;
      if (opened && id && typeof manager?.switchFile === "function") {
        manager.switchFile(id);
        setTimeout(() => Editor.gotoLine(line || 1, column || 1), 120);
        return true;
      }
    } catch (_) {}
    try {
      if (manager && typeof manager.addNewFile === "function") {
        manager.addNewFile(filename, {
          uri: target,
          location: target,
          isUnsaved: false,
          render: true,
        });
        setTimeout(() => Editor.gotoLine(line || 1, column || 1), 180);
        return true;
      }
    } catch (_) {}
    try {
      if (window.acode && typeof window.acode.newEditorFile === "function") {
        window.acode.newEditorFile(filename, {
          uri: target,
          location: target,
          isUnsaved: false,
          render: true,
        });
        setTimeout(() => Editor.gotoLine(line || 1, column || 1), 180);
        return true;
      }
    } catch (_) {}
    throw new Error(
      "Acode editorManager.addNewFile/open tab API is unavailable.",
    );
  },
  async runVisibleTerminal(command, options) {
    const cmd = String(command || "").trim();
    if (!cmd) return false;
    const terminal = this.require("terminal");
    if (!terminal) throw new Error("Acode terminal API is unavailable.");
    const name = options?.name || "Ace AI";
    let term = null;
    if (typeof terminal.createServer === "function") {
      try {
        term = await terminal.createServer({ name });
      } catch (_) {}
    }
    if (!term && typeof terminal.create === "function") {
      term = await terminal.create({ name, serverMode: true });
    }
    if (!term && typeof terminal.createLocal === "function") {
      term = await terminal.createLocal({ name });
    }
    const id = term?.id || term?.pid || term?.name || "";
    if (typeof terminal.write === "function" && id) {
      terminal.write(id, cmd + "\r");
      return true;
    }
    const instanceWrite =
      term?.write || term?.component?.write || term?.terminal?.write;
    if (typeof instanceWrite === "function") {
      instanceWrite.call(term.component || term.terminal || term, cmd + "\r");
      return true;
    }
    throw new Error("Acode terminal.write API is unavailable.");
  },
  showContextMenu(items, options) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) return false;
    try {
      const contextmenu = this.require("contextmenu");
      if (typeof contextmenu !== "function") return false;
      const menu = contextmenu({
        top: options?.top || 56,
        right: options?.right || 12,
        items: rows.map((item) => [item.label, item.id]),
        onselect(action) {
          const picked = rows.find((item) => item.id === action);
          if (picked && typeof picked.action === "function") picked.action();
          try {
            menu.hide?.();
          } catch (_) {}
        },
      });
      State.contextMenu = menu;
      menu.show?.();
      return true;
    } catch (_) {
      return false;
    }
  },
  pushBackAction() {
    try {
      const stack = this.require("actionStack");
      if (!stack || typeof stack.push !== "function") return;
      if (typeof stack.remove === "function") stack.remove(C.PANEL_ACTION_ID);
      else if (typeof stack.has === "function" && stack.has(C.PANEL_ACTION_ID))
        return;
      stack.push({
        id: C.PANEL_ACTION_ID,
        action: () => {
          if (UI && typeof UI.handleBackAction === "function")
            return UI.handleBackAction();
          return UI.closePanel();
        },
      });
    } catch (_) {}
  },
  removeBackAction() {
    try {
      const stack = this.require("actionStack");
      if (stack && typeof stack.remove === "function")
        stack.remove(C.PANEL_ACTION_ID);
    } catch (_) {}
  },
};
