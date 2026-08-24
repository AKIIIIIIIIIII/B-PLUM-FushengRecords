#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const albumDir = resolve(process.argv[2] || "");
if (!process.argv[2]) {
  console.error("用法：validate-album.mjs <浮生录目录>");
  process.exit(2);
}

const required = ["app/page.tsx", "app/globals.css", "app/ticket-store.ts", "package.json", "public/album-manifest.json"];
const failures = [];
for (const path of required) {
  try { await access(join(albumDir, path)); } catch { failures.push("缺少 " + path); }
}

if (!failures.length) {
  try {
    const manifest = JSON.parse(await readFile(join(albumDir, "public", "album-manifest.json"), "utf8"));
    if (!manifest.title || !Array.isArray(manifest.tickets)) failures.push("album-manifest.json 结构无效");
    if (manifest.contact?.qrImageUrl) {
      try { await access(join(albumDir, "public", manifest.contact.qrImageUrl.replace(/^\//, ""))); }
      catch { failures.push("缺少联络二维码：" + manifest.contact.qrImageUrl); }
    }
    for (const ticket of manifest.tickets || []) {
      if (!ticket.ticketNumber || !["past", "universe"].includes(ticket.kind) || !ticket.imageUrl) {
        failures.push("票根数据无效：" + (ticket.ticketNumber || "未编号"));
        continue;
      }
      try { await access(join(albumDir, "public", ticket.imageUrl.replace(/^\//, ""))); }
      catch { failures.push("缺少票根图片：" + ticket.imageUrl); }
      if (ticket.dataUrl) {
        try { await access(join(albumDir, "public", ticket.dataUrl.replace(/^\//, ""))); }
        catch { failures.push("缺少票根 JSON：" + ticket.dataUrl); }
      }
    }
  } catch {
    failures.push("album-manifest.json 无法读取");
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log("浮生录结构检查通过");
