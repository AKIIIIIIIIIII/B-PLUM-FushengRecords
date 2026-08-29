import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectTickets, shapeAllowedForKind, shapeFromDimensions } from "../scripts/collect-tickets.mjs";

test("shape dimensions map to the three standard ticket styles", () => {
  assert.equal(shapeFromDimensions(1800, 600), "intermission-stub");
  assert.equal(shapeFromDimensions(1600, 640), "film-edge");
  assert.equal(shapeFromDimensions(1200, 1500), "chapter-pass");
  assert.equal(shapeFromDimensions(1000, 1000), null);
});

test("past accepts two shapes while universe accepts all three", () => {
  for (const shape of ["intermission-stub", "film-edge"]) assert.equal(shapeAllowedForKind("past", shape), true);
  assert.equal(shapeAllowedForKind("past", "chapter-pass"), false);
  for (const shape of ["intermission-stub", "film-edge", "chapter-pass"]) assert.equal(shapeAllowedForKind("universe", shape), true);
});

test("collector rejects a past chapter pass before writing the album", async () => {
  const root = await mkdtemp(join(tmpdir(), "fusheng-shape-test-"));
  try {
    const album = join(root, "album");
    const input = join(root, "input");
    await mkdir(join(album, "public", "tickets"), { recursive: true });
    await mkdir(input, { recursive: true });
    await writeFile(join(album, "public", "album-manifest.json"), JSON.stringify({ title: "测试", tickets: [] }));

    const ticketNumber = "LT-P-20260825-TEST";
    await writeFile(join(input, `${ticketNumber}.json`), JSON.stringify({
      schemaVersion: 1,
      ticketNumber,
      kind: "past",
      title: "过去章节方票",
      createdAt: "2026-08-25T00:00:00+09:00",
      design: { shapeStyle: "chapter-pass" }
    }));
    await copyFile(new URL("../../make-life-ticket/assets/ticket-stock/chapter-pass.png", import.meta.url), join(input, `${ticketNumber}.png`));

    const result = await collectTickets(album, [input]);
    assert.equal(result.imported, 0);
    assert.equal(result.rejected[0]?.reason, "过去篇仅接受幕间长票或胶片齿票");
    assert.deepEqual(await readdir(join(album, "public", "tickets")), []);
    const manifest = JSON.parse(await readFile(join(album, "public", "album-manifest.json"), "utf8"));
    assert.deepEqual(manifest.tickets, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("collector records sample provenance and refreshes collection revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "fusheng-source-test-"));
  try {
    const album = join(root, "album");
    const input = join(root, "input");
    await mkdir(join(album, "public", "tickets"), { recursive: true });
    await mkdir(input, { recursive: true });
    await writeFile(join(album, "public", "album-manifest.json"), JSON.stringify({ title: "测试", tickets: [] }));
    const ticketNumber = "LT-U-20260830-SAMPLE";
    await writeFile(join(input, `${ticketNumber}.json`), JSON.stringify({
      schemaVersion: 1, ticketNumber, kind: "universe", title: "虚构样票测试", fictionalSample: true,
      createdAt: "2026-08-30T00:00:00+09:00", design: { shapeStyle: "chapter-pass" }
    }));
    await copyFile(new URL("../../make-life-ticket/assets/ticket-stock/chapter-pass.png", import.meta.url), join(input, `${ticketNumber}.png`));

    await collectTickets(album, [input]);
    const firstManifest = JSON.parse(await readFile(join(album, "public", "album-manifest.json"), "utf8"));
    assert.equal(firstManifest.tickets[0].fictionalSample, true);
    assert.match(firstManifest.tickets[0].collectionRevision, /^\d{4}-\d{2}-\d{2}T.+-[0-9a-f-]{36}$/i);

    await collectTickets(album, [input]);
    const secondManifest = JSON.parse(await readFile(join(album, "public", "album-manifest.json"), "utf8"));
    assert.notEqual(secondManifest.tickets[0].collectionRevision, firstManifest.tickets[0].collectionRevision);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
