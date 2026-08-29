#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const SHAPES = new Set(["intermission-stub", "film-edge", "chapter-pass"]);

export function shapeFromDimensions(width, height) {
  if (!(width > 0 && height > 0)) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 3) <= 0.16) return "intermission-stub";
  if (Math.abs(ratio - 2.5) <= 0.16) return "film-edge";
  if (Math.abs(ratio - 0.8) <= 0.08) return "chapter-pass";
  return null;
}

export function shapeAllowedForKind(kind, shape) {
  return kind === "universe" ? SHAPES.has(shape) : kind === "past" && shape !== "chapter-pass" && SHAPES.has(shape);
}

async function readPngShape(path) {
  const bytes = await readFile(path);
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature || bytes.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return shapeFromDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

async function validateTicketShape(data, image) {
  const declared = data.design?.shapeStyle;
  if (declared !== undefined && !SHAPES.has(declared)) return "JSON 中的票型未知";
  const actual = await readPngShape(image);
  if (!actual) return "PNG 尺寸不属于标准票型";
  if (declared && declared !== actual) return "JSON 票型与 PNG 尺寸不一致";
  const shape = declared || actual;
  if (!shapeAllowedForKind(data.kind, shape)) return "过去篇仅接受幕间长票或胶片齿票";
  return null;
}

function ticketStem(name) {
  return basename(name, extname(name)).replace(/-(main|preview)$/i, "");
}

async function expandInputs(inputs) {
  const files = [];
  for (const input of inputs) {
    const full = resolve(input);
    const info = await stat(full);
    if (info.isDirectory()) {
      for (const name of await readdir(full)) {
        const path = join(full, name);
        if ((await stat(path)).isFile()) files.push(path);
      }
    } else {
      files.push(full);
    }
  }
  return files;
}

function sortKey(data) {
  if (data.kind !== "past") return data.createdAt || "9999-12-31T23:59:59Z";
  const display = data.time?.display || data.time?.raw || "";
  const year = display.match(/\d{4}/)?.[0] || "9999";
  const month = display.match(/\d{4}[.\-/年](\d{1,2})/)?.[1]?.padStart(2, "0");
  const day = display.match(/\d{4}[.\-/年]\d{1,2}[.\-/月](\d{1,2})/)?.[1]?.padStart(2, "0");
  const seasonMonth = display.includes("春") ? "03" : display.includes("夏") ? "06" : display.includes("秋") ? "09" : display.includes("冬") ? "12" : "12";
  return [year, month || seasonMonth, day || "31", data.createdAt || ""].join("-");
}

function chooseImage(ticketNumber, images) {
  return images
    .filter((path) => ticketStem(path) === ticketNumber)
    .sort((a, b) => {
      const score = (path) => basename(path, extname(path)) === ticketNumber ? 0 : /-main$/i.test(path) ? 1 : 2;
      return score(a) - score(b);
    })[0];
}

export async function collectTickets(albumDir, inputs) {
  const files = await expandInputs(inputs);
  const jsonFiles = files.filter((path) => extname(path).toLowerCase() === ".json");
  const images = files.filter((path) => extname(path).toLowerCase() === ".png");
  const manifestPath = join(resolve(albumDir), "public", "album-manifest.json");
  const ticketDir = join(resolve(albumDir), "public", "tickets");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const byNumber = new Map((manifest.tickets || []).map((ticket) => [ticket.ticketNumber, ticket]));
  const rejected = [];
  let imported = 0;
  let updated = 0;

  await mkdir(ticketDir, { recursive: true });

  for (const jsonPath of jsonFiles) {
    try {
      const raw = await readFile(jsonPath, "utf8");
      const data = JSON.parse(raw);
      if (data.schemaVersion !== 1 || !data.ticketNumber || !["past", "universe"].includes(data.kind) || !data.title) {
        rejected.push({ file: basename(jsonPath), reason: "JSON 结构无效" });
        continue;
      }
      const image = chooseImage(data.ticketNumber, images);
      if (!image) {
        rejected.push({ file: basename(jsonPath), reason: "缺少同名 PNG" });
        continue;
      }
      const shapeError = await validateTicketShape(data, image);
      if (shapeError) {
        rejected.push({ file: basename(jsonPath), reason: shapeError });
        continue;
      }
      const existed = byNumber.has(data.ticketNumber);
      const imageName = data.ticketNumber + ".png";
      const jsonName = data.ticketNumber + ".json";
      await copyFile(image, join(ticketDir, imageName));
      await writeFile(join(ticketDir, jsonName), raw, "utf8");
      byNumber.set(data.ticketNumber, {
        ticketNumber: data.ticketNumber,
        kind: data.kind,
        title: data.title,
        date: data.time?.display || data.time?.raw || (data.kind === "universe" ? "宇宙时区" : "日期未详"),
        place: data.place || "地点未题",
        note: data.note || "",
        createdAt: data.createdAt || new Date().toISOString(),
        sortKey: sortKey(data),
        imageUrl: "/tickets/" + imageName,
        dataUrl: "/tickets/" + jsonName,
        imported: true,
        fictionalSample: data.fictionalSample === true,
        collectionRevision: `${new Date().toISOString()}-${randomUUID()}`
      });
      if (existed) updated += 1;
      else imported += 1;
    } catch (error) {
      rejected.push({ file: basename(jsonPath), reason: error instanceof Error ? error.message : "无法读取" });
    }
  }

  for (const image of images) {
    const number = ticketStem(image);
    if (!jsonFiles.some((path) => ticketStem(path) === number)) {
      rejected.push({ file: basename(image), reason: "缺少同名 JSON" });
    }
  }

  manifest.tickets = [...byNumber.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "past" ? -1 : 1;
    return (a.kind === "past" ? a.sortKey : a.createdAt).localeCompare(b.kind === "past" ? b.sortKey : b.createdAt);
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return { imported, updated, rejected };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [albumDir, ...inputs] = process.argv.slice(2);
  if (!albumDir || !inputs.length) {
    console.error("用法：collect-tickets.mjs <浮生录目录> <票根文件或目录...>");
    process.exit(2);
  }

  try {
    const result = await collectTickets(albumDir, inputs);
    console.log(JSON.stringify(result));
    if (!result.imported && !result.updated) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
