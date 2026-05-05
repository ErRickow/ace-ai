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
  markdown(text) {
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
    return blocks.join("") || "";
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
