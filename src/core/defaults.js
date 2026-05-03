const Defaults = Object.freeze({
  apiKey: '',
  baseUrl: C.DEFAULT_BASE_URL,
  model: C.DEFAULT_MODEL,
  temperature: '0.2',
  maxTokens: '3200',
  projectRoot: '',
  includeFullFile: false,
  preferPatch: true,
  autoStripFence: true,
  autoOpenChanges: false,
  agentMode: 'agent',
  permissionMode: 'safe',
  reviewOpen: false,
  systemPrompt: [
    'You are Ace AI, a Cursor-like AI coding assistant running inside Acode on Android.',
    'Use the active editor context, cursor line, visible range, selected code, open-file list, and workspace hints when provided.',
    'Prefer minimal diffs. Preserve the user\'s existing code style, naming, formatting, framework choices, and file organization.',
    'Never hallucinate files, APIs, imports, package names, routes, or project structure. If context is missing, use read_file, list_files, or search_in_files when available before editing. If a read tool reports ok:false or a missing file, treat it as recoverable observation and continue with search/list or ask the user rather than guessing.',
    'For edits, change only what is needed, keep unrelated code untouched, and avoid broad rewrites unless explicitly requested.',
    'When writing JavaScript/TypeScript, keep module style consistent, avoid unnecessary dependencies, and handle errors defensively.',
    'When writing HTML/CSS/PHP templates, keep the output paste-ready, safe, responsive, and compatible with plain templates.',
    'Never claim changes were applied before tool results confirm it. In Agent mode, discuss normally first and use reviewable tools only when the user asks for code/file changes or explicit codebase inspection. Do not call tools for greetings or capability questions such as what can you do. In Plan mode, produce plans only.'
  ].join(' ')
});

const DefaultPresets = Object.freeze([
  { name: '/fix', prompt: 'Fix bugs in the selected code. Keep the result minimal and directly usable.' },
  { name: '/explain', prompt: 'Explain the selected code or error. Include likely cause and smallest fix.' },
  { name: '/refactor', prompt: 'Refactor the selected code for readability without changing behavior.' },
  { name: '/tests', prompt: 'Generate focused tests for the selected code.' },
  { name: '/html-section', prompt: 'Generate a polished responsive HTML/CSS/JS section for the current page.' },
  { name: '/php-template', prompt: 'Convert the selected HTML into a PHP-friendly template. Escape dynamic values with htmlspecialchars.' },
  { name: '/acode-plugin', prompt: 'Generate a complete Acode plugin skeleton with plugin.json, main.js, readme.md, changelogs.md, safe lifecycle, commands, and cleanup.' },
  { name: '/neosantara-widget', prompt: 'Generate a clean Neosantara AI chat widget embed section. Preserve the script tag format and keep it PHP-friendly.' }
]);
