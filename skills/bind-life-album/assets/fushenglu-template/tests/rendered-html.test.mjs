import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../app/ticket-store.ts", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const shellSource = await readFile(new URL("../app/components/album-shell.tsx", import.meta.url), "utf8");
const controlsSource = await readFile(new URL("../app/components/album-controls.tsx", import.meta.url), "utf8");
const ambientSource = await readFile(new URL("../app/components/ambient-world.tsx", import.meta.url), "utf8");
const chaptersSource = await readFile(new URL("../app/components/chapters.tsx", import.meta.url), "utf8");
const paginationSource = await readFile(new URL("../app/past-pagination.ts", import.meta.url), "utf8");
const paginationModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(paginationSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`);
const viewportSource = await readFile(new URL("../app/viewport-layout.ts", import.meta.url), "utf8");
const viewportModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(viewportSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`);

test("IndexedDB v3 preserves tickets and persisted album settings", () => {
  assert.match(storeSource, /indexedDB\.open\(DATABASE_NAME, 3\)/);
  assert.match(storeSource, /createObjectStore\(SETTINGS_STORE_NAME, \{ keyPath: "key" \}\)/);
  assert.match(storeSource, /database\.transaction\(\[STORE_NAME, SETTINGS_STORE_NAME\], "readwrite"\)/);
});

test("ticket imports enforce two past shapes and three future shapes", () => {
  assert.match(storeSource, /shapeAllowedForKind/);
  assert.match(storeSource, /kind === "universe" \|\| shape !== "chapter-pass"/);
  assert.match(storeSource, /JSON 票型与 PNG 尺寸不一致/);
  assert.match(storeSource, /过去篇仅接受幕间长票或胶片齿票/);
  assert.match(pageSource, /result\.rejected\[0\]\?\.reason/);
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
  assert.match(controlsSource, />清空票根<\/button>/);
  assert.match(pageSource, /确认清空当前浏览器中的全部票根吗？网站自带票根可稍后恢复。/);
  assert.match(pageSource, /canRestore=\{defaultTicketsHidden === true\}/);
  assert.match(controlsSource, />恢复默认票根<\/button>/);
  assert.match(pageSource, /if \(defaultTicketsHidden === false\) seedTickets\.forEach/);
  assert.match(pageSource, /window\.setTimeout\(\(\) => \{[\s\S]*setImportMessage\(""\)[\s\S]*\}, 4200\)/);
});

test("homepage shell uses fixed responsive cover and subdued contact note", () => {
  assert.match(styleSource, /width: 290px/);
  assert.match(shellSource, /const noteWidth = Math\.max\(mobile \? 132 : 160/);
  assert.match(shellSource, /86 \/ uiScale/);
  assert.match(shellSource, /opacity-60/);
  assert.match(shellSource, /hover:opacity-\[\.78\]/);
});

test("Three.js scene uses deterministic seeded placement", () => {
  assert.match(ambientSource, /createSeededRandom/);
  assert.match(ambientSource, /Math\.imul\(state, 1664525\) \+ 1013904223/);
  assert.doesNotMatch(ambientSource, /Math\.random/);
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

test("past pagination preserves logical pages across desktop and mobile layouts", () => {
  assert.equal(paginationModule.getPastPageCount(10, 3), 4);
  assert.equal(paginationModule.normalizePastPage(3, 4, false), 2);
  assert.equal(paginationModule.getPastTurnTarget(0, "forward", 4, false), 2);
  assert.equal(paginationModule.getPastTurnTarget(2, "forward", 4, false), null);
  assert.equal(paginationModule.getPastTurnTarget(1, "forward", 4, true), 2);
  assert.equal(paginationModule.remapPastPage(2, 3, 2, true), 3);
  assert.equal(paginationModule.remapPastPage(2, 3, 2, false), 2);
});

test("past book uses a connected spine and physical page-turn controls", () => {
  assert.match(styleSource, /\.past-spread \{[^}]*gap: 0/);
  assert.match(styleSource, /\.page-spine \{/);
  assert.match(styleSource, /\.turning-leaf \{[^}]*transform: rotateY\(var\(--turn-angle\)\)/);
  assert.match(styleSource, /\.past-spread\.is-single \.turning-leaf \{[^}]*width: 100%/);
  assert.match(chaptersSource, /const TURN_THRESHOLD = 0\.3/);
  assert.match(chaptersSource, /const TURN_VELOCITY = 0\.45/);
  assert.match(chaptersSource, /aria-label="上一页"/);
  assert.match(chaptersSource, /aria-label="下一页"/);
  assert.doesNotMatch(chaptersSource, />上一叠</);
  assert.doesNotMatch(chaptersSource, />下一叠</);
});

test("viewport layout scales foreground from stable desktop and mobile canvases", () => {
  const desktop = viewportModule.createViewportLayout(1440, 900);
  assert.deepEqual({ scale: desktop.uiScale, mobile: desktop.isMobile, book: [desktop.bookWidth, desktop.bookHeight], rows: desktop.pastRows }, { scale: 1, mobile: false, book: [1160, 650], rows: 3 });
  assert.equal(viewportModule.createViewportLayout(1920, 1080).uiScale, 1.15);
  const tablet = viewportModule.createViewportLayout(768, 1024);
  assert.equal(tablet.isMobile, false);
  assert.equal(tablet.pastRows, 2);
  const mobile = viewportModule.createViewportLayout(390, 844);
  assert.equal(mobile.uiScale, 1);
  assert.equal(mobile.isMobile, true);
  assert.equal(mobile.pastRows, 2);
  assert.ok(viewportModule.createViewportLayout(320, 568).uiScale < 1);
});

test("viewport stage isolates full-bleed scenery from uniformly scaled foreground", () => {
  assert.match(pageSource, /className="ui-stage/);
  assert.match(pageSource, /scale\(\$\{viewportLayout\.uiScale\}\)/);
  assert.match(pageSource, /--touch-target/);
  assert.match(pageSource, /stageWidth=\{viewportLayout\.designWidth\}/);
  assert.match(pageSource, /--book-width/);
  assert.match(pageSource, /--book-height/);
  assert.match(styleSource, /\.past-chapter \{[^}]*width: var\(--book-width\); height: var\(--book-height\)/);
});
