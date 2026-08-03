# AI Ecosystem Map

**→ [nestor-workspace.github.io/ai-ecosystem-map](https://nestor-workspace.github.io/ai-ecosystem-map/)**

Living, public-safe map of Cyril’s personal AI ecosystem: conversation surfaces, code harnesses, personal agents, memory systems, domain adapters and infrastructure.

Clicking any component highlights its direct relationships and dims the rest of the graph. The same interaction is available from the generated catalogue and by keyboard.

The published site is generated from [`data/architecture.json`](data/architecture.json). The output is a standalone HTML document with inline CSS, inline SVG and embedded brand marks.

## Local development

```bash
npm ci        # once
npm run dev   # build, then serve on http://localhost:8000
```

`npm run dev` rebuilds `dist/index.html` and serves it. Re-run it after every edit — the
build is a one-shot generator, there is no watcher.

To build without serving, or to run the full gate that CI runs:

```bash
npm run build    # regenerate dist/index.html
npm run verify   # check + build + test, exactly what CI runs
```

The page is entirely self-contained, so opening `dist/index.html` straight from the
filesystem works too; the server only matters if you need a real `http://` origin (for
instance to drive the page with a headless browser).

## Updating the map

1. Edit `data/architecture.json`.
2. Keep every node identifier stable; edges reference those identifiers.
3. Run `npm run verify`.
4. Open a pull request. GitHub Pages is redeployed after the change reaches `main`.

`npm run check` rejects duplicate identifiers, dangling or self edges, unknown status and
edge-kind values, nodes placed outside their zone, and overlapping nodes. `npm run build`
then refuses any node whose label or subtitle would not fit inside its box, so a layout
mistake fails the build instead of silently shipping truncated text. The test suite
additionally greps the data for common private-data patterns.

Brand assets for Hermes Agent, Docmost and rabbit are kept locally in `assets/` from their official projects/sites. Other marks are generated from Simple Icons and LobeHub Icons at build time.

`assets/hermes-avatar.png` is the avatar of this personal Hermes instance, not a Nous Research mark; `hermes-agent.png` remains the upstream project mark and is used only by the infrastructure node. Every asset is embedded as base64, so keep new ones at the size they are rendered (96px is plenty for a 42px disc). Assets are clipped to a circle at render time, so a square image is fine — its corners are cut, not left to bleed outside the badge.

`assets/favicon.png` (64px, generated from the Nestor avatar) is inlined as a data URI, so
the published site stays a single file with no second request.

A node `subtitle` is either a string (prose, wrapped over at most two lines) or an array of
strings (an enumeration, rendered one item per line and never reflowed). Prefer the array
whenever the subtitle lists distinct products or layers.

## Status vocabulary

- `active`: in regular use.
- `experimental`: working prototype or non-primary path.
- `planned`: represented only by dashed edges; not yet delivered.

## Privacy

This repository is intentionally public so it can use GitHub Pages on the organization’s current plan. Do not add credentials, private hostnames, private IP addresses, email addresses or personal documents.
