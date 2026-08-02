# AI Ecosystem Map

Living, public-safe map of Cyril’s personal AI ecosystem: conversation surfaces, code harnesses, personal agents, memory systems, domain adapters and infrastructure.

Clicking any component highlights its direct relationships and dims the rest of the graph. The same interaction is available from the generated catalogue and by keyboard.

The published site is generated from [`data/architecture.json`](data/architecture.json). The output is a standalone HTML document with inline CSS, inline SVG and embedded brand marks.

## Local development

```bash
npm ci
npm run verify
```

Open `dist/index.html` in a browser.

## Updating the map

1. Edit `data/architecture.json`.
2. Keep every node identifier stable; edges reference those identifiers.
3. Run `npm run verify`.
4. Open a pull request. GitHub Pages is redeployed after the change reaches `main`.

The data validator rejects duplicate identifiers, dangling edges and accidental publication of common private-data patterns.

Brand assets for Hermes Agent, Docmost and rabbit are kept locally in `assets/` from their official projects/sites. Other marks are generated from Simple Icons and LobeHub Icons at build time.

## Status vocabulary

- `active`: in regular use.
- `experimental`: working prototype or non-primary path.
- `planned`: represented only by dashed edges; not yet delivered.

## Privacy

This repository is intentionally public so it can use GitHub Pages on the organization’s current plan. Do not add credentials, private hostnames, private IP addresses, email addresses or personal documents.
