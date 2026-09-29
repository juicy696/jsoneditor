# JSON Editor (JED) 🏮

**Zero-dependency, single-file JSON editor + mindmap viewer.**
**单文件零依赖的 JSON 编辑器 + 思维导图。**

Works with vanilla JS, Vue 3 and React 18 — no build step, no bundler, no npm install required.
支持原生 JS、Vue 3、React 18 —— 无需构建、无需打包器，甚至无需 npm install。

---

## ✨ Features

- **Dual view** — structured editor + mind map, editing in both, synced in real time
  双视图 —— 结构化编辑器 + 思维导图，双端可编辑，实时同步
- **Syntax-colored structure** — braces colored by nesting depth (rainbow layers), types color-coded
  括号按嵌套深度彩虹着色，key/value 类型分色
- **Smart editing** — click key/value to edit inline; type `{"a":1}` to convert to object, `true/false/null` literals, pure numbers auto-detect, plain text auto-quoted
  智能编辑 —— 点击内联编辑；输入 JSON 自动转对象/数组，`true/false/null` 识别为字面量，纯数字转数值，纯文本自动补引号
- **Container matching** — `{}` inserts key-value pairs, `[]` inserts array elements
  容器匹配 —— `{}` 中插键值对，`[]` 中插数组元素
- **Mind map canvas** — drag to pan, scroll to zoom (30%–300%), root node shows `root(n)`
  导图画布 —— 拖拽平移、滚轮缩放，根节点显示 root(n)
- **Text view** — raw JSON with copy, one-click apply-back to structure
  文本视图 —— 原始 JSON + 复制，一键应用回结构
- **Thin scrollbars, 50vh max-height, theme (light/dark), readonly mode**
  5px 细滚动条、最大高度限制、明暗主题、只读模式
- **~45 KB per file, zero dependencies** — smaller than most icons libraries
  每个文件仅 ~45KB，零依赖

---

## 📦 Install / 安装

### Option A — CDN (recommended, no install)

```html
<!-- Vanilla JS -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/json-editor@main/src/json-editor.js"></script>

<!-- Vue 3 -->
<script src="https://unpkg.com/vue@3"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/json-editor@main/src/json-vue.js"></script>

<!-- React 18 -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/json-editor@main/src/json-react.js"></script>
```

### Option B — npm

```bash
npm install @jed/json-editor
```

```js
// Vanilla (UMD-style global, works in browser script tag)
// Vue project: import '@jed/json-editor/vue'
// React project: import '@jed/json-editor/react'
```

### Option C — download

Download `src/json-editor.js` (or the vue/react variant) and include it locally. That's it.

---

## 🚀 Usage / 使用

### Vanilla JS

Three ways to render — pick any:

```html
<!-- 1. <json> tag, auto-scan, multiple instances -->
<json data-title="Config">{"name": "Jakey", "tags": ["admin"]}</json>

<!-- 2. any element with tag="json" -->
<div tag="json" data-theme="dark">{"a": 1}</div>

<!-- 3. container + API -->
<div id="editor"></div>
<script>
  var editor = JED.create({
    el: '#editor',
    title: 'My Editor',
    theme: 'dark',            // light | dark
    max_height: '50vh',       // scroll when overflow
    font_size: '13px',
    value: { hello: 'world' },
    onChange: function (json) { console.log('changed', json); },
    onError: function (errors) { console.warn(errors); }
  });
</script>
```

API: `editor.get()` / `editor.set(v)` / `editor.view('mindmap')` / `editor.validate()` / `editor.destroy()`

### Vue 3

```html
<script src="https://unpkg.com/vue@3"></script>
<script src="json-vue.js"></script>
<div id="app">
  <json-editor v-model="config" theme="dark" max_height="50vh" />
</div>
<script>
  const app = Vue.createApp({ data: () => ({ config: { a: 1 } }) });
  app.use(JED.vue);   // registers <json-editor> globally
  app.mount('#app');
</script>
```

### React 18

```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="json-react.js"></script>
<div id="root"></div>
<script>
  const e = React.createElement;
  function App() {
    const [data, setData] = React.useState({ a: 1 });
    return e(JED.react.component, { value: data, onChange: setData, theme: 'dark' });
  }
  ReactDOM.createRoot(document.getElementById('root')).render(e(App));
</script>
```

---

## 🧭 Why another JSON editor?

| | JED | Monaco | CodeMirror | JSONEditor (josdejong) |
|---|---|---|---|---|
| Size | ~45 KB | ~2 MB+ | ~300 KB | ~500 KB |
| Dependencies | 0 | many | few | few |
| Build step | none | required | optional | none |
| Mind map view | ✅ | ❌ | ❌ | ❌ |
| Vue/React adapter in one file | ✅ | ❌ | ❌ | ❌ |
| Works from `file://` | ✅ | ❌ (worker) | ✅ | ✅ |

JED is not trying to replace Monaco for IDE-grade editing. It targets **embedding**: config panels, CMS fields, teaching demos, quick JSON inspection — anywhere you need a friendly JSON UI without shipping a framework.

---

## 🗺️ Roadmap

- [ ] Vue/React reactive binding (store subscription instead of full re-render)
- [ ] Schema validation hints
- [ ] Search & filter nodes
- [ ] Drag-and-drop node reordering in mind map
- [ ] More themes

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE).

- ✅ Free for commercial use — no license fee required by the license itself
- ✅ Modifications allowed — must retain copyright notices and the NOTICE file
- ✅ Patent grant included
- 📌 Attribution: derivative works must keep the author attribution (see [NOTICE](NOTICE))

Commercial licensing, custom development and paid support: zhuxi0906@gmail.com

---

**Live demo**: https://YOUR_USERNAME.github.io/json-editor/ · **npm**: `@jed/json-editor`
