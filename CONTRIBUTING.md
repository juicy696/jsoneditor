# Contributing / 贡献指南

Thanks for your interest in contributing! / 感谢你有兴趣贡献！

## Dev setup / 开发环境

No build step required. The library is plain JavaScript.

```bash
git clone https://github.com/juicy696/jsoneditor.git
cd json-editor
# open demo/index.html in a browser — that's the whole dev environment
```

## Code style / 代码规范

- Variable naming: **snake_case** everywhere (no camelCase for new code)
- Single-file constraint: each adapter (vue/react) must stay self-contained with the core
- All user-visible strings should work for both zh-CN and en (bilingual comments OK)

## Workflow / 流程

1. Fork → branch (`feat/xxx` or `fix/xxx`)
2. Test manually in `demo/index.html`, `demo/demo_vue.html`, `demo/demo_react.html`
3. Commit with a clear message (conventional commits preferred: `feat:`, `fix:`, `docs:`)
4. Open a Pull Request

## Reporting bugs / 报告问题

Open an issue with:
- Browser + version
- Minimal reproduction (HTML snippet)
- Expected vs actual behavior
