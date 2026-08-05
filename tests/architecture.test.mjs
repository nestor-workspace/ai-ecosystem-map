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

// Le trajet complet d'une note : Claude ou ChatGPT écrit dans le dossier Drive, Nestor
// le surveille, la note atterrit dans le vault. Chaque maillon manquant casse la capture.
test("the capture chain from Claude and ChatGPT to Obsidian is complete", () => {
  const links = (from, to) => architecture.edges.some((e) => e.from === from && e.to === to);
  for (const surface of ["chatgpt-web", "claude-web"]) {
    assert.ok(links(surface, "google-workspace"), `${surface} must reach the Drive inbox`);
  }
  assert.ok(links("nestor", "google-workspace"), "Nestor must watch the Drive inbox");
  assert.ok(links("nestor", "obsidian"), "Nestor must write the captured note to Obsidian");
  const drive = architecture.nodes.find((node) => node.id === "google-workspace");
  assert.ok(
    drive.subtitle.some((item) => item.includes("nestor-inbox")),
    "the watched folder must be named on the node that hosts it",
  );
});

// Une interface sans arête sortante est un nœud mort sur la carte : elle affiche une
// surface d'entrée qui ne mène nulle part.
test("every human interface reaches something", () => {
  const orphans = architecture.nodes
    .filter((node) => node.zone === "interfaces")
    .filter((node) => !architecture.edges.some((edge) => edge.from === node.id))
    .map((node) => node.id);
  assert.deepEqual(orphans, []);
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

// Le groupe passe à opacity 1, mais c'est le tracé qui porte la sienne : sans cette règle
// un lien retenu reste à 54 % et la sélection ne se suit plus à l'œil.
test("selected relationships bring their edges to full opacity", () => {
  assert.match(generatedHtml, /\.is-related \.edge \{[^}]*opacity: 1/);
});

test("the flow legend only lists edge kinds the map actually draws", () => {
  assert.match(generatedHtml, /intégration existante/);
  assert.equal(generatedHtml.includes("évolution planifiée"), false);
});
