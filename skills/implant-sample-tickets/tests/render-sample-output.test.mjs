#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const renderer = path.resolve(skillDir, "../make-life-ticket/scripts/render_ticket.py");

function ticket(ticketNumber, extra = {}) {
  return {
    schemaVersion: 1,
    ticketNumber,
    kind: "universe",
    status: "ordered",
    title: "虚构样票测试",
    scene: "用于验证最终 JSON 来源标记的测试场景。",
    time: { mode: "cosmic", raw: "宇宙时区", display: "宇宙时区" },
    place: "测试场域",
    image: { source: "procedural", concept: "安静的测试场景", prompt: null, referenceUsed: false },
    design: {
      shapeStyle: "chapter-pass",
      layoutStyle: "chapter-poster",
      stampStyle: "broken-ring",
      eventDoodle: { keyword: "", style: "broken-ink-doodle", placement: "place-side", status: "none" },
    },
    createdAt: "2026-08-30T12:00:00+09:00",
    ...extra,
  };
}

async function render(root, name, data, extraArgs = []) {
  const input = path.join(root, `${name}-input.json`);
  const output = path.join(root, `${name}-output`);
  await writeFile(input, `${JSON.stringify(data, null, 2)}\n`);
  execFileSync("python3", [renderer, "--input", input, "--output-dir", output, ...extraArgs], { stdio: "pipe" });
  return JSON.parse(await readFile(path.join(output, `${data.ticketNumber}.json`), "utf8"));
}

test("sample rendering forces fictionalSample true in the final JSON", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fusheng-sample-render-"));
  try {
    const output = await render(root, "sample", ticket("LT-U-20260830-SMPL", { fictionalSample: false }), ["--fictional-sample"]);
    assert.equal(output.fictionalSample, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ordinary rendering does not add fictionalSample", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fusheng-ordinary-render-"));
  try {
    const output = await render(root, "ordinary", ticket("LT-U-20260830-REAL"));
    assert.equal(Object.hasOwn(output, "fictionalSample"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
