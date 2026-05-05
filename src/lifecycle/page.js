const Page = {
  render($page) {
    if (!$page) return;
    $page.innerHTML = `<div style="padding:18px;font-family:system-ui"><h2>Ace AI v${C.VERSION}</h2><p>Acode-native chat-first AI coding assistant with optional approval-first Agent mode. Use side button, selection menu, command palette, or sidebar app.</p><button id="ace-ai-open-page" style="padding:10px 14px;border-radius:12px;border:0;background:#1d2026;color:white;border:1px solid #30343c;font-weight:800">Open Ace AI</button><p style="opacity:.75;font-size:13px">Set your Neosantara API key from Ace AI → Settings.</p></div>`;
    $page
      .querySelector("#ace-ai-open-page")
      ?.addEventListener("click", () => UI.openPanel("chat"));
  },
};
