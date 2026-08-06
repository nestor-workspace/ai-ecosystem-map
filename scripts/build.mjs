import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as simpleIcons from "simple-icons";

const root = new URL("../", import.meta.url);
const architecture = JSON.parse(await readFile(new URL("data/architecture.json", root), "utf8"));

const brandAssetFiles = {
  openclaw: "openclaw.png",
  // `hermes` = la marque du projet Nous Research ; `hermes-avatar` = l'avatar de
  // l'instance de Cyril. Les deux coexistent : le nœud d'infrastructure désigne le
  // projet upstream, les nœuds agent désignent son instance.
  hermes: "hermes-agent.png",
  "hermes-avatar": "hermes-avatar.png",
  docmost: "docmost.png",
  rabbit: "rabbit.png",
  mypacer: "mypacer.png",
};

const brandAssets = new Map(
  await Promise.all(
    Object.entries(brandAssetFiles).map(async ([slug, filename]) => [
      slug,
      (await readFile(new URL(`assets/${filename}`, root))).toString("base64"),
    ]),
  ),
);

// Favicon inline : le document reste un fichier unique, sans requête vers un second asset.
const favicon = (await readFile(new URL("assets/favicon.png", root))).toString("base64");

const lobeIconFiles = {
  openai: "openai.svg",
  claude: "claude-color.svg",
  claudecode: "claudecode-color.svg",
};

const lobeIcons = new Map(
  await Promise.all(
    Object.entries(lobeIconFiles).map(async ([slug, filename]) => {
      const source = await readFile(
        new URL(`node_modules/@lobehub/icons-static-svg/icons/${filename}`, root),
        "utf8",
      );
      const content = source
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "")
        .replace(/<title>.*?<\/title>/, "");
      return [slug, { content }];
    }),
  ),
);

const iconsBySlug = new Map(
  Object.values(simpleIcons)
    .filter((value) => value && typeof value === "object" && value.slug && value.path)
    .map((icon) => [icon.slug, icon]),
);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const zoneById = new Map(architecture.zones.map((zone) => [zone.id, zone]));
const nodeById = new Map(architecture.nodes.map((node) => [node.id, node]));

function simpleIcon(slug) {
  return iconsBySlug.get(slug);
}

function brandIcon(slug) {
  const lobeIcon = lobeIcons.get(slug);
  if (lobeIcon) return { ...lobeIcon, source: "lobe" };
  const icon = simpleIcon(slug);
  if (icon) return { content: `<path d="${icon.path}" fill="#${icon.hex}" />`, source: "simple" };
  return undefined;
}

function fallbackLetters(node) {
  return node.iconText || node.label.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
}

function renderSvgMark(node, x, y, size = 42) {
  if (node.iconAsset && brandAssets.has(node.iconAsset)) {
    // Le carré de l'image dépasse du disque (demi-diagonale > rayon) : on le découpe
    // au cercle plutôt que de l'insérer, sinon les coins bavent hors de la pastille.
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" class="logo-disc" />
      <use href="#brand-${escapeHtml(node.iconAsset)}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#disc-clip)" />`;
  }

  const iconSlugs = node.icons || (node.icon ? [node.icon] : []);
  const resolved = iconSlugs.map(brandIcon).filter(Boolean).slice(0, 3);

  if (resolved.length > 0) {
    const markSize = resolved.length === 1 ? size * 0.58 : size * 0.38;
    const gap = resolved.length === 1 ? 0 : 2;
    const total = resolved.length * markSize + (resolved.length - 1) * gap;
    const startX = x + (size - total) / 2;
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" class="logo-disc" />${resolved
      .map(
        (icon, index) =>
          `<svg x="${startX + index * (markSize + gap)}" y="${y + (size - markSize) / 2}" width="${markSize}" height="${markSize}" viewBox="0 0 24 24" color="#111111" aria-hidden="true">${icon.content}</svg>`,
      )
      .join("")}`;
  }

  return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="${escapeHtml(node.iconColor || "#667085")}" />
    <text x="${x + size / 2}" y="${y + size / 2 + 5}" text-anchor="middle" class="logo-fallback">${escapeHtml(fallbackLetters(node))}</text>`;
}

function renderHtmlMark(node) {
  if (node.iconAsset && brandAssets.has(node.iconAsset)) {
    return `<svg class="catalog-logo logo-disc-html" viewBox="0 0 100 100" aria-hidden="true"><use href="#brand-${escapeHtml(node.iconAsset)}" /></svg>`;
  }
  const icon = brandIcon(node.icon) || (node.icons || []).map(brandIcon).find(Boolean);
  if (icon) {
    return `<span class="catalog-logo logo-disc-html"><svg viewBox="0 0 24 24" color="#111111" aria-hidden="true">${icon.content}</svg></span>`;
  }
  return `<span class="catalog-logo logo-text" style="--brand:${escapeHtml(node.iconColor || "#667085")}">${escapeHtml(fallbackLetters(node))}</span>`;
}

