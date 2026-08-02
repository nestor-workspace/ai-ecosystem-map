# AI Ecosystem Map

Living, public-safe map of Cyril’s personal AI ecosystem: conversation surfaces, code harnesses, personal agents, memory systems, domain adapters and infrastructure.

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

## Status vocabulary

- `active`: in regular use.
- `experimental`: working prototype or non-primary path.
- `planned`: represented only by dashed edges; not yet delivered.

## Privacy

This repository is intentionally public so it can use GitHub Pages on the organization’s current plan. Do not add credentials, private hostnames, private IP addresses, email addresses or personal documents.
