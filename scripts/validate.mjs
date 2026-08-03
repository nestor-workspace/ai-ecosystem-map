import { readFile } from "node:fs/promises";

const architecture = JSON.parse(
  await readFile(new URL("../data/architecture.json", import.meta.url), "utf8"),
);

const NODE_STATUSES = new Set(["active", "experimental", "planned"]);
const EDGE_KINDS = new Set(["primary", "active", "ondemand", "planned", "experimental"]);
// Hauteur réservée au titre + sous-titre d'une zone, avant la première rangée de nœuds.
const ZONE_HEADER_HEIGHT = 66;

const errors = [];
const zoneIds = new Set();
const nodeIds = new Set();
const zoneById = new Map();

for (const zone of architecture.zones) {
  if (zoneIds.has(zone.id)) errors.push(`Duplicate zone id: ${zone.id}`);
  zoneIds.add(zone.id);
  zoneById.set(zone.id, zone);
}

for (const node of architecture.nodes) {
  if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  if (!NODE_STATUSES.has(node.status)) errors.push(`Unknown status for ${node.id}: ${node.status}`);
  const listSubtitle = Array.isArray(node.subtitle);
  if (listSubtitle && !node.subtitle.every((item) => typeof item === "string" && item.length > 0)) {
    errors.push(`${node.id}: list subtitle must contain non-empty strings`);
  } else if (!listSubtitle && typeof node.subtitle !== "string") {
    errors.push(`${node.id}: subtitle must be a string or a list of strings`);
  }
  const zone = zoneById.get(node.zone);
  if (!zone) {
    errors.push(`Unknown zone for ${node.id}: ${node.zone}`);
    continue;
  }
  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(node[key])) errors.push(`Invalid ${key} for ${node.id}`);
  }
  if (
    node.x < zone.x ||
    node.y < zone.y + ZONE_HEADER_HEIGHT ||
    node.x + node.width > zone.x + zone.width ||
    node.y + node.height > zone.y + zone.height
  ) {
    errors.push(`${node.id} does not fit inside zone ${zone.id}`);
  }
}

for (const [index, node] of architecture.nodes.entries()) {
  for (const other of architecture.nodes.slice(index + 1)) {
    if (
      node.x < other.x + other.width &&
      node.x + node.width > other.x &&
      node.y < other.y + other.height &&
      node.y + node.height > other.y
    ) {
      errors.push(`${node.id} overlaps ${other.id}`);
    }
  }
}

for (const edge of architecture.edges) {
  if (!nodeIds.has(edge.from)) errors.push(`Unknown edge source: ${edge.from}`);
  if (!nodeIds.has(edge.to)) errors.push(`Unknown edge target: ${edge.to}`);
  if (edge.from === edge.to) errors.push(`Self edge is not allowed: ${edge.from}`);
  if (!EDGE_KINDS.has(edge.kind)) errors.push(`Unknown edge kind ${edge.from}->${edge.to}: ${edge.kind}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${architecture.zones.length} zones, ${architecture.nodes.length} nodes and ${architecture.edges.length} edges.`,
);
