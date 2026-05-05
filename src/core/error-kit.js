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
