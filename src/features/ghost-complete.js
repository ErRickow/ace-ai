/**
 * Feature 1: Inline Ghost Text Autocomplete
 *
 * Creates a CodeMirror 6 extension that shows greyed-out AI suggestions
 * as the user types. Triggers after a brief debounce when cursor is at
 * end of a non-empty line. The ghost text can be accepted with Tab.
 */
const GhostComplete = {
  _active: false,
  _ghostText: "",
  _ghostPos: -1,
  _ghostNode: null,
  _debounceTimer: 0,
  _lastRequest: 0,
  _abortController: null,
  DEBOUNCE_MS: 650,
  MIN_LINE_LENGTH: 4,
  MAX_CONTEXT_CHARS: 2000,

  install() {
    if (this._active) return;
    const view = Editor.view();
    if (!view || !view.state || typeof view.dispatch !== "function") return;
    this._active = true;
    this._bindKeyHandler(view);
    this._bindChangeHandler(view);
  },

  uninstall() {
    this._active = false;
    this._clearGhost();
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    if (this._abortController) {
      try { this._abortController.abort(); } catch (_) {}
    }
  },

  _bindKeyHandler(view) {
    // Intercept Tab to accept ghost text
    const handler = (ev) => {
      if (!this._ghostText || !this._ghostNode) return;
      if (ev.key === "Tab" && !ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        this._acceptGhost(view);
      } else if (ev.key === "Escape") {
        this._clearGhost();
      }
    };
    const dom = view.dom || view.contentDOM;
    if (dom) {
      dom.addEventListener("keydown", handler, { capture: true });
      this._keyHandler = handler;
      this._keyDom = dom;
    }
  },

  _bindChangeHandler(view) {
    // Listen for document changes via EditorManager events
    const onChange = () => {
      if (!this._active) return;
      this._clearGhost();
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this._tryComplete(), this.DEBOUNCE_MS);
    };
    this._editorChangeHandler = onChange;
    Editor.onChange(onChange);
  },

  async _tryComplete() {
    if (!this._active) return;
    const settings = Store.settings();
    if (!settings.apiKey) return;

    const view = Editor.view();
    if (!view || !view.state) return;

    const text = Editor.text();
    const cursor = Editor.cursor();
    if (!cursor || !text) return;

    // Only trigger when cursor is at end of a line with content
    const lines = text.split("\n");
    const currentLine = lines[cursor.line - 1] || "";
    const lineAfterCursor = currentLine.slice(cursor.column - 1);
    if (lineAfterCursor.trim().length > 0) return; // Cursor not at end
    if (currentLine.trim().length < this.MIN_LINE_LENGTH) return;

    // Build context: last N chars before cursor
    const offset = Editor.offsetFromLineColumn(text, cursor.line, cursor.column);
    const contextStart = Math.max(0, offset - this.MAX_CONTEXT_CHARS);
    const prefix = text.slice(contextStart, offset);

    // Cancel any previous request
    if (this._abortController) {
      try { this._abortController.abort(); } catch (_) {}
    }

    const requestId = ++this._lastRequest;

    try {
      if (typeof AbortController !== "undefined") {
        this._abortController = new AbortController();
      }

      const baseUrl = Util.baseUrl(settings.baseUrl);
      const payload = {
        model: settings.model || C.DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: "You are an inline code autocomplete engine. Given the code context, predict the most likely next 1-2 lines of code. Return ONLY the completion text, no explanation, no markdown fences, no prefix repetition. If unsure, return empty string.",
          },
          {
            role: "user",
            content: "Complete this code:\n```\n" + prefix.slice(-800) + "\n```",
          },
        ],
        max_output_tokens: 120,
        temperature: 0,
        stream: false,
        store: false,
      };

      const res = await fetch(baseUrl + "/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + settings.apiKey,
        },
        body: JSON.stringify(payload),
        signal: this._abortController?.signal,
      });

      if (requestId !== this._lastRequest) return; // Stale
      if (!res.ok) return;

      const data = await res.json();
      let completion = "";
      if (data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.type === "message" && Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === "output_text" || part.type === "text") {
                completion += part.text || "";
              }
            }
          }
        }
      }
      if (!completion) completion = data.output_text || "";

      // Clean completion
      completion = completion
        .replace(/^```[\w]*\n?/, "")
        .replace(/\n?```$/, "")
        .replace(/^\n/, "");

      if (!completion || completion.length < 2) return;
      if (requestId !== this._lastRequest) return;

      // Show ghost text
      this._showGhost(view, completion, offset);
    } catch (_) {
      // Silently ignore errors (network, abort, etc)
    }
  },

  _showGhost(view, text, pos) {
    this._clearGhost();
    this._ghostText = text;
    this._ghostPos = pos;

    // Create ghost decoration via DOM overlay
    const dom = view.dom || view.contentDOM;
    if (!dom) return;

    // Find cursor position in DOM
    const cursorEl = dom.closest(".ace-ai-panel")
      ? null
      : dom.querySelector(".cm-cursor, .cm-cursor-primary, .ace_cursor");

    // Create ghost span
    const ghost = document.createElement("span");
    ghost.className = "ace-ai-ghost-text";
    ghost.textContent = text.split("\n")[0]; // Show first line only
    ghost.style.cssText =
      "color:#667085;opacity:0.6;pointer-events:none;font-style:italic;user-select:none;";

    if (cursorEl) {
      cursorEl.parentElement?.insertBefore(ghost, cursorEl.nextSibling);
    } else {
      // Fallback: append to active line
      const activeLine = dom.querySelector(
        ".cm-activeLine, .cm-line:last-child, .ace_line:last-child",
      );
      if (activeLine) activeLine.appendChild(ghost);
    }
    this._ghostNode = ghost;
  },

  _acceptGhost(view) {
    if (!this._ghostText) return;
    const text = this._ghostText;
    this._clearGhost();
    Editor.insertAtCursor(text);
  },

  _clearGhost() {
    if (this._ghostNode) {
      try { this._ghostNode.remove(); } catch (_) {}
      this._ghostNode = null;
    }
    this._ghostText = "";
    this._ghostPos = -1;
  },
};
