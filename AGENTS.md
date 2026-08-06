# AGENTS.md

Instructions for AI agents working in this repository.

## What this is

A single generated page mapping Cyril's personal AI ecosystem, published to GitHub Pages.
`data/architecture.json` is the source of truth; `scripts/build.mjs` turns it into a
self-contained `dist/index.html`.

Read [`docs/build.md`](docs/build.md) before touching `scripts/build.mjs` or the layout
fields in the data — the layout is placed by hand and the text fitting is estimated, both of
which are easy to break without noticing.

## Commands

```bash
npm ci        # once
npm run verify   # check + build + test — the only gate, same as CI
npm run build    # regenerate dist/index.html
npm run dev      # build, then serve dist/ on http://localhost:8000 (no watcher)
```

`npm run verify` must pass before anything is committed. It is exactly what CI and the Pages
deploy run, so a green local run means a green pipeline.

## Verifying a visual change

`npm run verify` never looks at the rendered page. For a CSS, layout or icon change, render it:

```bash
HEADLESS=$(ls ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell | head -1)
"$HEADLESS" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1700,2700 --screenshot=/tmp/map.png \
  "file://$PWD/dist/index.html#google-workspace"
```

- There is no Chrome on this machine; the headless shell in the Playwright cache does the job
  with no extra dependency.
- A `#node-id` fragment pre-selects that node — the only way to render the selected state in
  one command.
- To prove a CSS refactor is neutral at rest, compare the SHA-256 of two nominal screenshots
  taken with identical flags. They must be byte-identical.

## Rules

- **This repo is public.** Never add credentials, tokens, private hostnames, private IP
  addresses, email addresses or personal documents. A test greps the data for the obvious
  patterns, but it is a backstop, not a review.
- **Use `npm`, not `bun`.** This overrides the global TS/JS preference: `package-lock.json` is
  committed and both workflows pin `npm ci` with npm caching.
- **Never hand-edit `dist/index.html`.** It is generated. Change the data or the script, then
  rebuild.
- **Commit the rebuilt `dist/index.html`** in the same commit as the change that alters it. A
  fresh build must be byte-identical to what is committed.
- **Node ids are an API.** Edges and `#node-id` deep links reference them; renaming one breaks
  external links and the tests.
- **Don't loosen a build check to make a node fit.** `SUBTITLE_CHAR_PX`, `LABEL_CHAR_PX` and
  the geometry constants exist so a layout mistake fails the build instead of shipping
  truncated text. Resize the box or shorten the text.
- No new dependencies. The generator is plain Node plus two icon packages; keep it that way.

## Conventions

- Page content, data strings and code comments are in **French**. README, `docs/` and this
  file are in **English**.
- Conventional Commits, linear history. Merge a PR by fast-forwarding `main` onto the branch
  locally, not with `gh pr merge` — it preserves the commit SHA instead of rewriting it.
- Vocabularies are closed sets, enforced by `scripts/validate.mjs`: node `status` is
  `active` / `experimental` / `planned`; edge `kind` is `primary` / `active` / `ondemand` /
  `planned` / `experimental`. Adding a value means updating the validator, the CSS and the
  legend together.
- A node `subtitle` is a string for prose (wrapped, max two lines) or an array for an
  enumeration (one item per line). Prefer the array when listing distinct products or layers.
