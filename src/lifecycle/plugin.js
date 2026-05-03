function init(baseUrl, $page, cache) {
  State.baseUrl = baseUrl || '';
  State.cache = cache || null;
  State.page = $page || null;
  try { if (window.acode?.addIcon) window.acode.addIcon('ace-ai', State.baseUrl + 'icon.png', { monochrome: false }); } catch (_) {}
  Runtime.clearTransientState();
  PermissionModel.resetSession();
  Page.render($page);
  Native.install();
  Acode.toast('Ace AI v' + C.VERSION + ' ready');
}

function unmount() {
  Native.cleanup();
}

if (window.acode && typeof window.acode.setPluginInit === 'function') {
  window.acode.setPluginInit(C.PLUGIN_ID, init);
  window.acode.setPluginUnmount(C.PLUGIN_ID, unmount);
} else {
  console.warn('Ace AI: acode global not found.');
}
