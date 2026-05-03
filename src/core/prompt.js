const Prompt = {
  extractFileMentions(text) {
    const value = String(text || '');
    const matches = value.match(/(^|\s)@([A-Za-z0-9_./\\:-]+\.[A-Za-z0-9_+-]+)/g) || [];
    return matches.map((m) => m.trim().replace(/^@/, '').replace(/^\s*@/, '')).filter(Boolean).slice(0, 12);
  },
  listLines(items, mapper) {
    return (items || []).map(mapper).filter(Boolean).join('\n');
  },
  contextHeader(ctx, instruction) {
    const dirty = ctx.dirty?.dirty ? 'dirty/unsaved' : 'saved or unknown';
    const visible = ctx.visibleRange ? `lines ${ctx.visibleRange.startLine}-${ctx.visibleRange.endLine}` : 'unknown';
    const cursor = ctx.cursor ? `line ${ctx.cursor.line}, column ${ctx.cursor.column}` : 'unknown';
    const open = this.listLines(ctx.openFiles, (f, i) => `- ${i + 1}. ${f.filename}${f.dirty ? ' (dirty)' : ''}${f.uri ? ' — ' + f.uri : ''}`);
    const recent = this.listLines(ctx.recentFiles, (f, i) => `- ${i + 1}. ${f.filename}${f.uri ? ' — ' + f.uri : ''}`);
    const mentions = this.extractFileMentions(instruction);
    return [
      `Active file: ${ctx.file.filename}`,
      `Active path/uri: ${ctx.file.uri || ctx.file.location || '(unknown)'}`,
      `Language: ${ctx.file.language}`,
      `Cursor: ${cursor}`,
      `Visible range: ${visible}`,
      `Unsaved state: ${dirty}`,
      `Target: ${ctx.hasSelection ? 'selected code' : 'cursor/visible context'}`,
      open ? `Open files/tabs:\n${open}` : 'Open files/tabs: active file only or unavailable',
      recent ? `Recently touched files:\n${recent}` : 'Recently touched files: unavailable',
      mentions.length ? `@file mentions detected: ${mentions.join(', ')}` : ''
    ].filter(Boolean).join('\n');
  },
  shouldAllowTools(kind, instruction, outputMode, ctx) {
    if (!(kind === 'agent' || outputMode === 'tools')) return false;
    // V8 appends internal permission policy after the user's prompt. Tool
    // gating must inspect only the human prompt; otherwise words like
    // write/edit/file in the policy accidentally enable tools for casual
    // questions such as “what can you do?”.
    const userInstruction = String(instruction || '').split(/\n\s*Permission:/i)[0];
    const text = userInstruction.toLowerCase();
    if (!text.trim()) return false;
    if (/@codebase|@[a-z0-9_./\:-]+\.[a-z0-9_+-]+/i.test(userInstruction || '')) return true;
    if (/\b(fix|repair|bug|implement|create|write|add|modify|change|update|replace|refactor|generate|tests?|unit test|make|build|convert|rewrite|insert|append|patch)\b/i.test(text)) return true;
    if (/\b(search|find|read|list|inspect|open|look through|codebase|project)\b/i.test(text)) return true;
    // Common casual/capability questions should stay plain text. Without this
    // gate, small models often call read_file even for “what can you do?”.
    return false;
  },
  messages(kind, instruction, outputMode) {
    const settings = Store.settings();
    const ctx = Editor.context();
    const selection = Util.truncate(ctx.selection, C.MAX_SELECTION);
    // Avoid duplicated context on mobile: when code is selected, send the selection as the primary target.
    // Full-file context can make the model propose whole-file rewrites instead of a focused selection edit.
    const fullFile = settings.includeFullFile && !ctx.hasSelection ? Util.truncate(ctx.text, C.MAX_FULL_FILE) : '';
    const cursorContext = Util.truncate(ctx.cursorContext?.content || '', C.MAX_CONTEXT_WINDOW);
    const visibleContext = Util.truncate(ctx.visibleContext?.content || '', C.MAX_CONTEXT_WINDOW);
    const mentions = this.extractFileMentions(instruction);
    let system = settings.systemPrompt || Defaults.systemPrompt;
    if (kind === 'edit' || kind === 'patch') {
      system += ' For code edits, return exactly the requested output format. Do not wrap in markdown unless asked.';
    }
    const targetText = ctx.hasSelection ? 'selected code' : (settings.includeFullFile ? 'active file' : 'cursor and visible editor context');
    let user = '';
    user += `Mode: ${kind}\n`;
    user += `Output mode: ${outputMode}\n`;
    user += this.contextHeader(ctx, instruction) + '\n';
    user += `Target: ${targetText}\n\n`;
    user += `User instruction:\n${instruction || '(no instruction)'}\n\n`;
    if (mentions.length) {
      user += 'The user referenced files with @file syntax. Use read_file for those paths before making assumptions if the contents are not already in context.\n\n';
    }
    if (selection) user += `Selected code/error:\n\`\`\`${ctx.file.language}\n${selection}\n\`\`\`\n\n`;
    if (!selection && cursorContext) user += `Context around cursor (${ctx.cursorContext.startLine}-${ctx.cursorContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${cursorContext}\n\`\`\`\n\n`;
    if (!selection && visibleContext && visibleContext !== cursorContext) user += `Visible editor range (${ctx.visibleContext.startLine}-${ctx.visibleContext.endLine}, line numbered):\n\`\`\`${ctx.file.language}\n${visibleContext}\n\`\`\`\n\n`;
    if (fullFile) user += `Full active file context:\n\`\`\`${ctx.file.language}\n${fullFile}\n\`\`\`\n\n`;
    if (kind === 'agent' || outputMode === 'tools') {
      // Native tools are injected into the /v1/responses payload by client.js.
      // Only add a brief reminder so the model knows it should use them.
      user += [
        'You are in Ace AI Agent mode. You can answer normally in plain text, or use tools when needed.',
        'Available read tools: read_file, list_files, search_in_files. Use them only when file/codebase inspection is actually needed: @file/@codebase references, imports/routes/components, project-wide behavior, or edits to files not already in context. Do not call tools for greetings, capability questions, or normal explanations that can be answered from the visible context. If a read_file/list_files/search_in_files result returns ok:false, treat it as recoverable observation: do not hallucinate the missing file, try another search/list if useful, or ask for the correct path.',
        'Available write tools: replace_selection, insert_at_cursor, replace_file, create_file, write_file, append_file.',
        'Rules:',
        '- The user must approve every write tool call before it is applied. Never claim write changes are already done.',
        '- Read tools are safe, but only use them when inspection is needed. Do not inspect files for greetings, “what can you do?”, or plain conversational answers.',
        '- If selected code exists, treat it as the default edit target. Prefer replace_selection. Do not use replace_file/write_file for the active filename unless the user explicitly asks for the whole/full/entire file rewrite.',
        '- Prefer minimal diffs. Do not rewrite unrelated code.',
        '- Use create_file only for brand-new files. Use write_file/replace_file with complete content. If Project Root is unknown and you are editing the current tab, leave replace_file.path empty or use replace_selection. Do not invent a relative path for the active unsaved tab.',
        '- For discussion, capability questions, greetings, explanations, debugging, or planning with no file change needed, reply in plain text without any tool calls.',
        '- For multi-file tasks, emit one tool call per file/action.'
      ].join('\n');
    } else if (kind === 'patch' || outputMode === 'patch') {
      user += [
        'Return only a unified diff patch against the active file.',
        `Use headers: --- a/${ctx.file.filename} and +++ b/${ctx.file.filename}.`,
        'No markdown fences. No explanation outside the patch.'
      ].join('\n');
    } else if (outputMode === 'replacement') {
      user += 'Return only replacement code/text. No markdown fences. No explanation.';
    } else if (outputMode === 'snippet') {
      user += 'Return paste-ready code/snippet. Prefer concise comments only when helpful.';
    } else {
      user += 'Answer clearly. Include code blocks only when useful.';
    }
    const messages = [{ role: 'system', content: system }];
    let history = Store.chat().filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content);
    const currentHistoryPrompt = String(State.currentHistoryPrompt || instruction || '').trim();
    if (history.length && history[history.length - 1].role === 'user' && String(history[history.length - 1].content || '').trim() === currentHistoryPrompt) {
      history = history.slice(0, -1);
    }
    history.slice(-24).forEach((m) => {
      messages.push({ role: m.role, content: String(m.content || '') });
    });
    messages.push({ role: 'user', content: user });
    return { messages, ctx, settings, allowTools: this.shouldAllowTools(kind, instruction, outputMode, ctx) };
  }
};
