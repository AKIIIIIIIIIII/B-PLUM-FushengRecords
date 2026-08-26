#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/generate-sample-plan.mjs");
const generate = (args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: "utf8" }));
const first = generate(["--seed", "repeatable", "--past-count", "2", "--future-count", "3"]);
assert.deepEqual(generate(["--seed", "repeatable", "--past-count", "2", "--future-count", "3"]), first, "相同 seed 的随机出票单必须可复现");
assert.equal(first.items.length, 5);
assert.equal(first.items.filter((item) => item.kind === "past").length, 2);
assert.equal(first.items.filter((item) => item.kind === "universe").length, 3);
for (const item of first.items) {
  assert.equal(item.fictionalSample, true);
  assert.ok(item.title && item.scene && item.place && item.note && item.image.concept);
  assert.ok(item.time.mode && item.time.raw && item.time.display && item.emotion.length && item.visualElements.length);
  assert.ok(["floral-slip", "negative-square", "broken-ring"].includes(item.design.stampStyle));
  assert.equal(item.design.eventDoodle.status, "generated");
  if (item.kind === "past") assert.ok(["intermission-stub", "film-edge"].includes(item.design.shapeStyle));
}
const defaults = generate(["--seed", "defaults"]);
assert.equal(defaults.pastCount, 5);
assert.equal(defaults.futureCount, 5);
assert.equal(defaults.items.length, 10);
