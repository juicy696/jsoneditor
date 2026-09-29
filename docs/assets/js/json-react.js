/**
 * json-editor.js  v1.0.0
 * Single-file JSON editor + mindmap plugin (zero dependencies, no framework)
 *
 * Copyright 2026 Jakey Zhu (zhuxi0906@gmail.com)
 * Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
 * Redistributions and modifications must retain this notice, the LICENSE and NOTICE files.
 * GitHub: https://github.com/YOUR_USERNAME/json-editor
 *
 * Usage 1: auto-scan <json> tags (multiple instances)
 *   <json>{"a":1}</json>
 *
 * Usage 2: any element with tag="json"
 *   <div tag="json">{"a":1}</div>
 *
 * Usage 3: container + id
 *   <div id="my-editor"></div>
 *   <script> JED.create({ el: '#my-editor', value: {...} }); </script>
 *
 * Manual re-scan: JED.scan()
 */
(function () {
  'use strict';

  /* ============================== 工具函数 ============================== */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function deep_clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function type_of(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value === 'object' ? 'object' : typeof value;
  }

  function escape_html(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function copy_to_clipboard(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback_copy(text, done); });
    } else {
      fallback_copy(text, done);
    }
  }

  function fallback_copy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
    document.body.removeChild(ta);
  }

  /* ============================== 解析器 ============================== */

  var parser = {
    parse: function (text) {
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch (e) {
        // 宽松容错：单引号、尾逗号、无引号 key
        try {
          var loose = text
            .replace(/(['"])?([a-zA-Z0-9_$\u4e00-\u9fa5]+)(['"])?:/g, '"$2":')
            .replace(/'/g, '"')
            .replace(/,(\s*[}\]])/g, '$1');
          return { ok: true, value: JSON.parse(loose), loose: true };
        } catch (e2) {
          return { ok: false, error: e.message };
        }
      }
    }
  };

  /* ============================== 校验器 ============================== */

  var validator = {
    validate: function (model) {
      var errors = [];
      walk(model.root, '$', 0);
      function walk(node, path, depth) {
        if (depth > 100) { errors.push({ path: path, msg: 'Nesting depth exceeds 100 levels' }); return; }
        if (node.type === 'object') {
          var seen = {};
          node.children.forEach(function (child) {
            if (child.key === '' || child.key === null) {
              errors.push({ path: path, msg: 'Empty key found' });
            } else if (seen[child.key]) {
              errors.push({ path: path, msg: 'Duplicate key: "' + child.key + '"' });
            }
            seen[child.key] = true;
            walk(child, path + '.' + child.key, depth + 1);
          });
        } else if (node.type === 'array') {
          node.children.forEach(function (child, i) {
            walk(child, path + '[' + i + ']', depth + 1);
          });
        } else if (node.type === 'string' && node.value === undefined) {
          errors.push({ path: path, msg: 'Missing string value' });
        }
      }
      return errors;
    }
  };

  /* ============================== 模型（AST） ============================== */
  /* node: { type: 'object'|'array'|'string'|'number'|'boolean'|'null',
              key: string|null, value: any, children: [node]|null, collapsed: bool } */

  function to_node(value, key) {
    var t = type_of(value);
    var node = { type: t, key: key === undefined ? null : key, collapsed: false };
    if (t === 'object') {
      node.children = Object.keys(value).map(function (k) { return to_node(value[k], k); });
    } else if (t === 'array') {
      node.children = value.map(function (v) { return to_node(v, null); });
    } else {
      node.value = value;
    }
    return node;
  }

  function to_value(node) {
    if (node.type === 'object') {
      var obj = {};
      node.children.forEach(function (c) { obj[c.key] = to_value(c); });
      return obj;
    }
    if (node.type === 'array') return node.children.map(to_value);
    if (node.type === 'string') return node.value === undefined ? '' : node.value;
    if (node.type === 'null') return null;
    if (node.type === 'boolean') return node.value === true;
    if (node.type === 'number') return typeof node.value === 'number' && isFinite(node.value) ? node.value : 0;
    return node.value;
  }

  var model_api = {
    /** 在 parent 下插入子节点，返回新节点 */
    insert_child: function (parent, index, child) {
      if (parent.type === 'object' && (child.key === undefined || child.key === null)) {
        child.key = unique_key(parent);
      }
      if (index === undefined || index === null || index > parent.children.length) index = parent.children.length;
      parent.children.splice(index, 0, child);
      return child;
    },
    remove_child: function (parent, child) {
      var i = parent.children.indexOf(child);
      if (i >= 0) parent.children.splice(i, 1);
    },
    move_child: function (parent, child, dir) {
      var i = parent.children.indexOf(child);
      var j = i + dir;
      if (i < 0 || j < 0 || j >= parent.children.length) return false;
      var tmp = parent.children[i];
      parent.children[i] = parent.children[j];
      parent.children[j] = tmp;
      return true;
    },
    /** 根据容器类型生成空子节点 */
    make_child_for: function (parent_type) {
      if (parent_type === 'object') return { type: 'string', key: 'new_key', value: '', collapsed: false };
      return { type: 'string', key: null, value: '', collapsed: false };
    }
  };

  function unique_key(parent) {
    var base = 'new_key', name = base, i = 2;
    var keys = parent.children.map(function (c) { return c.key; });
    while (keys.indexOf(name) >= 0) { name = base + '_' + i; i++; }
    return name;
  }

  /** 查找节点的父节点 */
  function find_parent(root, target) {
    if (root === target) return null;
    var stack = [root];
    while (stack.length) {
      var cur = stack.pop();
      if (cur.children) {
        for (var i = 0; i < cur.children.length; i++) {
          if (cur.children[i] === target) return cur;
          stack.push(cur.children[i]);
        }
      }
    }
    return null;
  }

  /* ============================== 样式注入 ============================== */

  var STYLE = [
    '.jed-root{--jed-bg:#ffffff;--jed-fg:#24292f;--jed-border:#d0d7de;--jed-head-bg:#f6f8fa;',
    '--jed-accent:#0969da;--jed-key:#0550ae;--jed-str:#116329;--jed-num:#953800;--jed-bool:#8250df;',
    '--jed-null:#6e7781;--jed-brace:#cf222e;--jed-hover:#eef1f4;--jed-btn-bg:#f6f8fa;--jed-dirty:#bf8700;',
    'font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;font-size:14px;color:var(--jed-fg);',
    'border:1px solid var(--jed-border);border-radius:8px;overflow:hidden;background:var(--jed-bg);',
    'display:flex !important;flex-direction:column;box-sizing:border-box;width:100%;}',
    '.jed-root *,.jed-root *::before,.jed-root *::after{box-sizing:border-box;}',
    /* head */
    '.jed-head{display:flex;align-items:center;gap:8px;padding:5px 10px;background:var(--jed-head-bg);',
    'border-bottom:1px solid var(--jed-border);flex-wrap:wrap;min-height:34px;flex-shrink:0;}',
    '.jed-title{font-weight:600;margin-right:8px;white-space:nowrap;font-size:12px;line-height:34px;}',
    '.jed-tabs{display:flex;gap:2px;flex:1;}',
    '.jed-tab{padding:3px 10px;border:1px solid transparent;border-radius:5px;cursor:pointer;user-select:none;',
    'color:var(--jed-fg);background:transparent;font-size:11px;line-height:1.3;}',
    '.jed-tab:hover{background:var(--jed-hover);}',
    '.jed-tab.active{background:var(--jed-accent);color:#fff;font-weight:500;}',
    '.jed-head-actions{display:flex;gap:6px;align-items:center;}',
    '.jed-btn{padding:5px 12px;border:1px solid var(--jed-border);border-radius:6px;cursor:pointer;',
    'background:var(--jed-btn-bg);color:var(--jed-fg);font-size:13px;line-height:1.2;}',
    '.jed-btn:hover{background:var(--jed-hover);}',
    '.jed-btn.primary{background:transparent;border-color:transparent;color:var(--jed-fg);}',
    '.jed-btn.primary:hover{background:var(--jed-hover);opacity:1;}',
    /* 复制：纯图标按钮，无背景无边框 */
    '.jed-btn-icon{width:24px;height:24px;padding:0;text-align:center;font-size:12px;line-height:1;',
    'background:transparent;border:none;color:var(--jed-accent);border-radius:5px;}',
    '.jed-btn-icon:hover{background:var(--jed-hover);}',
    /* 文本视图右上角浮动应用按钮（tab 下方） */
    '.jed-text-wrap{position:relative;}',
    '.jed-text-apply{position:absolute;top:8px;right:12px;z-index:5;box-shadow:0 2px 8px rgba(0,0,0,.15);}',
    /* body：占满剩余高度，内容与 head 之间留足间距（修复顶部遮挡） */
    '.jed-body{flex:1;overflow:auto;position:relative;padding:10px 0 0;min-height:0;}',
    /* 细滚动条：5px */
    '.jed-body::-webkit-scrollbar{width:5px;height:5px;}',
    '.jed-body::-webkit-scrollbar-track{background:transparent;}',
    '.jed-body::-webkit-scrollbar-thumb{background:var(--jed-border);border-radius:3px;}',
    '.jed-body::-webkit-scrollbar-thumb:hover{background:var(--jed-null);}',
    '.jed-body{scrollbar-width:thin;scrollbar-color:var(--jed-border) transparent;}',
    /* 编辑器视图 */
    '.jed-editor{font-family:Consolas,Menlo,monospace;font-size:1em;line-height:1.7;padding:8px 4px 12px;}',
    '.jed-row{display:flex;align-items:baseline;padding:1px 6px;border-radius:4px;white-space:nowrap;}',
    '.jed-row:hover{background:var(--jed-hover);}',
    '.jed-indent{display:inline-block;}',
    '.jed-toggle{width:16px;display:inline-block;cursor:pointer;color:var(--jed-null);text-align:center;flex-shrink:0;',
    'font-size:10px;line-height:1;transition:transform .18s ease;transform-origin:50% 55%;}',
    '.jed-toggle.jed-open{transform:rotate(90deg);}',
    '.jed-toggle:hover{color:var(--jed-accent);}',
    '.jed-key{color:var(--jed-key);cursor:text;outline:none;border-radius:3px;padding:0 2px;}',
    '.jed-key:focus,.jed-val:focus,.jed-key.jed-editable:hover,.jed-val.jed-editable:hover{background:var(--jed-hover);box-shadow:0 0 0 1px var(--jed-accent);}',
    '.jed-colon{color:var(--jed-null);margin:0 6px;}',
    '.jed-val{cursor:text;outline:none;border-radius:3px;padding:0 2px;}',
    '.jed-val:focus{background:#fff;box-shadow:0 0 0 1px var(--jed-accent);}',
    '.jed-val.t-string{color:var(--jed-str);}',
    '.jed-val.t-number{color:var(--jed-num);}',
    '.jed-val.t-boolean{color:var(--jed-bool);}',
    '.jed-quote{color:var(--jed-null);}',
    '.jed-val.t-null{color:var(--jed-null);font-style:italic;}',
    '.jed-brace{color:var(--jed-brace);font-weight:600;cursor:default;}',
    '.jed-brace.bt-object{color:var(--jed-brace);}',
    '.jed-brace.bt-array{color:var(--jed-num);}',
    '.jed-count{color:var(--jed-null);font-size:12px;margin-left:6px;}',
    '.jed-ops{display:none;gap:2px;margin-left:8px;}',
    '.jed-row:hover .jed-ops{display:inline-flex;}',
    '.jed-op-add{visibility:hidden;}',
    '.jed-row:hover .jed-op-add{visibility:visible;}',
    /* 容器包裹范围悬停高亮 */
    '.jed-row.jed-range-hover{background:var(--jed-hover);}',
    '.jed-op{width:22px;height:20px;line-height:18px;text-align:center;border:1px solid var(--jed-border);',
    'border-radius:4px;background:var(--jed-btn-bg);cursor:pointer;font-size:12px;color:var(--jed-fg);padding:0;}',
    '.jed-op:hover{background:var(--jed-accent);color:#fff;border-color:var(--jed-accent);}',
    '.jed-child-count{color:var(--jed-null);font-size:12px;cursor:pointer;margin-left:4px;}',
    /* 错误提示 */
    '.jed-errors{padding:8px 12px;background:#fff8f6;border-top:1px solid #ffc1bc;color:#cf222e;font-size:13px;}',
    '.jed-errors li{margin:2px 0;}',
    /* 文本视图 */
    '.jed-text-wrap{display:flex;align-items:stretch;height:100%;position:relative;}',
    '.jed-text{flex:1;font-family:Consolas,Menlo,monospace;font-size:13px;line-height:1.6;padding:12px;',
    'border:none;outline:none;resize:none;background:var(--jed-bg);color:var(--jed-fg);min-height:300px;}',
    '.jed-text-side{display:flex;flex-direction:column;justify-content:flex-start;padding:12px 10px;gap:6px;}',
    /* 导图视图 */
    '.jed-mindmap{position:relative;height:100%;min-height:400px;overflow:hidden;cursor:grab;',
    'background-image:radial-gradient(var(--jed-border) 1px,transparent 1px);background-size:24px 24px;}',
    /* 导图全屏拖拽/缩放画布，body 不应再出滚动条 */
    '.jed-body.mm-mode{overflow:hidden;}',
    '.jed-mindmap.jed-dragging{cursor:grabbing;}',
    '.jed-mm-canvas{position:absolute;top:0;left:0;transform-origin:0 0;}',
    '.jed-mm-root{border-width:3px;font-weight:600;background:var(--jed-head-bg);}',
    '.jed-mm-svg{position:absolute;top:0;left:0;pointer-events:none;}',
    '.jed-mm-node{position:absolute;padding:4px 10px;border-radius:14px;border:2px solid var(--jed-accent);',
    'background:var(--jed-bg);font-family:Consolas,monospace;font-size:12px;cursor:pointer;white-space:nowrap;',
    'user-select:none;box-shadow:0 1px 3px rgba(0,0,0,.08);}',
    '.jed-mm-node.nt-object{border-color:var(--jed-brace);border-radius:4px;}',
    '.jed-mm-node.nt-array{border-color:var(--jed-num);border-radius:4px;border-style:dashed;}',
    '.jed-mm-node.nt-string{border-color:var(--jed-str);}',
    '.jed-mm-node.nt-number{border-color:var(--jed-num);}',
    '.jed-mm-node.nt-boolean{border-color:var(--jed-bool);}',
    '.jed-mm-node.nt-null{border-color:var(--jed-null);border-style:dotted;color:var(--jed-null);}',
    '.jed-mm-node:hover{box-shadow:0 2px 8px rgba(0,0,0,.18);}',
    '.jed-mm-node .jed-mm-add{display:none;margin-left:6px;color:var(--jed-accent);font-weight:700;}',
    '.jed-mm-node:hover .jed-mm-add{display:inline;}',
    '.jed-mm-input{position:absolute;z-index:10;font-family:Consolas,monospace;font-size:12px;',
    'border:1px solid var(--jed-accent);border-radius:4px;padding:2px 6px;outline:none;}',
    /* 主题 */
    '.jed-root.dark{--jed-bg:#0d1117;--jed-fg:#c9d1d9;--jed-border:#30363d;--jed-head-bg:#161b22;',
    '--jed-hover:#21262d;--jed-btn-bg:#21262d;--jed-key:#79c0ff;--jed-str:#7ee787;--jed-num:#ffa657;',
    '--jed-bool:#d2a8ff;--jed-null:#8b949e;--jed-brace:#ff7b72;}',
    '.jed-root.dark .jed-key:focus,.jed-root.dark .jed-val:focus{background:#0d1117;}',
    '.jed-root.dark .jed-text{background:#0d1117;}',
    '.jed-root.dark .jed-mm-node{background:#161b22;}'
  ].join('');

  if (!document.getElementById('jed-style')) {
    var style_el = document.createElement('style');
    style_el.id = 'jed-style';
    style_el.textContent = STYLE;
    document.head.appendChild(style_el);
  }

  /* ============================== 实例 ============================== */

  function JedInstance(options) {
    this.options = options || {};
    this.container = typeof options.el === 'string'
      ? document.querySelector(options.el)
      : options.el;
    if (!this.container) throw new Error('JED: container not found: ' + options.el);
    this.title = options.title || 'JSON Editor';
    this.readonly = !!options.readonly;
    this.active_view = options.defaultView || 'editor';
    this.errors = [];
    this._init(JSON.parse(JSON.stringify(options.value !== undefined ? options.value : {})));
  }

  JedInstance.prototype._init = function (value) {
    var self = this;
    var text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    var parsed = parser.parse(text);
    this.model = { root: to_node(parsed.ok ? parsed.value : {}) };
    this.json_text = parsed.ok ? JSON.stringify(parsed.value, null, 2) : text;

    this.container.classList.add('jed-root');
    if (this.options.theme === 'dark') this.container.classList.add('dark');
    /* 高度参数：height 固定高；max_height 最大高（默认 50vh），溢出滚动；font_size 编辑器文本尺寸 */
    if (this.options.height) this.container.style.height = this.options.height;
    this.container.style.maxHeight = this.options.max_height || '50vh';
    if (this.options.font_size) this.container.style.fontSize = this.options.font_size;
    this.container.innerHTML = '';

    /* ---- head ---- */
    var head = el('div', 'jed-head');
    var title = el('span', 'jed-title', this.title);
    var tabs = el('div', 'jed-tabs');
    this.tab_defs = [
      { id: 'editor', label: 'Editor' },
      { id: 'mindmap', label: 'Mind Map' },
      { id: 'text', label: 'Text' }
    ];
    this.tab_els = {};
    this.tab_defs.forEach(function (def) {
      var tab = el('div', 'jed-tab', def.label);
      tab.setAttribute('data-view', def.id);
      if (def.id === self.active_view) tab.classList.add('active');
      tab.addEventListener('click', function () { self.switch_view(def.id); });
      tabs.appendChild(tab);
      self.tab_els[def.id] = tab;
    });
    var actions = el('div', 'jed-head-actions');
    this.copy_btn = el('button', 'jed-btn primary jed-btn-icon', '⧉');
    this.copy_btn.title = 'Copy JSON';
    actions.appendChild(this.copy_btn);
    head.appendChild(title);
    head.appendChild(tabs);
    head.appendChild(actions);
    this.container.appendChild(head);

    /* body：head 固定高度，body 占余下全部空间（避免顶部遮挡） */
    this.body = el('div', 'jed-body');
    this.container.appendChild(this.body);

    this.copy_btn.addEventListener('click', function () {
      copy_to_clipboard(self.get_text(), function (ok) {
        self.copy_btn.textContent = ok ? '✓' : '✕';
        self.copy_btn.title = ok ? 'Copied' : 'Copy failed';
        setTimeout(function () {
          self.copy_btn.textContent = '⧉';
          self.copy_btn.title = 'Copy JSON';
        }, 1200);
      });
    });

    this.switch_view(this.active_view);
  };

  /* ---------- 视图切换 ---------- */

  JedInstance.prototype.switch_view = function (view_id) {
    this.active_view = view_id;
    var self = this;
    /* 导图模式禁用 body 滚动（画布自己拖拽/缩放），其他视图恢复 */
    this.body.classList.toggle('mm-mode', view_id === 'mindmap');
    Object.keys(this.tab_els).forEach(function (k) {
      self.tab_els[k].classList.toggle('active', k === view_id);
    });
    this.body.innerHTML = '';
    this.errors = [];
    var err_box = this.container.querySelector('.jed-errors');
    if (err_box) err_box.remove();

    if (view_id === 'editor') this.render_editor_view();
    else if (view_id === 'mindmap') this.render_mindmap_view();
    else this.render_text_view();
  };

  /* ---------- 编辑器视图（重写版） ---------- */
  /* 渲染流程：纯函数 build_rows 生成行数据 → 逐行创建 DOM。
     所有编辑操作只修改 model，然后统一重渲染，避免行内状态残留。 */

  JedInstance.prototype.render_editor_view = function () {
    var self = this;
    this.body.innerHTML = '';
    var wrap = el('div', 'jed-editor');
    this.body.appendChild(wrap);

    var rows = [];
    build_rows(this.model.root, 0, true, null, false);
    var row_els = [];
    rows.forEach(function (r, idx) { row_els[idx] = create_row_dom(r); });

    /* 容器悬停高亮：鼠标进入包裹范围任一行，范围内全部行加浅色背景 */
    rows.forEach(function (r, idx) {
      if (!r.range) return;
      var range_rows = [];
      for (var i = r.range[0]; i <= r.range[1]; i++) {
        if (row_els[i]) range_rows.push(row_els[i]);
      }
      range_rows.forEach(function (rr) {
        rr.classList.add('jed-range');
        rr.__jed_range_rows = range_rows;
      });
    });
    wrap.addEventListener('mouseover', function (e) {
      var row_el = e.target.closest('.jed-row');
      if (!row_el) return;
      clear_range_hover();
      var group = row_el.__jed_range_rows;
      if (group) group.forEach(function (rr) { rr.classList.add('jed-range-hover'); });
    });
    wrap.addEventListener('mouseleave', clear_range_hover);
    function clear_range_hover() {
      wrap.querySelectorAll('.jed-range-hover').forEach(function (rr) {
        rr.classList.remove('jed-range-hover');
      });
    }

    /** 递归生成扁平行数据（展开的才生成），同时记录容器包裹范围（start/end 行索引） */
    function build_rows(node, depth, is_root, parent_node, parent_collapsed) {
      var hidden = parent_collapsed;
      if (!hidden) {
        var start = rows.length;
        var row_meta = { node: node, depth: depth, is_root: is_root, parent: parent_node, kind: 'open' };
        rows.push(row_meta);
        if ((node.type === 'object' || node.type === 'array') && !node.collapsed) {
          node.children.forEach(function (child) {
            build_rows(child, depth + 1, false, node, false);
          });
          var end = rows.length;
          rows.push({ node: node, depth: depth, is_root: is_root, parent: parent_node, kind: 'close' });
          row_meta.range = [start, end];
        }
      }
    }

    function create_row_dom(r) {
      var node = r.node;
      var row = el('div', 'jed-row');
      var indent = el('span', 'jed-indent');
      indent.style.width = (r.depth * 20) + 'px';
      row.appendChild(indent);

      var is_container = node.type === 'object' || node.type === 'array';

      if (r.kind === 'close') {
        /* 闭括号行（颜色与对应开括号一致，按嵌套深度递变） */
        var cb = el('span', 'jed-brace', node.type === 'object' ? '}' : ']');
        cb.style.color = brace_color(r.depth);
        cb.style.cursor = 'pointer';
        cb.title = 'Click to collapse';
        cb.addEventListener('click', function () {
          node.collapsed = true;
          self.render_editor_view();
        });
        row.appendChild(cb);
        /* + 号：悬停在该行时显示（新增项追加到末尾） */
        if (!self.readonly) {
          var add_op = el('button', 'jed-op', '+');
          add_op.className = 'jed-op jed-op-add';
          add_op.style.marginLeft = '6px';
          add_op.title = node.type === 'object' ? 'Insert key-value pair' : 'Insert array element';
          add_op.addEventListener('click', function () {
            self.insert_child_ui(node, node.children.length);
          });
          row.appendChild(add_op);
        }
        wrap.appendChild(row);
        return row;
      }

      /* 开括号行 / 叶子行 */
      var toggle = el('span', 'jed-toggle');
      if (is_container) {
        toggle.textContent = '▶';
        toggle.title = node.collapsed ? 'Expand' : 'Collapse';
        if (!node.collapsed) toggle.classList.add('jed-open');
        toggle.addEventListener('click', function () {
          node.collapsed = !node.collapsed;
          self.render_editor_view();
        });
      }
      row.appendChild(toggle);

      if (!r.is_root && node.key !== null && node.key !== undefined) {
        var key_el = el('span', 'jed-key', '"' + node.key + '"');
        if (!self.readonly) attach_key_edit(key_el, node, r.parent);
        row.appendChild(key_el);
        row.appendChild(el('span', 'jed-colon', ':'));
      }

      if (is_container) {
        var open_brace = el('span', 'jed-brace', node.type === 'object' ? '{' : '[');
        open_brace.style.color = brace_color(r.depth);
        row.appendChild(open_brace);
        row.appendChild(el('span', 'jed-child-count', node.children.length + ' items'));
        /* root 开括号行也提供「+」插入子项（闭括号行仅非 root 时已有） */
        if (r.is_root && !self.readonly) {
          var root_add = el('button', 'jed-op jed-op-add', '+');
          root_add.style.marginLeft = '6px';
          root_add.title = node.type === 'object' ? 'Insert key-value pair' : 'Insert array element';
          root_add.addEventListener('click', function () {
            self.insert_child_ui(node, node.children.length);
          });
          row.appendChild(root_add);
        }
      } else {
        var val_text;
        if (node.type === 'string') {
          val_text = node.value;
        } else if (node.type === 'null') {
          val_text = 'null';
        } else {
          val_text = (node.value === undefined) ? '' : String(node.value);
        }
        var val_el = el('span', 'jed-val t-' + node.type);
        if (node.type === 'string') {
          /* 引号单独渲染不参与编辑；整个值区域（含引号）都可点击编辑，纯文本自动补引号 */
          var vq1 = el('span', 'jed-quote', '"');
          var vcore = el('span', 'jed-val-core', node.value === undefined ? '' : String(node.value));
          var vq2 = el('span', 'jed-quote', '"');
          val_el.appendChild(vq1);
          val_el.appendChild(vcore);
          val_el.appendChild(vq2);
          if (!self.readonly) attach_value_edit(val_el, node);
        } else {
          val_text = val_text || '';
          val_el.textContent = val_text;
          if (!self.readonly) attach_value_edit(val_el, node);
        }
        row.appendChild(val_el);
      }

      if (!r.is_root && !self.readonly) {
        row.appendChild(build_ops(node, r.parent));
      }
      wrap.appendChild(row);
      return row;
    }

    /** 括号按嵌套深度递变着色（色相 +60°/层），同层开闭括号同色 */
    function brace_color(depth) {
      var hue = (depth * 60) % 360;
      return 'hsl(' + hue + ', 72%, ' + (self.options.theme === 'dark' ? 62 : 42) + '%)';
    }

    /** 悬停操作按钮组：+ 添加 / ⊞ 全部折叠展开 / ↑ 上移 / ↓ 下移 / × 删除 */
    function build_ops(node, parent) {
      var is_container = node.type === 'object' || node.type === 'array';
      var ops = el('span', 'jed-ops');

      function btn(icon, title, handler, show) {
        var b = el('button', 'jed-op', icon);
        b.title = title;
        b.style.display = show ? '' : 'none';
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          handler();
        });
        ops.appendChild(b);
      }

      btn('+', is_container ? (node.type === 'object' ? 'Insert key-value pair' : 'Insert array element') : '', function () {
        self.insert_child_ui(node, node.children.length);
      }, is_container);
      btn('⊞', node.collapsed ? 'Expand all children' : 'Collapse all children', function () {
        self.toggle_all_children(node, !node.collapsed);
      }, is_container);
      btn('↑', 'Move up', function () {
        if (parent && model_api.move_child(parent, node, -1)) {
          self.mark_dirty();
          self.render_editor_view();
        }
      }, true);
      btn('↓', 'Move down', function () {
        if (parent && model_api.move_child(parent, node, 1)) {
          self.mark_dirty();
          self.render_editor_view();
        }
      }, true);
      btn('×', 'Delete', function () {
        if (parent) {
          model_api.remove_child(parent, node);
          self.mark_dirty();
          self.render_editor_view();
        }
      }, true);
      return ops;
    }

    /** key 点击进入内联编辑 */
    function attach_key_edit(key_el, node, parent) {
      key_el.classList.add('jed-editable');
      key_el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (key_el.querySelector('input')) return;
        var before = node.key;
        start_inline_edit(key_el, before, function (new_val) {
          new_val = new_val.trim();
          if (new_val && new_val !== before) {
            var dup = parent && parent.children.some(function (c) { return c !== node && c.key === new_val; });
            if (!dup) node.key = new_val;
          }
          self.mark_dirty();
          self.render_editor_view();
        });
      });
    }

    /** value 点击进入内联编辑；纯文本自动按字符串处理（自动补引号），
        带引号或 JSON 语法则按 JSON 解析（可切换类型）。
        编辑锚点 target：字符串模式替换引号内 core span，其他模式替换整个 val_el */
    function attach_value_edit(val_el, node) {
      val_el.classList.add('jed-editable');
      val_el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (val_el.querySelector('input')) return;
        var is_str = node.type === 'string';
        var edit_span = is_str ? val_el.querySelector('.jed-val-core') : val_el;
        if (!edit_span) edit_span = val_el;
        if (edit_span.querySelector('input')) return;
        var raw_before = is_str ? String(node.value === undefined ? '' : node.value) : JSON.stringify(node.value);
        start_inline_edit(edit_span, raw_before, function (new_val) {
          var t = new_val.trim();
          if (t !== '') {
            var parsed_val = parse_value_input(t);
            if (parsed_val.ok) {
              var new_node = to_node(parsed_val.value, node.key);
              node.type = new_node.type;
              node.value = new_node.value;
              node.children = new_node.children;
            }
          }
          self.mark_dirty();
          self.render_editor_view();
        });
      });
    }

  /* ---------- 值输入解析规则（编辑器/导图共用，模块级） ----------
      1. {} 或 [...] 开头 → 尝试 JSON 解析，成功则变为对象/数组（含内容）
      2. true / false / null → 对应字面量值
      3. 纯数字 → 数值
      4. 双引号包裹 → 按字符串解析（含转义）
      5. 其他 → 普通字符串（自动补引号） */
  function parse_value_input(t) {
    var c0 = t.charAt(0);
    if (c0 === '{' || c0 === '[') {
      var parsed = parser.parse(t);
      if (parsed.ok) return parsed;
      return { ok: true, value: t };  /* 括号开头但非法 JSON → 按字符串保留 */
    }
    if (t === 'true') return { ok: true, value: true };
    if (t === 'false') return { ok: true, value: false };
    if (t === 'null') return { ok: true, value: null };
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return { ok: true, value: Number(t) };
    if (c0 === '"') {
      var parsed_str = parser.parse(t);
      if (parsed_str.ok && parsed_str.value !== undefined) return parsed_str;
    }
    return { ok: true, value: t };
  }

  /** 折叠/展开某节点的全部后代（含嵌套层） */
    /** 在 span 内创建 input，Enter/失焦提交，Escape 取消 */
    function start_inline_edit(span, current_text, on_done) {
      var input = document.createElement('input');
      input.value = current_text;
      input.style.cssText = 'font:inherit;border:none;outline:none;background:transparent;color:inherit;padding:0;width:'
        + Math.max(60, current_text.length * 9 + 24) + 'px;';
      span.textContent = '';
      span.appendChild(input);
      input.focus();
      input.select();
      var done = false;
      function finish(cancel) {
        if (done) return;
        done = true;
        on_done(cancel ? current_text : input.value);
      }
      input.addEventListener('blur', function () { finish(false); });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(false); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(true); }
      });
    }
  };

  /** 折叠/展开某节点的全部后代（含嵌套层） */
  JedInstance.prototype.toggle_all_children = function (node, collapsed) {
    (function walk(n) {
      if (n.type !== 'object' && n.type !== 'array') return;
      n.collapsed = collapsed;
      n.children.forEach(walk);
    })(node);
    this.render_editor_view();
  };

  /** 插入子节点：object 插键值对，array 插元素（匹配容器类型）；
      若当前在导图视图，自动切到编辑器视图让新节点可编辑 */
  JedInstance.prototype.insert_child_ui = function (parent, index) {
    var child = model_api.make_child_for(parent.type);
    model_api.insert_child(parent, index, child);
    this.mark_dirty();
    if (this.active_view !== 'editor') {
      this.switch_view('editor');
    } else {
      this.render_editor_view();
    }
  };

  /* ---------- 导图视图 ---------- */

  JedInstance.prototype.render_mindmap_view = function () {
    var self = this;
    this.body.innerHTML = '';
    /* 导图用拖拽平移，禁用 body 滚动条 */
    this.body.classList.add('mm-mode');
    var wrap = el('div', 'jed-mindmap');
    this.body.appendChild(wrap);
    var canvas = el('div', 'jed-mm-canvas');
    wrap.appendChild(canvas);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'jed-mm-svg');
    canvas.appendChild(svg);

    /* ---------- 平移 + 滚轮缩放画布 ---------- */
    var view = { x: 20, y: 20, scale: 1 };
    function apply_view() {
      canvas.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
      canvas.style.transformOrigin = '0 0';
    }
    apply_view();

    /* 按住空白处拖拽平移 */
    var dragging = false, drag_start = null, moved = false;
    wrap.addEventListener('mousedown', function (e) {
      if (e.target.closest('.jed-mm-node') || e.target.closest('.jed-mm-input')) return;
      dragging = true;
      moved = false;
      drag_start = { mx: e.clientX, my: e.clientY, vx: view.x, vy: view.y };
      wrap.classList.add('jed-dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - drag_start.mx, dy = e.clientY - drag_start.my;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      view.x = drag_start.vx + dx;
      view.y = drag_start.vy + dy;
      apply_view();
    });
    window.addEventListener('mouseup', function () {
      dragging = false;
      wrap.classList.remove('jed-dragging');
    });
    /* 滚轮缩放（以鼠标位置为中心） */
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      var old_scale = view.scale;
      var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      var new_scale = Math.min(3, Math.max(0.3, old_scale * factor));
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      view.x = mx - (mx - view.x) * (new_scale / old_scale);
      view.y = my - (my - view.y) * (new_scale / old_scale);
      view.scale = new_scale;
      apply_view();
    }, { passive: false });

    var NODE_H = 30, LEVEL_W = 190, GAP = 8, PADDING = 40;
    var max_x = 0, max_y = 0;

    /* 布局：返回每个节点的 {node, el, x, y} */
    var layout = [];
    layout_tree(this.model.root, 0, null);

    function layout_tree(node, depth, parent_item) {
      var is_leaf = !(node.type === 'object' || node.type === 'array') || node.collapsed || node.children.length === 0;
      var item = { node: node, depth: depth, parent: parent_item, children: [] };
      layout.push(item);

      if (is_leaf) {
        item.y = alloc_y();
      } else {
        var child_ys = [];
        node.children.forEach(function (c) {
          var child_item = layout_tree(c, depth + 1, item);
          child_ys.push(child_item.y);
        });
        item.y = (child_ys[0] + child_ys[child_ys.length - 1]) / 2;
      }
      return item;
    }

    function alloc_y() {
      var y = max_y;
      max_y += NODE_H + GAP;
      return y;
    }

    /* 渲染节点 + 连线 */
    layout.forEach(function (item) {
      var x = PADDING + item.depth * LEVEL_W;
      var y = item.y;
      item.x = x;

      var node_el = el('div', 'jed-mm-node nt-' + item.node.type);
      var label;
      if (item.depth === 0) {
        /* 根节点固定显示 root(n) */
        label = 'root(' + (item.node.children ? item.node.children.length : 0) + ')';
      } else {
        label = item.node.key !== null && item.node.key !== undefined ? item.node.key + ' : ' : '';
        if (item.node.type === 'object' || item.node.type === 'array') {
          label += item.node.type === 'object' ? '{' + item.node.children.length + '}' : '[' + item.node.children.length + ']';
        } else if (item.node.type === 'string') {
          label += '"' + item.node.value + '"';
        } else {
          label += String(item.node.value);
        }
      }
      node_el.textContent = label;
      if (item.depth === 0) node_el.classList.add('jed-mm-root');

      if (!self.readonly && (item.node.type === 'object' || item.node.type === 'array')) {
        var add = el('span', 'jed-mm-add', '+');
        add.title = 'Add child';
        add.addEventListener('click', function (e) {
          e.stopPropagation();
          self.insert_child_ui(item.node, item.node.children.length);
        });
        node_el.appendChild(add);
      }

      /* 双击节点 → 跳转到编辑器视图（编辑统一在编辑器进行） */
      node_el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        self.switch_view('editor');
      });

      node_el.style.left = x + 'px';
      node_el.style.top = (y - NODE_H / 2) + 'px';
      node_el.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      canvas.appendChild(node_el);
      max_x = Math.max(max_x, x + 220);

      if (item.parent) {
        var px = item.parent.x + 160, py = item.parent.y;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var mx = (px + x) / 2;
        path.setAttribute('d', 'M' + px + ',' + py + ' C' + mx + ',' + py + ' ' + mx + ',' + y + ' ' + x + ',' + y);
        path.setAttribute('stroke', 'var(--jed-border)');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }
    });

    svg.setAttribute('width', max_x + PADDING);
    svg.setAttribute('height', max_y + PADDING);
    canvas.style.width = (max_x + PADDING) + 'px';
    canvas.style.height = (max_y + PADDING) + 'px';
  };

  /* ---------- 文本视图 ---------- */

  JedInstance.prototype.render_text_view = function () {
    var self = this;
    var wrap = el('div', 'jed-text-wrap');
    var text_area = el('textarea', 'jed-text');
    /* 每次进入文本视图都从当前模型重新序列化，保证加载/编辑/更新后内容同步 */
    text_area.value = self.get_text();
    text_area.spellcheck = false;
    if (this.readonly) text_area.readOnly = true;
    wrap.appendChild(text_area);

    /* 右上角浮动按钮：默认只有应用按钮隐藏，编辑文本时显示 */
    var apply_btn = el('button', 'jed-btn jed-text-apply', '→ Apply to structure');
    apply_btn.style.display = 'none';
    apply_btn.addEventListener('click', function () {
      var parsed = parser.parse(text_area.value);
      if (parsed.ok) {
        self.model.root = to_node(parsed.value);
        self.mark_dirty();
        apply_btn.textContent = '✓ Applied';
        setTimeout(function () {
          apply_btn.textContent = '→ Apply to structure';
          apply_btn.style.display = 'none';
        }, 1000);
      } else {
        apply_btn.textContent = '✕ Invalid JSON';
        setTimeout(function () { apply_btn.textContent = '→ Apply to structure'; }, 1200);
      }
    });
    wrap.appendChild(apply_btn);
    this.body.appendChild(wrap);

    text_area.addEventListener('input', function () {
      self.json_text = text_area.value;
      /* 文本被手动修改后显示浮动应用按钮 */
      apply_btn.style.display = '';
    });
  };

  /* ---------- 保存与校验 ---------- */

  JedInstance.prototype.do_save = function () {
    var errors = validator.validate(this.model);
    this.errors = errors;
    var old_err = this.container.querySelector('.jed-errors');
    if (old_err) old_err.remove();

    if (errors.length > 0) {
      var err_box = el('div', 'jed-errors');
      err_box.appendChild(el('div', null, 'Validation failed — ' + errors.length + ' issue(s):'));
      var ul = el('ul');
      errors.forEach(function (e) {
        ul.appendChild(el('li', null, e.path + ' — ' + e.msg));
      });
      err_box.appendChild(ul);
      this.container.appendChild(err_box);
      if (this.options.onError) this.options.onError(errors);
      return false;
    }

    this.container.classList.remove('dirty');
    this.json_text = JSON.stringify(to_value(this.model.root), null, 2);
    if (this.options.onSave) this.options.onSave(to_value(this.model.root), true);
    return true;
  };

  JedInstance.prototype.mark_dirty = function () {
    this.container.classList.add('dirty');
    if (this.options.onChange) {
      try { this.options.onChange(to_value(this.model.root)); } catch (e) { /* 回调异常不阻塞 */ }
    }
  };

  /* ---------- 公共 API ---------- */

  JedInstance.prototype.get = function () { return to_value(this.model.root); };
  JedInstance.prototype.get_text = function () { return JSON.stringify(to_value(this.model.root), null, 2); };

  JedInstance.prototype.set = function (value) {
    var parsed = typeof value === 'string' ? parser.parse(value) : { ok: true, value: value };
    if (!parsed.ok) throw new Error('JED.set: invalid JSON — ' + parsed.error);
    this.model.root = to_node(parsed.value);
    this.container.classList.remove('dirty');
    this.switch_view(this.active_view);
  };

  JedInstance.prototype.validate = function () { return validator.validate(this.model); };

  JedInstance.prototype.view = function (view_id) { this.switch_view(view_id); };

  JedInstance.prototype.destroy = function () {
    this.container.classList.remove('jed-root', 'dirty');
    this.container.innerHTML = '';
  };

  /** 读取当前视图 id（供外部重建实例时保留状态） */
  JedInstance.prototype.get_view = function () { return this.active_view; };

  /** 运行时切换主题（无需重建实例）：theme = 'light' | 'dark' */
  JedInstance.prototype.set_theme = function (theme) {
    this.options.theme = theme === 'dark' ? 'dark' : 'light';
    this.container.classList.toggle('dark', this.options.theme === 'dark');
  };

  /* ============================== 自动扫描 ============================== */

  function create_from_element(elem) {
    var raw = elem.getAttribute('data-value') || elem.textContent.trim();
    var parsed = parser.parse(raw || '{}');
    var value = parsed.ok ? parsed.value : {};
    var inst_options = {
      el: elem,
      title: elem.getAttribute('data-title') || 'JSON Editor',
      value: value,
      theme: elem.getAttribute('data-theme') || undefined,
      readonly: elem.hasAttribute('data-readonly'),
      height: elem.getAttribute('data-height') || undefined,
      max_height: elem.getAttribute('data-max-height') || undefined,
      font_size: elem.getAttribute('data-font-size') || undefined
    };
    var inst = new JedInstance(inst_options);
    elem.__jed = inst;
    return inst;
  }

  function scan(root) {
    root = root || document;
    var instances = [];
    /* 1. <json> 标签 */
    var json_tags = root.querySelectorAll('json:not([data-jed-ready])');
    Array.prototype.forEach.call(json_tags, function (elem) {
      elem.setAttribute('data-jed-ready', '1');
      instances.push(create_from_element(elem));
    });
    /* 2. <div tag="json"> 或任何元素带 tag="json" */
    var tagged = root.querySelectorAll('[tag="json"]:not([data-jed-ready])');
    Array.prototype.forEach.call(tagged, function (elem) {
      elem.setAttribute('data-jed-ready', '1');
      instances.push(create_from_element(elem));
    });
    return instances;
  }

  /* ============================== 导出全局 ============================== */

  var JED = {
    version: '1.0.0',
    create: function (options) { return new JedInstance(options); },
    scan: scan
  };

  if (typeof window !== 'undefined') window.JED = JED;

  /* DOM 就绪后自动扫描 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scan(); });
  } else {
    scan();
  }
})();
/* ============================== React 18 适配层 ============================== */
(function () {
'use strict';

  function JedReact(props) {
    var host_ref = React.useRef(null);
    var jed_ref = React.useRef(null);
    var onChange = props.onChange || function () {};

    React.useEffect(function () {
      jed_ref.current = JED.create({
        el: host_ref.current,
        title: props.title || 'JSON Editor',
        theme: props.theme || 'light',
        height: props.height || undefined,
        max_height: props.max_height || '50vh',
        font_size: props.font_size || undefined,
        defaultView: props.default_view || 'editor',
        readonly: !!props.readonly,
        value: props.value,
        onChange: onChange
      });
      return function () {
        if (jed_ref.current) { jed_ref.current.destroy(); jed_ref.current = null; }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 外部 value 变化 → 更新编辑器（跳过自身触发的变化） */
    React.useEffect(function () {
      var jed = jed_ref.current;
      if (!jed) return;
      var incoming = props.value;
      if (incoming === undefined || incoming === null) incoming = {};
      if (typeof incoming === 'string') {
        try { incoming = JSON.parse(incoming); } catch (e) { return; }
      }
      var current = jed.get();
      if (JSON.stringify(current) !== JSON.stringify(incoming)) {
        jed.set(incoming);
      }
    }, [props.value]);

    /* 标题变化 → 重建实例；主题变化 → 热切换（不重建） */
    var title_key = props.title || '';
    var prev_theme = React.useRef(props.theme);
    React.useEffect(function () {
      var jed = jed_ref.current;
      if (!jed) return;
      if (prev_theme.current !== props.theme) {
        prev_theme.current = props.theme;
        jed.set_theme(props.theme);
        return;
      }
      var saved = jed.get();
      var saved_view = jed.get_view();
      jed.destroy();
      jed_ref.current = JED.create({
        el: host_ref.current,
        title: props.title || 'JSON Editor',
        theme: props.theme || 'light',
        height: props.height || undefined,
        max_height: props.max_height || '50vh',
        font_size: props.font_size || undefined,
        defaultView: saved_view || props.default_view || 'editor',
        readonly: !!props.readonly,
        value: saved,
        onChange: onChange
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title_key, props.theme]);

    return React.createElement('div', { ref: host_ref });
  }

  var JEDReact = { component: JedReact };

  if (typeof window !== 'undefined' && window.JED) {
    window.JED.react = JEDReact;
  }
})();
