#!/usr/bin/env node

import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key.startsWith("--")) result[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  return result;
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

const args = parseArgs(process.argv.slice(2));
if (!args.output) {
  console.error("必须提供 --output <新藏本目录>。");
  process.exit(2);
}

const output = resolve(args.output);
if (await exists(output)) {
  console.error("目标已存在：" + output + "。请使用一个新的目录，避免覆盖藏本。");
  process.exit(2);
}

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const template = join(skillRoot, "assets", "fushenglu-template");
await mkdir(dirname(output), { recursive: true });
await cp(template, output, { recursive: true });

const manifestPath = join(output, "public", "album-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.title = args.title || "浮生录";
manifest.subtitle = args.subtitle || "人生票根藏本";
manifest.edition = args.edition || "私藏本";
manifest.contact = {
  label: args.contactLabel || "联络造册人",
  detail: args.contactDetail || "若欲量身造册，敬请移步访造册人。",
  url: args.contactUrl || "https://b-plum.com/",
  actionLabel: args.contactActionLabel || "拜访造册人",
  supportUrl: args.supportUrl || "https://buymeacoffee.com/plum.b",
  qrImageUrl: "/contact-qr.png",
  qrLabel: args.qrLabel || "请造册人喝杯茶"
};
if (args.contactQr) {
  if (!(await exists(resolve(args.contactQr)))) {
    console.error("找不到联络二维码：" + resolve(args.contactQr));
    process.exit(2);
  }
  await cp(resolve(args.contactQr), join(output, "public", "contact-qr.png"));
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ output, created: true }));