// ponytail: largeur estimée au caractère, calibrée sur le pire ratio observé au rendu
// (6.31px pour le sous-titre 11px, 9.76px pour le label 15px semi-gras). Volontairement
// pessimiste : on préfère refuser une boîte trop juste que publier du texte qui déborde.
// Si la police change, remesurer les bbox plutôt que d'ajuster ces constantes à l'aveugle.
const SUBTITLE_CHAR_PX = 6.4;
const LABEL_CHAR_PX = 9.8;

const buildErrors = [];

function wrapText(text, width, compact = false) {
  const maxChars = Math.max(16, Math.floor((width - (compact ? 84 : 86)) / SUBTITLE_CHAR_PX));
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

const subtitleWidth = (node) => node.width - (node.compact ? 84 : 86);

// Un sous-titre tableau est une énumération : un élément par ligne, jamais reflowé.
// Une chaîne reste de la prose, wrappée sur deux lignes au maximum.
function fittedSubtitle(node) {
  if (Array.isArray(node.subtitle)) {
    const available = subtitleWidth(node);
    for (const item of node.subtitle) {
      const estimated = item.length * SUBTITLE_CHAR_PX;
      if (estimated > available) {
        buildErrors.push(
          `${node.id}: list item "${item}" needs ~${Math.round(estimated)}px, ${Math.round(available)}px available`,
        );
      }
    }
    return node.subtitle;
  }
  const lines = wrapText(node.subtitle, node.width, node.compact);
  if (lines.length > 2) {
    buildErrors.push(`${node.id}: subtitle needs ${lines.length} lines in ${node.width}px (max 2)`);
  }
  return lines.slice(0, 2);
}

// Doit rester aligné sur la géométrie de renderNode : ligne de base du label, puis
// sous-titres tous les 15px, plus le jambage descendant de la dernière ligne.
const DESCENDER = 4;

function checkNodeFits(node, subtitleLines) {
  const markSize = node.compact ? 32 : 42;
  const availableWidth = node.width - (18 + markSize + 16) - 8;
  const estimatedWidth = node.label.length * LABEL_CHAR_PX;
  if (estimatedWidth > availableWidth) {
    buildErrors.push(
      `${node.id}: label "${node.label}" needs ~${Math.round(estimatedWidth)}px, ${Math.round(availableWidth)}px available`,
    );
  }
  const labelOffset = node.compact ? 23 : 31;
  const neededHeight = labelOffset + 22 + (subtitleLines.length - 1) * 15 + DESCENDER;
  if (neededHeight > node.height) {
    buildErrors.push(
      `${node.id}: ${subtitleLines.length} subtitle line(s) need ${neededHeight}px of height, box is ${node.height}px`,
    );
  }
}

function renderZone(zone) {
  return `<g class="zone-group">
    <rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="24" class="zone zone-${zone.kind}" />
    <text x="${zone.x + 28}" y="${zone.y + 34}" class="zone-title">${escapeHtml(zone.title)}</text>
    <text x="${zone.x + 28}" y="${zone.y + 56}" class="zone-subtitle">${escapeHtml(zone.subtitle)}</text>
  </g>`;
}

function checkIconResolves(node) {
  if (node.iconAsset && !brandAssets.has(node.iconAsset)) {
    buildErrors.push(`${node.id}: unknown iconAsset "${node.iconAsset}"`);
    return;
  }
  if (node.iconAsset) return;
  const slugs = node.icons || (node.icon ? [node.icon] : []);
  const unknown = slugs.filter((slug) => !brandIcon(slug));
  // Un slug non résolu retombe silencieusement sur les initiales : on l'exige explicite.
  if (unknown.length > 0 && !node.iconText) {
    buildErrors.push(`${node.id}: unresolved icon slug(s) ${unknown.join(", ")} and no iconText fallback`);
  }
}

function renderNode(node) {
  const zone = zoneById.get(node.zone);
  checkIconResolves(node);
  const markSize = node.compact ? 32 : 42;
  const markX = node.x + 18;
  const markY = node.y + (node.height - markSize) / 2;
  const textX = markX + markSize + 16;
  const labelY = node.compact ? node.y + 23 : node.y + 31;
  const subtitleLines = fittedSubtitle(node);
  checkNodeFits(node, subtitleLines);
  const classes = ["node", `node-${zone.kind}`, node.emphasis ? "node-emphasis" : ""]
    .filter(Boolean)
    .join(" ");
  return `<g id="node-${node.id}" class="node-group" data-node-id="${escapeHtml(node.id)}" role="button" tabindex="0" aria-label="Mettre en valeur les relations de ${escapeHtml(node.label)}">
    <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="16" class="${classes}" />
    ${renderSvgMark(node, markX, markY, markSize)}
    <text x="${textX}" y="${labelY}" class="node-label">${escapeHtml(node.label)}</text>
    ${subtitleLines
      .map(
        (line, index) =>
          `<text x="${textX}" y="${labelY + 22 + index * 15}" class="node-subtitle">${escapeHtml(line)}</text>`,
      )
      .join("")}
    <circle cx="${node.x + node.width - 14}" cy="${node.y + 14}" r="4" class="status status-${node.status}" />
  </g>`;
}

function anchor(node, side) {
  const positions = {
    top: [node.x + node.width / 2, node.y],
    bottom: [node.x + node.width / 2, node.y + node.height],
    left: [node.x, node.y + node.height / 2],
    right: [node.x + node.width, node.y + node.height / 2],
  };
  return positions[side];
}

function defaultSides(from, to) {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dy) > Math.abs(dx) * 0.72) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

