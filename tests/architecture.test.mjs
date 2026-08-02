import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const architecture = JSON.parse(
  await readFile(new URL("../data/architecture.json", import.meta.url), "utf8"),
);

test("every current zone contains at least one node", () => {
  for (const zone of architecture.zones) {
    assert.ok(
      architecture.nodes.some((node) => node.zone === zone.id),
      `Zone ${zone.id} is empty`,
    );
  }
});

test("planned edges are explicit and limited", () => {
  const planned = architecture.edges.filter((edge) => edge.kind === "planned");
  assert.deepEqual(planned.map(({ from, to }) => `${from}->${to}`), ["linear->obsidian"]);
});

test("the map contains no private infrastructure coordinates", () => {
  const serialized = JSON.stringify(architecture);
  assert.equal(serialized.includes("192.168."), false);
  assert.equal(serialized.includes("@gmail.com"), false);
  assert.equal(serialized.includes("token"), false);
});
