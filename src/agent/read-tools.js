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
