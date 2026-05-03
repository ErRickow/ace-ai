const ErrorKit = {
  create(input) {
    const err = new Error(input.message || input.title || 'Ace AI error');
    err.name = 'AceAIError';
    err.code = input.code || 'UNKNOWN';
    err.title = input.title || 'Ace AI Error';
    err.hint = input.hint || '';
    err.status = input.status || 0;
    err.details = input.details || '';
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
      String(rawText || '').slice(0, 600) ||
      ('HTTP ' + status);
    if (status === 400) return this.create({ code: 'BAD_REQUEST', status, title: 'Request tidak valid', message, hint: 'Cek model, base URL, max tokens, atau format request.' });
    if (status === 401) return this.create({ code: 'UNAUTHORIZED', status, title: 'API key ditolak', message, hint: 'Buka Settings dan pastikan NAI API Key benar, aktif, dan diawali format yang sesuai.' });
    if (status === 403) return this.create({ code: 'FORBIDDEN', status, title: 'Akses API ditolak', message, hint: 'Key mungkin tidak punya akses ke model/base URL ini. Coba model lain atau cek dashboard Neosantara.' });
    if (status === 404) return this.create({ code: 'NOT_FOUND', status, title: 'Endpoint tidak ditemukan', message, hint: 'Cek Base URL. Default yang benar: https://api.neosantara.xyz/v1' });
    if (status === 408) return this.create({ code: 'REQUEST_TIMEOUT', status, title: 'Request timeout', message, hint: 'Koneksi lambat atau server lama merespons. Coba Retry.' });
    if (status === 413) return this.create({ code: 'CONTEXT_TOO_LARGE', status, title: 'Context terlalu besar', message, hint: 'Matikan Include full file atau pilih kode yang lebih kecil.' });
    if (status === 429) return this.create({ code: 'RATE_LIMITED', status, title: 'Rate limit / kuota', message, hint: 'Tunggu sebentar lalu Retry, atau cek kuota API.' });
    if (status >= 500) return this.create({ code: 'SERVER_ERROR', status, title: 'Server API bermasalah', message, hint: 'Coba Retry. Kalau tetap gagal, copy error report dan cek status endpoint/proxy.' });
    return this.create({ code: 'HTTP_ERROR', status, title: 'API error', message, hint: 'Cek Settings, model, base URL, dan API key.' });
  },
  normalize(error) {
    if (error && error.name === 'AceAIError') return error;
    const msg = String(error?.message || error || '');
    if (error?.name === 'AbortError' || /aborted|timeout/i.test(msg)) {
      return this.create({ code: 'TIMEOUT', title: 'Request terlalu lama', message: 'Ace AI menghentikan request karena melewati batas waktu.', hint: 'Coba Retry. Kalau sering terjadi, turunkan max tokens atau matikan full file context.', cause: error });
    }
    if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) {
      return this.create({ code: 'NETWORK_OR_CORS', title: 'Tidak bisa menghubungi API', message: msg || 'Fetch gagal.', hint: 'Cek internet, Base URL, CORS WebView, atau pakai proxy backend Neosantara kamu.', cause: error });
    }
    if (/api key kosong|api key/i.test(msg)) {
      return this.create({ code: 'MISSING_API_KEY', title: 'API key belum diisi', message: msg, hint: 'Buka Settings Ace AI lalu isi NAI API Key.', cause: error });
    }
    return this.create({ code: 'UNKNOWN', title: 'Ace AI gagal', message: msg || 'Unknown error', hint: 'Coba ulang. Kalau tetap gagal, copy error report.', cause: error });
  },
  report(error) {
    const e = this.normalize(error || State.lastError);
    const ctx = Editor.context();
    const settings = Store.settings();
    return [
      'Ace AI Error Report',
      '===================',
      'Plugin version: ' + C.VERSION,
      'Time: ' + (e.time || new Date().toISOString()),
      'Code: ' + e.code,
      'Status: ' + (e.status || '-'),
      'Title: ' + e.title,
      'Message: ' + e.message,
      'Hint: ' + (e.hint || '-'),
      '',
      'Context',
      '-------',
      'File: ' + ctx.file.filename,
      'Language: ' + ctx.file.language,
      'Cursor: line ' + (ctx.cursor?.line || '-') + ', column ' + (ctx.cursor?.column || '-'),
      'Visible range: ' + (ctx.visibleRange ? (ctx.visibleRange.startLine + '-' + ctx.visibleRange.endLine) : '-'),
      'Open files: ' + ((ctx.openFiles || []).map((f) => f.filename).join(', ') || '-'),
      'Unsaved/dirty: ' + Boolean(ctx.dirty?.dirty),
      'Has selection: ' + ctx.hasSelection,
      'Selection lines: ' + ctx.selectionLines,
      'File lines: ' + ctx.textLines,
      '',
      'Settings',
      '--------',
      'Base URL: ' + settings.baseUrl,
      'Endpoint: /v1/responses only',
      'Responses last id: ' + (Store.responseState().lastResponseId || '-'),
      'Project Root: ' + (settings.projectRoot || '-'),
      'Model: ' + settings.model,
      'Max tokens: ' + settings.maxTokens,
      'Temperature: ' + settings.temperature,
      'Include full file: ' + settings.includeFullFile,
      'Last usage: ' + JSON.stringify(State.lastUsage || null),
      'API key set: ' + Boolean(settings.apiKey),
      '',
      'Last request',
      '------------',
      JSON.stringify(State.lastRequest || null, null, 2),
      '',
      'Details',
      '-------',
      String(e.details || e.stack || e.cause?.stack || '')
    ].join('\n');
  }
};
