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
    }
  },
};
