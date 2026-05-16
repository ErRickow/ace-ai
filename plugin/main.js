/*
 * Ace AI for Acode
 * v0.8.43 — modular source bundle.
 * Source modules are concatenated by tools/build.mjs for Acode compatibility.
 */
(function () {
  "use strict";

  
  // ---- core/constants.js ----
  const C = Object.freeze({
    PLUGIN_ID: "ace.ai.neosantara",
    VERSION: "0.8.43",
    STORAGE_KEY: "ace-ai.settings.v8_8",
    PRESETS_KEY: "ace-ai.presets.v8_8",
    CHAT_KEY: "ace-ai.chat.v8_8",
    RUNTIME_KEY: "ace-ai.runtime.v8_8",
    RESPONSE_KEY: "ace-ai.responses.v8_8",
    DEFAULT_BASE_URL: "https://api.neosantara.xyz/v1",
    DEFAULT_MODEL: "grok-4.1-fast-non-reasoning",
    MAX_SELECTION: 18000,
    MAX_FULL_FILE: 42000,
    MAX_CHAT_MESSAGES: 50,
    REQUEST_TIMEOUT_MS: 60000,
    REQUEST_RETRY_COUNT: 2,
    REQUEST_RETRY_BASE_MS: 750,
    AUTO_LOOP_TOTAL_TIMEOUT_MS: 180000,
    MAX_CONTEXT_WINDOW: 18000,
    MAX_TOOL_READ_CHARS: 30000,
    MAX_TOOL_SEARCH_FILES: 80,
    MAX_TOOL_SEARCH_RESULTS: 120,
    MAX_TOOL_SEARCH_CONTEXT_LINES: 2,
    MAX_READ_TOOL_ROUNDS: 5,
    PANEL_ACTION_ID: "ace-ai.close-panel",
    SIDEBAR_ID: "ace-ai-sidebar",
  });

  // ---- core/defaults.js ----
  const Defaults = Object.freeze({
    apiKey: "",
    baseUrl: C.DEFAULT_BASE_URL,
    model: C.DEFAULT_MODEL,
    temperature: "0.2",
    maxTokens: "3200",
    projectRoot: "",
    includeFullFile: false,
    preferPatch: true,
    autoStripFence: true,
    autoOpenChanges: false,
    agentMode: "agent",
    permissionMode: "safe",
    reviewOpen: false,
    systemPrompt: [
      "You are Ace AI, a Cursor-like AI coding assistant running inside Acode on Android.",
      "Use the active editor context, cursor line, visible range, selected code, open-file list, and workspace hints when provided.",
      "Prefer minimal diffs. Preserve the user's existing code style, naming, formatting, framework choices, and file organization.",
      "Never hallucinate files, APIs, imports, package names, routes, or project structure. If context is missing, use read_file, list_files, or search_in_files when available before editing. If a read tool reports ok:false or a missing file, treat it as recoverable observation and continue with search/list or ask the user rather than guessing.",
      "For edits, change only what is needed, keep unrelated code untouched, and avoid broad rewrites unless explicitly requested.",
      "When writing JavaScript/TypeScript, keep module style consistent, avoid unnecessary dependencies, and handle errors defensively.",
      "When writing HTML/CSS/PHP templates, keep the output paste-ready, safe, responsive, and compatible with plain templates.",
      "Never claim changes were applied before tool results confirm it. In Agent mode, discuss normally first and use reviewable tools only when the user asks for code/file changes or explicit codebase inspection. Do not call tools for greetings or capability questions such as what can you do. In Plan mode, produce plans only.",
    ].join(" "),
  });

  const DefaultPresets = Object.freeze([
    {
      name: "/fix",
      prompt:
        "Fix bugs in the selected code. Keep the result minimal and directly usable.",
    },
    {
      name: "/explain",
      prompt:
        "Explain the selected code or error. Include likely cause and smallest fix.",
    },
    {
      name: "/refactor",
      prompt:
        "Refactor the selected code for readability without changing behavior.",
    },
    { name: "/tests", prompt: "Generate focused tests for the selected code." },
    {
      name: "/html-section",
      prompt:
        "Generate a polished responsive HTML/CSS/JS section for the current page.",
    },
    {
      name: "/php-template",
      prompt:
        "Convert the selected HTML into a PHP-friendly template. Escape dynamic values with htmlspecialchars.",
    },
    {
      name: "/acode-plugin",
      prompt:
        "Generate a complete Acode plugin skeleton with plugin.json, main.js, readme.md, changelogs.md, safe lifecycle, commands, and cleanup.",
    },
    {
      name: "/neosantara-widget",
      prompt:
        "Generate a clean Neosantara AI chat widget embed section. Preserve the script tag format and keep it PHP-friendly.",
    },
  ]);

  // ---- core/state.js ----
  const State = {
    baseUrl: "",
    cache: null,
    page: null,
    panel: null,
    sidebarContainer: null,
    sideButton: null,
    fallbackButton: null,
    contextMenu: null,
    activeTab: "chat",
    activeMode: "chat",
    busy: false,
    lastOriginal: "",
    lastResult: "",
    lastPatch: "",
    lastTarget: "selection",
    lastSelectionSnapshot: null,
    lastSummary: "",
    lastResultKind: "",
    registeredCommands: [],
    registeredSelectionItems: [],
    selectionMenuObserver: null,
    selectionMenuSanitizer: null,
    editorListeners: [],
    hints: null,
    maximized: false,
    lastError: null,
    lastRequest: null,
    draftPrompt: "",
    streamingContent: "",
    streamingMode: "",
    suppressStreamingPreview: false,
    suppressedToolDraft: "",
    streamRenderTimer: 0,
    streamRenderToken: 0,
    flowStage: "idle",
    flowDetail: "",
    pendingTools: [],
    lastToolJson: "",
    agentMessage: "",
    toolResults: [],
    agentPlan: "",
    agentApprovalRequired: true,
    selectedToolIds: [],
    reviewToolId: null,
    undoStack: [],
    lastAppliedSummary: "",
    applyDiagnostics: [],
    recentFiles: [],
    toolProgress: "",
    retryStatus: "",
    lastUsage: null,
    readToolResults: [],
    toolActivity: [],
    reviewNotice: "",
    showRunDetails: false,
    showDiagnostics: false,
    lastActionMeta: null,
    // V8 layer state (initialized here to avoid dynamic property creation)
    v8Ready: false,
    aiMode: "",
    permissionMode: "",
    reviewOpen: false,
    cancelRequested: false,
    _abortController: null,
    autoLoopEnabled: false,
    autoLoopCount: 0,
    autoLoopMax: 6,
    autoLoopStartedAt: 0,
    pendingCommand: null,
    terminalHistory: [],
    contextAttachments: [],
    quickMenuOpen: false,
  };

  // ---- core/util.js ----
  const Util = {
    html(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },
    unhtml(value) {
      let text = String(value == null ? "" : value);
      // Some models HTML-escape code inside JSON tool arguments. Decode only
      // common entities before the content reaches file write tools. Run a
      // couple of passes so `&amp;lt;html&amp;gt;` becomes `<html>` too.
      for (let i = 0; i < 2; i++) {
        const before = text;
        text = text
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#0*39;/g, "'")
          .replace(/&#x0*27;/gi, "'");
        if (text === before) break;
      }
      return text;
    },
    textKey(text) {
      return String(text || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },
    stripAdjacentRepeatedLineBlocks(text) {
      const lines = String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n");
      if (lines.length < 6) return String(text || "");
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 4) {
        changed = false;
        outer: for (let size = Math.floor(lines.length / 2); size >= 3; size--) {
          for (let i = 0; i + size * 2 <= lines.length; i++) {
            const a = lines
              .slice(i, i + size)
              .join("\n")
              .trim();
            const b = lines
              .slice(i + size, i + size * 2)
              .join("\n")
              .trim();
            if (a.length < 80 || b.length < 80) continue;
            if (this.textKey(a) === this.textKey(b)) {
              lines.splice(i + size, size);
              changed = true;
              break outer;
            }
          }
        }
      }
      return lines.join("\n");
    },
    stripRepeatedTailParagraphs(text) {
      let value = String(text || "")
        .replace(/\r\n/g, "\n")
        .trim();
      if (!value) return "";
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 4) {
        changed = false;
        const parts = value.split(/\n{2,}/);
        if (parts.length < 2) break;
        for (let size = Math.floor(parts.length / 2); size >= 1; size--) {
          const a = parts
            .slice(parts.length - size * 2, parts.length - size)
            .join("\n\n")
            .trim();
          const b = parts
            .slice(parts.length - size)
            .join("\n\n")
            .trim();
          if (a.length < 60 || b.length < 60) continue;
          if (this.textKey(a) === this.textKey(b)) {
            value = parts
              .slice(0, parts.length - size)
              .join("\n\n")
              .trim();
            changed = true;
            break;
          }
        }
      }
      return value;
    },
    stripRepeatedTailSentences(text) {
      let value = String(text || "").trim();
      if (!value || /```/.test(value)) return value;
      const sentenceRe = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
      const sentences = value.match(sentenceRe) || [];
      if (sentences.length < 4) return value;
      for (let size = Math.floor(sentences.length / 2); size >= 2; size--) {
        const a = sentences
          .slice(sentences.length - size * 2, sentences.length - size)
          .join("")
          .trim();
        const b = sentences
          .slice(sentences.length - size)
          .join("")
          .trim();
        if (a.length < 80 || b.length < 80) continue;
        if (this.textKey(a) === this.textKey(b))
          return sentences
            .slice(0, sentences.length - size)
            .join("")
            .trim();
      }
      return value;
    },
    normalizeModelText(text) {
      let value = String(text || "").trim();
      if (!value) return "";
      // Collapse accidental duplicated full responses that can happen when a
      // streaming proxy sends both deltas and a final full snapshot. Keep this
      // conservative: only remove exact repeated halves after trimming spacing.
      let changed = true;
      let guard = 0;
      while (changed && guard++ < 4) {
        changed = false;
        const before = value;
        const half = Math.floor(value.length / 2);
        if (value.length > 80) {
          for (let pad = -8; pad <= 8; pad++) {
            const cut = half + pad;
            if (cut <= 20 || cut >= value.length - 20) continue;
            const a = value.slice(0, cut).trim();
            const b = value.slice(cut).trim();
            if (a && b && this.textKey(a) === this.textKey(b)) {
              value = a;
              break;
            }
          }
        }
        const lines = value.split(/\r?\n/);
        if (lines.length >= 4 && lines.length % 2 === 0) {
          const left = lines
            .slice(0, lines.length / 2)
            .join("\n")
            .trim();
          const right = lines
            .slice(lines.length / 2)
            .join("\n")
            .trim();
          if (left && this.textKey(left) === this.textKey(right)) value = left;
        }
        value = this.stripRepeatedTailParagraphs(value);
        value = this.stripAdjacentRepeatedLineBlocks(value);
        value = this.stripRepeatedTailSentences(value);
        changed = value !== before;
      }
      return value.trim();
    },

    normalizeCodeFences(text) {
      let value = String(text || "").replace(/\r\n/g, "\n");
      if (!value.includes("```")) return value;
      // Fenced code should be block-level. Some providers stream dense text like
      // "...patterns```javascriptconst x = 1". Move any opening fence that
      // is glued to prose onto its own line before splitting by line.
      value = value.replace(/([^\n])```/g, "$1\n```");

      const known = [
        "javascriptreact",
        "typescriptreact",
        "javascript",
        "typescript",
        "markdown",
        "python",
        "html",
        "css",
        "scss",
        "sass",
        "json",
        "jsonc",
        "bash",
        "shell",
        "sh",
        "zsh",
        "php",
        "java",
        "kotlin",
        "swift",
        "rust",
        "ruby",
        "dart",
        "yaml",
        "yml",
        "xml",
        "sql",
        "vue",
        "svelte",
        "jsx",
        "tsx",
        "mjs",
        "cjs",
        "js",
        "ts",
        "go",
        "rs",
        "rb",
        "py",
        "c",
        "cpp",
        "csharp",
        "cs",
        "text",
      ].sort((a, b) => b.length - a.length);

      value = value
        .split("\n")
        .map((line) => {
          if (!line.startsWith("```")) return line;
          const rest = line.slice(3);
          if (!rest || /^\s*$/.test(rest) || /^\s/.test(rest)) return line;
          if (/^[a-zA-Z0-9_+.-]+\s*$/.test(rest)) return line;
          const lower = rest.toLowerCase();
          const lang = known.find(
            (item) => lower.startsWith(item) && rest.length > item.length,
          );
          if (!lang) return line;
          const tail = rest.slice(lang.length);
          if (!tail || /^\s*$/.test(tail)) return line;
          return "```" + rest.slice(0, lang.length) + "\n" + tail.trimStart();
        })
        .join("\n");

      const fenceCount = (value.match(/```/g) || []).length;
      if (fenceCount % 2 === 1) value += "\n```";
      return value;
    },
    prepareMarkdownText(text) {
      let value = this.normalizeCodeFences(text).trim();
      if (!value) return "";
      // Models often return dense one-line analysis like
      // "Issue: ... - Line 4: ... - Line 6: ...Smallest fix:".
      // Normalize only obvious section/list boundaries so the UI can render it
      // as readable markdown without changing code fences.
      const fenceParts = value.split(/(```[\s\S]*?```)/g);
      value = fenceParts
        .map((part) => {
          if (part.startsWith("```")) return part;
          let chunk = part;
          // Headings and bullets sometimes arrive glued to the previous
          // sentence during streaming or from compact model output. Normalize
          // those boundaries outside code fences only.
          chunk = chunk.replace(/([^\n])\s*(#{1,3}\s+)/g, "$1\n\n$2");
          // Normalize compact list boundaries such as "I can:- Analyze"
          // and "Features: - Read" before the more general bullet rules.
          chunk = chunk.replace(/([:\]\)])\s*-\s+/g, "$1\n- ");
          chunk = chunk.replace(
            /([^\n])\s+-\s+(?=(?:`[^`]+`|\*\*|__|✅|⚠️|Line\s*\d+|No\s+|Safe\s+|After\s+|Before\s+|[A-Z][A-Za-z0-9 ./@_`-]{1,64}:|[A-Za-z]))/g,
            "$1\n- ",
          );
          chunk = chunk.replace(
            /([.!?):\]`])-(?=\s*(?:`[^`]+`|\*\*|__|✅|⚠️|Line\s*\d+|[A-Z][A-Za-z0-9 ./@_`-]{1,64}:|[A-Za-z]))/g,
            "$1\n- ",
          );
          chunk = chunk.replace(
            /([.!?])\s+((?:`[^`]+`|\*\*|__)?[A-Z][A-Za-z0-9 ./@_`-]{2,64}(?:\*\*|__)?:)/g,
            "$1\n\n$2",
          );
          chunk = chunk.replace(
            /([)\]])((?:`[^`]+`|\*\*|__)?[A-Z][A-Za-z0-9 ./@_`-]{2,64}(?:\*\*|__)?:)/g,
            "$1\n\n$2",
          );
          chunk = chunk.replace(/([^\n])\s*(\d+[.)]\s+)/g, "$1\n$2");
          chunk = chunk.replace(
            /([.!?])\s+(?=(?:✅|⚠️|❌|[A-Z][A-Za-z0-9 ./@_`-]{2,64}:))/g,
            "$1\n\n",
          );
          chunk = chunk.replace(/([^\n])\s+(?=```)/g, "$1\n");
          return chunk;
        })
        .join("");
      return value.replace(/\n{3,}/g, "\n\n").trim();
    },
    inlineMarkdown(text) {
      // Must escape HTML first, then apply markdown patterns on the escaped output.
      // Patterns match on escaped text so that special chars in code spans are safe.
      let out = this.html(text);
      // inline code — match escaped backtick representation (backticks pass through html())
      out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
      // bold **text** and __text__
      out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
      // italic *text* and _text_ (single, not double)
      out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
      out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");
      // strikethrough ~~text~~
      out = out.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
      // links [text](url) — must run after html() escape so href is safe
      // html() turns " into &quot; so we match on that in the URL part
      out = out.replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s)&quot;]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="ace-ai-md-link">$1</a>',
      );
      return out;
    },
    highlightCode(lang, code) {
      const name = String(lang || "")
        .toLowerCase()
        .replace(/[^a-z0-9+#.-]/g, "");
      const source = String(code || "").replace(/\n$/, "");
      return source
        .split("\n")
        .map((line) => this.highlightCodeLine(name, line))
        .join("\n");
    },
    highlightCodeLine(lang, line) {
      const source = String(line || "");
      const htmlLang = /^(html|xml|svg|vue|svelte|php)$/.test(lang);
      const cssLang = /^(css|scss|sass|less)$/.test(lang);
      const jsonLang = /^(json|jsonc)$/.test(lang);
      const bashLang = /^(bash|sh|zsh|shell)$/.test(lang);
      const sqlLang = /^sql$/.test(lang);
      const pyLang = /^(py|python)$/.test(lang);
      const phpLang = /^php$/.test(lang);
      const keywords = new Set(
        (htmlLang
          ? "doctype html head body script style div span main section article header footer nav button input form label meta link title class id src href type rel async defer"
          : cssLang
            ? "@media @supports @keyframes from to important var calc linear-gradient repeat no-repeat solid dashed flex grid block inline none auto relative absolute fixed sticky hidden visible"
            : jsonLang
              ? "true false null"
              : bashLang
                ? "if then else elif fi for while do done function case esac in export local readonly return echo cd pwd test"
                : sqlLang
                  ? "select from where insert update delete create alter drop table into values join left right inner outer group by order limit offset and or not null is as distinct"
                  : pyLang
                    ? "def class return if elif else for while try except finally with as import from pass break continue lambda async await True False None self"
                    : phpLang
                      ? "function class public private protected static return if else elseif foreach while for try catch finally new echo namespace use true false null"
                      : "const let var function return if else for while do switch case break continue class extends new this super import from export default async await try catch finally throw typeof instanceof true false null undefined await of in"
        ).split(/\s+/),
      );
      const tokenRe = htmlLang
        ? /(<!--.*?-->|<\/?[A-Za-z][^>]*?>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b)/g
        : cssLang
          ? /(\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[0-9a-fA-F]{3,8}\b|@[\w-]+|[a-zA-Z-]+(?=\s*:)|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b)/g
          : bashLang
            ? /(#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$[A-Za-z_][\w]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w-]*\b)/g
            : sqlLang
              ? /(--.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w$]*\b)/gi
              : /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|\/\*.*?\*\/|#.*|\$[A-Za-z_][\w]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
      let out = "";
      let last = 0;
      source.replace(tokenRe, (token, _a, offset) => {
        out += this.html(source.slice(last, offset));
        out += this.highlightToken(lang, token, keywords, {
          htmlLang,
          cssLang,
          jsonLang,
          bashLang,
          sqlLang,
          pyLang,
          phpLang,
        });
        last = offset + token.length;
        return token;
      });
      out += this.html(source.slice(last));
      return out;
    },
    highlightToken(lang, token, keywords, flags) {
      const escaped = this.html(token);
      if (/^(\/\/|\/\*|#|--|<!--)/.test(token))
        return `<span class="ace-ai-hl-comment">${escaped}</span>`;
      if (/^("|'|`)/.test(token))
        return `<span class="ace-ai-hl-string">${escaped}</span>`;
      if (flags.htmlLang && /^<\/?[A-Za-z]/.test(token))
        return `<span class="ace-ai-hl-tag">${escaped}</span>`;
      if (flags.cssLang && /^#[0-9a-fA-F]/.test(token))
        return `<span class="ace-ai-hl-number">${escaped}</span>`;
      if (/^\$[A-Za-z_]/.test(token))
        return `<span class="ace-ai-hl-variable">${escaped}</span>`;
      if (/^\d/.test(token))
        return `<span class="ace-ai-hl-number">${escaped}</span>`;
      const lower = token.toLowerCase();
      if (keywords.has(token) || keywords.has(lower))
        return `<span class="ace-ai-hl-keyword">${escaped}</span>`;
      if (flags.cssLang && /^[a-zA-Z-]+$/.test(token))
        return `<span class="ace-ai-hl-property">${escaped}</span>`;
      return escaped;
    },
    // Simple memoization cache for markdown rendering to avoid re-parsing
    // identical text on every render cycle. Stores last N results.
    _mdCache: new Map(),
    _mdCacheMax: 24,
    markdown(text) {
      const inputKey = String(text || "");
      if (!inputKey.trim()) return "";
      const cached = this._mdCache.get(inputKey);
      if (cached !== undefined) return cached;
      const source = this.prepareMarkdownText(this.normalizeModelText(text));
      const blocks = [];
      let last = 0;
      const fence = /```([a-zA-Z0-9_+.-]*)\s*\n([\s\S]*?)```/g;
      let match;
      const renderText = (chunk) => {
        const renderList = (lines, ordered) => {
          const tag = ordered ? "ol" : "ul";
          const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
          return (
            `<${tag}>` +
            lines
              .map(
                (line) => `<li>${this.inlineMarkdown(line.replace(re, ""))}</li>`,
              )
              .join("") +
            `</${tag}>`
          );
        };
        const renderParagraph = (lines) => {
          // Filter out heading lines that ended up in a paragraph block — render them as headings
          const out = [];
          let buf = [];
          const flushBuf = () => {
            if (buf.length) {
              out.push(
                `<p>${buf.map((l) => this.inlineMarkdown(l)).join("<br>")}</p>`,
              );
              buf = [];
            }
          };
          for (const line of lines) {
            const hMatch = line.match(/^(#{1,3})\s+(.*)/);
            if (hMatch) {
              flushBuf();
              const level = Math.min(3, hMatch[1].length);
              out.push(
                `<h${level}>${this.inlineMarkdown(hMatch[2])}</h${level}>`,
              );
            } else {
              buf.push(line);
            }
          }
          flushBuf();
          return out.join("");
        };
        const renderLines = (lines) => {
          const out = [];
          let i = 0;
          while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) {
              i++;
              continue;
            }
            // heading
            if (/^#{1,3}\s+/.test(line)) {
              const hMatch = line.match(/^(#{1,3})\s+(.*)/);
              const level = Math.min(3, hMatch[1].length);
              out.push(
                `<h${level}>${this.inlineMarkdown(hMatch[2])}</h${level}>`,
              );
              i++;
              continue;
            }
            if (/^\s*[-*]\s+/.test(line)) {
              const list = [];
              while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]))
                list.push(lines[i++]);
              out.push(renderList(list, false));
              continue;
            }
            if (/^\s*\d+[.)]\s+/.test(line)) {
              const list = [];
              while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]))
                list.push(lines[i++]);
              out.push(renderList(list, true));
              continue;
            }
            // horizontal rule
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
              out.push("<hr>");
              i++;
              continue;
            }
            // blockquote
            if (/^>\s*/.test(line)) {
              const bq = [];
              while (i < lines.length && /^>\s*/.test(lines[i]))
                bq.push(lines[i++].replace(/^>\s*/, ""));
              out.push(
                `<blockquote class="ace-ai-md-bq">${bq.map((l) => this.inlineMarkdown(l)).join("<br>")}</blockquote>`,
              );
              continue;
            }
            const paragraph = [];
            while (
              i < lines.length &&
              lines[i].trim() &&
              !/^#{1,3}\s+/.test(lines[i]) &&
              !/^\s*[-*]\s+/.test(lines[i]) &&
              !/^\s*\d+[.)]\s+/.test(lines[i]) &&
              !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
              !/^>\s*/.test(lines[i])
            )
              paragraph.push(lines[i++]);
            if (paragraph.length) out.push(renderParagraph(paragraph));
          }
          return out.join("");
        };
        const rawBlocks = String(chunk || "")
          .replace(/\r\n/g, "\n")
          .split(/\n{2,}/);
        return rawBlocks
          .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return "";
            const lines = trimmed.split("\n");
            // Block-level heading (whole block is a heading)
            if (lines.length === 1 && /^#{1,3}\s+/.test(trimmed)) {
              const hMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
              const level = Math.min(3, hMatch[1].length);
              return `<h${level}>${this.inlineMarkdown(hMatch[2])}</h${level}>`;
            }
            return renderLines(lines);
          })
          .join("");
      };
      while ((match = fence.exec(source))) {
        if (match.index > last)
          blocks.push(renderText(source.slice(last, match.index)));
        const lang = this.html(match[1] || "text");
        const code = this.html(match[2] || "").replace(/\n$/, "");
        blocks.push(
          `<div class="ace-ai-md-code"><div class="ace-ai-md-code-head"><span>${lang || "code"}</span><button class="ace-ai-md-copy" data-copy-code>Copy</button></div><pre><code>${code}</code></pre></div>`,
        );
        last = fence.lastIndex;
      }
      if (last < source.length) blocks.push(renderText(source.slice(last)));
      const result = blocks.join("") || "";
      // Evict oldest entries when cache is full
      if (this._mdCache.size >= this._mdCacheMax) {
        const firstKey = this._mdCache.keys().next().value;
        this._mdCache.delete(firstKey);
      }
      this._mdCache.set(inputKey, result);
      return result;
    },
    baseUrl(value) {
      return String(value || C.DEFAULT_BASE_URL)
        .trim()
        .replace(/\/+$/, "");
    },
    stripFence(text) {
      let value = this.normalizeCodeFences(text).trim();
      const fenced = value.match(/^```[a-zA-Z0-9_+.-]*\s*\n([\s\S]*?)\n```$/);
      return fenced ? fenced[1].trim() : value;
    },
    truncate(text, max) {
      const value = String(text || "");
      if (!max || value.length <= max) return value;
      const keep = Math.max(800, Math.floor((max - 160) / 2));
      return (
        value.slice(0, keep) +
        "\n\n/* ... Ace AI truncated long context ... */\n\n" +
        value.slice(-keep)
      );
    },
    filenameFromPath(path) {
      const clean = String(path || "")
        .replace(/[?#].*$/, "")
        .replace(/\/$/, "");
      return clean.split("/").filter(Boolean).pop() || "untitled";
    },
    lang(filename) {
      const ext = String(filename || "")
        .split(".")
        .pop()
        .toLowerCase();
      const map = {
        js: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        jsx: "javascriptreact",
        ts: "typescript",
        tsx: "typescriptreact",
        html: "html",
        htm: "html",
        css: "css",
        scss: "scss",
        php: "php",
        py: "python",
        json: "json",
        md: "markdown",
        xml: "xml",
        vue: "vue",
        svelte: "svelte",
        java: "java",
        kt: "kotlin",
        swift: "swift",
        go: "go",
        rs: "rust",
        rb: "ruby",
        dart: "dart",
        c: "c",
        h: "c",
        cpp: "cpp",
        hpp: "cpp",
        cs: "csharp",
        sh: "bash",
        yml: "yaml",
        yaml: "yaml",
        sql: "sql",
      };
      return map[ext] || ext || "text";
    },
    nowLabel() {
      try {
        return new Date().toLocaleTimeString();
      } catch (_) {
        return "";
      }
    },
    isPatch(text) {
      const v = String(text || "");
      return /^---\s+/m.test(v) && /^\+\+\+\s+/m.test(v) && /^@@\s/m.test(v);
    },
    debounce(fn, wait) {
      let t = 0;
      return function () {
        clearTimeout(t);
        const args = arguments;
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },
    rafDebounce(fn) {
      let frame = 0;
      const schedule =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb) => setTimeout(cb, 16);
      const cancel =
        typeof cancelAnimationFrame === "function"
          ? cancelAnimationFrame
          : clearTimeout;
      return function () {
        if (frame) cancel(frame);
        const args = arguments;
        frame = schedule(() => {
          frame = 0;
          fn.apply(this, args);
        });
      };
    },
    async copy(text) {
      const value = String(text || "");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch (_) {}
      // Fallback for Acode WebView
      const area = document.createElement("textarea");
      area.value = value;
      area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch (_) {}
      document.body.removeChild(area);
      return true;
    },
  };

  // ---- core/runtime.js ----
  const Runtime = {
    resetReviewState() {
      State.lastOriginal = "";
      State.lastResult = "";
      State.lastPatch = "";
      State.lastTarget = "selection";
      State.lastSummary = "";
      State.lastResultKind = "";
    },
    clearAgentState() {
      State.pendingTools = [];
      State.lastToolJson = "";
      State.agentMessage = "";
      State.toolResults = [];
      State.agentPlan = "";
      State.selectedToolIds = [];
      State.reviewToolId = null;
      State.readToolResults = [];
      State.toolActivity = [];
      State.reviewNotice = "";
      State.showRunDetails = false;
      State.toolProgress = "";
      State.flowStage = "idle";
      State.flowDetail = "";
    },
    clearTransientState() {
      this.resetReviewState();
      this.clearAgentState();
      State.lastError = null;
      State.draftPrompt = "";
      State.streamingContent = "";
      State.streamingMode = "";
      State.busy = false;
      State.retryStatus = "";
      State.toolActivity = [];
      State.toolProgress = "";
      State.flowStage = "idle";
      State.flowDetail = "";
      State.lastUsage = null;
      State.lastRequest = null;
      State.applyDiagnostics = [];
      State.lastAppliedSummary = "";
      State.reviewNotice = "";
      State.showRunDetails = false;
      State.currentHistoryPrompt = "";
      State.activeTab = "chat";
      try {
        localStorage.setItem(
          C.RUNTIME_KEY,
          JSON.stringify({
            version: C.VERSION,
            resetAt: new Date().toISOString(),
          }),
        );
      } catch (_) {}
    },
    debugState() {
      const ctx = Editor.context();
      return JSON.stringify(
        {
          version: C.VERSION,
          activeTab: State.activeTab,
          busy: State.busy,
          flowStage: State.flowStage,
          flowDetail: State.flowDetail,
          lastResultKind: State.lastResultKind,
          hasLastResult: Boolean(State.lastResult),
          hasLastPatch: Boolean(State.lastPatch),
          pendingTools: State.pendingTools.length,
          selectedTools: State.pendingTools.filter(
            (t) => t.selected !== false && !t.error,
          ).length,
          undoBatches: State.undoStack.length,
          hasError: Boolean(State.lastError),
          responses: Store.responseState(),
          chatMessages: Store.chat().length,
          file: ctx.file,
          cursor: ctx.cursor,
          visibleRange: ctx.visibleRange,
          openFiles: ctx.openFiles,
          dirty: ctx.dirty,
          usage: State.lastUsage,
          readToolResults: State.readToolResults,
          toolActivity: State.toolActivity,
          hasSelection: ctx.hasSelection,
          selectionLines: ctx.selectionLines,
          textLines: ctx.textLines,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    },
  };

  // ---- core/error-kit.js ----
  const ErrorKit = {
    create(input) {
      const err = new Error(input.message || input.title || "Ace AI error");
      err.name = "AceAIError";
      err.code = input.code || "UNKNOWN";
      err.title = input.title || "Ace AI Error";
      err.hint = input.hint || "";
      err.status = input.status || 0;
      err.details = input.details || "";
      err.raw = input.raw || null;
      err.cause = input.cause || null;
      err.time = new Date().toISOString();
      return err;
    },
    fromHttp(status, data, rawText) {
      const message =
        data?.error?.message ||
        data?.message ||
        data?.error ||
        String(rawText || "").slice(0, 600) ||
        "HTTP " + status;
      if (status === 400)
        return this.create({
          code: "BAD_REQUEST",
          status,
          title: "Invalid request",
          message,
          hint: "Check the model, base URL, max tokens, or request format.",
        });
      if (status === 401)
        return this.create({
          code: "UNAUTHORIZED",
          status,
          title: "API key rejected",
          message,
          hint: "Open Settings and make sure the NAI API Key is correct, active, and in the expected format.",
        });
      if (status === 403)
        return this.create({
          code: "FORBIDDEN",
          status,
          title: "API access denied",
          message,
          hint: "The key may not have access to this model or base URL. Try another model or check the Neosantara dashboard.",
        });
      if (status === 404)
        return this.create({
          code: "NOT_FOUND",
          status,
          title: "Endpoint not found",
          message,
          hint: "Check the Base URL. The default should be: https://api.neosantara.xyz/v1",
        });
      if (status === 408)
        return this.create({
          code: "REQUEST_TIMEOUT",
          status,
          title: "Request timed out",
          message,
          hint: "The connection may be slow or the server may be responding late. Try again.",
        });
      if (status === 413)
        return this.create({
          code: "CONTEXT_TOO_LARGE",
          status,
          title: "Context too large",
          message,
          hint: "Turn off Include full file or choose a smaller code selection.",
        });
      if (status === 429)
        return this.create({
          code: "RATE_LIMITED",
          status,
          title: "Rate limited / quota reached",
          message,
          hint: "This usually means the quota was hit or too many requests were sent in a short time. Wait a moment, reduce retries, or check the API quota.",
        });
      if (status >= 500)
        return this.create({
          code: "SERVER_ERROR",
          status,
          title: "API server problem",
          message,
          hint: "Try again. If it still fails, copy the error report and check the endpoint or proxy status.",
        });
      return this.create({
        code: "HTTP_ERROR",
        status,
        title: "API error",
        message,
        hint: "Check Settings, model, base URL, and API key.",
      });
    },
    normalize(error) {
      if (error && error.name === "AceAIError") return error;
      const msg = String(error?.message || error || "");
      if (error?.name === "AbortError" || /aborted|timeout/i.test(msg)) {
        return this.create({
          code: "TIMEOUT",
          title: "Request took too long",
          message:
            "Ace AI stopped the request because it exceeded the time limit.",
          hint: "Try again. If this happens often, lower max tokens or turn off full file context.",
          cause: error,
        });
      }
      if (
        /Failed to fetch|NetworkError|Load failed|Network request failed/i.test(
          msg,
        )
      ) {
        return this.create({
          code: "NETWORK_OR_CORS",
          title: "Could not reach the API",
          message: msg || "Fetch failed.",
          hint: "Check your internet, Base URL, WebView CORS, or use your Neosantara backend proxy.",
          cause: error,
        });
      }
      if (/api key empty|api key/i.test(msg)) {
        return this.create({
          code: "MISSING_API_KEY",
          title: "API key is missing",
          message: msg,
          hint: "Open Ace AI Settings and fill in the NAI API Key.",
          cause: error,
        });
      }
      return this.create({
        code: "UNKNOWN",
        title: "Ace AI failed",
        message: msg || "Unknown error",
        hint: "Try again. If it still fails, copy the error report.",
        cause: error,
      });
    },
    report(error) {
      const e = this.normalize(error || State.lastError);
      const ctx = Editor.context();
      const settings = Store.settings();
      const lastRequest = State.lastRequest || null;
      const reportRequest = lastRequest
        ? {
            tab: lastRequest.tab || "",
            mode: lastRequest.mode || "",
            outputMode: lastRequest.outputMode || "",
            userPrompt:
              lastRequest.userPrompt ||
              lastRequest.displayPrompt ||
              lastRequest.prompt ||
              "",
            transportPrompt:
              lastRequest.transportPrompt || lastRequest.prompt || "",
            displayPrompt:
              lastRequest.displayPrompt ||
              lastRequest.userPrompt ||
              lastRequest.prompt ||
              "",
            endpoint: lastRequest.endpoint || "",
            filename: lastRequest.filename || "",
            time: lastRequest.time || "",
          }
        : null;
      return [
        "Ace AI Error Report",
        "===================",
        "Plugin version: " + C.VERSION,
        "Time: " + (e.time || new Date().toISOString()),
        "Code: " + e.code,
        "Status: " + (e.status || "-"),
        "Title: " + e.title,
        "Message: " + e.message,
        "Hint: " + (e.hint || "-"),
        "",
        "Context",
        "-------",
        "File: " + ctx.file.filename,
        "Language: " + ctx.file.language,
        "Cursor: line " +
          (ctx.cursor?.line || "-") +
          ", column " +
          (ctx.cursor?.column || "-"),
        "Visible range: " +
          (ctx.visibleRange
            ? ctx.visibleRange.startLine + "-" + ctx.visibleRange.endLine
            : "-"),
        "Open files: " +
          ((ctx.openFiles || []).map((f) => f.filename).join(", ") || "-"),
        "Unsaved/dirty: " + Boolean(ctx.dirty?.dirty),
        "Has selection: " + ctx.hasSelection,
        "Selection lines: " + ctx.selectionLines,
        "File lines: " + ctx.textLines,
        "",
        "Settings",
        "--------",
        "Base URL: " + settings.baseUrl,
        "Endpoint: /v1/responses only",
        "Responses last id: " + (Store.responseState().lastResponseId || "-"),
        "Project Root: " + (settings.projectRoot || "-"),
        "Model: " + settings.model,
        "Max tokens: " + settings.maxTokens,
        "Temperature: " + settings.temperature,
        "Include full file: " + settings.includeFullFile,
        "Last usage: " + JSON.stringify(State.lastUsage || null),
        "API key set: " + Boolean(settings.apiKey),
        "",
        "Last request",
        "------------",
        JSON.stringify(reportRequest, null, 2),
        "",
        "Details",
        "-------",
        String(e.details || e.stack || e.cause?.stack || ""),
      ].join("\n");
    },
  };

  // ---- core/store.js ----
  const Store = {
    hasKey(key) {
      try {
        return localStorage.getItem(key) !== null;
      } catch (_) {
        return false;
      }
    },
    getJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        // Basic validation: parsed value must be a non-null object or array
        // for structured keys. Primitive values (string, number, boolean) are
        // also valid for simple settings.
        if (parsed === null || parsed === undefined) return fallback;
        return parsed;
      } catch (error) {
        // JSON is corrupted or unreadable — remove the bad entry to prevent
        // repeated parse failures, then return the safe fallback.
        try {
          localStorage.removeItem(key);
        } catch (_) {}
        console.warn(
          "Ace AI: removed corrupted localStorage key:",
          key,
          error.message || error,
        );
        return fallback;
      }
    },
    setJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // localStorage may be full (quota exceeded). Warn but do not crash.
        console.warn(
          "Ace AI: localStorage write failed for key:",
          key,
          error.message || error,
        );
      }
    },
    settings() {
      return Object.assign({}, Defaults, this.getJson(C.STORAGE_KEY, {}));
    },
    saveSettings(value) {
      const next = Object.assign({}, this.settings(), value || {});
      this.setJson(C.STORAGE_KEY, next);
      return next;
    },
    presets() {
      const items = this.getJson(C.PRESETS_KEY, null);
      return Array.isArray(items) && items.length
        ? items
        : DefaultPresets.slice();
    },
    savePresets(items) {
      const clean = (items || [])
        .filter((x) => x && x.name && x.prompt)
        .slice(0, 40);
      this.setJson(C.PRESETS_KEY, clean);
      return clean;
    },
    chat() {
      const hasCurrentChat = this.hasKey(C.CHAT_KEY);
      let items = this.getJson(C.CHAT_KEY, []);
      if (!hasCurrentChat && (!Array.isArray(items) || !items.length)) {
        const legacyKeys = [
          "ace-ai.chat.v8_7",
          "ace-ai.chat.v8_6",
          "ace-ai.chat.v8_5",
          "ace-ai.chat.v8_4",
          "ace-ai.chat.v8_3",
        ];
        for (const key of legacyKeys) {
          const legacy = this.getJson(key, []);
          if (Array.isArray(legacy) && legacy.length) {
            items = legacy;
            break;
          }
        }
      }
      return Array.isArray(items) ? items.slice(-C.MAX_CHAT_MESSAGES) : [];
    },
    saveChat(items) {
      const clean = [];
      (items || []).forEach((item) => {
        if (!item || !item.role) return;
        const next = Object.assign({}, item);
        if (next.role === "assistant")
          next.content = Util.normalizeModelText(next.content || "");
        if (!String(next.content || "").trim()) return;
        const prev = clean[clean.length - 1];
        if (
          prev &&
          prev.role === next.role &&
          prev.role === "assistant" &&
          Util.normalizeModelText(prev.content || "") ===
            Util.normalizeModelText(next.content || "")
        )
          return;
        clean.push(next);
      });
      this.setJson(C.CHAT_KEY, clean.slice(-C.MAX_CHAT_MESSAGES));
      // Also persist to project-specific history
      try { ProjectHistory.saveCurrentChat(); } catch (_) {}
    },
    responseState() {
      return this.getJson(C.RESPONSE_KEY, {
        lastResponseId: "",
        mode: "",
        updatedAt: "",
      });
    },
    saveResponseState(value) {
      const next = Object.assign({}, this.responseState(), value || {}, {
        updatedAt: new Date().toISOString(),
      });
      this.setJson(C.RESPONSE_KEY, next);
      return next;
    },
    clearResponseState() {
      try {
        localStorage.removeItem(C.RESPONSE_KEY);
      } catch (_) {}
    },
    clearChat() {
      // Keep an explicit empty array so New Chat does not resurrect migrated v8_3-v8_7 history.
      this.setJson(C.CHAT_KEY, []);
      this.clearResponseState();
    },
  };

  // ---- core/acode.js ----
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

  // ---- core/editor.js ----
  const Editor = {
    manager() {
      return window.editorManager || window.acode?.editorManager || null;
    },
    view() {
      const m = this.manager();
      return (m && m.editor) || window.editor || null;
    },
    activeFile() {
      const m = this.manager();
      return (
        (m &&
          (m.activeFile ||
            m.active ||
            m.file ||
            m.currentFile ||
            m.editorFile)) ||
        null
      );
    },
    text() {
      const view = this.view();
      try {
        if (
          view &&
          view.state &&
          view.state.doc &&
          typeof view.state.doc.toString === "function"
        )
          return view.state.doc.toString();
        if (view && typeof view.getValue === "function") return view.getValue();
        if (view && view.session && typeof view.session.getValue === "function")
          return view.session.getValue();
      } catch (_) {}
      return "";
    },
    normalizeRange(range) {
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to))
        return null;
      const from = Math.min(range.from, range.to);
      const to = Math.max(range.from, range.to);
      return { from, to };
    },
    selectionRange() {
      const view = this.view();
      try {
        const sel = view?.state?.selection?.main;
        if (sel && Number.isFinite(sel.from) && Number.isFinite(sel.to))
          return this.normalizeRange({ from: sel.from, to: sel.to });
      } catch (_) {}
      try {
        const range = view?.selection?.getRange?.();
        if (
          range &&
          Number.isFinite(range.start?.row) &&
          Number.isFinite(range.start?.column)
        ) {
          const text = this.text();
          return this.normalizeRange({
            from: this.offsetFromLineColumn(
              text,
              range.start.row + 1,
              range.start.column + 1,
            ),
            to: this.offsetFromLineColumn(
              text,
              range.end.row + 1,
              range.end.column + 1,
            ),
          });
        }
      } catch (_) {}
      return null;
    },
    selectedText() {
      const view = this.view();
      const text = this.text();
      const range = this.selectionRange();
      if (range && range.from !== range.to)
        return text.slice(range.from, range.to);
      try {
        if (view && typeof view.getCopyText === "function")
          return view.getCopyText() || "";
      } catch (_) {}
      try {
        if (view && typeof view.getSelectedText === "function")
          return view.getSelectedText() || "";
      } catch (_) {}
      return "";
    },
    lineColumnFromOffset(text, offset) {
      const value = String(text || "");
      const safe = Math.max(0, Math.min(Number(offset || 0), value.length));
      let line = 1;
      let column = 1;
      for (let i = 0; i < safe; i++) {
        if (value.charCodeAt(i) === 10) {
          line++;
          column = 1;
        } else column++;
      }
      return { line, column, offset: safe };
    },
    offsetFromLineColumn(text, line, column) {
      const lines = String(text || "").split("\n");
      const targetLine = Math.max(1, Math.min(Number(line || 1), lines.length));
      let offset = 0;
      for (let i = 0; i < targetLine - 1; i++) offset += lines[i].length + 1;
      return (
        offset +
        Math.max(
          0,
          Math.min(Number(column || 1) - 1, (lines[targetLine - 1] || "").length),
        )
      );
    },
    cursor() {
      const view = this.view();
      const text = this.text();
      try {
        const range = this.selectionRange();
        if (range) return this.lineColumnFromOffset(text, range.to);
      } catch (_) {}
      try {
        const cursor = view?.selection?.getCursor?.();
        if (
          cursor &&
          Number.isFinite(cursor.row) &&
          Number.isFinite(cursor.column)
        ) {
          return {
            line: cursor.row + 1,
            column: cursor.column + 1,
            offset: this.offsetFromLineColumn(
              text,
              cursor.row + 1,
              cursor.column + 1,
            ),
          };
        }
      } catch (_) {}
      return { line: 1, column: 1, offset: 0 };
    },
    visibleRange() {
      const view = this.view();
      const text = this.text();
      const lines = Math.max(1, text.split("\n").length);
      try {
        const visible = view?.visibleRanges;
        if (visible && visible.length) {
          const start = this.lineColumnFromOffset(text, visible[0].from).line;
          const end = this.lineColumnFromOffset(
            text,
            visible[visible.length - 1].to,
          ).line;
          return {
            startLine: Math.max(1, start),
            endLine: Math.min(lines, end),
            source: "codemirror-visibleRanges",
          };
        }
      } catch (_) {}
      try {
        const first = view?.renderer?.getFirstVisibleRow?.();
        const last = view?.renderer?.getLastVisibleRow?.();
        if (Number.isFinite(first) && Number.isFinite(last)) {
          return {
            startLine: Math.max(1, first + 1),
            endLine: Math.min(lines, last + 1),
            source: "ace-renderer",
          };
        }
      } catch (_) {}
      const cursor = this.cursor();
      return {
        startLine: Math.max(1, cursor.line - 40),
        endLine: Math.min(lines, cursor.line + 40),
        source: "cursor-fallback",
      };
    },
    numberedLines(text, startLine, endLine) {
      const lines = String(text || "").split("\n");
      const start = Math.max(1, Number(startLine || 1));
      const end = Math.min(
        lines.length,
        Math.max(start, Number(endLine || start)),
      );
      const width = String(end).length;
      const out = [];
      for (let line = start; line <= end; line++) {
        out.push(
          String(line).padStart(width, " ") + " | " + (lines[line - 1] || ""),
        );
      }
      return out.join("\n");
    },
    contextWindow(radius) {
      const text = this.text();
      const total = Math.max(1, text.split("\n").length);
      const cursor = this.cursor();
      const startLine = Math.max(1, cursor.line - (radius || 35));
      const endLine = Math.min(total, cursor.line + (radius || 35));
      return {
        startLine,
        endLine,
        content: this.numberedLines(text, startLine, endLine),
      };
    },
    visibleContext(maxLines) {
      const text = this.text();
      const visible = this.visibleRange();
      const total = Math.max(1, text.split("\n").length);
      const limit = Math.max(10, Number(maxLines || 90));
      let startLine = visible.startLine;
      let endLine = visible.endLine;
      if (endLine - startLine + 1 > limit)
        endLine = Math.min(total, startLine + limit - 1);
      return {
        startLine,
        endLine,
        source: visible.source,
        content: this.numberedLines(text, startLine, endLine),
      };
    },
    normalizeFile(raw, fallbackIndex) {
      if (!raw) return null;
      try {
        const file = raw.file || raw.editorFile || raw;
        const uri = String(
          file.uri ||
            file.url ||
            file.path ||
            file.location ||
            file.filename ||
            file.name ||
            "",
        ).trim();
        const filename = String(
          file.filename ||
            file.name ||
            file.title ||
            (uri ? Util.filenameFromPath(uri) : "tab-" + fallbackIndex),
        ).trim();
        const dirty = Boolean(
          file.dirty ||
          file.isDirty ||
          file.changed ||
          file.modified ||
          file.isUnsaved ||
          file.unsaved ||
          file.saved === false,
        );
        return filename
          ? { filename, uri, language: Util.lang(filename), dirty }
          : null;
      } catch (_) {
        return null;
      }
    },
    openFiles() {
      const m = this.manager();
      const out = [];
      const add = (item) => {
        const normalized = this.normalizeFile(item, out.length + 1);
        if (!normalized) return;
        const key = normalized.uri || normalized.filename;
        if (!out.some((x) => (x.uri || x.filename) === key)) out.push(normalized);
      };
      try {
        const candidates = [
          m?.files,
          m?.openFiles,
          m?.tabs,
          m?.editors,
          m?.editorFiles,
          window.acode?.files,
        ];
        candidates.forEach((list) => {
          if (Array.isArray(list)) list.forEach(add);
          else if (list && typeof list === "object")
            Object.keys(list).forEach((key) => add(list[key]));
        });
      } catch (_) {}
      const active = this.normalizeFile(this.activeFile(), 0) || this.info();
      if (
        active &&
        active.filename &&
        !out.some(
          (x) => (x.uri || x.filename) === (active.uri || active.filename),
        )
      )
        out.unshift(active);
      return out.slice(0, 12);
    },
    dirtyState() {
      const file = this.activeFile();
      const view = this.view();
      try {
        if (
          file &&
          (file.dirty ||
            file.isDirty ||
            file.changed ||
            file.modified ||
            file.isUnsaved ||
            file.unsaved ||
            file.saved === false)
        )
          return { dirty: true, source: "file" };
        if (
          view?.session?.getUndoManager &&
          typeof view.session.getUndoManager().isClean === "function"
        )
          return {
            dirty: !view.session.getUndoManager().isClean(),
            source: "undo-manager",
          };
      } catch (_) {}
      return { dirty: false, source: "unknown" };
    },
    info() {
      const file = this.activeFile();
      const view = this.view();
      let filename = "untitled";
      let uri = "";
      let location = "";
      let mode = "";
      try {
        filename = String(
          (file && (file.filename || file.name || file.title)) ||
            view?.session?.name ||
            "untitled",
        );
        location = String((file && file.location) || "");
        uri = String(
          (file && (file.uri || file.url || file.path)) || location || "",
        );
        if (filename === "untitled" && uri) filename = Util.filenameFromPath(uri);
        mode = String(
          (file && (file.mode || file.syntax)) ||
            view?.state?.facet?.languageData ||
            view?.session?.getMode?.().$id ||
            Util.lang(filename),
        );
      } catch (_) {}
      return { filename, uri, location, language: Util.lang(filename) || mode };
    },
    rememberRecentFile(info) {
      try {
        const file = info || this.info();
        if (!file || !file.filename) return;
        State.recentFiles = State.recentFiles || [];
        const key = file.uri || file.filename;
        State.recentFiles = State.recentFiles.filter(
          (item) => (item.uri || item.filename) !== key,
        );
        State.recentFiles.unshift({
          filename: file.filename,
          uri: file.uri || file.location || "",
          language: file.language || Util.lang(file.filename),
          time: new Date().toISOString(),
        });
        State.recentFiles = State.recentFiles.slice(0, 10);
      } catch (_) {}
    },
    context() {
      const fullText = this.text();
      const selection = this.selectedText();
      const info = this.info();
      const cursor = this.cursor();
      const visibleRange = this.visibleRange();
      const cursorContext = this.contextWindow(35);
      const visibleContext = this.visibleContext(90);
      const openFiles = this.openFiles();
      const dirty = this.dirtyState();
      this.rememberRecentFile(info);
      return {
        file: info,
        text: fullText,
        selection,
        hasSelection: Boolean(selection),
        selectionLines: selection ? selection.split("\n").length : 0,
        textLines: fullText ? fullText.split("\n").length : 0,
        cursor,
        visibleRange,
        selectionRange: this.selectionRange(),
        cursorContext,
        visibleContext,
        openFiles,
        dirty,
        recentFiles: (State.recentFiles || []).slice(0, 8),
      };
    },
    replaceRange(range, insert) {
      const normalized = this.normalizeRange(range);
      const text = this.text();
      if (!normalized) return false;
      const from = Math.max(0, Math.min(normalized.from, text.length));
      const to = Math.max(from, Math.min(normalized.to, text.length));
      return this.replaceAll(
        text.slice(0, from) + String(insert || "") + text.slice(to),
      );
    },
    replaceSelection(insert) {
      const view = this.view();
      const text = String(insert || "");
      const range = this.selectionRange();
      try {
        // CodeMirror 6 dispatch (primary path)
        if (view && range && typeof view.dispatch === "function") {
          view.dispatch({
            changes: { from: range.from, to: range.to, insert: text },
          });
          this.rememberRecentFile();
          return true;
        }
        // ACE editor — use session.replace with selection range (correct replace)
        if (
          view &&
          view.session &&
          typeof view.session.replace === "function" &&
          view.selection?.getRange
        ) {
          view.session.replace(view.selection.getRange(), text);
          this.rememberRecentFile();
          return true;
        }
        // Fallback: replaceAll on full range when no selection range available
        if (range && typeof this.replaceRange === "function") {
          return this.replaceRange(range, text);
        }
        // Last resort: view.insert — only correct if there IS a selection (ACE replaces selection)
        if (view && typeof view.insert === "function") {
          view.insert(text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) {
        Acode.toast("Replace failed: " + error.message);
      }
      return false;
    },
    insertAtCursor(insert) {
      const view = this.view();
      const text = String(insert || "");
      try {
        // CodeMirror 6: insert at cursor (from = to = cursor pos, no selection replacement)
        const range = this.selectionRange();
        if (view && typeof view.dispatch === "function") {
          const pos = range ? range.to : 0;
          view.dispatch({
            changes: { from: pos, to: pos, insert: text },
          });
          this.rememberRecentFile();
          return true;
        }
        // ACE editor: insert at cursor position
        if (view && typeof view.insert === "function") {
          view.insert(text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) {
        Acode.toast("Insert failed: " + error.message);
      }
      return false;
    },
    replaceAll(insert) {
      const view = this.view();
      const text = String(insert || "");
      try {
        if (
          view &&
          view.state &&
          view.state.doc &&
          typeof view.dispatch === "function"
        ) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
          });
          this.rememberRecentFile();
          return true;
        }
        if (view && typeof view.setValue === "function") {
          view.setValue(text, -1);
          this.rememberRecentFile();
          return true;
        }
        if (view && view.session && typeof view.session.setValue === "function") {
          view.session.setValue(text);
          this.rememberRecentFile();
          return true;
        }
      } catch (error) {
        Acode.toast("Apply failed: " + error.message);
      }
      return false;
    },

    gotoLine(line, column) {
      const view = this.view();
      const targetLine = Math.max(1, Number(line || 1));
      const targetColumn = Math.max(1, Number(column || 1));
      try {
        if (view && view.state && typeof view.dispatch === "function") {
          const offset = this.offsetFromLineColumn(
            view.state.doc.toString(),
            targetLine,
            targetColumn,
          );
          view.dispatch({
            selection: { anchor: offset },
            effects: view.constructor?.scrollIntoView
              ? view.constructor.scrollIntoView(offset, { y: "center" })
              : undefined,
          });
          view.focus?.();
          return true;
        }
      } catch (_) {}
      try {
        if (view && typeof view.gotoLine === "function") {
          view.gotoLine(targetLine, targetColumn - 1, true);
          view.focus?.();
          return true;
        }
        if (view && typeof view.moveCursorToPosition === "function") {
          view.moveCursorToPosition({
            row: targetLine - 1,
            column: targetColumn - 1,
          });
          view.scrollToLine?.(targetLine, true, true, function () {});
          view.focus?.();
          return true;
        }
      } catch (_) {}
      return false;
    },
    focus() {
      try {
        this.view()?.focus?.();
      } catch (_) {}
    },
    onChange(fn) {
      const m = this.manager();
      if (!m || typeof m.on !== "function") return;
      [
        "switch-file",
        "file-loaded",
        "save-file",
        "file-content-changed",
        "rename-file",
        "change",
        "changeSelection",
      ].forEach((event) => {
        try {
          m.on(event, fn);
          State.editorListeners.push([event, fn]);
        } catch (_) {}
      });
    },
    offChange(fn) {
      const m = this.manager();
      if (!m || typeof m.off !== "function") return;
      [
        "switch-file",
        "file-loaded",
        "save-file",
        "file-content-changed",
        "rename-file",
        "change",
        "changeSelection",
      ].forEach((event) => {
        try {
          m.off(event, fn);
        } catch (_) {}
      });
      State.editorListeners = State.editorListeners.filter(([, f]) => f !== fn);
    },
    removeListeners() {
      const m = this.manager();
      if (!m || typeof m.off !== "function") return;
      State.editorListeners.forEach(([event, fn]) => {
        try {
          m.off(event, fn);
        } catch (_) {}
      });
      State.editorListeners = [];
    },
  };

  // ---- core/patch.js ----
  const Patch = {
    clean(raw) {
      let text = Util.stripFence(raw || "");
      const idx = text.indexOf("--- ");
      if (idx > 0) text = text.slice(idx);
      return text.trim();
    },
    splitLines(text) {
      return String(text || "").split("\n");
    },
    canUseLcs(a, b) {
      const cells = (a.length + 1) * (b.length + 1);
      return cells <= 1600000;
    },
    lcsRows(a, b, oldOffset, newOffset) {
      const rows = [];
      if (!a.length && !b.length) return rows;
      if (!a.length) {
        for (let j = 0; j < b.length; j++)
          rows.push({
            type: "add",
            text: b[j],
            oldLine: 0,
            newLine: newOffset + j + 1,
          });
        return rows;
      }
      if (!b.length) {
        for (let i = 0; i < a.length; i++)
          rows.push({
            type: "del",
            text: a[i],
            oldLine: oldOffset + i + 1,
            newLine: 0,
          });
        return rows;
      }
      if (!this.canUseLcs(a, b)) {
        for (let i = 0; i < a.length; i++)
          rows.push({
            type: "del",
            text: a[i],
            oldLine: oldOffset + i + 1,
            newLine: 0,
          });
        for (let j = 0; j < b.length; j++)
          rows.push({
            type: "add",
            text: b[j],
            oldLine: 0,
            newLine: newOffset + j + 1,
          });
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
          dp[row + j] =
            a[i] === b[j]
              ? dp[next + j + 1] + 1
              : Math.max(dp[next + j], dp[row + j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) {
          rows.push({
            type: "same",
            text: a[i],
            oldLine: oldOffset + i + 1,
            newLine: newOffset + j + 1,
          });
          i++;
          j++;
        } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
          rows.push({
            type: "del",
            text: a[i],
            oldLine: oldOffset + i + 1,
            newLine: 0,
          });
          i++;
        } else {
          rows.push({
            type: "add",
            text: b[j],
            oldLine: 0,
            newLine: newOffset + j + 1,
          });
          j++;
        }
      }
      while (i < n)
        rows.push({
          type: "del",
          text: a[i],
          oldLine: oldOffset + i++ + 1,
          newLine: 0,
        });
      while (j < m)
        rows.push({
          type: "add",
          text: b[j],
          oldLine: 0,
          newLine: newOffset + j++ + 1,
        });
      return rows;
    },
    lineDiff(oldText, newText) {
      const oldLines = this.splitLines(oldText);
      const newLines = this.splitLines(newText);
      let prefix = 0;
      while (
        prefix < oldLines.length &&
        prefix < newLines.length &&
        oldLines[prefix] === newLines[prefix]
      )
        prefix++;
      let oldEnd = oldLines.length - 1;
      let newEnd = newLines.length - 1;
      while (
        oldEnd >= prefix &&
        newEnd >= prefix &&
        oldLines[oldEnd] === newLines[newEnd]
      ) {
        oldEnd--;
        newEnd--;
      }
      const rows = [];
      for (let i = 0; i < prefix; i++)
        rows.push({
          type: "same",
          text: oldLines[i],
          oldLine: i + 1,
          newLine: i + 1,
        });
      const midOld = oldLines.slice(prefix, oldEnd + 1);
      const midNew = newLines.slice(prefix, newEnd + 1);
      rows.push(...this.lcsRows(midOld, midNew, prefix, prefix));
      const suffixOldStart = oldEnd + 1;
      const suffixNewStart = newEnd + 1;
      const suffixCount = oldLines.length - suffixOldStart;
      for (let k = 0; k < suffixCount; k++) {
        rows.push({
          type: "same",
          text: oldLines[suffixOldStart + k],
          oldLine: suffixOldStart + k + 1,
          newLine: suffixNewStart + k + 1,
        });
      }
      return rows;
    },
    simpleDiff(oldText, newText) {
      const rows = this.lineDiff(oldText, newText);
      this.buildHunks(rows, { toolId: "preview" });
      return rows;
    },
    buildHunks(rows, options) {
      const list = Array.isArray(rows) ? rows : [];
      const context = Math.max(0, Math.min(Number(options?.context ?? 3), 8));
      const toolId = String(options?.toolId || "tool");
      const changes = [];
      for (let i = 0; i < list.length; i++)
        if (list[i].type !== "same") changes.push(i);
      const hunks = [];
      let cursor = 0;
      while (cursor < changes.length) {
        let start = changes[cursor];
        let end = changes[cursor];
        cursor++;
        while (
          cursor < changes.length &&
          changes[cursor] - end <= Math.max(1, context)
        ) {
          end = changes[cursor];
          cursor++;
        }
        const id = toolId + ":h" + (hunks.length + 1);
        for (let i = start; i <= end; i++) list[i].hunkId = id;
        const bodyRows = list.slice(start, end + 1);
        const oldStart = bodyRows.find((r) => r.oldLine)?.oldLine || 0;
        const newStart = bodyRows.find((r) => r.newLine)?.newLine || 0;
        const added = bodyRows.filter((r) => r.type === "add").length;
        const removed = bodyRows.filter((r) => r.type === "del").length;
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
          rows: list.slice(displayStart, displayEnd + 1),
        });
      }
      return hunks;
    },
    withHunks(oldText, newText, options) {
      const rows = this.lineDiff(oldText, newText);
      const hunks = this.buildHunks(rows, options || {});
      return {
        oldText: String(oldText || ""),
        newText: String(newText || ""),
        rows,
        hunks,
      };
    },
    hunkMap(preview) {
      const map = {};
      (preview?.hunks || []).forEach((h) => {
        map[String(h.id)] = h;
      });
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
      if (!preview || !Array.isArray(preview.rows) || !preview.rows.length)
        return String(preview?.newText || "");
      const hunks = preview.hunks || [];
      if (!hunks.length) return String(preview.newText || "");
      const byId = this.hunkMap(preview);
      const out = [];
      const rows = preview.rows;
      let i = 0;
      while (i < rows.length) {
        const row = rows[i];
        if (!row.hunkId) {
          if (row.type !== "add") out.push(row.text || "");
          i++;
          continue;
        }
        const hunkId = String(row.hunkId);
        const selected = byId[hunkId]?.selected !== false;
        const group = [];
        while (i < rows.length && String(rows[i].hunkId || "") === hunkId)
          group.push(rows[i++]);
        group.forEach((r) => {
          if (selected) {
            if (r.type !== "del") out.push(r.text || "");
          } else if (r.type !== "add") {
            out.push(r.text || "");
          }
        });
      }
      return out.join("\n");
    },
    parseUnified(patchText) {
      const lines = this.clean(patchText).split(/\r?\n/);
      const hunks = [];
      let hunk = null;
      for (const line of lines) {
        const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (m) {
          hunk = {
            oldStart: Number(m[1]),
            oldCount: Number(m[2] || 1),
            newStart: Number(m[3]),
            newCount: Number(m[4] || 1),
            lines: [],
          };
          hunks.push(hunk);
          continue;
        }
        if (!hunk) continue;
        if (/^[ +\-]/.test(line) || line === "\\ No newline at end of file")
          hunk.lines.push(line);
      }
      return hunks;
    },
    applyUnified(oldText, patchText) {
      const oldLines = String(oldText || "").split("\n");
      const hunks = this.parseUnified(patchText);
      if (!hunks.length) throw new Error("No unified diff hunks found");
      const out = [];
      let oldIndex = 0;
      for (const h of hunks) {
        const start = Math.max(0, h.oldStart - 1);
        while (oldIndex < start) out.push(oldLines[oldIndex++]);
        for (const line of h.lines) {
          if (line === "\\ No newline at end of file") continue;
          const sign = line[0];
          const body = line.slice(1);
          if (sign === " ") {
            out.push(
              oldLines[oldIndex] !== undefined ? oldLines[oldIndex] : body,
            );
            oldIndex++;
          } else if (sign === "-") {
            oldIndex++;
          } else if (sign === "+") {
            out.push(body);
          }
        }
      }
      while (oldIndex < oldLines.length) out.push(oldLines[oldIndex++]);
      return out.join("\n");
    },
    previewPatch(patchText) {
      const text = this.clean(patchText || "");
      if (!text) return [];
      const rows = [];
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (/^(---|\+\+\+|@@)/.test(line)) {
          rows.push({ type: "same", text: line });
        } else if (line.startsWith("+")) {
          rows.push({ type: "add", text: line.slice(1) });
        } else if (line.startsWith("-")) {
          rows.push({ type: "del", text: line.slice(1) });
        } else {
          rows.push({
            type: "same",
            text: line.startsWith(" ") ? line.slice(1) : line,
          });
        }
      }
      return rows;
    },
    render(rows) {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return '<div class="ace-ai-empty">No diff yet.</div>';
      return list
        .slice(0, 1400)
        .map(
          (r) =>
            '<div class="ace-ai-diff-line ace-ai-' +
            r.type +
            '"><span>' +
            (r.type === "add" ? "+" : r.type === "del" ? "-" : " ") +
            "</span><code>" +
            Util.html(r.text || "") +
            "</code></div>",
        )
        .join("");
    },
    renderHunks(hunks, toolId) {
      const list = Array.isArray(hunks) ? hunks : [];
      if (!list.length) return "";
      return (
        '<div class="ace-ai-hunks">' +
        list
          .map((h) => {
            const selected = h.selected !== false;
            const status = selected ? "included" : "skipped";
            const counts = "+" + (h.added || 0) + " −" + (h.removed || 0);
            const checked = selected ? "checked" : "";
            return `<div class="ace-ai-hunk ${selected ? "" : "rejected"}" data-hunk-card="${Util.html(h.id)}"><div class="ace-ai-hunk-head"><label class="ace-ai-hunk-toggle"><input type="checkbox" data-hunk-check="${Util.html(toolId || "")}" data-hunk-id="${Util.html(h.id)}" ${checked}><span><b>Hunk ${Util.html(h.index || "")}</b><em>${Util.html(status)} · ${Util.html(counts)} · old ${Util.html(h.oldStart || "-")} / new ${Util.html(h.newStart || "-")}</em></span></label></div><div class="ace-ai-tool-diff">${this.render(h.rows || [])}</div></div>`;
          })
          .join("") +
        "</div>"
      );
    },
  };

  // ---- core/prompt.js ----
  const Prompt = {
    extractFileMentions(text) {
      const value = String(text || "");
      const matches =
        value.match(/(^|\s)@([A-Za-z0-9_./\\:-]+\.[A-Za-z0-9_+-]+)/g) || [];
      return matches
        .map((m) => m.trim().replace(/^@/, "").replace(/^\s*@/, ""))
        .filter(Boolean)
        .slice(0, 12);
    },
    listLines(items, mapper) {
      return (items || []).map(mapper).filter(Boolean).join("\n");
    },
    isCodebaseRequest(text) {
      const value = String(text || "")
        .split(/\n\s*Permission:/i)[0]
        .toLowerCase();
      return /@codebase|\bcode\s*base\b|\bcodebase\b|\bproject\b|\bworkspace\b|\brepo(?:sitory)?\b|\bentire\s+(app|project|workspace|repo|codebase)\b|\ball\s+files?\b/i.test(
        value,
      );
    },
    contextHeader(ctx, instruction) {
      const dirty = ctx.dirty?.dirty ? "dirty/unsaved" : "saved or unknown";
      const visible = ctx.visibleRange
        ? `lines ${ctx.visibleRange.startLine}-${ctx.visibleRange.endLine}`
        : "unknown";
      const cursor = ctx.cursor
        ? `line ${ctx.cursor.line}, column ${ctx.cursor.column}`
        : "unknown";
      const open = this.listLines(
        ctx.openFiles,
        (f, i) =>
          `- ${i + 1}. ${f.filename}${f.dirty ? " (dirty)" : ""}${f.uri ? " — " + f.uri : ""}`,
      );
      const recent = this.listLines(
        ctx.recentFiles,
        (f, i) => `- ${i + 1}. ${f.filename}${f.uri ? " — " + f.uri : ""}`,
      );
      const mentions = this.extractFileMentions(instruction);
      return [
        `Active file: ${ctx.file.filename}`,
        `Active path/uri: ${ctx.file.uri || ctx.file.location || "(unknown)"}`,
        `Language: ${ctx.file.language}`,
        `Cursor: ${cursor}`,
        `Visible range: ${visible}`,
        `Unsaved state: ${dirty}`,
        `Target: ${ctx.hasSelection ? (this.isCodebaseRequest(instruction) ? "codebase/workspace; selection is context only" : "selected code") : "cursor/visible context"}`,
        open
          ? `Open files/tabs:\n${open}`
          : "Open files/tabs: active file only or unavailable",
        recent
          ? `Recently touched files:\n${recent}`
          : "Recently touched files: unavailable",
        mentions.length ? `@file mentions detected: ${mentions.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
    shouldAllowTools(kind, instruction, outputMode, ctx) {
      if (!(kind === "agent" || outputMode === "tools")) return false;
      // V8 appends internal permission policy after the user's prompt. Tool
      // gating must inspect only the human prompt; otherwise words like
      // write/edit/file in the policy accidentally enable tools for casual
      // questions such as “what can you do?”.
      const userInstruction = String(instruction || "").split(
        /\n\s*Permission:/i,
      )[0];
      const text = userInstruction.toLowerCase();
      if (!text.trim()) return false;
      if (/@codebase|@[a-z0-9_./\:-]+\.[a-z0-9_+-]+/i.test(userInstruction || ""))
        return true;
      if (
        /\b(fix|repair|bug|implement|create|write|add|modify|change|update|replace|refactor|generate|tests?|unit test|make|build|convert|rewrite|insert|append|patch)\b/i.test(
          text,
        )
      )
        return true;
      if (
        /\b(search|find|read|list|inspect|open|look through|codebase|project)\b/i.test(
          text,
        )
      )
        return true;
      // Common casual/capability questions should stay plain text. Without this
      // gate, small models often call read_file even for “what can you do?”.
      return false;
    },
    messages(kind, instruction, outputMode) {
      const settings = Store.settings();
      const ctx = Editor.context();
      const selection = Util.truncate(ctx.selection, C.MAX_SELECTION);
      const codebaseScope = this.isCodebaseRequest(instruction);
      // Avoid duplicated context on mobile: when code is selected, send the selection as the primary target.
      // Exception: project/codebase requests need broader context; in that case, the selection is just a hint.
      const fullFile =
        settings.includeFullFile && (!ctx.hasSelection || codebaseScope)
          ? Util.truncate(ctx.text, C.MAX_FULL_FILE)
          : "";
      const cursorContext = Util.truncate(
        ctx.cursorContext?.content || "",
        C.MAX_CONTEXT_WINDOW,
      );
      const visibleContext = Util.truncate(
        ctx.visibleContext?.content || "",
        C.MAX_CONTEXT_WINDOW,
      );
      const mentions = this.extractFileMentions(instruction);
      const attachments = Array.isArray(State.contextAttachments)
        ? State.contextAttachments.slice(0, 6)
        : [];
      const allowTools = this.shouldAllowTools(
        kind,
        instruction,
        outputMode,
        ctx,
      );
      let system = settings.systemPrompt || Defaults.systemPrompt;
      if (kind === "edit" || kind === "patch") {
        system +=
          " For code edits, return exactly the requested output format. Do not wrap in markdown unless asked.";
      }
      const targetText = codebaseScope
        ? "codebase/workspace (selection is context only)"
        : ctx.hasSelection
          ? "selected code"
          : settings.includeFullFile
            ? "active file"
            : "cursor and visible editor context";
      let user = "";
      user += `Mode: ${kind}\n`;
      user += `Output mode: ${outputMode}\n`;
      user += this.contextHeader(ctx, instruction) + "\n";
      user += `Target: ${targetText}\n\n`;
      user += `User instruction:\n${instruction || "(no instruction)"}\n\n`;
      if (mentions.length) {
        user +=
          "The user referenced files with @file syntax. Use read_file for those paths before making assumptions if the contents are not already in context.\n\n";
      }
      if (TerminalCapture.lastCapture().output) {
        const termCtx = TerminalCapture.contextForAgent();
        if (termCtx) user += termCtx + "\n\n";
      }
      if (attachments.length) {
        user += "Pinned context snapshots from the user:\n";
        attachments.forEach((item, index) => {
          const name =
            item.filename || item.path || "attached-file-" + (index + 1);
          const lang = item.language || Util.lang(name);
          const content = Util.truncate(item.content || "", C.MAX_CONTEXT_WINDOW);
          user +=
            "\nAttachment " +
            (index + 1) +
            ": " +
            name +
            (item.path ? " (" + item.path + ")" : "") +
            "\n```" +
            lang +
            "\n" +
            content +
            "\n```\n";
        });
        user +=
          "\nUse these pinned snapshots as trusted user-provided context. If you need fresher content, use read_file before editing.\n\n";
      }
      if (selection)
        user += `Selected code/error:\n\`\`\`${ctx.file.language}\n${selection}\n\`\`\`\n\n`;
      if ((!selection || codebaseScope) && cursorContext)
        user += `Context around cursor (${ctx.cursorContext.startLine}-${ctx.cursorContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${cursorContext}\n\`\`\`\n\n`;
      if (
        (!selection || codebaseScope) &&
        visibleContext &&
        visibleContext !== cursorContext
      )
        user += `Visible editor range (${ctx.visibleContext.startLine}-${ctx.visibleContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${visibleContext}\n\`\`\`\n\n`;
      if (fullFile)
        user += `Full active file context:\n\`\`\`${ctx.file.language}\n${fullFile}\n\`\`\`\n\n`;
      if (kind === "agent" || outputMode === "tools") {
        // Native tools are injected into the /v1/responses payload by client.js.
        // Only add a brief reminder so the model knows it should use them.
        user += [
          "You are in Ace AI Agent mode. You can answer normally in plain text, or use tools when needed.",
          "Tool flow is strict: inspect first, then propose. If you need file context, emit only read tools in that response. Do not mix read and write tools in the same response. After read outputs are returned, continue with a short analysis and then the smallest write tools needed for the change.",
          "For edit, fix, patch, refactor, create, update, or convert tasks, do not stop after reading. Once the needed context is available, continue with the smallest write tools required. Only return plain text if the user did not actually ask for a change.",
          "Available read tools: read_file, list_files, search_in_files, project_overview, open_file. Use them only when file/codebase inspection is actually needed: @file/@codebase references, imports/routes/components, project-wide behavior, or edits to files not already in context. Do not call tools for greetings, capability questions, or normal explanations that can be answered from the visible context. If a read_file/list_files/search_in_files/project_overview result returns ok:false, treat it as recoverable observation: do not hallucinate the missing file, try another search/list if useful, or ask for the correct path. search_in_files supports plain text and regex patterns; use regex only when needed (e.g. function\\s+myFunc).",
          "Available write tools: replace_selection, insert_at_cursor, replace_file, create_file, write_file, append_file, delete_file, rename_file, move_file, create_directory, insert_after_line, run_command.",
          "Rules:",
          "- The user must approve every write tool call before it is applied. Never claim write changes are already done.",
          "- Read tools are safe, but only use them when inspection/navigation is needed. Do not inspect or open files for greetings, “what can you do?”, or plain conversational answers.",
          "- If selected code exists and the user asks about the selection/current snippet, prefer replace_selection.",
          "- If the user says codebase, code base, project, workspace, repo, @codebase, or all files, treat the selection as context only. Inspect files and propose file-level edits instead of replacing just the selected fragment.",
          "- Do not use replace_file/write_file for the active filename unless the user explicitly asks for the whole/full/entire file rewrite or the task is clearly project/file-level.",
          "- If diagnosing a project, use project_overview first, then read/search/list only when needed. If you need more context, ask for it with read tools first. Do not emit write tools until the read phase is complete.",
          "- Prefer minimal diffs. Do not rewrite unrelated code.",
          "- Use create_file only for brand-new files. Use write_file/replace_file with complete content. If Project Root is unknown and you are editing the current tab, leave replace_file.path empty or use replace_selection. For new files, ask the user to set Project Root first; do not invent a relative path for an unsaved tab.",
          "- delete_file is available for real filesystem deletion. Use it only when the user explicitly asks to delete a file or folder, not to close tabs.",
          "- Use rename_file when only the filename changes (new_name = filename only, no slashes). Use move_file when the destination directory changes (new_path = full destination path). Prefer rename_file/move_file over delete+create to avoid data loss.",
          "- Use create_directory before create_file when a required folder is missing.",
          "- Use insert_after_line for small additions to existing files; combine multiple insertions for the same file/line into one tool.",
          "- Use open_file only to navigate to a file/line after read/search/list identifies it.",
          "- Use run_command only when the user asks to run/check/validate tests, lint, typecheck, format check, or syntax. It must be a safe visible-terminal command such as npm run lint, npm test, npm run check, npm run typecheck, package-manager equivalents, or node --check file.js. Never install packages, run network commands, chain shell commands, redirect output, or run destructive commands.",
          "- For discussion, capability questions, greetings, explanations, debugging, or planning with no file change needed, reply in plain text without any tool calls.",
          "- For multi-file tasks, emit one tool call per file/action.",
        ].join("\n");
      } else if (kind === "patch" || outputMode === "patch") {
        user += [
          "Return only a unified diff patch against the active file.",
          `Use headers: --- a/${ctx.file.filename} and +++ b/${ctx.file.filename}.`,
          "No markdown fences. No explanation outside the patch.",
        ].join("\n");
      } else if (outputMode === "replacement") {
        user +=
          "Return only replacement code/text. No markdown fences. No explanation.";
      } else if (outputMode === "snippet") {
        user +=
          "Return paste-ready code/snippet. Prefer concise comments only when helpful.";
      } else {
        user += "Answer clearly. Include code blocks only when useful.";
      }
      const messages = [{ role: "system", content: system }];
      let history = Store.chat().filter(
        (m) => m && (m.role === "user" || m.role === "assistant") && m.content,
      );
      const currentHistoryPrompt = String(
        State.currentHistoryPrompt || instruction || "",
      ).trim();
      if (
        history.length &&
        history[history.length - 1].role === "user" &&
        String(history[history.length - 1].content || "").trim() ===
          currentHistoryPrompt
      ) {
        history = history.slice(0, -1);
      }
      history.slice(-24).forEach((m) => {
        messages.push({ role: m.role, content: String(m.content || "") });
      });
      messages.push({ role: "user", content: user });
      return { messages, ctx, settings, allowTools };
    },
  };

  // ---- core/client.js ----
  const Client = {
    parseSseRecord(record) {
      const lines = String(record || "").split(/\r?\n/);
      const event =
        lines
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim() || "";
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      return { event, data };
    },
    deltaFromChunk(json) {
      if (!json) return "";
      const choice = json.choices && json.choices[0];
      if (!choice) return json.output_text || json.text || "";
      const delta = choice.delta || {};
      if (typeof delta.content === "string") return delta.content;
      if (Array.isArray(delta.content)) {
        return delta.content
          .map((part) => part?.text || part?.content || "")
          .join("");
      }
      if (typeof choice.text === "string") return choice.text;
      if (typeof choice.message?.content === "string")
        return choice.message.content;
      return "";
    },
    ensureNativeCall(nativeCallState, index) {
      if (!nativeCallState) return null;
      const idx = Number.isFinite(Number(index))
        ? Number(index)
        : nativeCallState.calls.length;
      if (!nativeCallState.calls[idx])
        nativeCallState.calls[idx] = {
          name: "",
          arguments: "",
          id: "",
          call_id: "",
          output_index: idx,
        };
      return nativeCallState.calls[idx];
    },
    setFlowStage(stage, detail) {
      State.flowStage = stage || "idle";
      State.flowDetail = detail || "";
    },
    responseDeltaFromChunk(json, nativeCallState) {
      if (!json) return "";
      if (json.error) throw ErrorKit.fromHttp(500, json, JSON.stringify(json));

      if (
        json.type === "response.output_item.added" &&
        json.item &&
        nativeCallState
      ) {
        const item = json.item;
        if (item.type === "function_call") {
          const idx =
            item.index != null
              ? item.index
              : json.output_index != null
                ? json.output_index
                : nativeCallState.calls.length;
          const call = this.ensureNativeCall(nativeCallState, idx);
          call.name = item.name || call.name || "";
          call.arguments = item.arguments || call.arguments || "";
          call.id = item.id || call.id || "";
          call.call_id =
            item.call_id || item.callId || call.call_id || call.id || "";
          State.toolProgress =
            "Model requested tool: " + (call.name || "function_call");
          this.setFlowStage(
            AgentTools.isReadOnlyName(call.name) ? "inspecting" : "proposing",
            call.name || "tool requested",
          );
        }
      }
      if (
        json.type === "response.function_call_arguments.delta" &&
        nativeCallState
      ) {
        const idx =
          json.output_index != null ? json.output_index : json.item_index;
        const call = this.ensureNativeCall(nativeCallState, idx);
        call.arguments += String(json.delta || "");
        if (json.call_id) call.call_id = json.call_id;
        if (json.name) call.name = json.name;
      }
      if (
        json.type === "response.function_call_arguments.done" &&
        nativeCallState
      ) {
        const idx =
          json.output_index != null ? json.output_index : json.item_index;
        const call = this.ensureNativeCall(nativeCallState, idx);
        if (json.arguments) call.arguments = json.arguments;
        if (json.name) call.name = json.name;
        if (json.call_id) call.call_id = json.call_id;
      }
      if (
        json.type === "response.output_item.done" &&
        json.item &&
        nativeCallState
      ) {
        const item = json.item;
        if (item.type === "function_call") {
          const idx =
            item.index != null
              ? item.index
              : json.output_index != null
                ? json.output_index
                : nativeCallState.calls.length;
          const call = this.ensureNativeCall(nativeCallState, idx);
          if (item.name) call.name = item.name;
          if (item.arguments) call.arguments = item.arguments;
          if (item.id) call.id = item.id;
          if (item.call_id || item.callId)
            call.call_id = item.call_id || item.callId;
          State.toolProgress =
            "Tool call ready: " + (call.name || "function_call");
          this.setFlowStage(
            AgentTools.isReadOnlyName(call.name) ? "inspecting" : "proposing",
            call.name || "tool ready",
          );
        }
      }

      if (json.usage || json.response?.usage)
        State.lastUsage = json.usage || json.response.usage;
      if (json.type === "response.completed" && json.response?.usage)
        State.lastUsage = json.response.usage;

      if (
        json.type === "response.output_text.delta" &&
        typeof json.delta === "string"
      )
        return json.delta;
      if (
        json.type === "response.refusal.delta" &&
        typeof json.delta === "string"
      )
        return json.delta;
      // For typed Responses SSE events, only delta events should append text.
      // `response.completed` may contain a full snapshot and must not be appended.
      if (json.type) return "";
      // Untyped proxy chunks may still use snapshot fields. The append layer below
      // treats cumulative snapshots as replacements/deduped content.
      if (typeof json.output_text === "string") return json.output_text;
      if (typeof json.text === "string") return json.text;
      if (Array.isArray(json.output)) {
        return json.output
          .map((item) => {
            if (typeof item.content === "string") return item.content;
            if (Array.isArray(item.content)) {
              return item.content
                .map((part) => part.text || part.content || "")
                .join("");
            }
            return "";
          })
          .join("");
      }
      return "";
    },
    latestUserInput(messages) {
      const last = (messages || [])
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      return String(last?.content || "").trim();
    },
    transcriptInput(messages, usePrevious) {
      const filtered = (messages || []).filter((m) => m.role !== "system");
      if (usePrevious) return this.latestUserInput(filtered);
      return filtered
        .map(
          (m) =>
            `${m.role === "assistant" ? "Assistant" : "User"}:\n${m.content}`,
        )
        .join("\n\n");
    },
    async fetchWithTimeout(url, payload, settings, accept, signal) {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: accept || "text/event-stream",
          Authorization: "Bearer " + settings.apiKey,
        },
        body: JSON.stringify(payload),
        signal,
      });
    },
    retryable(error) {
      const e = ErrorKit.normalize(error);
      if (e.code === "TIMEOUT") return false;
      if (e.status === 408 || e.status === 429 || e.status >= 500) return true;
      return /NETWORK_OR_CORS|SERVER_ERROR|RATE_LIMITED|REQUEST_TIMEOUT/i.test(
        e.code || "",
      );
    },
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async requestWithRetry(fn, onDelta) {
      const max = Math.max(0, Number(C.REQUEST_RETRY_COUNT || 0));
      let last = null;
      for (let attempt = 0; attempt <= max; attempt++) {
        try {
          State.retryStatus = attempt ? "Retry attempt " + attempt + "…" : "";
          if (attempt && typeof onDelta === "function")
            onDelta("", State.streamingContent || "", null);
          const result = await fn(attempt);
          State.retryStatus = "";
          return result;
        } catch (error) {
          last = ErrorKit.normalize(error);
          if (attempt >= max || !this.retryable(last)) {
            State.retryStatus = "";
            throw last;
          }
          const wait = Math.min(
            8000,
            Number(C.REQUEST_RETRY_BASE_MS || 750) * Math.pow(2, attempt),
          );
          State.retryStatus =
            "Retrying after " +
            last.code +
            " in " +
            Math.round(wait / 100) / 10 +
            "s…";
          if (typeof onDelta === "function")
            onDelta("", State.streamingContent || "", null);
          await this.sleep(wait);
        }
      }
      throw last;
    },
    appendStreamText(current, incoming) {
      const content = String(current || "");
      const delta = String(incoming || "");
      if (!delta) return { content, changed: false, delta: "" };
      // Some Responses-compatible proxies emit cumulative snapshots (`output_text`)
      // in addition to delta events. Treat a full snapshot as replacement, not as
      // another delta, otherwise the final assistant card shows duplicated text.
      if (content && delta === content)
        return { content, changed: false, delta: "" };
      if (content && delta.startsWith(content)) {
        return {
          content: delta,
          changed: delta !== content,
          delta: delta.slice(content.length),
        };
      }
      if (content && content.endsWith(delta))
        return { content, changed: false, delta: "" };
      const maxOverlap = Math.min(content.length, delta.length, 512);
      for (let size = maxOverlap; size > 20; size--) {
        if (content.slice(-size) === delta.slice(0, size)) {
          const extra = delta.slice(size);
          const next = Util.normalizeModelText(content + extra);
          return {
            content: next,
            changed: next !== content,
            delta: next.startsWith(content) ? next.slice(content.length) : extra,
          };
        }
      }
      const merged = content + delta;
      const normalized = Util.normalizeModelText(merged);
      return {
        content: normalized,
        changed: normalized !== content,
        delta: normalized.startsWith(content)
          ? normalized.slice(content.length)
          : delta,
      };
    },
    async readSse(res, built, onDelta, mode, nativeCallState) {
      if (!res.ok) {
        let raw = "";
        try {
          raw = await res.text();
        } catch (_) {}
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (_) {}
        throw ErrorKit.fromHttp(res.status, data, raw);
      }
      if (!res.body || typeof res.body.getReader !== "function") {
        throw ErrorKit.create({
          code: "STREAM_UNSUPPORTED",
          title: "Streaming is not supported in this WebView",
          message:
            "Response.body.getReader() is unavailable, so Ace AI cannot read streaming SSE.",
          hint: "Update Android System WebView/Acode, or use a proxy that converts the stream into events supported by the WebView.",
        });
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let content = "";
      let doneSignal = false;
      let responseId = "";
      let usage = null;
      const handleJson = (json) => {
        if (!json) return;
        const id = json.id || json.response?.id || json.item?.id;
        if (id && String(id).startsWith("resp")) responseId = String(id);
        if (json.type === "response.completed" && json.response?.id)
          responseId = String(json.response.id);
        if (json.usage || json.response?.usage)
          usage = json.usage || json.response.usage;
        const delta =
          mode === "responses"
            ? this.responseDeltaFromChunk(json, nativeCallState)
            : this.deltaFromChunk(json);
        if (delta) {
          const appended = this.appendStreamText(content, delta);
          if (appended.changed) {
            content = appended.content;
            if (typeof onDelta === "function")
              onDelta(appended.delta, content, built.ctx);
          }
        }
      };
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        const records = buffer.split(/\r?\n\r?\n/);
        buffer = records.pop() || "";
        for (const record of records) {
          const parsed = this.parseSseRecord(record);
          const data = parsed.data;
          if (!data) continue;
          if (data === "[DONE]") {
            doneSignal = true;
            continue;
          }
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (parseError) {
            throw ErrorKit.create({
              code: "INVALID_STREAM_CHUNK",
              title: "Invalid streaming chunk",
              message: "The server sent stream data that is not valid JSON.",
              hint: "Check the Base URL or proxy. The streaming endpoint must be OpenAI-compatible SSE.",
              details: data.slice(0, 1200),
              cause: parseError,
            });
          }
          handleJson(json);
        }
      }
      const tail = this.parseSseRecord(buffer).data;
      if (tail && tail !== "[DONE]") {
        try {
          handleJson(JSON.parse(tail));
        } catch (_) {}
      }
      if (
        !content &&
        !(nativeCallState && nativeCallState.calls.filter(Boolean).length)
      ) {
        throw ErrorKit.create({
          code: "EMPTY_STREAM_RESPONSE",
          title: "Stream finished with no content",
          message: doneSignal
            ? "The server sent [DONE] without content."
            : "The server closed the stream without content.",
          hint: "Try another model, check max tokens, or copy the error report.",
        });
      }
      return { content, responseId, usage };
    },
    responseInputItems(built, previousId) {
      const messages = (built.messages || []).filter((m) => m.role !== "system");
      const clean = messages
        .map((m) => ({ role: m.role, content: String(m.content || "") }))
        .filter((m) => m.content.trim());
      if (previousId) {
        const latest = clean
          .slice()
          .reverse()
          .find((m) => m.role === "user");
        return latest ? [{ role: "user", content: latest.content }] : [];
      }
      return clean;
    },
    functionOutputsInput(toolResults) {
      return (toolResults || []).map((item) => ({
        type: "function_call_output",
        call_id: item.call_id,
        output: item.output,
      }));
    },
    async streamResponses(baseUrl, built, settings, onDelta, signal, options) {
      const opts = options || {};
      const responseState = Store.responseState();
      const previousId =
        opts.previousResponseId ||
        (opts.ignorePrevious ? "" : responseState.lastResponseId || "");
      const system =
        built.messages.find((m) => m.role === "system")?.content || "";
      const input = opts.toolOutputs
        ? this.functionOutputsInput(opts.toolOutputs)
        : opts.inputOverride || this.responseInputItems(built, previousId);
      const isAgentMode =
        (built.kind === "agent" || built.outputMode === "tools") &&
        built.allowTools !== false;
      const payload = {
        model: settings.model || C.DEFAULT_MODEL,
        input,
        instructions: system,
        temperature: Number(settings.temperature || 0.2),
        max_output_tokens: Number(settings.maxTokens || 3200),
        stream: true,
        store: true,
      };
      if (previousId) payload.previous_response_id = previousId;
      let nativeCallState = null;
      if (isAgentMode) {
        payload.tools = AgentTools.nativeSchema();
        payload.tool_choice = "auto";
        nativeCallState = { calls: [] };
        this.setFlowStage("drafting", "Request sent to model");
      }
      const run = async () => {
        const res = await this.fetchWithTimeout(
          baseUrl + "/responses",
          payload,
          settings,
          "text/event-stream",
          signal,
        );
        return await this.readSse(
          res,
          built,
          onDelta,
          "responses",
          nativeCallState,
        );
      };
      const out = await this.requestWithRetry(run, onDelta);
      if (out.responseId)
        Store.saveResponseState({
          lastResponseId: out.responseId,
          mode: built.kind || "",
        });
      if (out.usage) State.lastUsage = out.usage;
      const result = {
        content: out.content,
        ctx: built.ctx,
        endpoint: "/v1/responses",
        responseId: out.responseId || previousId,
        usage: out.usage || null,
      };
      if (nativeCallState && nativeCallState.calls.filter(Boolean).length) {
        result.nativeCalls = nativeCallState.calls.filter(Boolean);
      }
      return result;
    },
    splitNativeCalls(calls) {
      const read = [];
      const write = [];
      (calls || []).forEach((call) => {
        const name = String(call?.name || "").trim();
        if (AgentTools.isReadOnlyName(name)) read.push(call);
        else if (AgentTools.isWriteName(name)) write.push(call);
      });
      return { read, write };
    },
    nativeCallKey(call) {
      return [
        String(call?.name || "").trim(),
        String(call?.arguments || "").trim(),
      ].join("\u0000");
    },
    mergeNativeCalls() {
      const merged = [];
      const seen = new Set();
      Array.prototype.slice.call(arguments).forEach((group) => {
        (group || []).forEach((call) => {
          if (!call || !String(call.name || "").trim()) return;
          const key = this.nativeCallKey(call);
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(call);
        });
      });
      return merged;
    },
    async completeWithReadTools(
      baseUrl,
      built,
      settings,
      onDelta,
      signal,
      initialOptions,
    ) {
      let result = null;
      let options = initialOptions || {};
      const maxRounds = C.MAX_READ_TOOL_ROUNDS;
      const collectedReadResults = [];
      const deferredWriteCalls = [];
      for (let round = 0; round < maxRounds; round++) {
        result = await this.streamResponses(
          baseUrl,
          built,
          settings,
          onDelta,
          signal,
          options,
        );
        const calls = result.nativeCalls || [];
        const split = this.splitNativeCalls(calls);
        if (!split.read.length) {
          const nativeCalls = this.mergeNativeCalls(deferredWriteCalls, calls);
          if (nativeCalls.length) result.nativeCalls = nativeCalls;
          if (split.write.length || deferredWriteCalls.length)
            this.setFlowStage(
              "proposing",
              `${nativeCalls.length} write proposal(s) ready`,
            );
          if (deferredWriteCalls.length && split.write.length) {
            State.reviewNotice =
              "Ace AI kept write proposals from earlier inspect rounds and merged them with the final response.";
          } else if (deferredWriteCalls.length && !split.write.length) {
            State.reviewNotice =
              "Ace AI recovered write proposals that were emitted before read-tool outputs returned.";
          }
          if (collectedReadResults.length)
            result.readToolResults = collectedReadResults.slice();
          return result;
        }

        if (split.write.length) deferredWriteCalls.push(...split.write);

        // Important: read/search/list tools are an observation step. Even if the
        // model emitted write calls in the same response, do not expose those writes
        // yet because the model has not seen the read outputs. Feed the observation
        // back first, including failures such as file-not-found, then let the model
        // continue with better context or ask the user.
        const uniqueReadCalls = AgentTools.uniqueReadCalls(split.read);
        const hiddenDraft = Util.normalizeModelText(result.content || "");
        if (hiddenDraft) State.suppressedToolDraft = hiddenDraft;
        State.streamingContent = "";
        State.suppressStreamingPreview = true;
        this.setFlowStage(
          "inspecting",
          uniqueReadCalls.map((c) => c.name).join(", ") || "reading",
        );
        State.toolProgress =
          uniqueReadCalls.map((c) => c.name).join(", ") || "reading";
        State.toolActivity = AgentTools.readActivityFromCalls(
          uniqueReadCalls,
          "running",
        );
        if (typeof onDelta === "function") onDelta("", "", built.ctx);
        const outputs = await AgentTools.runReadCalls(uniqueReadCalls);
        collectedReadResults.push(...outputs);
        const activityByKey = new Map();
        State.readToolResults = collectedReadResults.map((item) => {
          let parsed = null;
          try {
            parsed = JSON.parse(item.output || "{}");
          } catch (_) {}
          const path = parsed?.path || parsed?.query || parsed?.root || "";
          const row = {
            ok: item.ok,
            tool: item.name,
            path,
            count: parsed?.count || parsed?.line_count || 0,
            result: String(item.output || "").slice(0, 800),
          };
          const group =
            item.name === "read_file"
              ? "reading"
              : item.name === "list_files"
                ? "listing"
                : item.name === "search_in_files"
                  ? "searching"
                  : item.name === "project_overview"
                    ? "diagnosing"
                    : item.name === "open_file"
                      ? "opening"
                      : "using tools";
          const target =
            path || parsed?.fullPath || parsed?.tool || item.name || "tool";
          const key = group + ":" + target;
          if (!activityByKey.has(key))
            activityByKey.set(key, {
              group,
              tool: item.name,
              target,
              count: parsed?.count || parsed?.line_count || 0,
              status: item.ok ? "done" : "failed",
            });
          return row;
        });
        State.toolActivity = Array.from(activityByKey.values());
        State.streamingContent = "";
        if (typeof onDelta === "function") onDelta("", "", built.ctx);
        if (!result.responseId) {
          result.nativeCalls = this.mergeNativeCalls(deferredWriteCalls);
          result.readToolResults = collectedReadResults.slice();
          this.setFlowStage("proposing", "Read round complete");
          return result;
        }
        options = { previousResponseId: result.responseId, toolOutputs: outputs };
        State.suppressStreamingPreview = false;
        State.streamingContent = "";
        this.setFlowStage("proposing", "Read outputs returned to model");
      }
      State.toolProgress = "";
      if (result) {
        result.readToolResults = collectedReadResults.slice();
        result.nativeCalls = this.mergeNativeCalls(
          deferredWriteCalls,
          result.nativeCalls || [],
        );
      }
      this.setFlowStage("proposing", "Reached tool round limit");
      return result;
    },
    async streamComplete(kind, instruction, outputMode, onDelta) {
      const built = Prompt.messages(kind, instruction, outputMode);
      built.kind = kind;
      built.outputMode = outputMode;
      const settings = built.settings;
      if (!settings.apiKey) {
        throw ErrorKit.create({
          code: "MISSING_API_KEY",
          title: "API key is missing",
          message: "NAI API Key is empty.",
          hint: "Open Ace AI Settings and enter the API key.",
        });
      }

      const baseUrl = Util.baseUrl(settings.baseUrl);
      if (!/^https?:\/\//i.test(baseUrl)) {
        throw ErrorKit.create({
          code: "INVALID_BASE_URL",
          title: "Invalid Base URL",
          message: "The Base URL must start with http:// or https://",
          hint: "Default: https://api.neosantara.xyz/v1",
        });
      }

      let controller = null;
      let timer = null;
      State.toolProgress = "";
      State.toolActivity = [];
      State.retryStatus = "";
      State.cancelRequested = false;
      this.setFlowStage(
        "drafting",
        kind === "agent" ? "Agent request started" : "Request started",
      );
      try {
        if (typeof AbortController !== "undefined") {
          controller = new AbortController();
          State._abortController = controller;
          timer = setTimeout(() => controller.abort(), C.REQUEST_TIMEOUT_MS);
        }
        let result;
        try {
          result = await this.completeWithReadTools(
            baseUrl,
            built,
            settings,
            onDelta,
            controller ? controller.signal : undefined,
          );
        } catch (error) {
          const normalized = ErrorKit.normalize(error);
          const msg = String(normalized.message || normalized.details || "");
          const stalePrevious =
            normalized.status === 404 ||
            /previous_response_id|response.*not.*found|No response found|invalid.*response/i.test(
              msg,
            );
          if (!stalePrevious) throw normalized;
          Store.clearResponseState();
          result = await this.completeWithReadTools(
            baseUrl,
            built,
            settings,
            onDelta,
            controller ? controller.signal : undefined,
            { ignorePrevious: true },
          );
          result.recoveredConversation = true;
        }
        if (Store.settings().autoStripFence)
          result.content = Util.stripFence(result.content);
        if (result.nativeCalls && result.nativeCalls.length) {
          result.nativeToolResults = AgentTools.parseNativeCalls(
            result.nativeCalls,
          ).filter((tool) => AgentTools.isWriteName(tool.name));
          if (result.nativeToolResults.length)
            this.setFlowStage(
              "proposing",
              `${result.nativeToolResults.length} write proposal(s) ready`,
            );
        }
        if (!result.nativeToolResults?.length && !result.nativeCalls?.length)
          this.setFlowStage("done", "No tools requested");
        return result;
      } catch (error) {
        this.setFlowStage(
          "error",
          ErrorKit.normalize(error).title || "Request failed",
        );
        throw ErrorKit.normalize(error);
      } finally {
        State.toolProgress = "";
        State.toolActivity = [];
        State.retryStatus = "";
        State.suppressStreamingPreview = false;
        State.suppressedToolDraft = "";
        State._abortController = null;
        if (timer) clearTimeout(timer);
      }
    },
  };

  // ---- agent/tools.js ----
  const AgentTools = {
    writeNames: [
      "replace_selection",
      "insert_at_cursor",
      "replace_file",
      "create_file",
      "write_file",
      "append_file",
      "delete_file",
      "rename_file",
      "move_file",
      "create_directory",
      "insert_after_line",
      "run_command",
    ],
    readNames: [
      "read_file",
      "list_files",
      "search_in_files",
      "project_overview",
      "open_file",
    ],
    names: [
      "replace_selection",
      "insert_at_cursor",
      "replace_file",
      "create_file",
      "write_file",
      "append_file",
      "delete_file",
      "rename_file",
      "move_file",
      "create_directory",
      "insert_after_line",
      "run_command",
      "read_file",
      "list_files",
      "search_in_files",
      "project_overview",
      "open_file",
    ],
    // Native function definitions for /v1/responses "tools" parameter.
    // Each entry maps 1-to-1 with the existing tool names so parse/normalize/run work unchanged.
    nativeSchema() {
      const pathProp = {
        type: "string",
        description: "File path (relative to Project Root, or absolute).",
      };
      const contentProp = {
        type: "string",
        description: "Complete file or snippet content.",
      };
      return [
        {
          type: "function",
          name: "replace_selection",
          description:
            "Replace the currently selected code in the active Acode editor tab. Use when the user has a selection and the change is local to that selection.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Complete replacement text for the selected code.",
              },
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "insert_at_cursor",
          description:
            "Insert text at the current cursor position in the active editor. Use for small insertions when nothing is selected.",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Text to insert at the cursor.",
              },
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "replace_file",
          description:
            "Replace the complete content of an existing file, or of the active editor when path is empty. Always send the full file content.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description:
                  "Path to the target file. Leave empty to replace the active editor tab.",
              }),
              content: contentProp,
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "create_file",
          description:
            "Create a brand-new file. Fails if the file already exists. Relative paths require Project Root so the file is persisted to storage.",
          parameters: {
            type: "object",
            properties: { path: pathProp, content: contentProp },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "write_file",
          description:
            "Overwrite an existing file with complete new content. Requires the file to already exist.",
          parameters: {
            type: "object",
            properties: { path: pathProp, content: contentProp },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "append_file",
          description:
            "Append content to the end of an existing file without touching the rest.",
          parameters: {
            type: "object",
            properties: {
              path: pathProp,
              content: { type: "string", description: "Content to append." },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "delete_file",
          description:
            "Delete a file or directory from the workspace using Acode filesystem deletion. Use only for real storage deletion, not for closing an editor tab.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description:
                  "Path to delete. Leave empty only when the active editor is a real saved file path.",
              }),
            },
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "rename_file",
          description:
            "Rename a file within the same folder. Use when only the file name changes, not its directory. Prefer this over delete+create to avoid data loss.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description: "Current file path.",
              }),
              new_name: {
                type: "string",
                description:
                  "New file name only (no directory, no slashes), e.g. index.js → app.js.",
              },
            },
            required: ["path", "new_name"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "move_file",
          description:
            "Move a file to a different folder (optionally renaming it). Use when the destination directory changes. Prefer this over delete+create to avoid data loss.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description: "Current file path.",
              }),
              new_path: {
                type: "string",
                description:
                  "Full destination path including filename, relative to Project Root or absolute.",
              },
            },
            required: ["path", "new_path"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "read_file",
          description:
            "Read a file from the workspace. Leave path empty to read the active editor. Use optional 1-based line bounds for focused reads. If the file is missing, the tool returns an ok:false observation; continue by searching/listing or asking the user instead of guessing.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description: "File path. Leave empty for the active editor.",
              }),
              start_line: {
                type: "number",
                description: "Optional 1-based start line.",
              },
              end_line: {
                type: "number",
                description: "Optional 1-based end line.",
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "list_files",
          description:
            "List files under the Project Root or a folder. Use before multi-file edits when project structure is unknown.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.",
              },
              max_depth: {
                type: "number",
                description: "Optional recursion depth, default 2.",
              },
              glob: {
                type: "string",
                description:
                  "Optional simple extension/glob hint, e.g. *.js or src/*.ts.",
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "search_in_files",
          description:
            "Search text across files in the workspace. Use for @codebase-like lookup before changing related code.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Text or regex-like literal to search for.",
              },
              path: {
                type: "string",
                description:
                  "Folder path relative to Project Root, or absolute. Empty means Project Root/active folder.",
              },
              max_results: {
                type: "number",
                description: "Maximum result matches, default 30.",
              },
              include_glob: {
                type: "string",
                description: "Optional extension/glob hint such as *.js.",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "project_overview",
          description:
            "Inspect project metadata and summarize likely framework, package scripts, config files, and safe validation commands. Prefer this for Diagnose Project before editing or running commands.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Optional project/folder path relative to Project Root or absolute. Empty means Project Root/active folder.",
              },
              max_depth: {
                type: "number",
                description:
                  "Optional recursion depth for config discovery, default 3.",
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "open_file",
          description:
            "Open a file in Acode and optionally jump to a 1-based line/column. Use for navigation after search/read results, not for editing.",
          parameters: {
            type: "object",
            properties: {
              path: pathProp,
              line: {
                type: "integer",
                description: "Optional 1-based line number to jump to.",
              },
              column: {
                type: "integer",
                description: "Optional 1-based column number to jump to.",
              },
            },
            required: ["path"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "run_command",
          description:
            "Request a safe visible terminal command such as npm run lint, npm test, npm run check, or node --check file.js. The user must approve it in Review before it runs.",
          parameters: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description:
                  "Command to run in a visible Acode terminal. Must match Ace AI's safe allowlist.",
              },
              cwd: {
                type: "string",
                description:
                  "Optional working directory hint. Ace AI does not cd silently; include only for display/context.",
              },
            },
            required: ["command"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "create_directory",
          description:
            "Create a new directory (folder) in the workspace. Fails if the directory already exists. Use before create_file when the target folder is not yet present.",
          parameters: {
            type: "object",
            properties: {
              path: Object.assign({}, pathProp, {
                description:
                  "Path of the new directory to create (relative to Project Root, or absolute).",
              }),
            },
            required: ["path"],
            additionalProperties: false,
          },
        },
        {
          type: "function",
          name: "insert_after_line",
          description:
            "Insert text after a specific line number in an existing file. More surgical than replace_file — use when you only need to add lines without touching the rest. Line numbers are 1-based; use line 0 to insert before the first line.",
          parameters: {
            type: "object",
            properties: {
              path: pathProp,
              line: {
                type: "integer",
                description:
                  "Insert after this line number (1-based). Use 0 to insert at the very beginning of the file.",
              },
              content: {
                type: "string",
                description:
                  "Text to insert. A newline is added automatically after the target line.",
              },
            },
            required: ["path", "line", "content"],
            additionalProperties: false,
          },
        },
      ];
    },
    // Parse native function_call items collected from a /v1/responses stream.
    // Each item looks like: { name, arguments } where arguments is a JSON string.
    parseNativeCalls(calls) {
      const tools = [];
      (calls || []).forEach((call, index) => {
        const name = String(call.name || "").trim();
        if (!this.names.includes(name)) return;
        let args = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch (_) {}
        if (args && typeof args === "object") {
          tools.push(this.normalize({ id: index + 1, name, args }));
        }
      });
      return tools;
    },
    exampleValueForSchemaProp(name, prop) {
      const key = String(name || "");
      const description = String(prop?.description || "").toLowerCase();
      if (/content|snippet|text|code/.test(key + " " + description))
        return "complete content";
      if (/query|pattern/.test(key + " " + description)) return "text to find";
      if (/command|cmd/.test(key + " " + description)) return "npm run lint";
      if (/new_name|filename/.test(key + " " + description)) return "new-name.js";
      if (/new_path|destination/.test(key + " " + description))
        return "destination/path/file.js";
      if (/path|file|folder|directory/.test(key + " " + description))
        return "relative/or/absolute/path";
      if (/line|depth|result|column/.test(key + " " + description)) return 1;
      if (prop?.type === "boolean") return true;
      if (prop?.type === "number" || prop?.type === "integer") return 1;
      return "value";
    },
    schemaTextExamples() {
      return this.nativeSchema()
        .filter((item) => item?.type === "function" && item.name)
        .map((item) => {
          const props = item.parameters?.properties || {};
          const required = Array.isArray(item.parameters?.required)
            ? item.parameters.required
            : [];
          const keys = required.length
            ? required
            : Object.keys(props).slice(0, 2);
          const args = {};
          keys.forEach((key) => {
            args[key] = this.exampleValueForSchemaProp(key, props[key]);
          });
          return "    " + JSON.stringify({ name: item.name, args });
        });
    },
    schemaText() {
      const examples = this.schemaTextExamples();
      return [
        "You are in Ace AI Agent mode. You may answer in normal plain text for discussion, explanations, debugging, and planning.",
        "Only return JSON when you need to propose reviewable file/editor tools. If no tools are needed, return plain text.",
        "When returning tool calls, return JSON only, no markdown fences, with this shape:",
        "Every write/edit/create operation MUST be represented as a pending tool call. Nothing is applied automatically.",
        "{",
        '  "message": "short plan and summary for the user",',
        '  "tools": [',
        examples.join(",\n"),
        "  ]",
        "}",
        "Rules:",
        "- The user must approve tools after seeing diffs. Do not say changes are applied.",
        "- If selected code exists and the user asks about that snippet/current code, prefer replace_selection.",
        "- If the user says codebase/code base/project/workspace/repo/@codebase/all files, the selection is context only; inspect files and use file-level tools instead of replacing just the selection.",
        "- Do not call replace_file/write_file for the active filename unless the user explicitly asked to rewrite the whole file or the task is clearly file/project-level.",
        "- Use create_file only for brand-new files. If the file may exist, use write_file and include complete content.",
        "- Use project_overview for Diagnose Project. Use read_file/list_files/search_in_files before editing files that are not already included in context. If a read tool returns ok:false, continue safely by trying another read/search/list or ask the user; never invent file contents.",
        "- Use open_file only to navigate to an existing/read/search/project_overview result. It is not an edit tool.",
        "- Use write_file/replace_file only with complete file content, not partial fragments.",
        "- delete_file is supported for real filesystem deletion. Do not use it to close tabs; use it only when the user asks to delete a file or directory.",
        "- Use rename_file to rename within the same folder (new_name = filename only, no slashes). Use move_file to move to a different folder. Prefer rename_file/move_file over delete+create to avoid data loss.",
        "- Use create_directory to create a new folder before creating files inside it when the folder does not exist yet.",
        "- Use insert_after_line for adding imports, functions, or blocks to an existing file without replacing the whole content. Prefer it over replace_file/write_file for small insertions.",
        "- Use run_command only when the user asks to run/check/validate tests, lint, typecheck, format check, or syntax. It must be a safe visible-terminal command and the user still approves it in Review.",
        "- Never invent chmod, destructive terminal, package install, network, or background tools.",
        "- Keep paths relative to the active file folder or Project Root when possible.",
        "- If the active Acode tab is unsaved or Project Root is unknown, do NOT create a file with the active filename. Use replace_selection for local edits or replace_file with an empty path to replace the active editor content.",
        "- For tests for selected code: in Agent mode, answer normally unless the user clearly wants the editor/file changed. If Project Root is unknown, update the active editor/selection instead of creating a separate relative file.",
        "- For multi-file tasks, provide one tool per file/action.",
      ].join("\n");
    },
    cleanJson(raw) {
      let text = Util.stripFence(raw || "").trim();
      if (text.startsWith("```")) text = Util.stripFence(text);
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first >= 0 && last > first) text = text.slice(first, last + 1);
      return text.trim();
    },
    parse(raw) {
      const original = String(raw || "").trim();
      const source = this.cleanJson(original);
      let data = null;
      try {
        data = JSON.parse(source);
      } catch (error) {
        return { message: original, tools: [], raw: original };
      }
      const hasToolShape =
        data &&
        typeof data === "object" &&
        (Object.prototype.hasOwnProperty.call(data, "tools") ||
          Object.prototype.hasOwnProperty.call(data, "tool_calls") ||
          Object.prototype.hasOwnProperty.call(data, "actions"));
      if (!hasToolShape) return { message: original, tools: [], raw: original };
      let tools = data.tools || data.tool_calls || data.actions || [];
      if (!Array.isArray(tools)) tools = [];
      tools = tools
        .map((tool, index) => {
          const name = String(tool.name || tool.tool || tool.type || "").trim();
          const args = tool.args || tool.arguments || tool.input || {};
          return this.normalize({
            id: index + 1,
            name,
            args: args && typeof args === "object" ? args : {},
          });
        })
        .filter((tool) => this.writeNames.includes(tool.name));
      const message = String(data.message || data.summary || "").trim();
      if (!tools.length && !message)
        return { message: original, tools: [], raw: original };
      return { message, tools, raw: source };
    },
    normalize(tool) {
      const args = tool.args || {};
      const content = Util.unhtml(args.content ?? args.text ?? args.code ?? "");
      const path = String(args.path || args.file || args.filename || "").trim();
      const query = String(args.query || args.pattern || "").trim();
      const startLine =
        Number(args.start_line || args.startLine || args.line_start || 0) || 0;
      const endLine =
        Number(args.end_line || args.endLine || args.line_end || 0) || 0;
      const maxDepth = Number(args.max_depth || args.maxDepth || 0) || 0;
      const maxResults = Number(args.max_results || args.maxResults || 0) || 0;
      const glob = String(
        args.glob || args.include_glob || args.includeGlob || "",
      ).trim();
      const newName = String(args.new_name || args.newName || "").trim();
      const newPath = String(
        args.new_path || args.newPath || args.destination || args.dest || "",
      ).trim();
      const command = String(args.command || args.cmd || "").trim();
      const cwd = String(
        args.cwd || args.working_directory || args.workingDirectory || "",
      ).trim();
      const openLine =
        Number(args.line || args.target_line || args.start_line || 0) || 0;
      const openColumn = Number(args.column || args.col || 1) || 1;
      const insertAfterLine =
        Number(args.line ?? args.insert_after_line ?? args.after_line ?? -1) >= 0
          ? Number(args.line ?? args.insert_after_line ?? args.after_line)
          : -1;
      return Object.assign({}, tool, {
        path,
        content,
        query,
        startLine,
        endLine,
        maxDepth,
        maxResults,
        glob,
        newName,
        newPath,
        command,
        cwd,
        openLine,
        openColumn,
        insertAfterLine,
        safeCommand: "",
        title: this.titleFor(tool.name, path || query),
        preview: null,
        warning: "",
        error: "",
        selected: true,
        appliesTo:
          path ||
          (tool.name.includes("selection")
            ? "selection"
            : tool.name.includes("cursor")
              ? "cursor"
              : tool.name.includes("search")
                ? "workspace search"
                : "active file"),
      });
    },
    titleFor(name, path) {
      const target = path ? " " + path : "";
      const map = {
        replace_selection: "Replace selection",
        insert_at_cursor: "Insert at cursor",
        replace_file: "Replace file",
        create_file: "Create file",
        write_file: "Write file",
        append_file: "Append file",
        delete_file: "Delete file/folder",
        rename_file: "Rename file",
        move_file: "Move file",
        create_directory: "Create folder",
        insert_after_line: "Insert after line",
        read_file: "Read file",
        list_files: "List files",
        search_in_files: "Search files",
        open_file: "Open file",
        project_overview: "Inspect project",
        run_command: "Run command",
      };
      return (map[name] || "Run tool") + target;
    },
    safeCommand(command) {
      const cmd = String(command || "").trim();
      if (!cmd) return "";
      // Terminal tools must stay single-line and visible. Block shell control
      // chars, escaping, redirects, environment expansion, and package/network/
      // destructive commands before checking the allowlist.
      if (/[\r\n\\;&|`$<>]/.test(cmd)) return "";
      if (
        /\b(rm|sudo|su|chmod|chown|mkfs|dd|shutdown|reboot|curl|wget|nc|ssh|scp|apk|apt|pip|npm\s+install|pnpm\s+add|yarn\s+add|bun\s+add)\b/i.test(
          cmd,
        )
      )
        return "";
      const safePath = "[A-Za-z0-9_./:@+\\-=]+";
      const allowed = [
        /^npm\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
        /^pnpm\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
        /^yarn\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
        /^bun\s+(run\s+)?(lint|test|check|format:check|typecheck)$/i,
        new RegExp("^node\\s+--check\\s+" + safePath + "$", "i"),
        new RegExp("^node\\s+-c\\s+" + safePath + "$", "i"),
      ];
      return allowed.some((re) => re.test(cmd)) ? cmd : "";
    },
    fsFactory() {
      const fs = Acode.require("fs") || Acode.require("fsOperation");
      if (typeof fs !== "function") {
        throw ErrorKit.create({
          code: "FS_UNAVAILABLE",
          title: "Acode fs API is unavailable",
          message:
            'File create/write requires acode.require("fs") or fsOperation.',
          hint: "Editor-only tools like replace_selection and insert_at_cursor can still be used.",
        });
      }
      return fs;
    },
    isAbsolutePath(path) {
      const value = String(path || "").trim();
      return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/");
    },
    sanitizeProjectRoot(value) {
      return String(value || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/\/+$/, "");
    },
    baseDir() {
      const configured = this.sanitizeProjectRoot(
        Store.settings().projectRoot || "",
      );
      if (configured) return configured;
      const info = Editor.info();
      let base = String(info.location || info.uri || "")
        .trim()
        .replace(/\\/g, "/");
      if (!base) return "";
      // Acode can report an unsaved tab URI as just `file.js`. That is not a
      // writable project root. Only trust absolute URLs/paths as storage roots.
      if (!this.isAbsolutePath(base)) return "";
      const clean = base.replace(/[?#].*$/, "").replace(/\/+$/, "");
      if (!clean) return "";
      if (/\.[a-z0-9]+$/i.test(clean))
        return clean.replace(/\/[^/]*$/, "").replace(/\/+$/, "");
      return clean;
    },
    activeFilenameMatches(path) {
      const value = String(path || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (!value || value.includes("/")) return false;
      const active = String(Editor.info().filename || "").trim();
      return Boolean(active && active !== "untitled" && value === active);
    },
    canUseActiveEditorFallback(path) {
      // Mobile-friendly fallback: when the current Acode tab is new/unsaved, an AI model
      // often proposes create_file/write_file/replace_file with the active filename.
      // Treat that as an active-editor operation so the user is not forced to configure
      // Project Root just to edit the current tab.
      return !this.baseDir() && this.activeFilenameMatches(path);
    },
    canUseActiveDeleteFallback(path) {
      return (
        !this.baseDir() &&
        this.activeFilenameMatches(path) &&
        this.isAbsolutePath(this.activePath())
      );
    },
    isCodebaseRequest(text) {
      const prompt = String(text || "")
        .split(/\n\s*Permission:/i)[0]
        .toLowerCase();
      return /@codebase|\bcode\s*base\b|\bcodebase\b|\bproject\b|\bworkspace\b|\brepo(?:sitory)?\b|\bentire\s+(app|project|workspace|repo|codebase)\b|\ball\s+files?\b/i.test(
        prompt,
      );
    },
    shouldPreferSelectionEdit() {
      const snap = State.lastSelectionSnapshot;
      if (!snap || !String(snap.text || "").trim()) return false;
      const prompt = String(State.lastRequest?.prompt || "");
      if (this.isCodebaseRequest(prompt)) return false;
      return !/(whole|entire|full)\s+(file|document)|replace\s+(the\s+)?file|rewrite\s+(the\s+)?file|overwrite\s+(the\s+)?file/i.test(
        prompt,
      );
    },
    convertToSelectionReplacement(tool, reason) {
      const snap = State.lastSelectionSnapshot || {};
      tool.name = "replace_selection";
      tool.path = "";
      tool.appliesTo = "selection";
      tool.title = "AI wants to replace selected code";
      tool.warning =
        reason ||
        "Converted to selection edit because code is selected. Clear the selection if you want a whole-file rewrite.";
      tool.selectionSnapshot = {
        text: snap.text || Editor.selectedText(),
        range: snap.range || Editor.selectionRange(),
        fileKey:
          snap.fileKey || Editor.info().uri || Editor.info().filename || "",
        snapshotFileKey: snap.fileKey || "",
        filename: snap.filename || Editor.info().filename || "",
        fromSnapshot: Boolean(snap.text),
      };
      return tool;
    },
    convertToActiveEditorReplacement(tool, reason) {
      tool.name = "replace_file";
      tool.path = "";
      tool.appliesTo = "active file";
      tool.title = "AI wants to update the active editor";
      tool.warning =
        reason ||
        "Project Root is not available, so this will update the current Acode tab instead of creating a separate file.";
      return tool;
    },
    previewSelectionReplacement(tool, content, reason) {
      this.convertToSelectionReplacement(tool, reason);
      const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
      tool.preview = this.makePreview(oldText, content, "selection", tool.id);
      return tool;
    },
    previewActiveEditorReplacement(tool, content, reason) {
      this.convertToActiveEditorReplacement(tool, reason);
      tool.preview = this.makePreview(
        Editor.text(),
        content,
        "active file",
        tool.id,
      );
      return tool;
    },
    async prepareFilePreview(tool, mode) {
      const content = tool.content;
      const isCreate = mode === "create_file";
      if (!tool.path) tool.error = mode + ".path is empty";
      if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
        if (this.shouldPreferSelectionEdit())
          return this.previewSelectionReplacement(
            tool,
            content,
            "Converted to selected-code edit because text is selected and the target matches the active tab.",
          );
        return this.previewActiveEditorReplacement(
          tool,
          content,
          isCreate
            ? "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of creating a new file."
            : "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead of writing a project file.",
        );
      }
      const noRootRelative =
        isCreate &&
        tool.path &&
        this.isRelativePath(tool.path) &&
        !this.baseDir();
      if (noRootRelative) {
        tool.error = this.noProjectRootCreateError(tool.path);
        tool.appliesTo = "blocked new file: " + tool.path;
        tool.preview = this.makePreview("", content, tool.appliesTo, tool.id);
        return tool;
      }
      const pathError = tool.path ? this.relativePathError(tool.path) : "";
      if (pathError) tool.error = pathError;
      const snap =
        tool.path && !pathError
          ? await this.fileSnapshot(tool.path)
          : { exists: false, content: "" };
      if (isCreate && snap.exists)
        tool.error =
          "File already exists. create_file is blocked to avoid overwriting: " +
          tool.path;
      if (!isCreate && !snap.exists && !tool.error)
        tool.warning =
          "File does not exist yet — write_file will create it (same as create_file).";
      tool.preview = this.makePreview(
        snap.content || "",
        content,
        snap.full || tool.path || (isCreate ? "new file" : "file"),
        tool.id,
      );
      return tool;
    },
    relativePathError(path) {
      const value = String(path || "").trim();
      if (!value || this.isAbsolutePath(value)) return "";
      if (this.baseDir()) return "";
      return this.noProjectRootCreateError(value);
    },
    noProjectRootCreateError(path) {
      const value = String(path || "").trim() || "new file";
      return (
        "Project Root is unavailable for the relative path: " +
        value +
        ". Ace AI will not create a temporary unsaved Acode tab because that tab is not persisted and may disappear or load forever after Acode reload. Set Project Root in Settings or open a saved file/folder first, then retry."
      );
    },
    resolvePath(path) {
      const value = String(path || "").trim();
      if (!value)
        return String(Editor.info().uri || Editor.info().location || "").trim();
      if (this.isAbsolutePath(value)) return value;
      const base = this.baseDir();
      return base ? base + "/" + value.replace(/^\/+/, "") : value;
    },
    splitPath(fullPath) {
      const path = String(fullPath || "").replace(/\/+$/, "");
      const idx = path.lastIndexOf("/");
      if (idx < 0) return { dir: this.baseDir(), name: path };
      if (idx === 0) return { dir: "/", name: path.slice(1) };
      return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
    },
    activePath() {
      const info = Editor.info();
      return String(info.uri || info.location || info.filename || "").trim();
    },
    isRelativePath(path) {
      const value = String(path || "").trim();
      return Boolean(value && !this.isAbsolutePath(value));
    },
    toTextContent(value) {
      if (value == null) return "";
      if (typeof value === "string") return value;
      try {
        if (value instanceof ArrayBuffer)
          return new TextDecoder("utf-8").decode(value);
        if (ArrayBuffer.isView(value))
          return new TextDecoder("utf-8").decode(value);
      } catch (_) {}
      return String(value || "");
    },
    async fileSnapshot(path) {
      const requested = String(path || "").trim();
      if (requested && !this.baseDir() && this.activeFilenameMatches(requested)) {
        return {
          full: this.activePath() || requested,
          exists: true,
          content: Editor.text(),
          active: true,
          stat: null,
        };
      }
      const full = this.resolvePath(path);
      if (!full)
        return { full, exists: false, content: "", error: "Path is empty" };
      try {
        const fs = this.fsFactory();
        const file = await fs(full);
        let exists = true;
        if (typeof file.exists === "function") exists = await file.exists();
        if (!exists) return { full, exists: false, content: "" };
        let stat = null;
        if (typeof file.stat === "function") {
          try {
            stat = await file.stat();
          } catch (_) {}
          if (stat && stat.isDirectory)
            return {
              full,
              exists: true,
              isDirectory: true,
              content: "",
              stat,
              error: "The path is a folder, not a file",
            };
        }
        if (typeof file.readFile !== "function")
          return {
            full,
            exists: true,
            content: "",
            stat,
            error: "Acode fs.readFile is unavailable for this path",
          };
        let content = "";
        try {
          content = await file.readFile("utf-8");
        } catch (_) {
          content = await file.readFile();
        }
        return { full, exists: true, content: this.toTextContent(content), stat };
      } catch (error) {
        return {
          full,
          exists: false,
          content: "",
          error: error.message || String(error),
        };
      }
    },
    async snapshotForDelete(path) {
      const requested = String(path || "").trim();
      const full = this.canUseActiveDeleteFallback(requested)
        ? this.activePath()
        : this.resolvePath(path);
      if (!full)
        return { full, exists: false, content: "", error: "Path is empty" };
      try {
        const fs = this.fsFactory();
        const file = await fs(full);
        let exists = true;
        if (typeof file.exists === "function") exists = await file.exists();
        if (!exists) return { full, exists: false, content: "" };
        let stat = null;
        if (typeof file.stat === "function") {
          try {
            stat = await file.stat();
          } catch (_) {}
        }
        if (stat && stat.isDirectory) {
          const entries = await this.readDirectoryEntries(full).catch(() => []);
          const children = [];
          for (const entry of entries || []) {
            const item = this.normalizeDirEntry(entry, full);
            if (!item || !item.path) continue;
            children.push(await this.snapshotForDelete(item.path));
          }
          return { full, exists: true, isDirectory: true, stat, children };
        }
        let content = "";
        if (typeof file.readFile === "function") {
          try {
            content = await file.readFile("utf-8");
          } catch (_) {
            content = await file.readFile();
          }
        }
        return {
          full,
          exists: true,
          isDirectory: false,
          content: this.toTextContent(content),
          stat,
        };
      } catch (error) {
        return {
          full,
          exists: false,
          content: "",
          error: error.message || String(error),
        };
      }
    },
    snapshotTreeLines(snapshot, indent = "") {
      if (!snapshot) return [];
      const name =
        Util.filenameFromPath(snapshot.full) ||
        String(snapshot.full || "").trim() ||
        "target";
      if (!snapshot.isDirectory) {
        const size = snapshot.content
          ? " (" + snapshot.content.length + " chars)"
          : "";
        return [indent + name + size];
      }
      const lines = [indent + name + "/"];
      (snapshot.children || []).forEach((child) => {
        lines.push(...this.snapshotTreeLines(child, indent + "  "));
      });
      return lines;
    },
    async deleteFsEntry(fullPath) {
      const fs = this.fsFactory();
      const file = await fs(fullPath);
      const methods = ["delete", "remove", "deleteFile", "rm", "unlink"];
      let lastError = null;
      for (const method of methods) {
        if (typeof file[method] !== "function") continue;
        try {
          await file[method]();
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(
        "Acode fs delete API is unavailable for: " +
          fullPath +
          (lastError
            ? " (" + (lastError.message || String(lastError)) + ")"
            : ""),
      );
    },
    async restoreSnapshot(snapshot) {
      if (!snapshot || !snapshot.exists) return;
      const fs = this.fsFactory();
      const full = String(snapshot.full || "").trim();
      if (!full) throw new Error("Restore path is empty");
      if (snapshot.isDirectory) {
        const parts = this.splitPath(full);
        if (parts.dir && parts.name) {
          const parent = await fs(parts.dir);
          if (typeof parent.createDirectory !== "function")
            throw new Error(
              "Acode fs.createDirectory is unavailable for: " + parts.dir,
            );
          try {
            await parent.createDirectory(parts.name);
          } catch (_) {}
        }
        for (const child of snapshot.children || []) {
          await this.restoreSnapshot(child);
        }
        return;
      }
      const parts = this.splitPath(full);
      if (!parts.name) throw new Error("Restore file name is empty: " + full);
      if (!parts.dir)
        throw new Error("Restore folder is unavailable for: " + full);
      const dir = await fs(parts.dir);
      if (typeof dir.createFile !== "function")
        throw new Error(
          "Acode fs.createFile is unavailable for restore: " + parts.dir,
        );
      await dir.createFile(parts.name, snapshot.content || "");
    },
    isWriteName(name) {
      return this.writeNames.includes(String(name || "").trim());
    },
    makePreview(oldText, newText, target, toolId) {
      const preview = Patch.withHunks(oldText, newText, {
        toolId: toolId || "tool",
      });
      preview.target = target || preview.target || "";
      return preview;
    },
    toolHasSelectedHunks(tool) {
      if (!tool || tool.error || tool.selected === false) return false;
      return Patch.hasSelectedHunks(tool.preview);
    },
    hunkSummary(tool) {
      const hunks = tool?.preview?.hunks || [];
      if (!hunks.length) return "";
      const selected = hunks.filter((h) => h.selected !== false).length;
      return selected + "/" + hunks.length + " hunks accepted";
    },
    setHunkSelection(toolId, hunkId, selected) {
      const tool = (State.pendingTools || []).find(
        (item) => String(item.id) === String(toolId),
      );
      if (!tool) return false;
      const hunk = (tool.preview?.hunks || []).find(
        (item) => String(item.id) === String(hunkId),
      );
      if (!hunk) return false;
      hunk.selected = Boolean(selected);
      const any = (tool.preview?.hunks || []).some(
        (item) => item.selected !== false,
      );
      tool.selected = any;
      return true;
    },
    setAllHunks(toolId, selected) {
      const tool = (State.pendingTools || []).find(
        (item) => String(item.id) === String(toolId),
      );
      if (!tool || !tool.preview?.hunks?.length) return false;
      tool.preview.hunks.forEach((hunk) => {
        hunk.selected = Boolean(selected);
      });
      tool.selected = Boolean(selected);
      return true;
    },
    effectiveContent(tool) {
      if (tool?.preview?.hunks?.length)
        return Patch.applySelectedHunks(tool.preview);
      return String(tool?.content ?? "");
    },
    targetKey(tool) {
      const name = String(tool?.name || "").trim();
      if (name === "replace_selection") return "__selection__";
      if (name === "insert_at_cursor") return "__cursor__";
      if (name === "run_command")
        return "__command__:" + String(tool?.command || "").trim();
      return String(tool?.path || "").trim() || "__active_editor__";
    },
    markUnsafeToolBatch(tools) {
      const byTarget = new Map();
      (tools || []).forEach((tool) => {
        const key = this.targetKey(tool);
        if (!byTarget.has(key)) byTarget.set(key, []);
        byTarget.get(key).push(tool);
      });
      byTarget.forEach((items, key) => {
        if (items.length < 2) return;
        const fullWrites = items.filter((tool) =>
          [
            "replace_file",
            "write_file",
            "create_file",
            "delete_file",
            "replace_selection",
            "insert_at_cursor",
          ].includes(tool.name),
        );
        const surgical = items.filter((tool) =>
          ["append_file", "insert_after_line"].includes(tool.name),
        );
        if (fullWrites.length > 1) {
          fullWrites.slice(0, -1).forEach((tool) => {
            tool.error =
              "Multiple full-target edits point at the same target. Keep only the final consolidated edit before applying.";
            tool.selected = false;
          });
        }
        const sameLineInserts = new Set();
        items.forEach((tool) => {
          if (tool.name !== "insert_after_line") return;
          const lineKey = `${key}:${tool.insertAfterLine}`;
          if (sameLineInserts.has(lineKey)) {
            tool.error =
              "Multiple insert_after_line tools target the same file and line. Combine them into one insertion before applying.";
            tool.selected = false;
          }
          sameLineInserts.add(lineKey);
        });
        if (!fullWrites.length || !surgical.length) return;
        surgical.forEach((tool) => {
          tool.error =
            "This operation conflicts with another selected full-target edit for the same target. Combine the changes into one tool before applying.";
          tool.selected = false;
        });
      });
      return tools;
    },
    sanitizeWriteTools(tools) {
      const normalized = (tools || [])
        .map((raw, index) =>
          this.normalize(Object.assign({ id: index + 1 }, raw || {})),
        )
        .filter((tool) => this.isWriteName(tool.name));
      const exactSeen = new Set();
      const exactDeduped = [];
      for (const tool of normalized) {
        const exactKey = [
          tool.name,
          String(tool.path || ""),
          String(tool.content || ""),
        ].join("\u0000");
        if (exactSeen.has(exactKey)) continue;
        exactSeen.add(exactKey);
        exactDeduped.push(tool);
      }
      // A sequence of full-file rewrites for the same target is unsafe: applying
      // more than one would let the later rewrite erase the previous one. Keep the
      // model's last proposal for that target, similar to how IDE agents consolidate
      // pending file writes into one review card per file.
      const lastByTarget = new Map();
      exactDeduped.forEach((tool, index) => {
        if (
          ["replace_file", "write_file", "create_file", "delete_file"].includes(
            tool.name,
          )
        ) {
          const target = (tool.path || "").trim() || "__active_editor__";
          lastByTarget.set(target, index);
        }
      });
      const consolidated = exactDeduped
        .filter((tool, index) => {
          if (
            ![
              "replace_file",
              "write_file",
              "create_file",
              "delete_file",
            ].includes(tool.name)
          )
            return true;
          const target = (tool.path || "").trim() || "__active_editor__";
          return lastByTarget.get(target) === index;
        })
        .sort((a, b) => {
          if (a.name === "insert_after_line" && b.name === "insert_after_line") {
            const pathCompare = String(a.path || "").localeCompare(
              String(b.path || ""),
            );
            if (pathCompare) return pathCompare;
            return (
              Number(b.insertAfterLine || 0) - Number(a.insertAfterLine || 0)
            );
          }
          return 0;
        })
        .map((tool, index) => Object.assign(tool, { id: index + 1 }));
      return this.markUnsafeToolBatch(consolidated);
    },
    async preparePreviews(tools) {
      const sanitized = this.sanitizeWriteTools(tools);
      const prepared = await Promise.all(
        sanitized.map(async (tool) => {
          try {
            await this.preparePreview(tool);
          } catch (error) {
            tool.error = error.message || String(error);
          }
          tool.selected = !tool.error;
          return tool;
        }),
      );
      return prepared;
    },
    async preparePreview(tool) {
      const content = tool.content;
      if (
        !content &&
        ![
          "insert_at_cursor",
          "delete_file",
          "create_directory",
          "run_command",
        ].includes(tool.name)
      )
        tool.warning = "Content is empty; this tool is probably not useful.";
      if (tool.name === "replace_selection") {
        const liveText = Editor.selectedText();
        const snapshot = State.lastSelectionSnapshot || null;
        const oldText = liveText || snapshot?.text || "";
        if (!oldText)
          tool.error =
            "There is no active selection. Select code first or ask the agent to use replace_file/write_file.";
        tool.selectionSnapshot = {
          text: oldText,
          range: liveText ? Editor.selectionRange() : snapshot?.range || null,
          fileKey: Editor.info().uri || Editor.info().filename || "",
          snapshotFileKey: snapshot?.fileKey || "",
          filename: Editor.info().filename || snapshot?.filename || "",
          fromSnapshot: !liveText && Boolean(snapshot?.text),
        };
        const target =
          "selection" + (snapshot?.line ? " around line " + snapshot.line : "");
        tool.preview = this.makePreview(oldText, content, target, tool.id);
        return tool;
      }
      if (tool.name === "insert_at_cursor") {
        tool.preview = this.makePreview("", content, "cursor", tool.id);
        return tool;
      }
      if (tool.name === "run_command") {
        const cmd = this.safeCommand(tool.command);
        tool.safeCommand = cmd;
        if (!cmd)
          tool.error =
            "Command blocked by Ace AI safety policy: " +
            (tool.command || "(empty)");
        tool.command = cmd || tool.command;
        tool.appliesTo = "terminal: " + (tool.command || "command");
        tool.warning =
          "This command will run only after approval and will be typed into a visible Acode terminal.";
        tool.preview = this.makePreview(
          "",
          tool.command || "(blocked command)",
          tool.appliesTo,
          tool.id,
        );
        return tool;
      }
      if (tool.name === "replace_file") {
        if (tool.path && this.canUseActiveEditorFallback(tool.path)) {
          if (this.shouldPreferSelectionEdit()) {
            this.convertToSelectionReplacement(
              tool,
              "Converted to selected-code edit because text is selected and the target matches the active tab.",
            );
            const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
            tool.preview = this.makePreview(
              oldText,
              content,
              "selection",
              tool.id,
            );
            return tool;
          }
          this.convertToActiveEditorReplacement(
            tool,
            "No Project Root detected. Because the target matches the active tab name, Ace AI will update the active editor instead.",
          );
          const oldText = Editor.text();
          tool.preview = this.makePreview(
            oldText,
            content,
            "active file",
            tool.id,
          );
          return tool;
        }
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        if (!tool.path) {
          if (this.shouldPreferSelectionEdit()) {
            this.convertToSelectionReplacement(
              tool,
              "Converted to selected-code edit because code is selected. Clear the selection to rewrite the whole active file.",
            );
            const oldText = tool.selectionSnapshot?.text || Editor.selectedText();
            tool.preview = this.makePreview(
              oldText,
              content,
              "selection",
              tool.id,
            );
            return tool;
          }
          const oldText = Editor.text();
          tool.preview = this.makePreview(
            oldText,
            content,
            "active file",
            tool.id,
          );
          return tool;
        }
        const snap = await this.fileSnapshot(tool.path);
        if (!snap.exists)
          tool.error = "Target file not found for replace_file: " + tool.path;
        tool.preview = this.makePreview(
          snap.content,
          content,
          snap.full,
          tool.id,
        );
        return tool;
      }
      if (tool.name === "create_file")
        return await this.prepareFilePreview(tool, "create_file");
      if (tool.name === "write_file")
        return await this.prepareFilePreview(tool, "write_file");
      if (tool.name === "rename_file") {
        if (!tool.path) tool.error = "rename_file.path is empty";
        if (!tool.newName) tool.error = "rename_file.new_name is empty";
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        const snap =
          tool.path && !pathError
            ? await this.fileSnapshot(tool.path)
            : { exists: false, content: "" };
        if (!snap.exists && !tool.error)
          tool.error = "File not found for rename_file: " + tool.path;
        const oldName = Util.filenameFromPath(tool.path || "");
        tool.preview = this.makePreview(
          oldName,
          tool.newName,
          snap.full || tool.path,
          tool.id,
        );
        tool.appliesTo = tool.path + " → " + tool.newName;
        return tool;
      }
      if (tool.name === "move_file") {
        if (!tool.path) tool.error = "move_file.path is empty";
        if (!tool.newPath) tool.error = "move_file.new_path is empty";
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        const snap =
          tool.path && !pathError
            ? await this.fileSnapshot(tool.path)
            : { exists: false, content: "" };
        if (!snap.exists && !tool.error)
          tool.error = "File not found for move_file: " + tool.path;
        tool.preview = this.makePreview(
          tool.path,
          tool.newPath,
          snap.full || tool.path,
          tool.id,
        );
        tool.appliesTo = tool.path + " → " + tool.newPath;
        return tool;
      }
      if (tool.name === "append_file") {
        if (!tool.path) tool.error = "append_file.path is empty";
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        const snap =
          tool.path && !pathError
            ? await this.fileSnapshot(tool.path)
            : { exists: false, content: "" };
        if (!snap.exists)
          tool.error = "append_file requires an existing file: " + tool.path;
        const oldText = snap.content || "";
        const newText = oldText + content;
        tool.preview = this.makePreview(
          oldText,
          newText,
          snap.full || tool.path,
          tool.id,
        );
        return tool;
      }
      if (tool.name === "delete_file") {
        const targetPath = tool.path
          ? String(tool.path || "").trim()
          : this.activePath();
        if (!targetPath) {
          tool.error = "delete_file.path is empty";
          tool.appliesTo = "delete target";
          tool.preview = this.makePreview("", "", "delete target", tool.id);
          return tool;
        }
        const pathError =
          targetPath && !this.canUseActiveDeleteFallback(targetPath)
            ? this.relativePathError(targetPath)
            : "";
        if (pathError) tool.error = pathError;
        const snap =
          targetPath && !pathError
            ? await this.snapshotForDelete(targetPath)
            : { exists: false, content: "", full: targetPath };
        tool.deleteSnapshot = snap;
        if (!snap.exists)
          tool.error =
            "Target file or folder not found for delete_file: " + targetPath;
        const oldText = snap.isDirectory
          ? this.snapshotTreeLines(snap).join("\n")
          : String(snap.content || "");
        const target = snap.full || targetPath || "target";
        tool.preview = this.makePreview(oldText, "", target, tool.id);
        if (snap.isDirectory)
          tool.warning =
            "This delete removes a folder tree recursively. Undo will try to restore files and folders, but external changes after deletion may not be recoverable.";
        tool.appliesTo = snap.isDirectory ? "folder: " + target : target;
        return tool;
      }
      if (tool.name === "create_directory") {
        if (!tool.path) tool.error = "create_directory.path is empty";
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        if (!tool.error) {
          const snap = await this.fileSnapshot(tool.path);
          if (snap.exists) tool.error = "Directory already exists: " + tool.path;
        }
        tool.appliesTo = "new directory: " + (tool.path || "?");
        tool.preview = this.makePreview(
          "",
          "(empty directory)",
          tool.path || "new directory",
          tool.id,
        );
        return tool;
      }
      if (tool.name === "insert_after_line") {
        if (!tool.path) tool.error = "insert_after_line.path is empty";
        if (tool.insertAfterLine < 0)
          tool.error = "insert_after_line.line must be >= 0";
        const pathError = tool.path ? this.relativePathError(tool.path) : "";
        if (pathError) tool.error = pathError;
        const snap =
          tool.path && !pathError
            ? await this.fileSnapshot(tool.path)
            : { exists: false, content: "" };
        if (!snap.exists && !tool.error)
          tool.error = "File not found: " + tool.path;
        if (!tool.error) {
          const lines = String(snap.content || "").split("\n");
          const at = Math.max(0, Math.min(tool.insertAfterLine, lines.length));
          const newLines = lines.slice();
          const insertedLines = String(tool.content || "")
            .replace(/\r\n/g, "\n")
            .split("\n");
          newLines.splice(at, 0, ...insertedLines);
          tool.preview = this.makePreview(
            snap.content || "",
            newLines.join("\n"),
            snap.full || tool.path,
            tool.id,
          );
        } else {
          tool.preview = this.makePreview(
            "",
            tool.content,
            tool.path || "file",
            tool.id,
          );
        }
        tool.appliesTo = snap.full || tool.path || "file";
        return tool;
      }
      tool.error = "Unsupported tool: " + tool.name;
      return tool;
    },
    iconFor(name) {
      if (name === "create_file") return "＋";
      if (name === "append_file") return "↧";
      if (name === "delete_file") return "✕";
      if (name === "rename_file") return "✎";
      if (name === "move_file") return "→";
      if (name === "create_directory") return "＋";
      if (name === "insert_after_line") return "↓";
      if (name === "replace_selection") return "▣";
      if (name === "insert_at_cursor") return "＋";
      if (name === "read_file") return "◉";
      if (name === "list_files") return "☰";
      if (name === "search_in_files") return "⌕";
      if (name === "open_file") return "↗";
      if (name === "run_command") return "⌘";
      return "◆";
    },
    targetOf(tool) {
      return tool.preview?.target || tool.path || tool.appliesTo || "active file";
    },
    selectedTools() {
      return State.pendingTools.filter((tool) => this.toolHasSelectedHunks(tool));
    },
    operationKind(tool) {
      const name = String(tool?.name || "");
      if (name === "append_file") return "append only";
      if (name === "replace_selection") return "edit selection";
      if (name === "insert_at_cursor") return "insert at cursor";
      if (name === "replace_file" || name === "write_file")
        return tool?.path ? "replace file" : "replace active tab";
      if (name === "create_file") return "create file";
      if (name === "delete_file") return "delete";
      if (name === "rename_file") return "rename file";
      if (name === "move_file") return "move file";
      if (name === "create_directory") return "create directory";
      if (name === "insert_after_line") return "insert after line";
      if (name === "run_command") return "run command";
      return name || "change";
    },
    renderFileTree(options) {
      if (!State.pendingTools.length) return "";
      const showActions = !options || options.actions !== false;
      const rows = State.pendingTools
        .map((tool) => {
          const checked = tool.selected !== false && !tool.error ? "checked" : "";
          const disabled = tool.error ? "disabled" : "";
          const hunkText = this.hunkSummary(tool);
          const status = tool.error
            ? "blocked"
            : tool.selected === false
              ? "skipped"
              : hunkText || "selected";
          const target = this.targetOf(tool);
          const icon = this.iconFor(tool.name);
          return `<label class="ace-ai-tree-row ${tool.error ? "blocked" : ""}"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}><span class="ace-ai-tree-icon">${Util.html(icon)}</span><span class="ace-ai-tree-path">${Util.html(target)}</span><span class="ace-ai-tree-status">${Util.html(status)}</span></label>`;
        })
        .join("");
      const selected = this.selectedTools().length;
      const total = State.pendingTools.length;
      const actions = showActions
        ? '<div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-act="select-all-tools">Select all</button><button class="ace-ai-btn" data-act="select-no-tools">None</button></div>'
        : "";
      return `<div class="ace-ai-card ace-ai-tree"><div class="ace-ai-row" style="justify-content:space-between"><div><div class="ace-ai-label">Proposed file tree</div><div class="ace-ai-mini">${selected}/${total} selected · review before applying</div></div>${actions}</div><div class="ace-ai-tree-list">${rows}</div></div>`;
    },
    renderList(options) {
      if (!State.pendingTools.length) {
        return '<div class="ace-ai-empty">No pending changes yet.</div>';
      }
      const embedded = Boolean(options && options.embedded);
      const total = State.pendingTools.length;
      const selected = this.selectedTools().length;
      const rows = State.pendingTools
        .map((tool) => {
          const error = tool.error
            ? `<div class="ace-ai-tool-error">${Util.html(tool.error)}</div>`
            : "";
          const warning = tool.warning
            ? `<div class="ace-ai-tool-warn">${Util.html(tool.warning)}</div>`
            : "";
          const target = this.targetOf(tool);
          const rows = tool.preview?.rows || [];
          const hunks = tool.preview?.hunks || [];
          const hunkText = this.hunkSummary(tool);
          const diff = hunks.length
            ? Patch.renderHunks(hunks, tool.id)
            : rows.length
              ? `<div class="ace-ai-tool-diff">${Patch.render(rows)}</div>`
              : `<pre>${Util.html((tool.content || "").slice(0, 1600))}</pre>`;
          const checked = tool.selected !== false && !tool.error ? "checked" : "";
          const disabled = tool.error ? "disabled" : "";
          const icon = this.iconFor(tool.name);
          const kind = this.operationKind(tool);
          const state = tool.error
            ? "blocked"
            : tool.selected === false
              ? "skipped"
              : "ready";
          const open =
            State.reviewToolId && String(State.reviewToolId) === String(tool.id)
              ? " open"
              : "";
          const modeNote =
            tool.name === "append_file"
              ? "Append only: adds text at the end."
              : tool.name === "replace_selection"
                ? "Edit selection: replaces the captured selected range only."
                : tool.name === "replace_file" || tool.name === "write_file"
                  ? "Replace: overwrites the previewed target with the new content."
                  : kind;
          return `<details class="ace-ai-tool ace-ai-tool-slim ${tool.error ? "blocked" : ""}" data-tool-card="${tool.id}"${open}><summary class="ace-ai-tool-summary"><span class="ace-ai-disclosure" aria-hidden="true"></span><label class="ace-ai-tool-check" onclick="event.stopPropagation()"><input type="checkbox" data-tool-check="${tool.id}" ${checked} ${disabled}></label><span class="ace-ai-tree-icon">${Util.html(icon)}</span><span class="ace-ai-tool-main"><b>${Util.html(target)}</b><small>${Util.html(kind)}${hunkText ? " · " + Util.html(hunkText) : ""}</small></span><span class="ace-ai-tool-state ${state}">${Util.html(state)}</span></summary>${error}${warning}<div class="ace-ai-mini ace-ai-apply-note">${Util.html(modeNote)}</div>${diff}</details>`;
        })
        .join("");
      if (embedded) return `<div class="ace-ai-review-list">${rows}</div>`;
      return `<div class="ace-ai-card ace-ai-review-simple"><div class="ace-ai-row" style="justify-content:space-between;align-items:flex-start"><div><div class="ace-ai-label">Review changes</div><div class="ace-ai-mini">${selected}/${total} selected · tap a row to expand diff</div></div><div class="ace-ai-row nowrap"><button class="ace-ai-btn" data-act="select-all-tools">All</button><button class="ace-ai-btn" data-act="select-no-tools">None</button></div></div><div class="ace-ai-tree-list compact">${rows}</div></div>`;
    },
    async makeUndoRecord(tool) {
      const path = String(tool.path || "").trim();
      const record = {
        id: tool.id,
        name: tool.name,
        path,
        type: "editor",
        existed: true,
        oldText: "",
        target: this.targetOf(tool),
        time: new Date().toISOString(),
      };
      if (
        tool.name === "create_file" &&
        path &&
        this.isRelativePath(path) &&
        !this.baseDir()
      ) {
        record.type = "notice";
        record.existed = false;
        record.note = this.noProjectRootCreateError(path);
        return record;
      }
      if (tool.name === "run_command") {
        record.type = "notice";
        record.existed = false;
        record.note =
          "Terminal command was run in a visible Acode terminal; undo is not automatic.";
        return record;
      }
      if (tool.name === "delete_file") {
        const targetPath = path || this.activePath();
        const snap =
          tool.deleteSnapshot || (await this.snapshotForDelete(targetPath));
        record.type = "delete_file";
        record.fullPath = snap.full || this.resolvePath(targetPath);
        record.existed = Boolean(snap.exists);
        record.wasDirectory = Boolean(snap.isDirectory);
        record.snapshot = snap;
        record.oldText = snap.isDirectory
          ? this.snapshotTreeLines(snap).join("\n")
          : String(snap.content || "");
        return record;
      }
      if (
        tool.name === "replace_selection" ||
        tool.name === "insert_at_cursor" ||
        (tool.name === "replace_file" && !path)
      ) {
        record.type = "editor";
        record.oldText = Editor.text();
        return record;
      }
      if (path) {
        const snap = await this.fileSnapshot(path);
        record.type = "file";
        record.fullPath = snap.full || this.resolvePath(path);
        record.existed = Boolean(snap.exists);
        record.oldText = String(snap.content || "");
        return record;
      }
      return record;
    },
    async restoreRecord(record) {
      if (record.type === "notice")
        return record.note || "Nothing to undo automatically for this operation";
      if (record.type === "editor") {
        if (!Editor.replaceAll(record.oldText || ""))
          throw new Error("Undo editor change failed");
        return "Restored editor";
      }
      if (record.type === "delete_file") {
        const snapshot = record.snapshot || {
          full: record.fullPath,
          exists: true,
          isDirectory: Boolean(record.wasDirectory),
          content: record.oldText || "",
          children: [],
        };
        if (!snapshot.full) throw new Error("Undo path is empty");
        await this.restoreSnapshot(snapshot);
        return snapshot.isDirectory
          ? "Restored deleted folder"
          : "Restored deleted file";
      }
      const path = record.fullPath || record.path;
      if (!path) throw new Error("Undo path is empty");
      if (!record.existed) {
        try {
          await this.deleteFsEntry(path);
          return "Deleted created file";
        } catch (_) {}
        try {
          await this.writeFile(path, "", false, { requireExists: false });
          return "Cleared created file";
        } catch (error) {
          throw new Error(
            "Undo create_file failed; delete manually: " + (record.path || path),
          );
        }
      }
      await this.writeFile(path, record.oldText || "", false, {
        requireExists: false,
      });
      return "Restored " + (record.path || path);
    },
    async undoLast() {
      const batch = State.undoStack.pop();
      if (!batch || !batch.records || !batch.records.length)
        return Acode.toast("No undo batch");
      const results = [];
      for (const record of batch.records.slice().reverse()) {
        try {
          results.push({ ok: true, result: await this.restoreRecord(record) });
        } catch (error) {
          results.push({ ok: false, result: error.message || String(error) });
        }
      }
      State.toolResults = results.map((r) => ({
        ok: r.ok,
        tool: "undo",
        result: r.result,
      }));
      State.lastAppliedSummary =
        "Undo attempted for " + batch.records.length + " operation(s).";
      return results;
    },
    async run(tool) {
      if (tool.error) throw new Error(tool.error);
      const content = this.effectiveContent(tool);
      const path = String(tool.path || "").trim();
      if (tool.name === "replace_selection") {
        if (!content) throw new Error("replace_selection.content is empty");
        const snapshot =
          tool.selectionSnapshot || State.lastSelectionSnapshot || null;
        const live = Editor.selectedText();
        const expected = String(snapshot?.text || "");
        const info = Editor.info();
        const currentFileKey = String(info.uri || info.filename || "").trim();
        const snapshotKey = String(
          snapshot?.snapshotFileKey || snapshot?.fileKey || "",
        ).trim();
        if (snapshotKey && currentFileKey && snapshotKey !== currentFileKey) {
          throw new Error(
            "Active file changed since selection preview. Re-run Agent on the correct tab.",
          );
        }
        if (
          !snapshotKey &&
          snapshot?.filename &&
          info.filename &&
          snapshot.filename !== info.filename
        ) {
          throw new Error(
            "Active file changed since selection preview. Re-run Agent on the correct tab.",
          );
        }
        if (live) {
          if (!expected || live === expected || live.trim() === expected.trim()) {
            if (!Editor.replaceSelection(content))
              throw new Error("Replace selection failed");
            return live === expected
              ? "Selection replaced"
              : "Current selection replaced after whitespace-only drift";
          }
          throw new Error(
            "Current selected text no longer matches the reviewed preview. Re-run Agent before applying.",
          );
        }
        if (snapshot?.range && expected) {
          const text = Editor.text();
          const range = Editor.normalizeRange(snapshot.range);
          const slice = range ? text.slice(range.from, range.to) : "";
          if (range && (slice === expected || slice.trim() === expected.trim())) {
            if (!Editor.replaceRange(range, content))
              throw new Error("Replace selection range failed");
            return "Selection range replaced";
          }
          const first = text.indexOf(expected);
          const last = text.lastIndexOf(expected);
          if (first >= 0 && first === last) {
            if (
              !Editor.replaceRange(
                { from: first, to: first + expected.length },
                content,
              )
            )
              throw new Error("Replace matched preview text failed");
            return "Matched original selection text and replaced it";
          }
          const loose = expected.trim();
          if (loose && loose.length > 16) {
            const looseFirst = text.indexOf(loose);
            const looseLast = text.lastIndexOf(loose);
            if (looseFirst >= 0 && looseFirst === looseLast) {
              if (
                !Editor.replaceRange(
                  { from: looseFirst, to: looseFirst + loose.length },
                  content,
                )
              )
                throw new Error("Replace loosely matched preview text failed");
              return "Loosely matched original selection text and replaced it";
            }
          }
        }
        throw new Error(
          "Original selected text no longer matches the preview. Re-run Agent before applying.",
        );
      }
      if (tool.name === "insert_at_cursor") {
        if (!Editor.insertAtCursor(content))
          throw new Error("Insert at cursor failed");
        return "Inserted at cursor";
      }
      if (tool.name === "run_command") {
        const cmd = tool.safeCommand || this.safeCommand(tool.command);
        if (!cmd)
          throw new Error(
            "Command blocked by Ace AI safety policy: " +
              (tool.command || "(empty)"),
          );
        const ok = await Acode.confirm(
          "Run command in Acode terminal?",
          cmd + "\n\nThe command will be typed into a visible terminal tab.",
        );
        if (!ok) throw new Error("Command cancelled by user");
        await Acode.runVisibleTerminal(cmd, { name: "Ace AI Run" });
        State.terminalHistory.unshift({
          command: cmd,
          time: new Date().toISOString(),
        });
        State.terminalHistory = State.terminalHistory.slice(0, 10);
        return "Sent command to visible terminal: " + cmd;
      }
      if (tool.name === "replace_file") {
        if (!path) {
          if (!Editor.replaceAll(content))
            throw new Error("Replace active file failed");
          return "Active file replaced";
        }
        return await this.writeFile(path, content, false, {
          requireExists: true,
        });
      }
      if (tool.name === "write_file")
        return await this.writeFile(path, content, false, {
          requireExists: false,
        });
      if (tool.name === "append_file") {
        if (tool.preview?.hunks?.length)
          return await this.writeFile(path, content, false, {
            requireExists: true,
          });
        return await this.writeFile(path, content, true, { requireExists: true });
      }
      if (tool.name === "create_file")
        return await this.createFile(path, content, { failIfExists: true });
      if (tool.name === "rename_file") {
        const newName = String(tool.newName || "").trim();
        if (!path) throw new Error("rename_file.path is empty");
        if (!newName) throw new Error("rename_file.new_name is empty");
        const full = this.resolvePath(path);
        const parts = this.splitPath(full);
        const newFull = (parts.dir ? parts.dir + "/" : "") + newName;
        return await this.renameOrMoveFile(full, newFull, "Renamed");
      }
      if (tool.name === "move_file") {
        const newPath = String(tool.newPath || "").trim();
        if (!path) throw new Error("move_file.path is empty");
        if (!newPath) throw new Error("move_file.new_path is empty");
        const full = this.resolvePath(path);
        const newFull = this.resolvePath(newPath);
        return await this.renameOrMoveFile(full, newFull, "Moved");
      }
      if (tool.name === "delete_file") {
        const targetPath = path || this.activePath();
        if (!targetPath) throw new Error("delete_file.path is empty");
        const snap =
          tool.deleteSnapshot || (await this.snapshotForDelete(targetPath));
        if (!snap.exists)
          throw new Error("File or folder not found: " + targetPath);
        const full = snap.full || this.resolvePath(targetPath);
        await this.deleteFsEntry(full);
        try {
          const active = Editor.activeFile();
          const activeInfo = Editor.info();
          const activePath = String(
            activeInfo.uri || activeInfo.location || activeInfo.filename || "",
          ).trim();
          if (active && typeof active.remove === "function" && activePath) {
            const matchesDeleted =
              activePath === full ||
              activePath.startsWith(full.replace(/\/+$/, "") + "/");
            if (matchesDeleted) await active.remove(true);
          }
        } catch (_) {}
        return snap.isDirectory
          ? "Deleted folder " + targetPath
          : "Deleted file " + targetPath;
      }
      if (tool.name === "create_directory") {
        if (!path) throw new Error("create_directory.path is empty");
        const full = this.resolvePath(path);
        const parts = this.splitPath(full);
        if (!parts.name)
          throw new Error("Invalid create_directory path: " + path);
        if (!parts.dir)
          throw new Error(
            this.relativePathError(path) ||
              "Parent folder for create_directory is unavailable: " + path,
          );
        const parent = await this.fsFactory()(parts.dir);
        if (typeof parent.createDirectory !== "function")
          throw new Error(
            "Acode fs.createDirectory is unavailable for: " + parts.dir,
          );
        await parent.createDirectory(parts.name);
        return "Created directory " + path;
      }
      if (tool.name === "insert_after_line") {
        if (!path) throw new Error("insert_after_line.path is empty");
        if (tool.insertAfterLine < 0)
          throw new Error("insert_after_line.line must be >= 0");
        const snap = await this.fileSnapshot(path);
        if (!snap.exists) throw new Error("File not found: " + path);
        const lines = String(snap.content || "").split("\n");
        const at = Math.max(0, Math.min(tool.insertAfterLine, lines.length));
        const insertedLines = String(content || "")
          .replace(/\r\n/g, "\n")
          .split("\n");
        lines.splice(at, 0, ...insertedLines);
        return await this.writeFile(path, lines.join("\n"), false, {
          requireExists: true,
        });
      }
    },
    createUnsavedEditorFile(path, content) {
      const filename =
        Util.filenameFromPath(path) ||
        String(path || "untitled.txt")
          .split("/")
          .filter(Boolean)
          .pop() ||
        "untitled.txt";
      const options = {
        text: String(content || ""),
        isUnsaved: true,
        render: true,
        uri: String(path || filename),
      };
      const manager = window.editorManager || window.acode?.editorManager;
      try {
        if (manager && typeof manager.addNewFile === "function") {
          manager.addNewFile(filename, options);
          return true;
        }
      } catch (_) {}
      try {
        if (window.acode && typeof window.acode.newEditorFile === "function") {
          window.acode.newEditorFile(filename, options);
          return true;
        }
      } catch (_) {}
      return false;
    },
    async createFile(path, content, options) {
      if (!path) throw new Error("create_file.path is empty");
      if (this.isRelativePath(path) && !this.baseDir()) {
        throw new Error(this.noProjectRootCreateError(path));
      }
      const snap = await this.fileSnapshot(path);
      if (options?.failIfExists && snap.exists)
        throw new Error(
          "File already exists, create_file was cancelled: " + path,
        );
      const fs = this.fsFactory();
      const full = this.resolvePath(path);
      const parts = this.splitPath(full);
      if (!parts.name) throw new Error("Invalid create_file path: " + path);
      if (!parts.dir)
        throw new Error(
          this.relativePathError(path) ||
            "Target folder for create_file is unavailable: " + path,
        );
      const dir = await fs(parts.dir);
      if (typeof dir.exists === "function" && !(await dir.exists()))
        throw new Error("Parent folder not found: " + parts.dir);
      if (typeof dir.stat === "function") {
        try {
          const stat = await dir.stat();
          if (stat && stat.isFile)
            throw new Error("Parent path is not a folder: " + parts.dir);
        } catch (error) {
          if (/Parent path/.test(error.message || "")) throw error;
        }
      }
      if (typeof dir.createFile !== "function")
        throw new Error(
          "Acode fs.createFile is unavailable for folder: " + parts.dir,
        );
      await dir.createFile(parts.name, content);
      try {
        await Acode.openFileAt(full, { line: 1, column: 1 });
      } catch (_) {}
      return "Created " + path;
    },
    async writeFile(path, content, append, options) {
      if (!path)
        throw new Error(
          (append ? "append_file" : "write_file") + ".path is empty",
        );
      if (this.isRelativePath(path) && !this.baseDir()) {
        throw new Error(this.noProjectRootCreateError(path));
      }
      const snap = await this.fileSnapshot(path);
      if (options?.requireExists && !snap.exists)
        throw new Error("File not found: " + path);
      const fs = this.fsFactory();
      const full = this.resolvePath(path);
      // If file does not exist, create it first
      if (!snap.exists && !append) {
        return await this.createFile(path, content, { failIfExists: false });
      }
      const file = await fs(full);
      if (typeof file.writeFile !== "function")
        throw new Error("Acode fs.writeFile is unavailable for: " + path);
      if (append) {
        await file.writeFile(String(snap.content || "") + content);
        return "Appended " + path;
      }
      await file.writeFile(content);
      return "Wrote " + path;
    },
    async renameOrMoveFile(fromFull, toFull, verb) {
      const fs = this.fsFactory();
      const fromFile = await fs(fromFull);
      // Try native rename/move methods in order of preference
      const renameMethods = ["rename", "move", "moveTo", "renameTo"];
      let lastError = null;
      for (const method of renameMethods) {
        if (typeof fromFile[method] !== "function") continue;
        try {
          await fromFile[method](toFull);
          return verb + " to " + toFull;
        } catch (error) {
          lastError = error;
        }
      }
      // Fallback: read → create at new path → delete old
      let content = "";
      try {
        content = await fromFile.readFile("utf-8");
      } catch (_) {
        content = await fromFile.readFile();
      }
      content = this.toTextContent(content);
      await this.createFile(toFull, content, { failIfExists: false });
      await this.deleteFsEntry(fromFull);
      return verb + " (copy+delete) to " + toFull;
    },
    resultMeta(tool) {
      const hunks = tool?.preview?.hunks || [];
      const selectedHunks = hunks.filter((h) => h.selected !== false);
      const rows = selectedHunks.length
        ? selectedHunks
            .flatMap((h) => h.rows || [])
            .filter((row) => row.type !== "same")
        : (tool?.preview?.rows || []).filter((row) => row.type !== "same");
      const added = rows.filter((row) => row.type === "add").length;
      const removed = rows.filter((row) => row.type === "del").length;
      return {
        target: this.targetOf(tool),
        operation: this.operationKind(tool),
        hunks: hunks.length ? `${selectedHunks.length}/${hunks.length}` : "",
        added,
        removed,
      };
    },
    diagnostic(step, ok, message, meta) {
      const entry = {
        step,
        ok: Boolean(ok),
        message: String(message || ""),
        time: Util.nowLabel(),
        meta: meta || null,
      };
      State.applyDiagnostics = State.applyDiagnostics || [];
      State.applyDiagnostics.push(entry);
      return entry;
    },
    clearDiagnostics() {
      State.applyDiagnostics = [];
    },
    pushUndoBatch(records) {
      if (!records || !records.length) return;
      State.undoStack.push({
        time: new Date().toISOString(),
        records,
      });
      State.undoStack = State.undoStack.slice(-10);
    },
    preflightPathError(tool) {
      if (!tool || !this.isWriteName(tool.name)) return "";
      if (
        ["replace_selection", "insert_at_cursor", "run_command"].includes(
          tool.name,
        )
      )
        return "";
      if (!tool.path) return "";
      if (
        tool.name === "delete_file" &&
        this.canUseActiveDeleteFallback(tool.path)
      )
        return "";
      return this.relativePathError(tool.path);
    },
    canConvertToActiveEditor(tool) {
      if (!tool || !tool.content) return false;
      if (
        !["create_file", "write_file", "append_file", "replace_file"].includes(
          tool.name,
        )
      )
        return false;
      if (tool.name === "append_file") return false;
      return Boolean(
        Editor.info().filename || Editor.text() || Editor.selectedText(),
      );
    },
    convertToActiveEditor(tool) {
      if (!this.canConvertToActiveEditor(tool)) return false;
      tool.name = "replace_file";
      tool.path = "";
      tool.appliesTo = "active file";
      tool.error = "";
      tool.warning =
        "Converted to active-editor update. This will replace the current Acode tab, not create a separate project file.";
      tool.title = "AI wants to update the active editor";
      tool.selected = true;
      const oldText = Editor.text();
      tool.preview = this.makePreview(
        oldText,
        tool.content,
        "active file",
        tool.id,
      );
      return true;
    },
    convertBlockedToActiveEditor() {
      let converted = 0;
      for (const tool of State.pendingTools || []) {
        if (tool.error && this.convertToActiveEditor(tool)) converted++;
      }
      if (converted) {
        this.diagnostic(
          "fallback",
          true,
          "Converted " + converted + " blocked tool(s) to active-editor updates.",
        );
      }
      return converted;
    },
    async applyAll() {
      if (!State.pendingTools.length)
        return Acode.toast("No pending agent tools");
      this.clearDiagnostics();
      State.toolResults = [];
      State.reviewNotice = "";
      State.lastError = null;
      this.diagnostic("permission", true, "Apply requested for pending changes.");
      const tools = this.selectedTools();
      if (!tools.length) {
        this.diagnostic(
          "selection",
          false,
          "No unblocked selected tools are available.",
        );
        return Acode.toast("No selected tools");
      }

      const preflightErrors = [];
      for (const tool of tools) {
        if (tool.error)
          preflightErrors.push({
            ok: false,
            tool: tool.name,
            result: tool.error,
            ...this.resultMeta(tool),
          });
        const pathError = this.preflightPathError(tool);
        if (pathError)
          preflightErrors.push({
            ok: false,
            tool: tool.name,
            result: pathError,
            ...this.resultMeta(tool),
          });
      }
      if (preflightErrors.length) {
        State.toolResults = preflightErrors;
        this.diagnostic(
          "preflight",
          false,
          preflightErrors[0].result,
          preflightErrors,
        );
        throw ErrorKit.create({
          code: "TOOL_PREFLIGHT_FAILED",
          title: "Agent tool blocked before apply",
          message: preflightErrors[0].result,
          hint: "No changes were applied yet. To create project files, set Project Root in Settings first, then retry. Or use “Use active editor” to write to the current tab.",
          details: JSON.stringify(preflightErrors, null, 2),
        });
      }
      this.diagnostic(
        "preflight",
        true,
        "Preflight passed for " + tools.length + " selected operation(s).",
      );

      const results = [];
      const undoRecords = [];
      const appliedIds = new Set();
      const selectedIds = new Set(tools.map((tool) => String(tool.id)));
      const persistPartialState = (message) => {
        State.toolResults = results;
        this.pushUndoBatch(undoRecords);
        if (appliedIds.size) {
          State.pendingTools = State.pendingTools.filter(
            (pending) => !appliedIds.has(String(pending.id)),
          );
        }
        State.lastAppliedSummary = appliedIds.size
          ? "Partially applied " +
            appliedIds.size +
            " operation(s) before an error."
          : "No changes were applied.";
        State.reviewNotice = message || State.lastAppliedSummary;
      };

      for (const tool of tools) {
        try {
          this.diagnostic(
            "snapshot",
            true,
            "Creating undo snapshot for " + tool.name + ".",
          );
          const undo = await this.makeUndoRecord(tool);
          this.diagnostic(
            "execute",
            true,
            "Applying " + tool.name + " to " + this.targetOf(tool) + ".",
          );
          const result = await this.run(tool);
          undoRecords.push(undo);
          appliedIds.add(String(tool.id));
          results.push(
            Object.assign(
              { ok: true, tool: tool.name, result },
              this.resultMeta(tool),
            ),
          );
          State.toolResults = results;
          this.diagnostic("execute", true, result || tool.name + " applied");
        } catch (error) {
          const failed = Object.assign(
            {
              ok: false,
              tool: tool.name,
              result: error.message || String(error),
            },
            this.resultMeta(tool),
          );
          results.push(failed);
          tool.error = error.message || String(error);
          tool.selected = false;
          this.diagnostic(
            "execute",
            false,
            `${tool.name}: ${error.message || error}`,
          );
          persistPartialState(
            appliedIds.size
              ? "Some changes were applied before the error. Review the remaining pending tools before applying again."
              : "No changes were applied before this error.",
          );
          throw ErrorKit.create({
            code: "TOOL_FAILED",
            title: "Agent tool failed",
            message: `${tool.name}: ${error.message || error}`,
            hint: appliedIds.size
              ? "Some changes were applied before the error. The applied tools were removed from Review; use Undo Last Apply if needed."
              : "No changes were applied before this error.",
            details: JSON.stringify(
              { results, diagnostics: State.applyDiagnostics },
              null,
              2,
            ),
            cause: error,
          });
        }
      }
      this.pushUndoBatch(undoRecords);
      State.toolResults = results;
      const acceptedHunks = tools.reduce(
        (sum, tool) =>
          sum +
          (tool.preview?.hunks?.length
            ? Patch.selectedHunkCount(tool.preview)
            : 0),
        0,
      );
      State.lastAppliedSummary =
        "Applied " +
        results.length +
        " selected operation(s)" +
        (acceptedHunks ? " with " + acceptedHunks + " accepted hunk(s)." : ".");
      State.reviewNotice = "";
      this.diagnostic("summary", true, State.lastAppliedSummary);
      State.pendingTools = State.pendingTools.filter(
        (tool) => !selectedIds.has(String(tool.id)),
      );
      return results;
    },
  };

  // ---- agent/read-tools.js ----
  // Read-only codebase tools live outside the write/apply tool core so
  // AgentTools stays smaller and easier to audit. These methods are mixed into
  // the AgentTools singleton after the base tool object is created.
  Object.assign(AgentTools, {
    isReadOnlyName(name) {
      return this.readNames.includes(String(name || "").trim());
    },
    parseCallArgs(call) {
      let args = {};
      try {
        args = JSON.parse(call.arguments || call.args || "{}");
      } catch (_) {}
      return args && typeof args === "object" ? args : {};
    },
    callId(call, index) {
      return String(
        call.call_id ||
          call.callId ||
          call.id ||
          call.item_id ||
          "call_" + (index + 1),
      );
    },
    readCallKey(call) {
      return (
        String(call?.name || "") +
        ":" +
        String(call?.arguments || call?.args || "{}")
      );
    },
    readCallTarget(call) {
      const name = String(call?.name || "").trim();
      const args = this.parseCallArgs(call || {});
      if (name === "read_file")
        return String(
          args.path || Editor.info().filename || "active editor",
        ).trim();
      if (name === "list_files")
        return String(args.path || "project files").trim();
      if (name === "search_in_files")
        return String(args.query || args.path || "codebase").trim();
      if (name === "project_overview")
        return String(args.path || "project overview").trim();
      if (name === "open_file") return String(args.path || "file").trim();
      return name || "tool";
    },
    readCallGroup(call) {
      const name = String(call?.name || "").trim();
      if (name === "read_file") return "reading";
      if (name === "list_files") return "listing";
      if (name === "search_in_files") return "searching";
      if (name === "project_overview") return "diagnosing";
      if (name === "open_file") return "opening";
      return "using tools";
    },
    uniqueReadCalls(calls) {
      const out = [];
      const seen = new Set();
      (calls || []).forEach((call) => {
        if (!this.isReadOnlyName(call?.name)) return;
        const key = this.readCallKey(call);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(call);
      });
      return out;
    },
    readActivityFromCalls(calls, status) {
      return this.uniqueReadCalls(calls).map((call) => ({
        group: this.readCallGroup(call),
        tool: String(call?.name || "").trim(),
        target: this.readCallTarget(call),
        status: status || "running",
      }));
    },
    outputForToolResult(value) {
      const text =
        typeof value === "string" ? value : JSON.stringify(value, null, 2);
      return Util.truncate(text, C.MAX_TOOL_READ_CHARS);
    },
    async runReadCalls(calls) {
      const readCalls = (calls || []).filter((call) =>
        this.isReadOnlyName(call?.name),
      );
      const cache = new Map();
      const out = [];
      for (let index = 0; index < readCalls.length; index++) {
        const call = readCalls[index];
        const key = this.readCallKey(call);
        let result = cache.get(key);
        if (!result) {
          result = await this.runReadCall(call, index);
          cache.set(key, result);
        }
        // Responses API needs an output for every function call id. Duplicate
        // calls reuse the cached observation but keep their own call_id.
        out.push(
          Object.assign({}, result, {
            call_id: this.callId(call, index),
            name: String(call.name || result.name || ""),
          }),
        );
      }
      return out;
    },
    async runReadCall(call, index) {
      const name = String(call.name || "").trim();
      const args = this.parseCallArgs(call);
      const tool = this.normalize({ id: index + 1, name, args });
      try {
        const result = await this.runRead(tool);
        const ok = result && result.ok === false ? false : true;
        return {
          ok,
          name,
          call_id: this.callId(call, index),
          output: this.outputForToolResult(result),
        };
      } catch (error) {
        return {
          ok: false,
          name,
          call_id: this.callId(call, index),
          output: this.outputForToolResult({
            ok: false,
            tool: name,
            error: error.message || String(error),
            recoverable: true,
            instruction:
              "Continue without hallucinating. Use another read/search/list call if useful, or ask the user for the correct path.",
          }),
        };
      }
    },
    async runRead(tool) {
      if (tool.name === "read_file") return await this.readFileTool(tool);
      if (tool.name === "list_files") return await this.listFilesTool(tool);
      if (tool.name === "search_in_files")
        return await this.searchInFilesTool(tool);
      if (tool.name === "project_overview")
        return await this.projectOverviewTool(tool);
      if (tool.name === "open_file") return await this.openFileTool(tool);
      throw new Error("Unsupported read tool: " + tool.name);
    },
    readSlice(content, startLine, endLine) {
      const lines = String(content || "").split("\n");
      const total = lines.length;
      const start = Math.max(1, Number(startLine || 1));
      const end = Math.min(
        total,
        Number(endLine || 0) > 0 ? Number(endLine) : total,
      );
      const width = String(end).length;
      const out = [];
      for (let line = start; line <= end; line++)
        out.push(
          String(line).padStart(width, " ") + " | " + (lines[line - 1] || ""),
        );
      return {
        startLine: start,
        endLine: end,
        totalLines: total,
        content: out.join("\n"),
      };
    },
    async readFileTool(tool) {
      const path = String(tool.path || "").trim();
      let content = "";
      let fullPath = "";
      let exists = true;
      if (!path) {
        content = Editor.text();
        fullPath = this.activePath() || "active editor";
      } else {
        const snap = await this.fileSnapshot(path);
        exists = Boolean(snap.exists && !snap.isDirectory && !snap.error);
        fullPath = snap.full || this.resolvePath(path);
        if (!exists) {
          return {
            ok: false,
            tool: "read_file",
            path,
            fullPath,
            exists: Boolean(snap.exists),
            error: snap.error || "File not found: " + path,
            recoverable: true,
            next_step:
              "Do not guess this file. Try list_files/search_in_files, use the active editor if it matches, or ask the user for the correct path.",
          };
        }
        content = String(snap.content || "");
      }
      const slice = this.readSlice(content, tool.startLine, tool.endLine);
      return {
        ok: true,
        tool: "read_file",
        path: path || "(active editor)",
        fullPath,
        exists,
        language: Util.lang(path || Editor.info().filename),
        line_count: slice.totalLines,
        start_line: slice.startLine,
        end_line: slice.endLine,
        content: Util.truncate(slice.content, C.MAX_TOOL_READ_CHARS),
      };
    },

    packageManagerFromFiles(files) {
      const names = new Set(
        (files || []).map((f) => String(f.name || "").toLowerCase()),
      );
      if (names.has("pnpm-lock.yaml")) return "pnpm";
      if (names.has("yarn.lock")) return "yarn";
      if (names.has("bun.lockb") || names.has("bun.lock")) return "bun";
      if (names.has("package-lock.json")) return "npm";
      return "npm";
    },
    projectConfigRank(name) {
      const value = String(name || "").toLowerCase();
      const important = [
        "package.json",
        "plugin.json",
        "vite.config.js",
        "vite.config.ts",
        "webpack.config.js",
        "rollup.config.js",
        "eslint.config.js",
        ".eslintrc",
        ".prettierrc",
        "tsconfig.json",
        "jsconfig.json",
        "composer.json",
        "pubspec.yaml",
        "pyproject.toml",
        "requirements.txt",
        "tailwind.config.js",
        "next.config.js",
        "nuxt.config.js",
        "svelte.config.js",
        "vue.config.js",
        "capacitor.config.ts",
        "capacitor.config.json",
      ];
      const exact = important.indexOf(value);
      if (exact >= 0) return exact;
      if (/^(package|plugin|manifest)\.json$/.test(value)) return 10;
      if (
        /(vite|webpack|rollup|eslint|prettier|babel|tailwind|tsconfig|jsconfig|next|nuxt|svelte|vue|capacitor|composer|pubspec|pyproject|requirements)/.test(
          value,
        )
      )
        return 50;
      return 999;
    },
    likelyFrameworks(meta, configNames) {
      const deps = Object.assign(
        {},
        meta?.dependencies || {},
        meta?.devDependencies || {},
        meta?.peerDependencies || {},
      );
      const names = new Set(Object.keys(deps));
      const configs = new Set(
        (configNames || []).map((n) => String(n || "").toLowerCase()),
      );
      const out = [];
      const add = (label, why) => {
        if (!out.some((item) => item.name === label))
          out.push({ name: label, why });
      };
      if (names.has("@codemirror/view") || names.has("@codemirror/state"))
        add("CodeMirror", "CodeMirror packages detected");
      if (names.has("react")) add("React", "react dependency detected");
      if (names.has("vue")) add("Vue", "vue dependency detected");
      if (names.has("svelte")) add("Svelte", "svelte dependency detected");
      if (names.has("next") || configs.has("next.config.js"))
        add("Next.js", "next dependency/config detected");
      if (
        names.has("vite") ||
        configs.has("vite.config.js") ||
        configs.has("vite.config.ts")
      )
        add("Vite", "vite dependency/config detected");
      if (names.has("typescript") || configs.has("tsconfig.json"))
        add("TypeScript", "typescript package/config detected");
      if (names.has("jest") || names.has("@jest/globals"))
        add("Jest", "jest dependency detected");
      if (names.has("vitest")) add("Vitest", "vitest dependency detected");
      if (names.has("eslint") || configs.has("eslint.config.js"))
        add("ESLint", "eslint dependency/config detected");
      if (names.has("prettier") || configs.has(".prettierrc"))
        add("Prettier", "prettier dependency/config detected");
      if (meta?.id && meta?.main && meta?.minVersionCode)
        add("Acode plugin", "Acode plugin manifest fields detected");
      return out.slice(0, 12);
    },
    scriptCommand(pm, script) {
      if (!script) return "";
      if (script === "test") {
        if (pm === "npm") return "npm test";
        if (pm === "yarn") return "yarn test";
        return pm + " test";
      }
      if (pm === "npm") return "npm run " + script;
      return pm + " run " + script;
    },
    safeCommandsFromScripts(pm, scripts) {
      const order = ["lint", "test", "check", "typecheck", "format:check"];
      const out = [];
      for (const key of order) {
        if (!scripts || !Object.prototype.hasOwnProperty.call(scripts, key))
          continue;
        const cmd = this.scriptCommand(pm, key);
        if (this.safeCommand(cmd))
          out.push({
            script: key,
            command: cmd,
            value: String(scripts[key] || ""),
          });
      }
      return out;
    },
    async projectOverviewTool(tool) {
      const collected = await this.collectFiles(
        tool.path,
        tool.maxDepth || 3,
        "",
        260,
      );
      const files = collected.files || [];
      const lowerByName = new Map();
      files.forEach((file) => {
        const name = String(
          file.name || Util.filenameFromPath(file.path) || "",
        ).toLowerCase();
        if (name && !lowerByName.has(name)) lowerByName.set(name, file);
      });
      const configFiles = files
        .map((file) => ({
          path: file.path,
          name: file.name || Util.filenameFromPath(file.path),
          rank: this.projectConfigRank(file.name || file.path),
        }))
        .filter((file) => file.rank < 999)
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.path).localeCompare(String(b.path)),
        )
        .slice(0, 40)
        .map(({ path, name }) => ({ path, name }));
      const packageFile = lowerByName.get("package.json");
      const pluginFile = lowerByName.get("plugin.json");
      let packageJson = null;
      let packageError = "";
      if (packageFile) {
        try {
          packageJson = JSON.parse(
            (await this.fileSnapshot(packageFile.path)).content || "{}",
          );
        } catch (error) {
          packageError = error.message || String(error);
        }
      }
      let pluginJson = null;
      if (pluginFile) {
        try {
          pluginJson = JSON.parse(
            (await this.fileSnapshot(pluginFile.path)).content || "{}",
          );
        } catch (_) {}
      }
      const pm = this.packageManagerFromFiles(files);
      const scripts = packageJson?.scripts || {};
      const safeCommands = this.safeCommandsFromScripts(pm, scripts);
      const configNames = configFiles.map((file) => file.name);
      const likely = this.likelyFrameworks(
        packageJson || pluginJson || {},
        configNames,
      );
      const counts = {
        files_scanned: files.length,
        config_files_found: configFiles.length,
        open_editor_fallback:
          collected.root &&
          String(collected.root).includes("active/open editors"),
      };
      return {
        ok: true,
        tool: "project_overview",
        root: collected.root,
        package_manager: pm,
        package: packageJson
          ? {
              name: packageJson.name || "",
              version: packageJson.version || "",
              type: packageJson.type || "",
              private: Boolean(packageJson.private),
              scripts,
              dependencies: Object.keys(packageJson.dependencies || {}).slice(
                0,
                80,
              ),
              devDependencies: Object.keys(
                packageJson.devDependencies || {},
              ).slice(0, 80),
            }
          : null,
        package_error: packageError || undefined,
        plugin_manifest: pluginJson
          ? {
              id: pluginJson.id || "",
              name: pluginJson.name || "",
              version: pluginJson.version || "",
              main: pluginJson.main || "",
              minVersionCode: pluginJson.minVersionCode,
            }
          : undefined,
        likely_frameworks: likely,
        config_files: configFiles,
        safe_validation_commands: safeCommands,
        counts,
        next_step:
          safeCommands.length > 0
            ? "Summarize findings first. If the user wants validation, propose run_command for one safe command at a time."
            : "Summarize findings first. If validation is needed, ask which command/script should be used.",
      };
    },

    async openFileTool(tool) {
      const path = String(tool.path || "").trim();
      if (!path) throw new Error("open_file.path is empty");
      const fullPath = this.resolvePath(path);
      await Acode.openFileAt(fullPath || path, {
        line: tool.openLine || tool.startLine || 1,
        column: tool.openColumn || 1,
      });
      return {
        ok: true,
        tool: "open_file",
        path,
        fullPath: fullPath || path,
        line: tool.openLine || tool.startLine || 1,
        column: tool.openColumn || 1,
        opened: true,
      };
    },
    async readDirectoryEntries(fullPath) {
      const fs = this.fsFactory();
      const dir = await fs(fullPath);
      const methods = [
        "lsDir",
        "readDir",
        "readdir",
        "listDir",
        "list",
        "ls",
        "children",
      ];
      for (const method of methods) {
        try {
          const candidate =
            typeof dir[method] === "function" ? await dir[method]() : dir[method];
          if (Array.isArray(candidate)) return candidate;
        } catch (_) {}
      }
      throw new Error(
        "Acode fs directory listing API is unavailable for: " + fullPath,
      );
    },
    normalizeDirEntry(entry, parent) {
      if (typeof entry === "string") {
        const name =
          entry.replace(/\/+$/, "").split("/").filter(Boolean).pop() || entry;
        const fullPath = this.isAbsolutePath(entry)
          ? entry
          : String(parent || "").replace(/\/+$/, "") +
            "/" +
            entry.replace(/^\/+/, "");
        return {
          name,
          path: fullPath,
          isDirectory: !/\.[A-Za-z0-9_+-]+$/.test(name),
          isSymlink: false,
        };
      }
      if (!entry || typeof entry !== "object") return null;
      const rawPath = String(
        entry.url ||
          entry.uri ||
          entry.path ||
          entry.location ||
          entry.fullPath ||
          entry.filename ||
          entry.name ||
          "",
      ).trim();
      const name = String(
        entry.name || entry.filename || Util.filenameFromPath(rawPath) || "",
      ).trim();
      if (!name && !rawPath) return null;
      const fullPath = this.isAbsolutePath(rawPath)
        ? rawPath
        : String(parent || "").replace(/\/+$/, "") +
          "/" +
          (rawPath || name).replace(/^\/+/, "");
      const isDirectory = Boolean(
        entry.isDirectory ||
        entry.directory ||
        entry.type === "dir" ||
        entry.type === "directory" ||
        entry.isFolder ||
        entry.mime === "inode/directory" ||
        entry.isFile === false,
      );
      return {
        name: name || Util.filenameFromPath(fullPath),
        path: fullPath,
        isDirectory,
        isSymlink: Boolean(
          entry.isSymbolicLink ||
          entry.symlink ||
          entry.isSymlink ||
          entry.type === "symlink" ||
          entry.link,
        ),
        size: entry.size != null ? entry.size : undefined,
        modified:
          entry.lastModified || entry.modified || entry.mtime || undefined,
      };
    },
    globMatches(name, glob) {
      const g = String(glob || "").trim();
      if (!g) return true;
      if (g.startsWith("*."))
        return String(name || "")
          .toLowerCase()
          .endsWith(g.slice(1).toLowerCase());
      if (g.includes("*")) {
        let escaped = "";
        const specials = ".+?^${}()|[]\\";
        for (let i = 0; i < g.length; i++) {
          const ch = g[i];
          escaped += ch === "*" ? ".*" : specials.includes(ch) ? "\\" + ch : ch;
        }
        return new RegExp("^" + escaped + "$", "i").test(String(name || ""));
      }
      return String(name || "")
        .toLowerCase()
        .includes(g.toLowerCase());
    },
    shouldSkipDir(name) {
      return [
        ".git",
        "node_modules",
        "dist",
        "build",
        ".next",
        ".nuxt",
        ".cache",
        "coverage",
        ".gradle",
      ].includes(String(name || "").toLowerCase());
    },
    virtualWorkspaceFiles() {
      const active = Editor.info();
      const files = [];
      const add = (path, name, activeFlag) => {
        const filename = String(name || Util.filenameFromPath(path) || "").trim();
        if (!filename) return;
        const key = String(path || filename);
        if (files.some((f) => (f.path || f.name) === key)) return;
        files.push({
          path: path || filename,
          name: filename,
          active: Boolean(activeFlag),
          virtual: true,
        });
      };
      add(
        active.uri || active.location || active.filename,
        active.filename,
        true,
      );
      (Editor.openFiles() || []).forEach((f) =>
        add(f.uri || f.filename, f.filename, false),
      );
      (State.recentFiles || []).forEach((f) =>
        add(f.uri || f.filename, f.filename, false),
      );
      return files;
    },
    async collectFiles(folder, maxDepth, glob, limit) {
      const root = String(folder || "").trim()
        ? this.resolvePath(folder)
        : this.baseDir();
      if (!root)
        return {
          root: "active/open editors (Project Root unavailable)",
          files: this.virtualWorkspaceFiles().filter((f) =>
            this.globMatches(f.name, glob),
          ),
        };
      const max = Math.max(1, Math.min(Number(limit || 120), 400));
      const seen = new Set();
      const out = [];
      const visitKey = (value) =>
        String(value || "")
          .replace(/\\/g, "/")
          .replace(/\/+/g, "/")
          .replace(/\/+$/, "")
          .toLowerCase();
      const walk = async (dirPath, depth) => {
        const key = visitKey(dirPath);
        if (out.length >= max || seen.has(key) || depth < 0) return;
        seen.add(key);
        let entries = [];
        try {
          entries = await this.readDirectoryEntries(dirPath);
        } catch (error) {
          if (dirPath === root) throw error;
          return;
        }
        for (const entry of entries) {
          const item = this.normalizeDirEntry(entry, dirPath);
          if (!item) continue;
          if (item.isDirectory) {
            if (item.isSymlink) continue;
            if (depth > 0 && !this.shouldSkipDir(item.name))
              await walk(item.path, depth - 1);
          } else if (this.globMatches(item.name, glob)) {
            out.push(item);
            if (out.length >= max) break;
          }
        }
      };
      await walk(root, Math.max(0, Number(maxDepth || 2)));
      return { root, files: out };
    },
    async listFilesTool(tool) {
      try {
        const collected = await this.collectFiles(
          tool.path,
          tool.maxDepth || 2,
          tool.glob || "",
          200,
        );
        return {
          ok: true,
          tool: "list_files",
          root: collected.root,
          count: collected.files.length,
          files: collected.files.slice(0, 200).map((f) => ({
            path: f.path,
            name: f.name,
            size: f.size != null ? f.size : undefined,
            modified: f.modified || undefined,
            active: Boolean(f.active),
            virtual: Boolean(f.virtual),
          })),
        };
      } catch (error) {
        const fallback = this.virtualWorkspaceFiles();
        return {
          ok: false,
          tool: "list_files",
          root: this.baseDir() || "(unknown)",
          error: error.message || String(error),
          recoverable: true,
          fallback_files: fallback.map((f) => ({
            path: f.path,
            name: f.name,
            active: Boolean(f.active),
            virtual: true,
          })),
        };
      }
    },
    isLikelyTextFile(path) {
      const ext = String(path || "")
        .split(".")
        .pop()
        .toLowerCase();
      if (!ext) return false;
      return ![
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "ico",
        "pdf",
        "zip",
        "gz",
        "tar",
        "7z",
        "mp3",
        "mp4",
        "mov",
        "apk",
        "dex",
        "so",
        "ttf",
        "otf",
        "woff",
        "woff2",
      ].includes(ext);
    },
    async searchInFilesTool(tool) {
      const query = String(tool.query || "").trim();
      if (!query) throw new Error("search_in_files.query is empty");
      // Build a matcher: try regex first, fall back to case-insensitive substring
      let matcher;
      let isRegex = false;
      try {
        const re = new RegExp(query, "gi");
        // Only use regex mode when the query actually contains regex metacharacters
        if (/[\\^$.*+?()[\]{}|]/.test(query)) {
          matcher = (line) => {
            re.lastIndex = 0;
            return re.test(line);
          };
          isRegex = true;
        }
      } catch (_) {}
      if (!matcher) {
        const q = query.toLowerCase();
        matcher = (line) => line.toLowerCase().includes(q);
      }
      const contextLines = Math.max(
        0,
        Math.min(Number(tool.contextLines || C.MAX_TOOL_SEARCH_CONTEXT_LINES), 5),
      );
      let files = [];
      let root = this.baseDir();
      try {
        const collected = await this.collectFiles(
          tool.path,
          tool.maxDepth || 3,
          tool.glob || "",
          C.MAX_TOOL_SEARCH_FILES,
        );
        files = collected.files;
        root = collected.root;
      } catch (error) {
        const active = Editor.info();
        files = [
          { path: "", name: active.filename || "active editor", active: true },
        ];
        root = "active editor fallback: " + (error.message || error);
      }
      const maxResults = Math.max(
        1,
        Math.min(Number(tool.maxResults || 30), C.MAX_TOOL_SEARCH_RESULTS),
      );
      const results = [];
      for (const file of files) {
        if (results.length >= maxResults) break;
        if (!file.active && !this.isLikelyTextFile(file.path || file.name))
          continue;
        if (
          !file.active &&
          Number(file.size || 0) > 0 &&
          Number(file.size || 0) > C.MAX_TOOL_READ_CHARS
        )
          continue;
        let content = "";
        try {
          content = file.active
            ? Editor.text()
            : (await this.fileSnapshot(file.path)).content;
        } catch (_) {
          continue;
        }
        if (!file.active && String(content || "").length > C.MAX_TOOL_READ_CHARS)
          continue;
        const lines = String(content || "").split("\n");
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          if (matcher(lines[i])) {
            const before = lines
              .slice(Math.max(0, i - contextLines), i)
              .map((l, idx) => ({
                line: i - contextLines + idx,
                text: l.trim().slice(0, 200),
              }));
            const after = lines
              .slice(i + 1, i + 1 + contextLines)
              .map((l, idx) => ({
                line: i + 2 + idx,
                text: l.trim().slice(0, 200),
              }));
            results.push({
              path: file.active ? "(active editor)" : file.path,
              line: i + 1,
              text: lines[i].trim().slice(0, 500),
              before: contextLines > 0 ? before : undefined,
              after: contextLines > 0 ? after : undefined,
            });
          }
        }
      }
      return {
        ok: true,
        tool: "search_in_files",
        query,
        is_regex: isRegex,
        root,
        count: results.length,
        results,
      };
    },
  });

  // ---- agent/permission-model.js ----
  const PermissionModel = {
    sessionAllowed: {},
    permissionForTool(tool) {
      const name = String(tool?.name || "");
      if (name === "run_command") return "terminal.command";
      if (name === "replace_selection" || name === "insert_at_cursor")
        return "edit.selection";
      if (name === "create_file" || name === "create_directory")
        return "edit.create";
      if (
        name === "write_file" ||
        name === "replace_file" ||
        name === "append_file" ||
        name === "insert_after_line"
      )
        return "edit.file";
      return "edit";
    },
    patternForTool(tool) {
      const target =
        tool?.command || tool?.path || tool?.appliesTo || tool?.name || "*";
      return String(target || "*");
    },
    actionFor(tool) {
      const permission = this.permissionForTool(tool);
      const pattern = this.patternForTool(tool);
      const mode =
        State.permissionMode || Store.settings().permissionMode || "safe";
      const key = permission + ":" + pattern;
      if (this.sessionAllowed[key] || this.sessionAllowed[permission + ":*"])
        return "allow";
      if (permission === "terminal.command") return "ask";
      if (mode === "autopilot") return "allow";
      if (mode === "balanced" && permission === "edit.selection") return "allow";
      return "ask";
    },
    evaluateSelection() {
      const selected = AgentTools.selectedTools();
      if (!selected.length)
        return { action: "deny", reason: "No selected tools" };
      const actions = selected.map((tool) => this.actionFor(tool));
      if (actions.includes("deny"))
        return {
          action: "deny",
          reason: "A selected tool is denied by permission rules",
        };
      if (actions.includes("ask"))
        return {
          action: "ask",
          reason: "Approval required for selected write tools",
        };
      return {
        action: "allow",
        reason: "Selected tools are allowed by current permission mode",
      };
    },
    rememberAlways() {
      AgentTools.selectedTools().forEach((tool) => {
        const permission = this.permissionForTool(tool);
        const pattern = this.patternForTool(tool);
        this.sessionAllowed[permission + ":" + pattern] = true;
      });
    },
    resetSession() {
      this.sessionAllowed = {};
    },
    label() {
      const mode =
        State.permissionMode || Store.settings().permissionMode || "safe";
      if (mode === "autopilot")
        return "Autopilot: selected write tools can be applied after review. Terminal commands still ask.";
      if (mode === "balanced")
        return "Balanced: selection edits are allowed after review; file writes still ask.";
      return "Safe: write/edit/create tools ask before apply.";
    },
  };

  // ---- features/ghost-complete.js ----
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
      // Remove keydown handler to prevent listener accumulation
      if (this._keyDom && this._keyHandler) {
        this._keyDom.removeEventListener("keydown", this._keyHandler, { capture: true });
        this._keyHandler = null;
        this._keyDom = null;
      }
      // Remove editor onChange callback
      if (this._editorChangeHandler) {
        Editor.offChange(this._editorChangeHandler);
        this._editorChangeHandler = null;
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

  // ---- features/terminal-capture.js ----
  /**
   * Feature 2: Terminal Output Capture
   *
   * Enhances run_command to capture terminal output and feed it back
   * to the agent as context for follow-up analysis.
   */
  const TerminalCapture = {
    _lastOutput: "",
    _lastCommand: "",
    _lastExitCode: null,
    _maxOutputChars: 8000,
    _captureEnabled: true,

    _pushHistory(cmd, output, exitCode, time) {
      State.terminalHistory.unshift({
        command: cmd,
        output: (output || "").slice(0, 500),
        exitCode: exitCode,
        time: time,
      });
      State.terminalHistory = State.terminalHistory.slice(0, 10);
    },

    lastCapture() {
      return {
        command: this._lastCommand,
        output: this._lastOutput,
        exitCode: this._lastExitCode,
        time: this._lastTime || "",
        truncated: this._truncated || false,
      };
    },

    contextForAgent() {
      if (!this._lastCommand || !this._lastOutput) return "";
      const exit = this._lastExitCode !== null ? ` (exit ${this._lastExitCode})` : "";
      const trunc = this._truncated ? " [output truncated]" : "";
      return [
        "Last terminal command" + exit + trunc + ":",
        "$ " + this._lastCommand,
        "```",
        this._lastOutput.slice(0, this._maxOutputChars),
        "```",
      ].join("\n");
    },

    async runAndCapture(command, options) {
      const cmd = AgentTools.safeCommand(command);
      if (!cmd) {
        throw ErrorKit.create({
          code: "COMMAND_BLOCKED",
          title: "Command blocked",
          message: "Command blocked by Ace AI safety policy: " + (command || "(empty)"),
          hint: "Only safe lint/test/check commands are allowed.",
        });
      }

      this._lastCommand = cmd;
      this._lastOutput = "";
      this._lastExitCode = null;
      this._lastTime = new Date().toISOString();
      this._truncated = false;

      // Try to use Acode terminal with output capture
      try {
        // Acode's terminal API may provide output capture via callback
        const terminal = Acode.require("terminal");
        if (terminal && typeof terminal.run === "function") {
          const result = await terminal.run(cmd, {
            name: options?.name || "Ace AI",
            capture: true,
          });
          if (result && typeof result === "object") {
            this._lastOutput = String(result.output || result.stdout || "").slice(
              0,
              this._maxOutputChars * 2,
            );
            this._lastExitCode = result.exitCode ?? result.code ?? null;
            if (this._lastOutput.length > this._maxOutputChars) {
              this._lastOutput = this._lastOutput.slice(0, this._maxOutputChars);
              this._truncated = true;
            }
            this._pushHistory(cmd, this._lastOutput, this._lastExitCode, this._lastTime);
            return this.lastCapture();
          }
        }
      } catch (_) {}

      // Fallback: run visible terminal and capture what we can
      try {
        await Acode.runVisibleTerminal(cmd, { name: options?.name || "Ace AI Run" });
        // Visible terminal doesn't return output directly, but we mark as executed
        this._lastOutput = "(output captured in visible terminal tab)";
        this._lastExitCode = null;
      } catch (error) {
        this._lastOutput = "Error: " + (error.message || String(error));
        this._lastExitCode = 1;
      }

      this._pushHistory(cmd, this._lastOutput, this._lastExitCode, this._lastTime);

      return this.lastCapture();
    },
  };

  // ---- features/project-history.js ----
  /**
   * Feature 3: Per-Project Chat History
   *
   * Stores chat history separately per Project Root so users can
   * resume conversations when switching between projects.
   */
  const ProjectHistory = {
    PREFIX: "ace-ai.project-chat.",
    MAX_PROJECTS: 8,
    MAX_MESSAGES_PER_PROJECT: 40,

    _projectKey(root) {
      const normalized = String(root || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (!normalized) return "";
      // Create a short hash for the key
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
      }
      return this.PREFIX + Math.abs(hash).toString(36);
    },

    currentProjectRoot() {
      const settings = Store.settings();
      if (settings.projectRoot) return settings.projectRoot;
      return AgentTools.baseDir() || "";
    },

    save(messages, projectRoot) {
      const root = projectRoot || this.currentProjectRoot();
      if (!root) return; // No project root — use default global chat
      const key = this._projectKey(root);
      if (!key) return;

      const clean = (messages || [])
        .filter((m) => m && m.role && String(m.content || "").trim())
        .slice(-this.MAX_MESSAGES_PER_PROJECT);

      Store.setJson(key, {
        root,
        messages: clean,
        updatedAt: new Date().toISOString(),
      });

      // Track known project keys for cleanup
      this._trackProject(key, root);
    },

    load(projectRoot) {
      const root = projectRoot || this.currentProjectRoot();
      if (!root) return [];
      const key = this._projectKey(root);
      if (!key) return [];

      const data = Store.getJson(key, null);
      if (!data || !Array.isArray(data.messages)) return [];
      return data.messages;
    },

    restore(projectRoot) {
      const messages = this.load(projectRoot);
      if (messages.length) {
        Store.saveChat(messages);
        return true;
      }
      return false;
    },

    saveCurrentChat() {
      const root = this.currentProjectRoot();
      if (!root) return;
      const chat = Store.chat();
      if (chat.length) this.save(chat, root);
    },

    _trackProject(key, root) {
      const indexKey = this.PREFIX + "_index";
      const index = Store.getJson(indexKey, []);
      const existing = index.findIndex((item) => item.key === key);
      if (existing >= 0) {
        index[existing].updatedAt = new Date().toISOString();
      } else {
        index.push({ key, root, updatedAt: new Date().toISOString() });
      }
      // Keep only last N projects
      const sorted = index.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
      );
      const kept = sorted.slice(0, this.MAX_PROJECTS);
      // Remove old project data
      sorted.slice(this.MAX_PROJECTS).forEach((item) => {
        try { localStorage.removeItem(item.key); } catch (_) {}
      });
      Store.setJson(indexKey, kept);
    },

    listProjects() {
      const indexKey = this.PREFIX + "_index";
      return Store.getJson(indexKey, []);
    },

    clearProject(projectRoot) {
      const key = this._projectKey(projectRoot);
      if (key) {
        try { localStorage.removeItem(key); } catch (_) {}
        // Also remove the entry from the _index array
        const indexKey = this.PREFIX + "_index";
        const index = Store.getJson(indexKey, []);
        const filtered = index.filter((item) => item.key !== key);
        Store.setJson(indexKey, filtered);
      }
    },
  };

  // ---- features/theme-system.js ----
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

    applyToPanel(panel) {
      if (!panel) return;
      const theme = this.current();
      panel.classList.toggle("ace-ai-light", theme === "light");
      panel.classList.toggle("ace-ai-dark", theme === "dark");
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

  // ---- features/file-index.js ----
  /**
   * Feature 5: File Indexing & Caching
   *
   * Pre-scans the project structure at startup and caches the file tree
   * persistently. This makes list_files and search_in_files much faster
   * on subsequent calls.
   */
  const FileIndex = {
    STORAGE_PREFIX: "ace-ai.findex.",
    _cache: null,
    _scanning: false,
    _lastScanRoot: "",
    _lastScanTime: 0,
    STALE_MS: 5 * 60 * 1000, // Re-scan after 5 minutes

    cached() {
      return this._cache;
    },

    isFresh() {
      if (!this._cache || !this._lastScanTime) return false;
      return Date.now() - this._lastScanTime < this.STALE_MS;
    },

    async scan(force) {
      const root = AgentTools.baseDir();
      if (!root) return null;
      if (this._scanning) return this._cache;

      // Return cached if fresh and same root
      if (!force && this._cache && this._lastScanRoot === root && this.isFresh()) {
        return this._cache;
      }

      this._scanning = true;
      try {
        const collected = await AgentTools.collectFiles(root, 4, "", 500);
        this._cache = {
          root: collected.root,
          files: collected.files || [],
          scannedAt: new Date().toISOString(),
          count: (collected.files || []).length,
        };
        this._lastScanRoot = root;
        this._lastScanTime = Date.now();

        // Persist to localStorage for instant load next time
        this._persist(root);

        return this._cache;
      } catch (error) {
        // If scan fails, try to load from localStorage
        return this._loadPersisted(root);
      } finally {
        this._scanning = false;
      }
    },

    _storageKey(root) {
      let hash = 0;
      const str = String(root || "").toLowerCase();
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      return this.STORAGE_PREFIX + Math.abs(hash).toString(36);
    },

    _persist(root) {
      if (!this._cache) return;
      const key = this._storageKey(root);
      // Only store file paths/names to save space (not content)
      const compact = {
        root: this._cache.root,
        files: (this._cache.files || []).slice(0, 300).map((f) => ({
          path: f.path,
          name: f.name,
          size: f.size,
        })),
        scannedAt: this._cache.scannedAt,
        count: this._cache.count,
      };
      Store.setJson(key, compact);
    },

    _loadPersisted(root) {
      const key = this._storageKey(root);
      const data = Store.getJson(key, null);
      if (data && Array.isArray(data.files)) {
        this._cache = data;
        this._lastScanRoot = root;
        // Use actual scannedAt timestamp for freshness check
        this._lastScanTime = data.scannedAt ? new Date(data.scannedAt).getTime() : 0;
        return this._cache;
      }
      return null;
    },

    loadOrScan() {
      const root = AgentTools.baseDir();
      if (!root) return null;

      // Try memory cache first
      if (this._cache && this._lastScanRoot === root) return this._cache;

      // Try localStorage
      const persisted = this._loadPersisted(root);
      if (persisted) {
        // Background re-scan if stale
        if (!this.isFresh()) {
          setTimeout(() => this.scan(true), 1000);
        }
        return persisted;
      }

      // Start async scan
      this.scan(false);
      return null;
    },

    fileNames() {
      if (!this._cache || !this._cache.files) return [];
      return this._cache.files.map((f) => f.name || f.path || "");
    },

    search(query) {
      if (!this._cache || !this._cache.files) return [];
      const q = String(query || "").toLowerCase();
      if (!q) return [];
      return this._cache.files
        .filter((f) => {
          const name = String(f.name || f.path || "").toLowerCase();
          return name.includes(q);
        })
        .slice(0, 30);
    },

    invalidate() {
      this._cache = null;
      this._lastScanTime = 0;
    },
  };

  // ---- features/voice-input.js ----
  /**
   * Feature 6: Voice Input
   *
   * Adds a microphone button that uses Android's native speech-to-text
   * (Web Speech API / SpeechRecognition) to transcribe voice into the
   * prompt textarea.
   */
  const VoiceInput = {
    _recognition: null,
    _listening: false,
    _supported: false,

    isSupported() {
      if (this._supported) return true;
      this._supported = Boolean(
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition,
      );
      return this._supported;
    },

    isListening() {
      return this._listening;
    },

    start(onResult, onEnd) {
      if (!this.isSupported()) {
        Acode.toast("Voice input not supported in this WebView");
        return false;
      }
      if (this._listening) {
        this.stop();
        return false;
      }

      const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition;

      this._recognition = new SpeechRecognition();
      this._recognition.continuous = false;
      this._recognition.interimResults = true;
      this._recognition.lang = navigator.language || "en-US";
      this._recognition.maxAlternatives = 1;

      this._recognition.onresult = (event) => {
        let transcript = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        if (typeof onResult === "function") onResult(transcript, isFinal);
      };

      this._recognition.onerror = (event) => {
        const msg = event.error === "no-speech"
          ? "No speech detected"
          : event.error === "not-allowed"
            ? "Microphone permission denied"
            : "Voice error: " + (event.error || "unknown");
        Acode.toast(msg);
        this._listening = false;
        if (typeof onEnd === "function") onEnd();
      };

      this._recognition.onend = () => {
        this._listening = false;
        if (typeof onEnd === "function") onEnd();
      };

      try {
        this._recognition.start();
        this._listening = true;
        return true;
      } catch (error) {
        Acode.toast("Voice start failed: " + (error.message || error));
        this._listening = false;
        return false;
      }
    },

    stop() {
      if (this._recognition) {
        try { this._recognition.stop(); } catch (_) {}
      }
      this._listening = false;
    },

    toggle(onResult, onEnd) {
      if (this._listening) {
        this.stop();
        return false;
      }
      return this.start(onResult, onEnd);
    },

    buttonHtml() {
      if (!this.isSupported()) return "";
      const active = this._listening ? " active" : "";
      return `<button class="ace-ai-chip ace-ai-voice-btn${active}" data-act="voice-input" aria-label="Voice input" title="Tap to speak">${this._listening ? "🔴" : "🎤"}</button>`;
    },
  };

  // ---- features/mobile-ux.js ----
  /**
   * Feature 7: Mobile UX Improvements
   *
   * Adds swipe gestures, haptic feedback, compact mode detection,
   * and floating bubble for quick access.
   */
  const MobileUX = {
    _swipeStartX: 0,
    _swipeStartY: 0,
    _swipeThreshold: 80,
    _compact: false,
    _bubble: null,
    _handlers: [],

    isCompact() {
      return window.innerWidth < 380 || window.innerHeight < 640;
    },

    haptic(type) {
      try {
        if (navigator.vibrate) {
          if (type === "light") navigator.vibrate(10);
          else if (type === "medium") navigator.vibrate(25);
          else if (type === "heavy") navigator.vibrate([30, 10, 30]);
          else navigator.vibrate(15);
        }
      } catch (_) {}
    },

    installSwipe(root) {
      if (!root) return;
      const onTouchStart = (ev) => {
        const touch = ev.touches[0];
        if (!touch) return;
        this._swipeStartX = touch.clientX;
        this._swipeStartY = touch.clientY;
      };

      const onTouchEnd = (ev) => {
        const touch = ev.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - this._swipeStartX;
        const dy = touch.clientY - this._swipeStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Only handle horizontal swipes that are clearly horizontal
        if (absDx < this._swipeThreshold || absDy > absDx * 0.6) return;

        // Don't interfere with scroll areas
        const target = ev.target;
        if (target?.closest?.(".ace-ai-chatlog, .ace-ai-conversation, .ace-ai-tool-diff")) return;

        if (dx > 0) {
          // Swipe right — go back / close panel
          this.haptic("light");
          UI.handleBackAction();
        } else {
          // Swipe left — open review if tools are pending
          if (State.pendingTools.length) {
            this.haptic("light");
            State.activeTab = "changes";
            UI.render(root);
          }
        }
      };

      root.addEventListener("touchstart", onTouchStart, { passive: true });
      root.addEventListener("touchend", onTouchEnd, { passive: true });
      this._handlers.push(
        [root, "touchstart", onTouchStart],
        [root, "touchend", onTouchEnd],
      );
    },

    installCompactMode(root) {
      if (!root) return;
      const check = () => {
        const compact = this.isCompact();
        root.classList.toggle("ace-ai-compact-device", compact);
        this._compact = compact;
      };
      check();
      const handler = Util.debounce(check, 300);
      window.addEventListener("resize", handler);
      this._handlers.push([window, "resize", handler]);
    },

    installBubble() {
      // Floating action bubble — alternative to side button
      if (this._bubble) return;
      const bubble = document.createElement("button");
      bubble.className = "ace-ai-bubble";
      bubble.textContent = "✦";
      bubble.setAttribute("aria-label", "Open Ace AI");
      bubble.style.cssText = `
        position:fixed;right:12px;bottom:90px;z-index:2147483000;
        width:44px;height:44px;border-radius:50%;border:1px solid rgba(77,163,255,.5);
        background:rgba(15,17,23,.95);color:#4da3ff;font-size:18px;font-weight:900;
        box-shadow:0 4px 20px rgba(0,0,0,.4);touch-action:manipulation;
        display:flex;align-items:center;justify-content:center;
        transition:transform .15s ease,box-shadow .15s ease;
      `;
      bubble.addEventListener("click", () => {
        this.haptic("medium");
        UI.openPanel("chat");
      });

      // Make it draggable
      let dragging = false;
      let offsetY = 0;
      bubble.addEventListener("touchstart", (ev) => {
        const touch = ev.touches[0];
        offsetY = touch.clientY - bubble.getBoundingClientRect().top;
        dragging = false;
      }, { passive: true });
      bubble.addEventListener("touchmove", (ev) => {
        dragging = true;
        const touch = ev.touches[0];
        const y = Math.max(20, Math.min(window.innerHeight - 60, touch.clientY - offsetY));
        bubble.style.bottom = "auto";
        bubble.style.top = y + "px";
        ev.preventDefault();
      }, { passive: false });
      bubble.addEventListener("touchend", () => {
        if (dragging) {
          dragging = false;
          return;
        }
      });

      document.body.appendChild(bubble);
      this._bubble = bubble;
    },

    removeBubble() {
      if (this._bubble) {
        try { this._bubble.remove(); } catch (_) {}
        this._bubble = null;
      }
    },

    css() {
      if (document.getElementById("ace-ai-style-mobile-ux")) return;
      const style = document.createElement("style");
      style.id = "ace-ai-style-mobile-ux";
      style.textContent = `
  .ace-ai-compact-device .ace-ai-msg{padding:8px;font-size:12px}
  .ace-ai-compact-device .ace-ai-card{padding:8px}
  .ace-ai-compact-device .ace-ai-textarea{min-height:36px;max-height:68px;font-size:12px}
  .ace-ai-compact-device .ace-ai-chip{padding:5px 8px;font-size:11px}
  .ace-ai-compact-device .ace-ai-iconbtn{min-width:32px;min-height:32px}
  .ace-ai-compact-device .ace-ai-brand{font-size:13px}
  .ace-ai-compact-device .ace-ai-head{padding:7px 9px}
  .ace-ai-voice-btn{display:inline-flex;align-items:center;gap:4px}
  .ace-ai-voice-btn.active{border-color:rgba(220,38,38,.6);background:rgba(220,38,38,.12);animation:ace-ai-pulse 1.1s ease-in-out infinite}
  .ace-ai-bubble{cursor:pointer}
  .ace-ai-bubble:active{transform:scale(.9);box-shadow:0 2px 10px rgba(0,0,0,.3)}
  `;
      document.head.appendChild(style);
    },

    cleanup() {
      this._handlers.forEach(([el, event, fn]) => {
        try { el.removeEventListener(event, fn); } catch (_) {}
      });
      this._handlers = [];
      this.removeBubble();
    },
  };

  // ---- features/intent-handler.js ----
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
            let decodedQuery;
            try {
              decodedQuery = decodeURIComponent(query);
            } catch (_) {
              decodedQuery = query;
            }
            State.draftPrompt = decodedQuery;
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
            let decodedDefault;
            try {
              decodedDefault = decodeURIComponent(query);
            } catch (_) {
              decodedDefault = query;
            }
            State.draftPrompt = decodedDefault;
          }
      }
    },

    uninstall() {
      this._installed = false;
    },
  };

  // ---- ui/templates.js ----
  const Templates = {
    neosantaraHtml(widgetId) {
      const id = String(widgetId || "").trim() || "YOUR_WIDGET_ID";
      return `<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="${id}"\n  async\n></script>`;
    },
    neosantaraPhp(widgetId) {
      const id = String(widgetId || "").trim() || "YOUR_WIDGET_ID";
      return `<?php\n$neosantaraWidgetId = htmlspecialchars('${id}', ENT_QUOTES, 'UTF-8');\n?>\n<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="<?= $neosantaraWidgetId ?>"\n  async\n></script>`;
    },
    acodeSkeleton() {
      return `// main.js\n(function () {\n  const PLUGIN_ID = 'your.plugin.id';\n\n  acode.setPluginInit(PLUGIN_ID, (baseUrl, $page, cache) => {\n    $page.innerHTML = '<h1>Hello Acode</h1>';\n    const open = () => $page.show();\n\n    try {\n      const commands = acode.require('commands');\n      commands.addCommand({ name: 'your-plugin.open', description: 'Open Your Plugin', exec: open });\n    } catch (_) {}\n  });\n\n  acode.setPluginUnmount(PLUGIN_ID, () => {\n    try { acode.require('commands').removeCommand('your-plugin.open'); } catch (_) {}\n  });\n})();`;
    },
  };

  // ---- ui/base-ui.js ----
  const ACE_AI_LOGO =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAASq0lEQVR4nO3de4wV1R0H8O+9u8vuXWDlsQvyrlRAVvARHgu4SBfBFkQINU1tmvSPkjRNkUasaQy1jenD2KSC8dHYh6Zp/7E2xCIo9qFEWcQFEx+YImsFDGhAqLSwsC6wu/1jmcvs3Zm58zhnzjlzvp9kk4U7d+bcu/P7njPvXF1tDTTRq7oBRCnLqW5ApcJls+DJdqU1kHogpB0ALHoif+76SCUM0ggAFj1RdKmEgcwAYOETieHUkvAgkBEALHwiOYQHQV7UjC5h8RPJJ6zORI0AWPhE6RIyGhAxAmDxE6mTqP6SBgCLn0i92HUYdxOAhU+kl1ibBHFGACx+In1Fqs+oAcDiJ9Jf6DqNEgAsfiJzhKpX0ecBEJFBwgYAe38i85St2zABwOInMldg/ZYLABY/kfl865j7AIgsFhQA7P2JssOznv3OBDS6+PeuW5V4HnMe2yKgJaQTrhfoRcmZgpnbBBDxRxY5H9ID1wtvOY+7Ahvb+7v/OPOf2hF7PrvXtBR/NzzxCVwvPBRHAZkZAYj6I5e+P2uJbxuuF8FKA8DY3t9R7o+8e01L8SfJfMgsXC/6Kda5yucCpMrrD+v8X0b+qBSD7etFZjYBiCg6dwAYP/z3U25YV+51yibL14tegCMAIqsxAIgs5gRAZof/QPmdOTbs7KGBuF6glyMAIotVKn9AeUqcNHfv2Amb8LZ8Rzayfb2w5jwAhwXDOorB1vUij4xv/xORP+4DILIYA4DIYgwAIovlrqit0X4fwJ6MXHpJ9pmr+X0DtA0AFj1ljY5hoF0AsPAp63QKAq0CwK/4bT1GS+bzu6JQlxDQIgC8Cp9FT1njFQaqg0D5UQAWP9nCa71Wvcmr1anALHzKOq9rD1RSOgLYI/COrUQmca/vKkcBygJA9dCHSCeq6kH5PgCAvT/ZSYf1XkkAcOhP1Ef1poAWIwAiUoMBQGSx1AOAw3+i/lRuBmh1HkBUuhxLJTK1MzMyAFj4pBtTnydoXACUFv+NGzcraglRn7fuuaP4++41LUaFgFEB4C5+Fj7pwlkXnSAwKQSMCQCn+N2F705eIpVu3Li5XxCYEgJGHAb02uZn8ZNOvNZHE/ZVGREAjtKhFpFOnPXSpM1T7QOgNEVZ/KSz0vVT91GAMfsATErVrDt14GPVTSgaPm2c6iZ4unHjZiM6K2MCwERTH3qm+Hv7fXcqbIkY5Qq/6bmdxd/bVi+U3RwAl9ukaxDoTvtNAFO5i9/r36aJUvxe/5ZNp1GJSRKNAMKct6z6pocq+BX71IeeMXIkELX43f+f1kgA6GtnFkcCMuusMhfzIedtd4W7aGHPulVoelxcCJiybRVGc8D30hry+zXJipf2+L627StzU2yJPCL2VblrUnadxRoBuBsVdLKDswe07S6GgFtQ4ZdOozoIRAytgwq/dJqkQaByFCB6R3UadRZ5H0DYRpW+HjbJwtL5qIDfML/9vjtDFb9b1OlV8Bvmt61eGKr43aJOrwtVxV/6etQ6i70PIOxpjvOf2iHtWKiKEAg78mi/784BRwHiFnPz41sSjQSSfE+v3DYv1HRtqxcOOAoQt5hXvLQn0UhA584hKtl1xsOAErlHAkl78qQhkAb3SCBpT540BCgcHgZMQVDxf9rROeAnznx0ElT8Jzq7BvzEmQ+JwQBQyK/Yg0LAZH7FHhQCJFfsTQDdz3HWhV+vXa7IP+3oxKghBc/56bwp4NdrlyvyE51daChUe87P5k0B2XXGEYACYXv4rIwEwvbwHAmkjwFAZDEGAJHFGABEFmMAEFmMAaCA1979JNPpzmvvfpLpSBwGgGR+h+zKFbff6zofAgT8L+YpV9x+r9t8CDANDACF/Io8Kz1/Kb8iZ8+vDgMgBUG99qghhQE/ceajk6Beu6FQPeAnznxIDAZASpIWrynF70havCz+dDAAUhS3iE0rfkfcImbxp4cBkLKoxWxq8TuiFjOLP128H0BEIm5H5hR1GvcETHpzjMUvvBH6piB+nKJO456Ai194Q8h8bMEAUMj03j0q9u764SZADKbcckpUO03pVU1pp04YADHpHgKi26d7cenePl1xEyABHZ9WLDOYnCJLuk9AJBZ+MsYEwFv33KFtr6tru2Rh0ZWnU6cQRPtNgLC3RSbSke7rr/YB4GZKqpLdTFpPjQgA3VOUyIsJ660x+wCcJ5846Wrbdjfpz93zm1D8QAqPBgPE3drY/fgjBgHponTIL7L4ZdeZMSMAR+kz0Eza3qLsM6Xnd1Tmyk8jjKhlOV8yH05CuhBZ+EnrJMr7jRsBuJmWtkS6iX0UIGzvy16aKD7ZdRY5AOa5LmEtt1D36/MMebItkQ7SqrNYmwDzHt+CNy5dyhomeVj8RNGlUWexNwHCLozFTxSf7DpLtBNQp+IOSsignYUvNk/1fW15azuXp/nybCCzzow4FbicKNtIbkEra9DrXJ4ey6PkjA+AuHtJy62sftNxeXosj8QwPgCIKD4GAJHFGABEFmMAEFmMAUBkMQYAkcUYAEQWYwAQWYwBQGSx1AMgymWORDZQedk8RwBEFmMAEFlMSQCI3AwIe6lo6XRBl6YGTcfl6bG8rFB91ywtRgCyQ8Dv9XIrrd/rXJ4eyzOdDvvAcsMH1/SqWrhzuyMgu39kIj+qe39A8QiARwTIVjoUP6DZcwGcL4WjAcoq3To65fsAvNJPty+JSASv9Vr1fTWV7gMo5d4n4MYRAZnKrzNTXfgOrQIA8A8BCqYiJDlSi0eX4gc02wcAXP5yGASUNToVvkO7AHC4vyyGAZlKx6J3024TgOLJFepSX2Zv5+nUl0liVeZySZ9Grt7utStVN4EsNf+J51U3IZHciCEFY0cALHzShalBYGQAsPBJV6YFgXEB4FX8PE+AVPE6FGpSCBgVAKXFz8InXZQGgSkhoPxU4LBY/KSz0vXRlM1UYwLAjcVPOjJxvTQiANxpauKXTPZwr58mjAJSOxMwzJdhynYTUVK61EMqI4CwSeg1HXt/Mk25UUCSehBN+gjA+RBhinf3mhbsXrtSSvLxyjWKSkaHo0s9OKQGQJQP60wn+kM7hT9zk94XZZB+9q3vuwhNVBDoUA+lpG0CRP2wDmd6EcOf3WtaMHPTFhY/xeKsOyJGjzrUgxcjjgLE4RQ/UVKiQkBHmQwAFj+JltUQyGQAEFE48o8CpJya7P1JlpmbtmDf+lWJdgrqNorgCIDIYgwAIosxAIgsxgAgshgDgMhiDAAiizEAiCzGACCyGAOAyGLaPhswbRX5HHZ858sYXqiO9L7b//AyDp/qKDvdrHEj8dUZE7Fg0iiMKFQjnw9+IlMvgAsXe3DwVAe2HziKI/89i40r5kRqWznnu3sw69GtQucpS9eDdytbdvWGR5QtWzYGwCU3XzU6cvEDwMrGCXh0137f12+dOhb33jwDY4YWIs03B2BQZR7XNNThmoZGGHPvdgm6Hrwbba2tSpef1RDgJsAlt0+fEOt9K6ZPgFdfXqiqwC+Xz8LDt82JXPxezH+CYzyqix8A2lpblY5AZGIAAKirqcKiyVfGeu+YoQXMnVDf7/+qKvL49ep5WD5tvIjmWUuH4ndkNQS4CQBg2bTxGFQRPwtvb5yItiMni/++f/F1mD2uPuAdA3V0XcD5nh4ML1QL6e0f+Mfb2PzeRwLmpIZOxe9oa21FU3MzgOzcnJYBAGBlzOG/Y+mUMfjFKxXovNCNxtHDsHrGpEjvf+z1/fhtWzsAYGxdLX60eCaq8hV9L+b6hv9Dq6tw7ehhidpJVKpS523LNNo2afgQXDdmeKJ51FZVYsnVY7F1/xF8t2lapHY/886hYvEDwCenz2HtX9sGTDdnfD2e/tpNidpJaohaj2XUg/X7AJL2/sX5NE5AdWUeCyY1hH5P54WLgUcQqLyRC5eg6bmdxZ/CxMkDprnmJw+j6bmdmPXHbQpaqDerAyAHYMV0MTvq5k6oR8vkK1FdWRH6Pa8ePI4zXReELN9WDYuXBf6bgknfBxDn9klp3TZpzoR6jK2rFTKvfC6HpVPHRXrPvuOnhCzbywNLb8ADS28InOZnL7+DZ989LK0Nsg0a2YArrp8NAOg48B6GTJuB+kW34sifnkRvd7fi1nnTrR6sHgGIGv47Zo8bGWn6z86dF7p82zS0LANyeVw88z98+MjPgd5eVA0bgWGz5qtumjGsDYCaygosmTJW6DxH1EY/k5Diq7803D/52j/x+bGPcfq9twAADYuXq2yWUawNgCVTxmLwILVHQUfUDlK6fJMNbbweNWP69t+c3LEdAHBix0sAgGGz56OqbpiqphlFWgUseOJ5vL52JXavaYm03eNs7yyQ/GjkKMP/k2e7UD9YfO8+c3Syw49BTD8RqBz3zr4Zv/p9v9dyFZUYuehWHNv6bNrN8qVrPUgdATiNDrsTI63iHzWkBk0Tw5+pJ6P4AWDR5NEYWl0lZd5Zlq+pwYgFfevK/h9/H22rFxZ/Dv/mYQB6bgboWA/Sx8Du5As7vWwrpk9APqf+FKhCVSXWLZiOB3e8q7opRhkxvwUVhVqgtwdn//1+v9c62v8FAKj9whcxePJUnD3Y7jULZXSrh1Q2gp0PHWa6NMS98k+Gb9xwFY51dOLpvR8A6DsVeEPLTFQVr03IIYde1FVzf4Gj4Za+3r3zyGF0f97Z77VzH32InvNdyA+qRsMty7ULAECvekhtL1haxV3OtaOH4eqRQ1U3o5/1zY1YM3sKLvR0Y0ShBhoMTrS2//51vq/1dndj79eX9Pu/93/6A9lNikyXerDuYqCVjeF7//PdPVj05HZ0nL8IAHj2m1/C9FFXhHrv2fMXIx1lqKupAiBuf0CYE4EA4K4tbXj14DFhyyWzWHUYsDKfx7Jp4c/We+3Q8WLxA8D2A0dDv3fwoErs+uh4pPbRZdUbHrl06a0+mpqb0X7ikOpmCGVVACy8alSk235tf79/wW8/8HGkW3PtP34aP3zxTRzr6Cw/cRk23hJMpxBoam7O5G3BrAqAlY0TQ0977sJFvHqofw9+7Ewn3v7ks9DzWDF9PP7W/gmW/u7v+PZfdmHb/qP4z7ku9PSWL2fnpqAfnDyDR3ftx73b9oZebpboEAJZLX7Asn0A67fuSTyPb/15Z6z37T16EnuPniw/YYCZm7Yker+pqjc8wrsCS2JVAJC5slyEKlm1CUBE/TEAiCzGACCyGAOAyGIMACKLMQCILMYAILIYA4DIYgwAIosxAIgsxgAgshgDgMhiDAAiizEAiCxWyRtQEsmlc41xBEBkMStvCLJv/ari7zLusvPa8tnF329+8U3h82f7g8luv/uhHnEe960T60YA7pXP699JuVc+r38nxfYHk93+UmGf8KMrqwLAb2UTtRL6rWyiVkK2P5iq9pscAlZuAngR3RMNmH+E5xHEmj/bHzz/EO238aarDIBLRPzxg3oaEduiQUXC9stvfxZZtQngt5KJSn6/lUzUysf2B1PVfpN3BFoVAMDAP6LoYV/pyia652H7g8lufymTix+wdBNA9rae7JWO7Q/Gog/PuhEAEV2WuQCY/9QO6XuUyU771q/KVO8PZDAAiCi8TAYARwEkWhZ7fyCjAQAwBEicrBY/kPGjAO4QsPEsL0rGWXeyWvxAxgMAuPzH42iAospy4TsyHwAOG/6YRFFldh8AEZXHACCymPYBcNOvny/+bvJ112QP93rqXn91pH0AEJE8RgQARwFkCpN6f8CQACjFECAdmbheGhMApWlq4pdN2VW6PprQ+wNArn5ooVd1I6LY9b2VA/6Px/hJFa+OyJTiBwwMAMA7BIh0YFLxA4YGgINBQLowrfAdRgeAg0FAqpha+I5MBAARxWPNxUBpUzEqSbM3yvrns0UegMYPLzaTqk2StJab9c9nk1zD0AIAcDNAkNZLK6mKQ5POIalmiT1l1j+fbYw5EcgEKovDvdxWST1l1j+fjRgAgqguDoesIsn657OVEwDcD0BknxxHAEQWYwAQWcwdANwMILJHDuAIgMhqDAAii5UGADcDiLKvWOccARBZzCsAOAogyq5+9c0RAJHF/AKAo4CInAtUVN+sVNYFM1n/fJYYUNdBIwCGQESqi0R2cWT982WcZz07lwP74WXCMai8UCWN4sj658sozwAotw+Ao4AYVK2kaS03658vg3zruNwIwMGRAJGZAjvxsEcBOBIgMk/ZuuVhQCKLRQkAjgKIzBGqXqOOABgCRPoLXadxNgEYAkT6ilSfcR8M4iyERweI9BCrY066E5CjASL1YtehiKMADAEidRLVn6hnA3KTgChdQjpe0ecBcDRAJJ+wOpPxdGCOBojkEN7Bynw8OIOASAxpI2uZAeBwN55hQBROKpvTaQSAG8OAyF/q+9D+D4fF3tyR9NKFAAAAAElFTkSuQmCC";
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
      ThemeSystem.applyToPanel(panel);
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
      ThemeSystem.applyToPanel(State.panel);
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

  // ---- ui/v8-layer.js ----
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
  <div class="ace-ai-head"><div class="ace-ai-head-main"><div class="ace-ai-brand-wrap"><img class="ace-ai-brand-logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAASq0lEQVR4nO3de4wV1R0H8O+9u8vuXWDlsQvyrlRAVvARHgu4SBfBFkQINU1tmvSPkjRNkUasaQy1jenD2KSC8dHYh6Zp/7E2xCIo9qFEWcQFEx+YImsFDGhAqLSwsC6wu/1jmcvs3Zm58zhnzjlzvp9kk4U7d+bcu/P7njPvXF1tDTTRq7oBRCnLqW5ApcJls+DJdqU1kHogpB0ALHoif+76SCUM0ggAFj1RdKmEgcwAYOETieHUkvAgkBEALHwiOYQHQV7UjC5h8RPJJ6zORI0AWPhE6RIyGhAxAmDxE6mTqP6SBgCLn0i92HUYdxOAhU+kl1ibBHFGACx+In1Fqs+oAcDiJ9Jf6DqNEgAsfiJzhKpX0ecBEJFBwgYAe38i85St2zABwOInMldg/ZYLABY/kfl865j7AIgsFhQA7P2JssOznv3OBDS6+PeuW5V4HnMe2yKgJaQTrhfoRcmZgpnbBBDxRxY5H9ID1wtvOY+7Ahvb+7v/OPOf2hF7PrvXtBR/NzzxCVwvPBRHAZkZAYj6I5e+P2uJbxuuF8FKA8DY3t9R7o+8e01L8SfJfMgsXC/6Kda5yucCpMrrD+v8X0b+qBSD7etFZjYBiCg6dwAYP/z3U25YV+51yibL14tegCMAIqsxAIgs5gRAZof/QPmdOTbs7KGBuF6glyMAIotVKn9AeUqcNHfv2Amb8LZ8Rzayfb2w5jwAhwXDOorB1vUij4xv/xORP+4DILIYA4DIYgwAIovlrqit0X4fwJ6MXHpJ9pmr+X0DtA0AFj1ljY5hoF0AsPAp63QKAq0CwK/4bT1GS+bzu6JQlxDQIgC8Cp9FT1njFQaqg0D5UQAWP9nCa71Wvcmr1anALHzKOq9rD1RSOgLYI/COrUQmca/vKkcBygJA9dCHSCeq6kH5PgCAvT/ZSYf1XkkAcOhP1Ef1poAWIwAiUoMBQGSx1AOAw3+i/lRuBmh1HkBUuhxLJTK1MzMyAFj4pBtTnydoXACUFv+NGzcraglRn7fuuaP4++41LUaFgFEB4C5+Fj7pwlkXnSAwKQSMCQCn+N2F705eIpVu3Li5XxCYEgJGHAb02uZn8ZNOvNZHE/ZVGREAjtKhFpFOnPXSpM1T7QOgNEVZ/KSz0vVT91GAMfsATErVrDt14GPVTSgaPm2c6iZ4unHjZiM6K2MCwERTH3qm+Hv7fXcqbIkY5Qq/6bmdxd/bVi+U3RwAl9ukaxDoTvtNAFO5i9/r36aJUvxe/5ZNp1GJSRKNAMKct6z6pocq+BX71IeeMXIkELX43f+f1kgA6GtnFkcCMuusMhfzIedtd4W7aGHPulVoelxcCJiybRVGc8D30hry+zXJipf2+L627StzU2yJPCL2VblrUnadxRoBuBsVdLKDswe07S6GgFtQ4ZdOozoIRAytgwq/dJqkQaByFCB6R3UadRZ5H0DYRpW+HjbJwtL5qIDfML/9vjtDFb9b1OlV8Bvmt61eGKr43aJOrwtVxV/6etQ6i70PIOxpjvOf2iHtWKiKEAg78mi/784BRwHiFnPz41sSjQSSfE+v3DYv1HRtqxcOOAoQt5hXvLQn0UhA584hKtl1xsOAErlHAkl78qQhkAb3SCBpT540BCgcHgZMQVDxf9rROeAnznx0ElT8Jzq7BvzEmQ+JwQBQyK/Yg0LAZH7FHhQCJFfsTQDdz3HWhV+vXa7IP+3oxKghBc/56bwp4NdrlyvyE51daChUe87P5k0B2XXGEYACYXv4rIwEwvbwHAmkjwFAZDEGAJHFGABEFmMAEFmMAaCA1979JNPpzmvvfpLpSBwGgGR+h+zKFbff6zofAgT8L+YpV9x+r9t8CDANDACF/Io8Kz1/Kb8iZ8+vDgMgBUG99qghhQE/ceajk6Beu6FQPeAnznxIDAZASpIWrynF70havCz+dDAAUhS3iE0rfkfcImbxp4cBkLKoxWxq8TuiFjOLP128H0BEIm5H5hR1GvcETHpzjMUvvBH6piB+nKJO456Ai194Q8h8bMEAUMj03j0q9u764SZADKbcckpUO03pVU1pp04YADHpHgKi26d7cenePl1xEyABHZ9WLDOYnCJLuk9AJBZ+MsYEwFv33KFtr6tru2Rh0ZWnU6cQRPtNgLC3RSbSke7rr/YB4GZKqpLdTFpPjQgA3VOUyIsJ660x+wCcJ5846Wrbdjfpz93zm1D8QAqPBgPE3drY/fgjBgHponTIL7L4ZdeZMSMAR+kz0Eza3qLsM6Xnd1Tmyk8jjKhlOV8yH05CuhBZ+EnrJMr7jRsBuJmWtkS6iX0UIGzvy16aKD7ZdRY5AOa5LmEtt1D36/MMebItkQ7SqrNYmwDzHt+CNy5dyhomeVj8RNGlUWexNwHCLozFTxSf7DpLtBNQp+IOSsignYUvNk/1fW15azuXp/nybCCzzow4FbicKNtIbkEra9DrXJ4ey6PkjA+AuHtJy62sftNxeXosj8QwPgCIKD4GAJHFGABEFmMAEFmMAUBkMQYAkcUYAEQWYwAQWYwBQGSx1AMgymWORDZQedk8RwBEFmMAEFlMSQCI3AwIe6lo6XRBl6YGTcfl6bG8rFB91ywtRgCyQ8Dv9XIrrd/rXJ4eyzOdDvvAcsMH1/SqWrhzuyMgu39kIj+qe39A8QiARwTIVjoUP6DZcwGcL4WjAcoq3To65fsAvNJPty+JSASv9Vr1fTWV7gMo5d4n4MYRAZnKrzNTXfgOrQIA8A8BCqYiJDlSi0eX4gc02wcAXP5yGASUNToVvkO7AHC4vyyGAZlKx6J3024TgOLJFepSX2Zv5+nUl0liVeZySZ9Grt7utStVN4EsNf+J51U3IZHciCEFY0cALHzShalBYGQAsPBJV6YFgXEB4FX8PE+AVPE6FGpSCBgVAKXFz8InXZQGgSkhoPxU4LBY/KSz0vXRlM1UYwLAjcVPOjJxvTQiANxpauKXTPZwr58mjAJSOxMwzJdhynYTUVK61EMqI4CwSeg1HXt/Mk25UUCSehBN+gjA+RBhinf3mhbsXrtSSvLxyjWKSkaHo0s9OKQGQJQP60wn+kM7hT9zk94XZZB+9q3vuwhNVBDoUA+lpG0CRP2wDmd6EcOf3WtaMHPTFhY/xeKsOyJGjzrUgxcjjgLE4RQ/UVKiQkBHmQwAFj+JltUQyGQAEFE48o8CpJya7P1JlpmbtmDf+lWJdgrqNorgCIDIYgwAIosxAIgsxgAgshgDgMhiDAAiizEAiCzGACCyGAOAyGLaPhswbRX5HHZ858sYXqiO9L7b//AyDp/qKDvdrHEj8dUZE7Fg0iiMKFQjnw9+IlMvgAsXe3DwVAe2HziKI/89i40r5kRqWznnu3sw69GtQucpS9eDdytbdvWGR5QtWzYGwCU3XzU6cvEDwMrGCXh0137f12+dOhb33jwDY4YWIs03B2BQZR7XNNThmoZGGHPvdgm6Hrwbba2tSpef1RDgJsAlt0+fEOt9K6ZPgFdfXqiqwC+Xz8LDt82JXPxezH+CYzyqix8A2lpblY5AZGIAAKirqcKiyVfGeu+YoQXMnVDf7/+qKvL49ep5WD5tvIjmWUuH4ndkNQS4CQBg2bTxGFQRPwtvb5yItiMni/++f/F1mD2uPuAdA3V0XcD5nh4ML1QL6e0f+Mfb2PzeRwLmpIZOxe9oa21FU3MzgOzcnJYBAGBlzOG/Y+mUMfjFKxXovNCNxtHDsHrGpEjvf+z1/fhtWzsAYGxdLX60eCaq8hV9L+b6hv9Dq6tw7ehhidpJVKpS523LNNo2afgQXDdmeKJ51FZVYsnVY7F1/xF8t2lapHY/886hYvEDwCenz2HtX9sGTDdnfD2e/tpNidpJaohaj2XUg/X7AJL2/sX5NE5AdWUeCyY1hH5P54WLgUcQqLyRC5eg6bmdxZ/CxMkDprnmJw+j6bmdmPXHbQpaqDerAyAHYMV0MTvq5k6oR8vkK1FdWRH6Pa8ePI4zXReELN9WDYuXBf6bgknfBxDn9klp3TZpzoR6jK2rFTKvfC6HpVPHRXrPvuOnhCzbywNLb8ADS28InOZnL7+DZ989LK0Nsg0a2YArrp8NAOg48B6GTJuB+kW34sifnkRvd7fi1nnTrR6sHgGIGv47Zo8bGWn6z86dF7p82zS0LANyeVw88z98+MjPgd5eVA0bgWGz5qtumjGsDYCaygosmTJW6DxH1EY/k5Diq7803D/52j/x+bGPcfq9twAADYuXq2yWUawNgCVTxmLwILVHQUfUDlK6fJMNbbweNWP69t+c3LEdAHBix0sAgGGz56OqbpiqphlFWgUseOJ5vL52JXavaYm03eNs7yyQ/GjkKMP/k2e7UD9YfO8+c3Syw49BTD8RqBz3zr4Zv/p9v9dyFZUYuehWHNv6bNrN8qVrPUgdATiNDrsTI63iHzWkBk0Tw5+pJ6P4AWDR5NEYWl0lZd5Zlq+pwYgFfevK/h9/H22rFxZ/Dv/mYQB6bgboWA/Sx8Du5As7vWwrpk9APqf+FKhCVSXWLZiOB3e8q7opRhkxvwUVhVqgtwdn//1+v9c62v8FAKj9whcxePJUnD3Y7jULZXSrh1Q2gp0PHWa6NMS98k+Gb9xwFY51dOLpvR8A6DsVeEPLTFQVr03IIYde1FVzf4Gj4Za+3r3zyGF0f97Z77VzH32InvNdyA+qRsMty7ULAECvekhtL1haxV3OtaOH4eqRQ1U3o5/1zY1YM3sKLvR0Y0ShBhoMTrS2//51vq/1dndj79eX9Pu/93/6A9lNikyXerDuYqCVjeF7//PdPVj05HZ0nL8IAHj2m1/C9FFXhHrv2fMXIx1lqKupAiBuf0CYE4EA4K4tbXj14DFhyyWzWHUYsDKfx7Jp4c/We+3Q8WLxA8D2A0dDv3fwoErs+uh4pPbRZdUbHrl06a0+mpqb0X7ikOpmCGVVACy8alSk235tf79/wW8/8HGkW3PtP34aP3zxTRzr6Cw/cRk23hJMpxBoam7O5G3BrAqAlY0TQ0977sJFvHqofw9+7Ewn3v7ks9DzWDF9PP7W/gmW/u7v+PZfdmHb/qP4z7ku9PSWL2fnpqAfnDyDR3ftx73b9oZebpboEAJZLX7Asn0A67fuSTyPb/15Z6z37T16EnuPniw/YYCZm7Yker+pqjc8wrsCS2JVAJC5slyEKlm1CUBE/TEAiCzGACCyGAOAyGIMACKLMQCILMYAILIYA4DIYgwAIosxAIgsxgAgshgDgMhiDAAiizEAiCxWyRtQEsmlc41xBEBkMStvCLJv/ari7zLusvPa8tnF329+8U3h82f7g8luv/uhHnEe960T60YA7pXP699JuVc+r38nxfYHk93+UmGf8KMrqwLAb2UTtRL6rWyiVkK2P5iq9pscAlZuAngR3RMNmH+E5xHEmj/bHzz/EO238aarDIBLRPzxg3oaEduiQUXC9stvfxZZtQngt5KJSn6/lUzUysf2B1PVfpN3BFoVAMDAP6LoYV/pyia652H7g8lufymTix+wdBNA9rae7JWO7Q/Gog/PuhEAEV2WuQCY/9QO6XuUyU771q/KVO8PZDAAiCi8TAYARwEkWhZ7fyCjAQAwBEicrBY/kPGjAO4QsPEsL0rGWXeyWvxAxgMAuPzH42iAospy4TsyHwAOG/6YRFFldh8AEZXHACCymPYBcNOvny/+bvJ112QP93rqXn91pH0AEJE8RgQARwFkCpN6f8CQACjFECAdmbheGhMApWlq4pdN2VW6PprQ+wNArn5ooVd1I6LY9b2VA/6Px/hJFa+OyJTiBwwMAMA7BIh0YFLxA4YGgINBQLowrfAdRgeAg0FAqpha+I5MBAARxWPNxUBpUzEqSbM3yvrns0UegMYPLzaTqk2StJab9c9nk1zD0AIAcDNAkNZLK6mKQ5POIalmiT1l1j+fbYw5EcgEKovDvdxWST1l1j+fjRgAgqguDoesIsn657OVEwDcD0BknxxHAEQWYwAQWcwdANwMILJHDuAIgMhqDAAii5UGADcDiLKvWOccARBZzCsAOAogyq5+9c0RAJHF/AKAo4CInAtUVN+sVNYFM1n/fJYYUNdBIwCGQESqi0R2cWT982WcZz07lwP74WXCMai8UCWN4sj658sozwAotw+Ao4AYVK2kaS03658vg3zruNwIwMGRAJGZAjvxsEcBOBIgMk/ZuuVhQCKLRQkAjgKIzBGqXqOOABgCRPoLXadxNgEYAkT6ilSfcR8M4iyERweI9BCrY066E5CjASL1YtehiKMADAEidRLVn6hnA3KTgChdQjpe0ecBcDRAJJ+wOpPxdGCOBojkEN7Bynw8OIOASAxpI2uZAeBwN55hQBROKpvTaQSAG8OAyF/q+9D+D4fF3tyR9NKFAAAAAElFTkSuQmCC" alt="Ace AI logo"><div><div class="ace-ai-brand">Ace AI <span class="ace-ai-mini">v${C.VERSION}</span></div><div class="ace-ai-sub" data-role="context-line">Agent · review before apply</div></div></div></div><div class="ace-ai-actions"><button class="ace-ai-iconbtn ace-ai-header-new" data-act="new-chat" title="Start a clean chat" aria-label="New chat">＋</button><button class="ace-ai-iconbtn" data-act="quick-menu" title="Quick menu" aria-label="Quick menu">⋮</button><button class="ace-ai-iconbtn" data-act="settings" title="Settings" aria-label="Settings">⚙</button><button class="ace-ai-iconbtn" data-act="toggle-max" title="Maximize" aria-label="Maximize">⤢</button><button class="ace-ai-iconbtn" data-act="close" title="Close" aria-label="Close panel">×</button></div></div>
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

  // ---- native/acode-integration.js ----
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
      // Throttle: run at most once per 150ms to avoid excessive DOM queries
      // on every mutation in the document body.
      let pending = false;
      let lastRun = 0;
      const THROTTLE_MS = 150;
      const throttledRun = () => {
        if (pending) return;
        const elapsed = Date.now() - lastRun;
        if (elapsed >= THROTTLE_MS) {
          lastRun = Date.now();
          run();
        } else {
          pending = true;
          setTimeout(() => {
            pending = false;
            lastRun = Date.now();
            run();
          }, THROTTLE_MS - elapsed);
        }
      };
      try {
        const observer = new window.MutationObserver(throttledRun);
        observer.observe(document.body, { childList: true, subtree: true });
        State.selectionMenuObserver = observer;
      } catch (_) {}
      try {
        document.addEventListener("selectionchange", throttledRun, {
          passive: true,
        });
        State.selectionMenuSanitizer = throttledRun;
      } catch (_) {}
      run();
      [120, 800, 1500].forEach((delay) => {
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

  // ---- lifecycle/page.js ----
  const Page = {
    render($page) {
      if (!$page) return;
      $page.innerHTML = `<div style="padding:18px;font-family:system-ui"><h2>Ace AI v${C.VERSION}</h2><p>Acode-native chat-first AI coding assistant with optional approval-first Agent mode. Use side button, selection menu, command palette, or sidebar app.</p><button id="ace-ai-open-page" style="padding:10px 14px;border-radius:12px;border:0;background:#1d2026;color:white;border:1px solid #30343c;font-weight:800">Open Ace AI</button><p style="opacity:.75;font-size:13px">Set your Neosantara API key from Ace AI → Settings.</p></div>`;
      $page
        .querySelector("#ace-ai-open-page")
        ?.addEventListener("click", () => UI.openPanel("chat"));
    },
  };

  // ---- lifecycle/plugin.js ----
  function init(baseUrl, $page, cache) {
    State.baseUrl = baseUrl || "";
    State.cache = cache || null;
    State.page = $page || null;
    try {
      if (window.acode?.addIcon)
        window.acode.addIcon("ace-ai", State.baseUrl + "icon.png", {
          monochrome: false,
        });
    } catch (_) {}
    const errors = [];
    try {
      Runtime.clearTransientState();
    } catch (e) {
      errors.push("Runtime: " + (e.message || e));
    }
    try {
      PermissionModel.resetSession();
    } catch (e) {
      errors.push("Permission: " + (e.message || e));
    }
    try {
      Page.render($page);
    } catch (e) {
      errors.push("Page: " + (e.message || e));
    }
    try {
      Native.install();
    } catch (e) {
      errors.push("Native: " + (e.message || e));
    }
    try {
      ThemeSystem.css();
      ThemeSystem.install();
    } catch (e) {
      errors.push("Theme: " + (e.message || e));
    }
    try {
      MobileUX.css();
      MobileUX.installBubble();
    } catch (e) {
      errors.push("MobileUX: " + (e.message || e));
    }
    try {
      IntentHandler.install();
    } catch (e) {
      errors.push("Intent: " + (e.message || e));
    }
    try {
      FileIndex.loadOrScan();
    } catch (e) {
      errors.push("FileIndex: " + (e.message || e));
    }
    try {
      // Restore project-specific chat history if available
      const restored = ProjectHistory.restore();
      if (restored) State.projectHistoryRestored = true;
    } catch (e) {
      errors.push("ProjectHistory: " + (e.message || e));
    }
    try {
      GhostComplete.install();
    } catch (e) {
      errors.push("GhostComplete: " + (e.message || e));
    }
    if (errors.length) {
      Acode.toast(
        "Ace AI v" +
          C.VERSION +
          " partially loaded (" +
          errors.length +
          " warning" +
          (errors.length > 1 ? "s" : "") +
          ")",
      );
      console.warn("Ace AI init warnings:", errors);
    } else {
      Acode.toast("Ace AI v" + C.VERSION + " ready");
    }
  }

  function unmount() {
    try {
      // Save project chat before cleanup
      ProjectHistory.saveCurrentChat();
    } catch (_) {}
    try {
      GhostComplete.uninstall();
    } catch (_) {}
    try {
      ThemeSystem.uninstall();
    } catch (_) {}
    try {
      MobileUX.cleanup();
    } catch (_) {}
    try {
      IntentHandler.uninstall();
    } catch (_) {}
    try {
      VoiceInput.stop();
    } catch (_) {}
    try {
      Native.cleanup();
    } catch (e) {
      console.warn("Ace AI unmount error:", e.message || e);
    }
    try {
      if (State._abortController) State._abortController.abort();
    } catch (_) {}
  }

  if (window.acode && typeof window.acode.setPluginInit === "function") {
    window.acode.setPluginInit(C.PLUGIN_ID, init);
    window.acode.setPluginUnmount(C.PLUGIN_ID, unmount);
  } else {
    console.warn("Ace AI: acode global not found.");
  }

})();
