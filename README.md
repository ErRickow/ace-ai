# Ace AI Acode Plugin Source

Author: Er Rickow

License: Apache-2.0

Ace AI is an Acode-native AI coding assistant for the Neosantara Responses API. This repository contains the modular source used to build the installable Acode plugin bundle in `plugin/main.js`.

## Repository layout

```txt
src/                  Modular plugin source
  agent/              Tool registry, read tools, write tools, and permission helpers
  core/               API client, editor adapters, patch utilities, state, store, markdown utilities
  lifecycle/          Plugin/page lifecycle wiring
  native/             Defensive Acode integration helpers
  ui/                 Chat UI, review cards, working state, settings, and v8 layer
plugin/               Installable Acode plugin package files
tools/build.mjs       Concatenates source modules into plugin/main.js
```

## Development

Install dependencies:

```sh
npm ci
```

Run the full validation suite:

```sh
npm run check
```

Useful individual commands:

```sh
npm run syntax      # build and node -c plugin/main.js
npm run lint        # ESLint over src/ and tools/
npm run format      # Prettier check
npm run format:write
```

## Build output

The Acode-installable plugin lives in `plugin/`. The build script concatenates the modular files into a single `plugin/main.js` because Acode plugins are loaded as one bundled entry file.

To package manually, ZIP these files at the ZIP root:

```txt
main.js
plugin.json
readme.md
changelogs.md
icon.png
```

## Runtime model

Ace AI is intentionally review-first. The assistant may inspect files with read tools, propose edits with write tools, and suggest safe terminal checks, but file changes are not applied until the user approves them in the Review card. Relative project file writes require a Project Root, except the supported unsaved-tab fallback for new files when no project root is available.

## Release notes

User-facing release notes belong in `plugin/changelogs.md`. The plugin store README at `plugin/readme.md` should describe the plugin only and should not include changelog entries.

## Remote ZIP / external source install

Acode plugins can be developed from this source tree, built into a ZIP, and installed either locally or through Acode's Remote plugin install flow. The installable ZIP must include `plugin.json`, `main.js`, `readme.md`, `changelogs.md`, and `icon.png` at the ZIP root.

For registry/market publishing, keep `plugin.json` marketplace-ready with `author`, `price`, `license`, `keywords`, `readme`, `changelogs`, and an optional `repository` field only when a real GitHub/GitLab source URL exists.

## Release automation

GitHub Actions builds the installable ZIP from source. Push a version tag to publish a release:

```sh
git tag v0.8.43
git push origin v0.8.43
```

The workflow runs `npm ci`, `npm run check`, packages the five runtime plugin files from `plugin/`, uploads the ZIP as a workflow artifact, and creates a GitHub Release for tag pushes. Manual workflow runs build the same ZIP artifact without creating a release.

## Markdown rendering

Ace AI includes a lightweight Markdown renderer for chat output with copyable, syntax-highlighted fenced code blocks for JavaScript, TypeScript, HTML, CSS, JSON, PHP, Python, Bash, SQL, and related languages. It is bundled directly into the plugin so the installable ZIP stays self-contained.
