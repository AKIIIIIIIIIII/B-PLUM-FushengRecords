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
const shapes = new Set(["intermission-stub", "film-edge", "chapter-pass"]);

function shapeFromDimensions(width, height) {
  const ratio = width / height;
  if (Math.abs(ratio - 3) <= 0.16) return "intermission-stub";
  if (Math.abs(ratio - 2.5) <= 0.16) return "film-edge";
  if (Math.abs(ratio - 0.8) <= 0.08) return "chapter-pass";
  return null;
}

async function readPngShape(path) {
  const bytes = await readFile(path);
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return shapeFromDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}
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
      const imagePath = join(albumDir, "public", ticket.imageUrl.replace(/^\//, ""));
      let imageShape = null;
      try {
        await access(imagePath);
        imageShape = await readPngShape(imagePath);
        if (!imageShape) failures.push("票根图片尺寸不是标准票型：" + ticket.imageUrl);
        if (ticket.kind === "past" && imageShape === "chapter-pass") failures.push("过去篇不接受章节方票：" + ticket.ticketNumber);
      } catch { failures.push("缺少票根图片：" + ticket.imageUrl); }
      if (ticket.dataUrl) {
        try {
          const dataPath = join(albumDir, "public", ticket.dataUrl.replace(/^\//, ""));
          await access(dataPath);
          const data = JSON.parse(await readFile(dataPath, "utf8"));
          const declaredShape = data.design?.shapeStyle;
          if (declaredShape !== undefined && !shapes.has(declaredShape)) failures.push("票根 JSON 票型未知：" + ticket.ticketNumber);
          if (declaredShape && imageShape && declaredShape !== imageShape) failures.push("票根 JSON 与 PNG 票型不一致：" + ticket.ticketNumber);
          if (ticket.kind === "past" && declaredShape === "chapter-pass") failures.push("过去篇不接受章节方票：" + ticket.ticketNumber);
        } catch { failures.push("缺少或无法读取票根 JSON：" + ticket.dataUrl); }
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