// Point à t=0.5 d'une Bézier cubique : (P0 + 3·P1 + 3·P2 + P3) / 8.
const cubicMidpoint = (p0, p1, p2, p3) => [
  (p0[0] + 3 * p1[0] + 3 * p2[0] + p3[0]) / 8,
  (p0[1] + 3 * p1[1] + 3 * p2[1] + p3[1]) / 8,
];

function bezierPath(start, end, startSide, endSide) {
  const [sx, sy] = start;
  const [tx, ty] = end;
  let c1;
  let c2;
  if ([startSide, endSide].every((side) => side === "top" || side === "bottom")) {
    const bend = Math.max(45, Math.abs(ty - sy) * 0.46);
    c1 = [sx, sy + (startSide === "bottom" ? bend : -bend)];
    c2 = [tx, ty + (endSide === "top" ? -bend : bend)];
  } else {
    const bend = Math.max(45, Math.abs(tx - sx) * 0.46);
    c1 = [sx + (startSide === "right" ? bend : -bend), sy];
    c2 = [tx + (endSide === "left" ? -bend : bend), ty];
  }
  return {
    d: `M ${sx} ${sy} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${tx} ${ty}`,
    mid: cubicMidpoint(start, c1, c2, end),
  };
}

function renderEdge(edge, index) {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  const [defaultFromSide, defaultToSide] = defaultSides(from, to);
  const fromSide = edge.fromSide || defaultFromSide;
  const toSide = edge.toSide || defaultToSide;
  const start = anchor(from, fromSide);
  const end = anchor(to, toSide);
  const { d, mid } = bezierPath(start, end, fromSide, toSide);
  const label = edge.label
    ? `<text x="${mid[0].toFixed(1)}" y="${(mid[1] - 7).toFixed(1)}" text-anchor="middle" class="edge-label">${escapeHtml(edge.label)}</text>`
    : "";
  return `<g class="edge-group edge-${edge.kind}" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}">
    <path id="edge-${index}" d="${d}" class="edge" marker-end="url(#arrow-${edge.kind})" />${label}
  </g>`;
}

