# JsonStudio Website

The promotion website, served via GitHub Pages from this `docs/` directory.

## Structure / 结构

```
docs/
├── index.html        # 首页：Hero banner（50vh）+ Live Demo（<json> 标签实机）+ 使用文档 + 下载
├── vue.html          # Vue 3 集成页：实机 Vue 组件演示 + v-model 文档 + 下载
├── react.html        # React 18 集成页：实机组件演示 + Props 文档 + 下载
├── license.html      # 许可证页：Apache-2.0 说明 + 商业授权联系方式
├── LICENSE           # 协议全文（license.html 动态加载显示）
└── assets/
    ├── site.css      # 站点样式（nav / hero / 卡片 / footer）
    ├── nav.js        # 统一导航与页脚（JsonSite.nav() / JsonSite.footer()）
    └── js/           # 编辑器引擎（下载按钮直接指向这里的文件）
        ├── json-editor.js
        ├── json-vue.js
        └── json-react.js
```

## Nav / 导航

顶部居中：左侧「🏮 JsonStudio」标题，右侧 Web / Vue / React 三个演示页签 + GitHub 链接（带图标）。
修改导航项：编辑 `assets/nav.js`。

## Deploy / 部署（GitHub Pages）

1. 推送整个仓库到 GitHub
2. Settings → Pages → Source: `main` branch, `/docs` folder
3. 自定义域名：在本目录添加 `CNAME` 文件（内容为域名），DNS 加 CNAME 记录指向 `<user>.github.io`

## TODO

- [ ] 使用文档目前为中文，定稿后翻译为英文
- [ ] 替换 `juicy696`（nav.js、各 html 中 GitHub 链接、README）
