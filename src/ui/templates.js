const Templates = {
  neosantaraHtml(widgetId) {
    const id = String(widgetId || "").trim() || "YOUR_WIDGET_ID";
    return `<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="${id}"\n  async\n></script>`;
  },
  neosantaraPhp(widgetId) {
    const id = String(widgetId || "").trim() || "YOUR_WIDGET_ID";
    return `<?php\n$neosantaraWidgetId = htmlspecialchars('${id}', ENT_QUOTES, 'UTF-8');\n?>\n<!-- Widget Chat AI Neosantara -->\n<script\n  src="https://api.neosantara.xyz/widget.js"\n  data-widget-id="<?= $neosantaraWidgetId ?>"\n  async\n></script>`;
  },
  acodeSkeleton() {
    return `// main.js\n(function () {\n  const PLUGIN_ID = 'your.plugin.id';\n\n  acode.setPluginInit(PLUGIN_ID, (baseUrl, $page, cache) => {\n    $page.innerHTML = '<h1>Hello Acode</h1>';\n    const open = () => $page.show();\n\n    try {\n      const commands = acode.require('commands');\n      commands.addCommand({ name: 'your-plugin.open', description: 'Open Your Plugin', exec: open });\n    } catch (_) {}\n  });\n\n  acode.setPluginUnmount(PLUGIN_ID, () => {\n    try { acode.require('commands').removeCommand('your-plugin.open'); } catch (_) {}\n  });\n})();`;
  },
};
