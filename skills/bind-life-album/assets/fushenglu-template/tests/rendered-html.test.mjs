import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../app/ticket-store.ts", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("IndexedDB v2 preserves tickets and adds persisted album settings", () => {
  assert.match(storeSource, /indexedDB\.open\(DATABASE_NAME, 2\)/);
  assert.match(storeSource, /createObjectStore\(SETTINGS_STORE_NAME, \{ keyPath: "key" \}\)/);
  assert.match(storeSource, /database\.transaction\(\[STORE_NAME, SETTINGS_STORE_NAME\], "readwrite"\)/);
});

test("clear all removes local tickets and hides defaults atomically", () => {
  assert.match(storeSource, /export async function clearAllTickets/);
  assert.match(storeSource, /objectStore\(STORE_NAME\)\.clear\(\)/);
  assert.match(storeSource, /DEFAULT_TICKETS_HIDDEN_KEY, value: true/);
});

test("restore defaults only changes the persisted visibility setting", () => {
  assert.match(storeSource, /export async function restoreDefaultTickets/);
  assert.match(storeSource, /DEFAULT_TICKETS_HIDDEN_KEY, value: false/);
});

test("page exposes clear and restore behavior with the agreed wording", () => {
  assert.match(pageSource, /allTickets\.length > 0/);
  assert.match(pageSource, />清空票根<\/button>/);
  assert.match(pageSource, /确认清空当前浏览器中的全部票根吗？网站自带票根可稍后恢复。/);
  assert.match(pageSource, /defaultTicketsHidden === true &&/);
  assert.match(pageSource, />恢复默认票根<\/button>/);
  assert.match(pageSource, /if \(defaultTicketsHidden === false\) seedTickets\.forEach/);
  assert.match(pageSource, /window\.setTimeout\(\(\) => \{[\s\S]*setImportMessage\(""\)[\s\S]*\}, 4200\)/);
});

test("past and future bookmarks share a stable baseline and consistent selected motion", () => {
  assert.doesNotMatch(styleSource, /\.bookmarks button:first-child/);
  assert.match(styleSource, /\.bookmarks button \{[^}]*transform: translateY\(0\)/);
  assert.match(styleSource, /--bookmark-active-shift: 10px/);
  assert.match(styleSource, /\.bookmarks button\.active \{[^}]*translateY\(var\(--bookmark-active-shift\)\)/);
  assert.match(styleSource, /@media \(hover: hover\)[\s\S]*\.bookmarks button:not\(\.active\):hover[^}]*translateY\(3px\)/);
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*--bookmark-active-shift: 8px/);
  assert.match(styleSource, /prefers-reduced-motion:[\s\S]*\.bookmarks button[^}]*transition-duration: \.01ms !important/);
});
