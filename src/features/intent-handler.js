/**
 * Feature 8: Intent API Integration
 *
 * Handles share-to-Ace-AI intents and custom URL schemes
 * so users can share error logs from other apps or trigger
 * commands via deep links.
 */
const IntentHandler = {
  _installed: false,
  SCHEME: "aceai",

  install() {
    if (this._installed) return;
    this._installed = true;

    // Register intent handler with Acode's Intent API
    try {
      const intent = Acode.require("intent");
      if (intent && typeof intent.onShare === "function") {
        intent.onShare(this._handleShare.bind(this));
      }
      if (intent && typeof intent.onUri === "function") {
        intent.onUri(this._handleUri.bind(this));
      }
    } catch (_) {}

    // Also listen for custom URL via Acode's global
    try {
      if (window.acode && typeof window.acode.onIntent === "function") {
        window.acode.onIntent(C.PLUGIN_ID, this._handleIntent.bind(this));
      }
    } catch (_) {}
  },

  _handleShare(data) {
    // data.text contains shared text from another app
    const text = String(data?.text || data?.content || data || "").trim();
    if (!text) return;

    // Open Ace AI with the shared content as context
    const prompt = text.length > 500
      ? "Analyze this shared content:\n\n" + text.slice(0, 2000)
      : "Explain and help with this:\n\n" + text;

    UI.openPanel("chat", "agent");
    State.draftPrompt = prompt;
    setTimeout(() => {
      const input = State.panel?.querySelector('[data-role="prompt"]');
      if (input) {
        input.value = prompt;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, 100);
    Acode.toast("Shared content loaded into Ace AI");
  },

  _handleUri(uri) {
    // Handle aceai:// scheme URLs
    const url = String(uri || "").trim();
    if (!url.startsWith(this.SCHEME + "://")) return;

    const path = url.slice((this.SCHEME + "://").length);
    const [action, ...params] = path.split("/");
    const query = params.join("/");

    this._executeAction(action, query);
  },

  _handleIntent(data) {
    // Generic intent handler
    if (data?.action === "share") return this._handleShare(data);
    if (data?.uri) return this._handleUri(data.uri);
    if (data?.command) this._executeAction(data.command, data.query || "");
  },

  _executeAction(action, query) {
    const act = String(action || "").toLowerCase().trim();

    switch (act) {
      case "open":
        UI.openPanel("chat");
        break;

      case "fix":
        UI.openPanel("chat", "agent", "Fix the selected code. Keep the change minimal.");
        break;

      case "explain":
        UI.openPanel("chat", "agent", "Explain the selected code/error.");
        break;

      case "diagnose":
        UI.openPanel("chat", "agent",
          "Diagnose this project. Use project_overview first, then inspect only the files needed.");
        break;

      case "review":
        UI.openPanel("chat", "agent",
          "Review the current file for bugs and improvements. Do not edit yet.");
        break;

      case "ask":
        if (query) {
          UI.openPanel("chat", "agent");
          State.draftPrompt = decodeURIComponent(query);
          setTimeout(() => {
            const input = State.panel?.querySelector('[data-role="prompt"]');
            if (input) {
              input.value = State.draftPrompt;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, 100);
        } else {
          UI.openPanel("chat");
        }
        break;

      case "lint":
        UI.openPanel("chat", "agent");
        UI.requestRunCommand(State.panel, "npm run lint");
        break;

      case "test":
        UI.openPanel("chat", "agent");
        UI.requestRunCommand(State.panel, "npm test");
        break;

      default:
        UI.openPanel("chat");
        if (query) {
          State.draftPrompt = decodeURIComponent(query);
        }
    }
  },

  uninstall() {
    this._installed = false;
  },
};
