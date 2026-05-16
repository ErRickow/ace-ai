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
