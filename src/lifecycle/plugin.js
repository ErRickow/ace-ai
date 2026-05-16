function init(baseUrl, $page, cache) {
  State.baseUrl = baseUrl || "";
  State.cache = cache || null;
  State.page = $page || null;
  try {
    if (window.acode?.addIcon)
      window.acode.addIcon("ace-ai", State.baseUrl + "icon.png", {
        monochrome: false,
      });
  } catch (_) {}
  const errors = [];
  try {
    Runtime.clearTransientState();
  } catch (e) {
    errors.push("Runtime: " + (e.message || e));
  }
  try {
    PermissionModel.resetSession();
  } catch (e) {
    errors.push("Permission: " + (e.message || e));
  }
  try {
    Page.render($page);
  } catch (e) {
    errors.push("Page: " + (e.message || e));
  }
  try {
    Native.install();
  } catch (e) {
    errors.push("Native: " + (e.message || e));
  }
  if (errors.length) {
    Acode.toast(
      "Ace AI v" +
        C.VERSION +
        " partially loaded (" +
        errors.length +
        " warning" +
        (errors.length > 1 ? "s" : "") +
        ")",
    );
    console.warn("Ace AI init warnings:", errors);
  } else {
    Acode.toast("Ace AI v" + C.VERSION + " ready");
  }
}

function unmount() {
  try {
    Native.cleanup();
  } catch (e) {
    console.warn("Ace AI unmount error:", e.message || e);
  }
  try {
    if (State._abortController) State._abortController.abort();
  } catch (_) {}
}

if (window.acode && typeof window.acode.setPluginInit === "function") {
  window.acode.setPluginInit(C.PLUGIN_ID, init);
  window.acode.setPluginUnmount(C.PLUGIN_ID, unmount);
} else {
  console.warn("Ace AI: acode global not found.");
}