// clipPathUnits="objectBoundingBox" : le cercle s'adapte à la bbox de l'élément clippé,
// donc un seul clipPath sert toutes les pastilles quelle que soit leur taille.
const discClip = `<clipPath id="disc-clip" clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath>`;

const markers = ["active", "primary", "planned", "ondemand", "experimental"]
  .map(
    (kind) => `<marker id="arrow-${kind}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" class="arrow arrow-${kind}" />
    </marker>`,
  )
  .join("");

// La légende des pastilles se déduit des statuts réellement présents : pas d'entrée
// pour un statut que plus aucun nœud ne porte.
const STATUS_LABELS = {
  active: "en usage régulier",
  experimental: "expérimental",
  planned: "non livré",
};
const presentStatuses = new Set(architecture.nodes.map((node) => node.status));
const statusLegend = Object.entries(STATUS_LABELS)
  .filter(([status]) => presentStatuses.has(status))
  .map(([status, label]) => `<span><i class="legend-dot status-${status}"></i> ${label}</span>`)
  .join("\n      ");

// Même principe pour les flux : pas d'entrée pour un type d'arête que plus aucun lien
// ne porte. Le jour où le dernier lien planifié disparaît, sa ligne disparaît avec lui.
const EDGE_LABELS = {
  primary: "flux principal",
  active: "intégration existante",
  ondemand: "accès à la demande",
  planned: "évolution planifiée",
  experimental: "expérimental",
};
const presentEdgeKinds = new Set(architecture.edges.map((edge) => edge.kind));
const flowLegend = Object.entries(EDGE_LABELS)
  .filter(([kind]) => presentEdgeKinds.has(kind))
  // `active` est le trait par défaut : il n'a pas de classe modificatrice.
  .map(
    ([kind, label]) =>
      `<span><i class="legend-line${kind === "active" ? "" : ` ${kind}`}"></i> ${label}</span>`,
  )
  .join("\n      ");

