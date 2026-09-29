// 将 json-editor.js 的最新 core 同步进 json-vue.js / json-react.js
const fs = require('fs');
const core = fs.readFileSync('D:/json_editor/repo/src/json-editor.js', 'utf8').trimEnd();

['D:/json_editor/repo/src/json-vue.js', 'D:/json_editor/repo/src/json-react.js'].forEach(function (f) {
  let src = fs.readFileSync(f, 'utf8');
  const idx = src.indexOf('/* ============================== Vue 3') !== -1
    ? src.indexOf('/* ============================== Vue 3')
    : src.indexOf('/* ============================== React 18');
  if (idx === -1) { console.log(f + ': marker not found!'); return; }
  const tail = src.slice(idx);
  fs.writeFileSync(f, core + '\n' + tail);
  console.log(f.split('/').pop() + ' core synced');
});
