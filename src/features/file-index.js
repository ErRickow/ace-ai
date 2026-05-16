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
