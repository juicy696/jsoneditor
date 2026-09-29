# JsonStudio Website

The promotion website, served via GitHub Pages from this `docs/` directory.

## Structure

```
docs/
├── index.html        # Home: hero banner (50vh) + live demo (<json> tag) + usage docs + downloads
├── vue.html          # Vue 3 integration: live component demo + v-model docs + downloads
├── react.html        # React 18 integration: live component demo + props docs + downloads
├── help.html         # Full documentation: install, API, options, views, events, FAQ
├── license.html      # License page: Apache-2.0 summary + commercial contact
├── LICENSE           # License text (fetched by license.html)
└── assets/
    ├── site.css      # Site styles (nav / hero / cards / footer)
    ├── nav.js        # Shared nav & footer (JsonSite.nav() / JsonSite.footer())
    ├── img/          # Images (partner logos)
    └── js/           # Editor engine (download buttons link here)
        ├── json-editor.js
        ├── json-vue.js
        └── json-react.js
```

## Nav

Top-centered: "JSONEditor" brand on the left; JavaScript / Vue / React / Docs tabs + GitHub link on the right.
Edit `assets/nav.js` to change nav items.

## Deploy (GitHub Pages)

1. Push the repository to GitHub
2. Settings → Pages → Source: `main` branch, `/docs` folder
3. Custom domain: add a `CNAME` file in this directory, then point DNS to `<user>.github.io`
