/**
 * Feature 4: Light Mode / System Theme
 *
 * Adds light theme support and auto-detection of system preference.
 * User can choose: dark (default), light, or auto (system).
 */
const ThemeSystem = {
  STORAGE_KEY: "ace-ai.theme.v1",
  _mediaQuery: null,
  _listener: null,

  current() {
    const saved = Store.getJson(this.STORAGE_KEY, "auto");
    if (saved === "light" || saved === "dark") return saved;
    return this._systemPreference();
  },

  preference() {
    return Store.getJson(this.STORAGE_KEY, "auto");
  },

  setPreference(value) {
    const valid = ["dark", "light", "auto"];
    const pref = valid.includes(value) ? value : "auto";
    Store.setJson(this.STORAGE_KEY, pref);
    this.apply();
  },

  _systemPreference() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    } catch (_) {}
    return "dark";
  },

  apply() {
    const theme = this.current();
    const panels = document.querySelectorAll(".ace-ai-panel");
    panels.forEach((panel) => {
      panel.classList.toggle("ace-ai-light", theme === "light");
      panel.classList.toggle("ace-ai-dark", theme === "dark");
    });
  },

  install() {
    this.apply();
    // Listen for system theme changes
    try {
      this._mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      this._listener = () => {
        if (this.preference() === "auto") this.apply();
      };
      this._mediaQuery.addEventListener("change", this._listener);
    } catch (_) {}
  },

  uninstall() {
    try {
      if (this._mediaQuery && this._listener) {
        this._mediaQuery.removeEventListener("change", this._listener);
      }
    } catch (_) {}
  },

  css() {
    if (document.getElementById("ace-ai-style-themes")) return;
    const style = document.createElement("style");
    style.id = "ace-ai-style-themes";
    style.textContent = `
.ace-ai-panel.ace-ai-light{--ace-ai-bg:#f8f9fb;--ace-ai-surface:#ffffff;--ace-ai-surface-2:#f0f2f5;--ace-ai-border:#e2e5ea;--ace-ai-text:#1a1d23;--ace-ai-muted:#6b7280;--ace-ai-accent:#2563eb;--ace-ai-danger:#dc2626;--ace-ai-warn:#d97706;--ace-ai-ok:#16a34a;--ace-ai-code-bg:#f3f4f6}
.ace-ai-panel.ace-ai-light .ace-ai-head{background:#ffffff;border-bottom-color:#e2e5ea}
.ace-ai-panel.ace-ai-light .ace-ai-msg{background:#ffffff;border-color:#e8eaef}
.ace-ai-panel.ace-ai-light .ace-ai-msg.user{background:#f0f4ff;border-color:#dbe4f8}
.ace-ai-panel.ace-ai-light .ace-ai-msg.assistant{background:#ffffff}
.ace-ai-panel.ace-ai-light .ace-ai-card{background:#ffffff;border-color:#e2e5ea}
.ace-ai-panel.ace-ai-light .ace-ai-textarea,.ace-ai-panel.ace-ai-light .ace-ai-input{background:#f8f9fb;border-color:#e2e5ea;color:#1a1d23}
.ace-ai-panel.ace-ai-light .ace-ai-textarea:focus,.ace-ai-panel.ace-ai-light .ace-ai-input:focus{border-color:#2563eb}
.ace-ai-panel.ace-ai-light .ace-ai-chip{background:#f0f2f5;border-color:#e2e5ea;color:#374151}
.ace-ai-panel.ace-ai-light .ace-ai-iconbtn,.ace-ai-panel.ace-ai-light .ace-ai-btn{background:#f0f2f5;border-color:#e2e5ea;color:#374151}
.ace-ai-panel.ace-ai-light .ace-ai-primary{background:rgba(37,99,235,.1);border-color:rgba(37,99,235,.4);color:#1d4ed8}
.ace-ai-panel.ace-ai-light .ace-ai-danger{background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.4);color:#b91c1c}
.ace-ai-panel.ace-ai-light .ace-ai-footer{background:#ffffff;border-top-color:#e2e5ea}
.ace-ai-panel.ace-ai-light .ace-ai-md code{background:#f3f4f6;border-color:#e5e7eb;color:#1f2937}
.ace-ai-panel.ace-ai-light .ace-ai-md-code{background:#f8f9fb;border-color:#e2e5ea}
.ace-ai-panel.ace-ai-light .ace-ai-md-code pre{color:#1f2937}
.ace-ai-panel.ace-ai-light .ace-ai-md-code-head{border-bottom-color:#e5e7eb;color:#6b7280}
.ace-ai-panel.ace-ai-light .ace-ai-diff-line.ace-ai-add{background:rgba(22,163,74,.1);color:#166534}
.ace-ai-panel.ace-ai-light .ace-ai-diff-line.ace-ai-del{background:rgba(220,38,38,.08);color:#991b1b}
.ace-ai-panel.ace-ai-light .ace-ai-diff-line.ace-ai-same{color:#6b7280}
.ace-ai-panel.ace-ai-light .ace-ai-tool{background:#f8f9fb;border-color:#e2e5ea}
.ace-ai-panel.ace-ai-light .ace-ai-loading-card{border-color:rgba(217,119,6,.3);background:rgba(217,119,6,.05)}
.ace-ai-panel.ace-ai-light .ace-ai-error-card{border-color:rgba(220,38,38,.4);background:rgba(220,38,38,.05)}
.ace-ai-panel.ace-ai-light .ace-ai-status-shimmer{color:#d97706;-webkit-text-fill-color:#d97706}
.ace-ai-panel.ace-ai-light .ace-ai-mini{color:#6b7280}
.ace-ai-panel.ace-ai-light .ace-ai-label{color:#9ca3af}
.ace-ai-panel.ace-ai-light .ace-ai-sub{color:#6b7280}
.ace-ai-panel.ace-ai-light .ace-ai-empty{border-color:#e2e5ea;color:#9ca3af}
.ace-ai-panel.ace-ai-light .ace-ai-context-chip{background:#f0f2f5;border-color:#e2e5ea;color:#374151}
.ace-ai-panel.ace-ai-light .ace-ai-hunk{background:#f8f9fb;border-color:rgba(37,99,235,.25)}
.ace-ai-panel.ace-ai-light .ace-ai-tool-error{background:rgba(220,38,38,.06);border-color:rgba(220,38,38,.3);color:#991b1b}
.ace-ai-panel.ace-ai-light .ace-ai-tool-warn{background:rgba(217,119,6,.06);border-color:rgba(217,119,6,.3);color:#92400e}
.ace-ai-panel.ace-ai-light .ace-ai-settings{background:#f8f9fb;border-color:#e2e5ea}
`;
    document.head.appendChild(style);
  },
};
