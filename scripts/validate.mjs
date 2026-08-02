import { readFile } from "node:fs/promises";

const architecture = JSON.parse(
  await readFile(new URL("../data/architecture.json", import.meta.url), "utf8"),
);

const errors = [];
const zoneIds = new Set();
const nodeIds = new Set();

for (const zone of architecture.zones) {
  if (zoneIds.has(zone.id)) errors.push(`Duplicate zone id: ${zone.id}`);
  zoneIds.add(zone.id);
}

for (const node of architecture.nodes) {
  if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  if (!zoneIds.has(node.zone)) errors.push(`Unknown zone for ${node.id}: ${node.zone}`);
  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(node[key])) errors.push(`Invalid ${key} for ${node.id}`);
  }
}

for (const edge of architecture.edges) {
  if (!nodeIds.has(edge.from)) errors.push(`Unknown edge source: ${edge.from}`);
  if (!nodeIds.has(edge.to)) errors.push(`Unknown edge target: ${edge.to}`);
  if (edge.from === edge.to) errors.push(`Self edge is not allowed: ${edge.from}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${architecture.zones.length} zones, ${architecture.nodes.length} nodes and ${architecture.edges.length} edges.`,
);
