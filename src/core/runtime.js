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
