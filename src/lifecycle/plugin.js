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
  try {
    ThemeSystem.css();
    ThemeSystem.install();
  } catch (e) {
    errors.push("Theme: " + (e.message || e));
  }
  try {
    MobileUX.css();
    MobileUX.installBubble();
  } catch (e) {
    errors.push("MobileUX: " + (e.message || e));
  }
  try {
    IntentHandler.install();
  } catch (e) {
    errors.push("Intent: " + (e.message || e));
  }
  try {
    FileIndex.loadOrScan();
  } catch (e) {
    errors.push("FileIndex: " + (e.message || e));
  }
  try {
    // Restore project-specific chat history if available
    const restored = ProjectHistory.restore();
    if (restored) State.projectHistoryRestored = true;
  } catch (e) {
    errors.push("ProjectHistory: " + (e.message || e));
  }
  try {
    GhostComplete.install();
  } catch (e) {
    errors.push("GhostComplete: " + (e.message || e));
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
    // Save project chat before cleanup
    ProjectHistory.saveCurrentChat();
  } catch (_) {}
  try {
    GhostComplete.uninstall();
  } catch (_) {}
  try {
    ThemeSystem.uninstall();
  } catch (_) {}
  try {
    MobileUX.cleanup();
  } catch (_) {}
  try {
    IntentHandler.uninstall();
  } catch (_) {}
  try {
    VoiceInput.stop();
  } catch (_) {}
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
