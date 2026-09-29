# v1.0.0 — 2026-09-29

First public release. / 首次公开发布。

## Core (json-editor.js)

- Structured editor view: rainbow-depth brace coloring, inline key/value editing,
  type auto-detection (`{...}` → object, `true/false/null` literals, numbers, auto-quoted strings)
- Mind map view: drag-to-pan canvas, scroll-to-zoom (30%–300%), root(n) root node
- Text view: live-serialized JSON, copy icon button, floating apply-back button
- Container-matched insertion: `{}` → key-value pairs, `[]` → array elements
- Per-depth brace colors, 5px scrollbars, max-height scrolling (default 50vh),
  light/dark themes, readonly mode
- Declarative usage: `<json>` tags and `[tag="json"]` elements, auto-scanned,
  configurable via data-* attributes

## Vue 3 adapter (json-vue.js)

- Single-file build: core + adapter
- `app.use(JED.vue)` global `<json-editor>` component
- v-model two-way binding with loop protection
- Reactive theme/title changes

## React 18 adapter (json-react.js)

- Single-file build: core + adapter
- `JED.react.component` function component (no JSX required)
- onChange unidirectional flow, external-value sync with loop protection
- Theme/title changes rebuild instance preserving data
