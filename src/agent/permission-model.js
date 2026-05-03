const PermissionModel = {
  sessionAllowed: {},
  permissionForTool(tool) {
    const name = String(tool?.name || '');
    if (name === 'replace_selection' || name === 'insert_at_cursor') return 'edit.selection';
    if (name === 'create_file') return 'edit.create';
    if (name === 'write_file' || name === 'replace_file' || name === 'append_file') return 'edit.file';
    return 'edit';
  },
  patternForTool(tool) {
    const target = tool?.path || tool?.appliesTo || tool?.name || '*';
    return String(target || '*');
  },
  actionFor(tool) {
    const permission = this.permissionForTool(tool);
    const pattern = this.patternForTool(tool);
    const mode = State.permissionMode || Store.settings().permissionMode || 'safe';
    const key = permission + ':' + pattern;
    if (this.sessionAllowed[key] || this.sessionAllowed[permission + ':*']) return 'allow';
    if (mode === 'autopilot') return 'allow';
    if (mode === 'balanced' && (permission === 'edit.selection')) return 'allow';
    return 'ask';
  },
  evaluateSelection() {
    const selected = AgentTools.selectedTools();
    if (!selected.length) return { action: 'deny', reason: 'No selected tools' };
    const actions = selected.map((tool) => this.actionFor(tool));
    if (actions.includes('deny')) return { action: 'deny', reason: 'A selected tool is denied by permission rules' };
    if (actions.includes('ask')) return { action: 'ask', reason: 'Approval required for selected write tools' };
    return { action: 'allow', reason: 'Selected tools are allowed by current permission mode' };
  },
  rememberAlways() {
    AgentTools.selectedTools().forEach((tool) => {
      const permission = this.permissionForTool(tool);
      const pattern = this.patternForTool(tool);
      this.sessionAllowed[permission + ':' + pattern] = true;
    });
  },
  resetSession() {
    this.sessionAllowed = {};
  },
  label() {
    const mode = State.permissionMode || Store.settings().permissionMode || 'safe';
    if (mode === 'autopilot') return 'Autopilot: selected write tools can be applied after review.';
    if (mode === 'balanced') return 'Balanced: selection edits are allowed after review; file writes still ask.';
    return 'Safe: write/edit/create tools ask before apply.';
  }
};
