import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const architecture = JSON.parse(
  await readFile(new URL("../data/architecture.json", import.meta.url), "utf8"),
);
const generatedHtml = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

test("every current zone contains at least one node", () => {
  for (const zone of architecture.zones) {
    assert.ok(
      architecture.nodes.some((node) => node.zone === zone.id),
      `Zone ${zone.id} is empty`,
    );
  }
});

// Liste blanche volontairement vide : plus rien n'est annoncé sans être livré. Un flux
// planifié doit être ajouté ici sciemment, pas glissé dans la carte au passage.
test("planned edges are explicit and limited", () => {
  const planned = architecture.edges.filter((edge) => edge.kind === "planned");
  assert.deepEqual(planned.map(({ from, to }) => `${from}->${to}`), []);
});

test("Claude and ChatGPT capture notes into Obsidian through the watched inbox", () => {
  const inbox = architecture.edges.filter((edge) => edge.label === "nestor-inbox");
  assert.deepEqual(
    inbox.map(({ from, to }) => `${from}->${to}`).sort(),
    ["chatgpt-web->nestor", "claude-web->nestor"],
  );
  assert.ok(
    architecture.edges.some((edge) => edge.from === "nestor" && edge.to === "obsidian"),
    "Nestor must still write to Obsidian for the capture to land",
  );
});

test("the map contains no private infrastructure coordinates", () => {
  const serialized = JSON.stringify(architecture);
  assert.equal(serialized.includes("192.168."), false);
  assert.equal(serialized.includes("@gmail.com"), false);
  assert.equal(serialized.includes("token"), false);
});

test("Rabbit r1 is an active interface for all connected agent surfaces", () => {
  const rabbit = architecture.nodes.find((node) => node.id === "rabbit-r1");
  assert.equal(rabbit.status, "active");
  const targets = architecture.edges
    .filter((edge) => edge.from === "rabbit-r1")
    .map((edge) => edge.to)
    .sort();
  assert.deepEqual(targets, ["claude-code", "hermes", "nestor"]);
});

test("self-hosted runtimes and memories are explicit", () => {
  const nodeIds = new Set(architecture.nodes.map((node) => node.id));
  for (const expected of ["hermes-agent-runtime", "hermes-memory", "openclaw-memory", "docmost"]) {
    assert.ok(nodeIds.has(expected), `${expected} is missing`);
  }
  assert.ok(
    architecture.edges.some((edge) => edge.from === "nas-vm" && edge.to === "docmost"),
    "Docmost must be attached to the NAS",
  );
});

test("the generated map exposes keyboard-selectable relationship highlighting", () => {
  assert.match(generatedHtml, /function selectNode\(id\)/);
  assert.match(generatedHtml, /data-node-id="rabbit-r1"/);
  assert.match(generatedHtml, /data-from="rabbit-r1" data-to="nestor"/);
  assert.match(generatedHtml, /event\.key === 'Escape'/);
  assert.match(generatedHtml, /location\.hash\.slice\(1\)/);
});

test("the flow legend only lists edge kinds the map actually draws", () => {
  assert.match(generatedHtml, /intégration existante/);
  assert.equal(generatedHtml.includes("évolution planifiée"), false);
});
