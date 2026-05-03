const Native = {
  install() {
    UI.css();
    this.installSideButton();
    this.installSidebarApp();
    this.installSelectionMenu();
    this.installCommands();
    Editor.onChange(() => {
      if (State.panel && !State.panel.classList.contains('ace-ai-hidden')) UI.render(State.panel);
      if (State.sidebarContainer) UI.render(State.sidebarContainer.querySelector('.ace-ai-panel'));
    });
  },
  installSideButton() {
    const SideButton = Acode.require('sideButton');
    if (typeof SideButton === 'function') {
      try {
        State.sideButton = SideButton({
          text: 'AI',
          icon: 'ace-ai',
          backgroundColor: '#1d2026',
          textColor: '#fff',
          onclick: () => { try { UI.openPanel('chat'); } catch (e) { try { Acode.toast('Ace AI open failed: ' + (e.message || e)); } catch (_) {} } }
        });
        State.sideButton.show?.();
        return;
      } catch (_) {}
    }
    const btn = document.createElement('button');
    btn.className = 'ace-ai-fab';
    btn.textContent = 'AI';
    btn.addEventListener('click', () => UI.openPanel('chat'));
    document.body.appendChild(btn);
    State.fallbackButton = btn;
  },
  installSidebarApp() {
    const sideBarApps = Acode.require('sidebarApps');
    if (!sideBarApps || typeof sideBarApps.add !== 'function') return;
    try {
      sideBarApps.add('ace-ai', C.SIDEBAR_ID, 'Ace AI', (container) => {
        State.sidebarContainer = container;
        UI.mountPanel(container, true);
      }, false, (container) => {
        State.sidebarContainer = container;
        const existing = container.querySelector('.ace-ai-panel');
        if (!existing) UI.mountPanel(container, true);
        else UI.render(existing);
      });
    } catch (_) {}
  },
  installSelectionMenu() {
    const selectionMenu = Acode.require('selectionMenu');
    if (!selectionMenu || typeof selectionMenu.add !== 'function') return;
    const add = (label, mode, seed, aiMode) => {
      try {
        selectionMenu.add(() => UI.openPanel('chat', aiMode || 'agent', seed), label, mode || 'selected', false);
        State.registeredSelectionItems.push(label);
      } catch (_) {}
    };
    add('Ace Fix', 'selected', 'Fix the selected code.');
    add('Ace Explain', 'selected', 'Explain the selected code or error.');
    add('Ace Refactor', 'selected', 'Refactor the selected code safely.');
    add('Ace Agent', 'all', 'Discuss, plan, or use tools with review.');
    add('Ace Plan', 'all', 'Create a plan before editing.', 'plan');
  },
  commandDescriptor(name, description, tab, mode, seed) {
    return { name, description, bindKey: null, exec: () => { UI.openPanel(tab, mode, seed); return true; } };
  },
  installCommands() {
    const items = [
      this.commandDescriptor('ace-ai.agent', 'Ace AI: Agent', 'chat', 'agent', ''),
      this.commandDescriptor('ace-ai.plan', 'Ace AI: Plan', 'chat', 'plan', ''),
      this.commandDescriptor('ace-ai.explainError', 'Ace AI: Explain Error', 'chat', 'agent', 'Explain the selected error/code and give the smallest fix.'),
      this.commandDescriptor('ace-ai.generateWidget', 'Ace AI: Generate Neosantara Widget', 'chat', 'agent', 'Generate a clean Neosantara widget embed section.'),
      this.commandDescriptor('ace-ai.agentTools', 'Ace AI: Agent Tools', 'chat', 'agent', 'Use tools to edit/create/write files.')
    ];
    items.forEach((cmd) => this.addCommand(cmd));
  },
  addCommand(cmd) {
    try {
      if (window.acode && typeof window.acode.addCommand === 'function') {
        window.acode.addCommand(cmd); State.registeredCommands.push(['acode', cmd.name]); return;
      }
    } catch (_) {}
    const commands = Acode.require('commands');
    try {
      if (commands && typeof commands.addCommand === 'function') { commands.addCommand(cmd); State.registeredCommands.push(['commands', cmd.name]); return; }
      if (commands?.registry && typeof commands.registry.add === 'function') { commands.registry.add(cmd); State.registeredCommands.push(['registry', cmd.name]); return; }
    } catch (_) {}
    try {
      const view = Editor.view();
      if (view?.commands && typeof view.commands.addCommand === 'function') { view.commands.addCommand(cmd); State.registeredCommands.push(['editor', cmd.name]); }
    } catch (_) {}
  },
  cleanupCommands() {
    State.registeredCommands.forEach(([kind, name]) => {
      try {
        if (kind === 'acode' && window.acode?.removeCommand) window.acode.removeCommand(name);
        else if (kind === 'commands') Acode.require('commands')?.removeCommand?.(name);
        else if (kind === 'registry') Acode.require('commands')?.registry?.remove?.(name);
        else if (kind === 'editor') Editor.view()?.commands?.removeCommand?.(name);
      } catch (_) {}
    });
    State.registeredCommands = [];
  },
  cleanup() {
    try { State.sideButton?.hide?.(); } catch (_) {}
    try { State.fallbackButton?.remove?.(); } catch (_) {}
    try { Acode.require('sidebarApps')?.remove?.(C.SIDEBAR_ID); } catch (_) {}
    try { State.contextMenu?.destroy?.(); } catch (_) {}
    this.cleanupCommands();
    Editor.removeListeners();
    Acode.removeBackAction();
    try { State.panel?.parentElement?.remove?.(); } catch (_) {}
    try { document.getElementById('ace-ai-style-v8_3-base')?.remove?.(); } catch (_) {}
  }
};
