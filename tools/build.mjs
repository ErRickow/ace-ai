import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const plugin = path.join(root, 'plugin');
const modules = [
  "core/constants.js",
  "core/defaults.js",
  "core/state.js",
  "core/util.js",
  "core/runtime.js",
  "core/error-kit.js",
  "core/store.js",
  "core/acode.js",
  "core/editor.js",
  "core/patch.js",
  "core/prompt.js",
  "core/client.js",
  "agent/tools.js",
  "agent/permission-model.js",
  "ui/templates.js",
  "ui/base-ui.js",
  "ui/v8-layer.js",
  "native/acode-integration.js",
  "lifecycle/page.js",
  "lifecycle/plugin.js"
];
const template = fs.readFileSync(path.join(src, 'main.template.js'), 'utf8');
const joined = modules.map((file) => {
  const abs = path.join(src, file);
  const content = fs.readFileSync(abs, 'utf8').trimEnd();
  return `\n  // ---- ${file} ----\n` + content.split('\n').map(line => line ? '  ' + line : '').join('\n') + '\n';
}).join('');
const out = template.replace('/* @ace-ai-includes */', () => joined);
fs.mkdirSync(plugin, { recursive: true });
fs.writeFileSync(path.join(plugin, 'main.js'), out);
console.log(`Built ${path.join(plugin, 'main.js')} from ${modules.length} modules`);