const zoneCatalog = architecture.zones
  .map((zone) => {
    const nodes = architecture.nodes.filter((node) => node.zone === zone.id);
    return `<section class="catalog-section">
      <div class="catalog-heading">
        <span class="zone-index zone-index-${zone.kind}">${escapeHtml(zone.title.split(".")[0])}</span>
        <div><h3>${escapeHtml(zone.title.replace(/^\d+\.\s*/, ""))}</h3><p>${escapeHtml(zone.subtitle)}</p></div>
      </div>
      <div class="catalog-grid">${nodes
        .map(
          (node) => `<article class="catalog-card" data-node-id="${escapeHtml(node.id)}" role="button" tabindex="0" aria-label="Mettre en valeur les relations de ${escapeHtml(node.label)}">
            ${renderHtmlMark(node)}
            <div><h4>${escapeHtml(node.label)}</h4>${
              Array.isArray(node.subtitle)
                ? `<ul>${node.subtitle.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
                : `<p>${escapeHtml(node.subtitle)}</p>`
            }</div>
            <span class="catalog-status status-${node.status}" title="${escapeHtml(node.status)}"></span>
          </article>`,
        )
        .join("")}</div>
    </section>`;
  })
  .join("");

const assetSymbols = [...brandAssets.entries()]
  .map(
    ([slug, base64]) =>
      `<symbol id="brand-${escapeHtml(slug)}" viewBox="0 0 100 100"><image href="data:image/png;base64,${base64}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" /></symbol>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Cartographie maintenable d’un écosystème IA personnel." />
  <link rel="icon" type="image/png" href="data:image/png;base64,${favicon}" />
  <title>${escapeHtml(architecture.meta.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f1ea;
      --surface: #fffdf8;
      --fg: #172033;
      --muted: #667085;
      --line: #98a2b3;
      --input: #e8f1ff;
      --process: #eee9ff;
      --storage: #e2f7ee;
      --external: #fff1d6;
      --neutral: #edf0f4;
      --primary: #2563eb;
      --planned: #8b5cf6;
      --ondemand: #7c8799;
      --experimental: #e97616;
      --shadow: 0 18px 50px rgba(31, 38, 51, 0.08);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111318;
        --surface: #181c23;
        --fg: #edf1f7;
        --muted: #a7b0c0;
        --line: #596375;
        --input: #16243a;
        --process: #29213e;
        --storage: #173329;
        --external: #382b16;
        --neutral: #252b34;
        --primary: #6ea8ff;
        --planned: #b497ff;
        --ondemand: #a2adbe;
        --experimental: #ff9d4d;
        --shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      }
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; overflow-x: hidden; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main { width: min(100vw, 1560px); min-width: 0; margin: 0 auto; padding: 42px 24px 72px; }
    header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; margin-bottom: 24px; }
    header > * { min-width: 0; }
    .eyebrow { margin: 0 0 8px; color: var(--planned); font-size: 12px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
    h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(34px, 5vw, 64px); line-height: .98; letter-spacing: -.045em; }
    header .subtitle { max-width: 820px; margin: 18px 0 0; color: var(--muted); font-size: 17px; }
    .meta { text-align: right; color: var(--muted); font-size: 13px; }
    .meta strong { display: block; color: var(--fg); font-size: 18px; }
    .diagram-shell { width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid color-mix(in srgb, var(--line) 42%, transparent); border-radius: 26px; background: var(--surface); box-shadow: var(--shadow); }
    .diagram { display: block; min-width: 1180px; width: 100%; height: auto; }
    .zone { stroke: color-mix(in srgb, var(--line) 45%, transparent); stroke-width: 1; }
    .zone-input { fill: var(--input); }
    .zone-process { fill: var(--process); }
    .zone-storage { fill: var(--storage); }
    .zone-external { fill: var(--external); }
    .zone-neutral { fill: var(--neutral); }
    .zone-title { font-size: 16px; font-weight: 780; fill: var(--fg); }
    .zone-subtitle { font-size: 12px; fill: var(--muted); }
    .node { stroke: color-mix(in srgb, var(--line) 58%, transparent); stroke-width: 1.2; filter: drop-shadow(0 5px 8px rgba(15, 23, 42, .06)); }
    .node-group, .catalog-card { cursor: pointer; }
    .node-group, .edge-group, .catalog-card { transition: opacity .18s ease, filter .18s ease, transform .18s ease; }
    .node-group:hover .node, .node-group:focus-visible .node { stroke: var(--primary); stroke-width: 2.2; }
    .node-group:focus-visible, .catalog-card:focus-visible { outline: none; }
    .node-group:focus-visible .node { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--primary) 65%, transparent)); }
    .selection-active .node-group.is-dimmed, .selection-active .edge-group.is-dimmed { opacity: .11; }
    .selection-active .node-group.is-related, .selection-active .edge-group.is-related { opacity: 1; }
    /* Remonter l'opacité du groupe ne suffit pas : le tracé garde la sienne, et un lien
       gris à 54 % reste illisible dès qu'on cherche à suivre un chemin. On le pousse à
       fond et on l'épaissit — les marqueurs sont en markerUnits="strokeWidth", donc la
       pointe de flèche grossit avec le trait. */
    .selection-active .edge-group.is-related .edge { stroke-width: calc(var(--w) + 1); opacity: 1; }
    .node-group.is-selected .node { stroke: var(--primary); stroke-width: 3.4; }
    .node-group.is-related:not(.is-selected) .node { stroke: color-mix(in srgb, var(--primary) 58%, var(--line)); stroke-width: 1.8; }
    .node-input, .node-process, .node-storage, .node-external, .node-neutral { fill: var(--surface); }
    .node-emphasis { stroke: var(--primary); stroke-width: 2.2; }
    .node-label { font-size: 15px; font-weight: 760; fill: var(--fg); }
    .node-subtitle { font-size: 11px; fill: var(--muted); }
    .logo-disc { fill: #fff; stroke: rgba(15, 23, 42, .08); stroke-width: 1; }
    .logo-fallback { fill: #fff; font-size: 13px; font-weight: 850; }
    .status-active { fill: #22a06b; background: #22a06b; }
    .status-experimental { fill: var(--experimental); background: var(--experimental); }
    .status-planned { fill: var(--planned); background: var(--planned); }
    .legend-dot { width: 9px; height: 9px; border-radius: 50%; }
    /* L'épaisseur passe par --w pour que la mise en avant à la sélection soit un delta
       appliqué à tous les types, au lieu d'une valeur fixe qui écraserait la hiérarchie. */
    .edge-group { --w: 1.35; }
    .edge { fill: none; stroke: var(--line); stroke-width: var(--w); opacity: .54; }
    .edge-primary { --w: 2.4; }
    .edge-primary .edge { stroke: var(--primary); opacity: .82; }
    .edge-planned { --w: 2.5; }
    .edge-planned .edge { stroke: var(--planned); stroke-dasharray: 10 7; opacity: .95; }
    .edge-ondemand .edge { stroke: var(--ondemand); stroke-dasharray: 3 6; opacity: .75; }
    .edge-experimental .edge { stroke: var(--experimental); stroke-dasharray: 7 6; opacity: .85; }
    .arrow-active { fill: var(--line); }
    .arrow-primary { fill: var(--primary); }
    .arrow-planned { fill: var(--planned); }
    .arrow-ondemand { fill: var(--ondemand); }
    .arrow-experimental { fill: var(--experimental); }
    .edge-label { fill: var(--fg); stroke: var(--surface); stroke-width: 6; paint-order: stroke; font-size: 10px; font-weight: 750; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px 22px; margin: 18px 4px 0; color: var(--muted); font-size: 13px; }
    .legend span { display: inline-flex; align-items: center; gap: 8px; }
    .legend .interaction-hint { margin-left: auto; color: var(--fg); font-weight: 700; }
    .legend-line { width: 34px; border-top: 2px solid var(--line); }
    .legend-line.primary { border-color: var(--primary); }
    .legend-line.ondemand { border-top-style: dotted; border-color: var(--ondemand); }
    .legend-line.planned { border-top-style: dashed; border-color: var(--planned); }
    .legend-line.experimental { border-top-style: dashed; border-color: var(--experimental); }
    .insights { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 42px 0 54px; }
    .insight { padding: 22px; border: 1px solid color-mix(in srgb, var(--line) 40%, transparent); border-radius: 18px; background: var(--surface); }
    .insight b { display: block; margin-bottom: 6px; font-size: 16px; }
    .insight p { margin: 0; color: var(--muted); }
    .section-title { margin: 0 0 28px; font-size: 28px; letter-spacing: -.02em; }
    .catalog-section { margin: 0 0 38px; }
    .catalog-heading { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
    .catalog-heading h3 { margin: 0; font-size: 20px; }
    .catalog-heading p { margin: 2px 0 0; color: var(--muted); }
    .zone-index { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; font-size: 17px; font-weight: 850; }
    .zone-index-input { background: var(--input); }
    .zone-index-process { background: var(--process); }
    .zone-index-storage { background: var(--storage); }
    .zone-index-external { background: var(--external); }
    .zone-index-neutral { background: var(--neutral); }
    .catalog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
    .catalog-card { position: relative; display: flex; gap: 13px; align-items: center; min-height: 82px; padding: 15px 38px 15px 15px; border: 1px solid color-mix(in srgb, var(--line) 36%, transparent); border-radius: 16px; background: var(--surface); }
    .catalog-card:hover { border-color: color-mix(in srgb, var(--primary) 52%, var(--line)); transform: translateY(-1px); }
    .selection-active .catalog-card.is-dimmed { opacity: .28; }
    .catalog-card.is-related { border-color: color-mix(in srgb, var(--primary) 45%, var(--line)); }
    .catalog-card.is-selected { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 22%, transparent); }
    .catalog-card h4 { margin: 0 0 2px; font-size: 15px; }
    .catalog-card p { margin: 0; color: var(--muted); font-size: 13px; }
    .catalog-card ul { margin: 0; padding-left: 16px; color: var(--muted); font-size: 13px; }
    .catalog-logo { overflow: hidden; }
    .catalog-logo { flex: 0 0 42px; width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
    .logo-disc-html { display: grid; place-items: center; padding: 10px; background: #fff; border: 1px solid rgba(15, 23, 42, .08); }
    .logo-disc-html svg { width: 100%; height: 100%; }
    .logo-text { display: grid; place-items: center; background: var(--brand); color: white; font-weight: 850; }
    .catalog-status { position: absolute; top: 15px; right: 15px; width: 8px; height: 8px; border-radius: 50%; }
    footer { margin-top: 48px; padding-top: 22px; border-top: 1px solid color-mix(in srgb, var(--line) 35%, transparent); color: var(--muted); font-size: 12px; }
    footer a { color: inherit; }
    @media (max-width: 760px) {
      main { padding: 28px 14px 52px; }
      header { grid-template-columns: minmax(0, 1fr); }
      h1 { font-size: 32px; }
      header .subtitle { overflow-wrap: anywhere; }
      .meta { text-align: left; }
      .insights { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Living architecture</p>
        <h1>${escapeHtml(architecture.meta.title)}</h1>
        <p class="subtitle">${escapeHtml(architecture.meta.subtitle)}</p>
      </div>
      <div class="meta"><strong>${architecture.nodes.length} composants</strong>Mis à jour le ${escapeHtml(architecture.meta.updated)}</div>
    </header>

    <div class="diagram-shell" role="region" aria-label="Cartographie de l’écosystème IA" tabindex="0">
      <svg class="diagram" viewBox="0 0 ${architecture.meta.width} ${architecture.meta.height}" role="img" aria-labelledby="map-title map-desc">
        <title id="map-title">${escapeHtml(architecture.meta.title)}</title>
        <desc id="map-desc">Architecture en cinq couches : interfaces, runtimes agentiques, mémoire et coordination, adaptateurs métier et infrastructure.</desc>
        <defs>
          ${discClip}
          ${markers}
          ${assetSymbols}
        </defs>
        ${architecture.zones.map(renderZone).join("\n")}
        ${architecture.edges.map(renderEdge).join("\n")}
        ${architecture.nodes.map(renderNode).join("\n")}
      </svg>
    </div>

    <div class="legend" aria-label="Légende des flux">
      ${flowLegend}
      ${statusLegend}
      <span class="interaction-hint">Clique une case pour isoler ses relations · Échap pour réinitialiser</span>
    </div>

    <section class="insights" aria-label="Lecture de l’architecture">
      <article class="insight"><b>Deux agents, deux mandats</b><p>Nestor orchestre le quotidien personnel depuis OpenClaw. Hermes opère DecaSaaS / MyPacer de bout en bout et ne supervise plus Nestor.</p></article>
      <article class="insight"><b>Hermes tourne en boucle fermée</b><p>Cinq jobs cron déclenchent des tours sans sollicitation : veille des réponses toutes les deux minutes, pilotage business quotidien, études planifiées.</p></article>
      <article class="insight"><b>Les mémoires restent spécialisées</b><p>OpenClaw combine mémoire durable, journal quotidien et transcripts indexés ; Hermes borne MEMORY.md et USER.md et s’appuie sur un index plein-texte de ses sessions.</p></article>
      <article class="insight"><b>Claude et ChatGPT alimentent le vault</b><p>Leurs apps déposent une note Markdown dans le dossier Drive « nestor-inbox » ; Nestor surveille cet emplacement et classe la note dans Obsidian.</p></article>
    </section>

    <h2 class="section-title">Catalogue maintenable</h2>
    ${zoneCatalog}

    <footer>
      Vue publique volontairement expurgée des secrets, adresses privées et identifiants. Les marques appartiennent à leurs propriétaires respectifs ; pictogrammes issus de <a href="https://simpleicons.org/">Simple Icons</a>, <a href="https://lobehub.com/icons">LobeHub Icons</a> et des assets officiels <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a>, <a href="https://github.com/docmost/docmost">Docmost</a> et <a href="https://www.rabbit.tech/">rabbit</a>. L’avatar des nœuds Hermes est celui de l’instance personnelle et n’est pas une marque de Nous Research. Source de vérité : <a href="https://github.com/nestor-workspace/ai-ecosystem-map">architecture.json sur GitHub</a>.
    </footer>
  </main>
  <script>
    (() => {
      const graphNodes = [...document.querySelectorAll('.node-group[data-node-id]')];
      const catalogCards = [...document.querySelectorAll('.catalog-card[data-node-id]')];
      const edges = [...document.querySelectorAll('.edge-group[data-from][data-to]')];
      let selectedId = null;

      const interactiveItems = [...graphNodes, ...catalogCards];

      function clearSelection() {
        selectedId = null;
        document.body.classList.remove('selection-active');
        for (const item of interactiveItems) {
          item.classList.remove('is-selected', 'is-related', 'is-dimmed');
          item.setAttribute('aria-pressed', 'false');
        }
        for (const edge of edges) edge.classList.remove('is-related', 'is-dimmed');
      }

      function selectNode(id) {
        if (selectedId === id) {
          clearSelection();
          return;
        }
        selectedId = id;
        const relatedIds = new Set([id]);
        for (const edge of edges) {
          const related = edge.dataset.from === id || edge.dataset.to === id;
          edge.classList.toggle('is-related', related);
          edge.classList.toggle('is-dimmed', !related);
          if (related) {
            relatedIds.add(edge.dataset.from);
            relatedIds.add(edge.dataset.to);
          }
        }
        for (const item of interactiveItems) {
          const itemId = item.dataset.nodeId;
          item.classList.toggle('is-selected', itemId === id);
          item.classList.toggle('is-related', relatedIds.has(itemId));
          item.classList.toggle('is-dimmed', !relatedIds.has(itemId));
          item.setAttribute('aria-pressed', itemId === id ? 'true' : 'false');
        }
        document.body.classList.add('selection-active');
      }

      for (const item of interactiveItems) {
        item.setAttribute('aria-pressed', 'false');
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          selectNode(item.dataset.nodeId);
        });
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectNode(item.dataset.nodeId);
          }
        });
      }

      document.querySelector('.diagram-shell').addEventListener('click', clearSelection);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') clearSelection();
      });

      const initialId = decodeURIComponent(location.hash.slice(1));
      if (graphNodes.some((node) => node.dataset.nodeId === initialId)) selectNode(initialId);
    })();
  </script>
</body>
</html>`;

if (buildErrors.length > 0) {
  console.error(`${buildErrors.length} node problem(s):\n${buildErrors.join("\n")}`);
  process.exit(1);
}

await mkdir(new URL("dist/", root), { recursive: true });
await writeFile(new URL("dist/index.html", root), html);
console.log(`Built dist/index.html (${Buffer.byteLength(html)} bytes).`);
