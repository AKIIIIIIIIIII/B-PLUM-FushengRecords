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
const perspectiveSource = await readFile(new URL("../app/future-perspective.ts", import.meta.url), "utf8");
const perspectiveModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(perspectiveSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`);
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
  const contactNoteSource = shellSource.match(/export function ContactNote[\s\S]*?(?=export function ChapterBookmarks)/)?.[0] || "";
  assert.match(styleSource, /width: 290px/);
  assert.match(contactNoteSource, /w-40 origin-top-right/);
  assert.match(contactNoteSource, /w-\[118px\]/);
  assert.match(contactNoteSource, /max-\[760px\]:scale-\[\.78\]/);
  assert.doesNotMatch(contactNoteSource, /86 \/ uiScale/);
  assert.doesNotMatch(contactNoteSource, /var\(--readable-small\)/);
  assert.doesNotMatch(contactNoteSource, /var\(--touch-target\)/);
  assert.match(contactNoteSource, /opacity-60/);
  assert.match(contactNoteSource, /hover:opacity-\[\.78\]/);
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
  assert.equal(paginationModule.getPastSwipeDirection(7, 0), null);
  assert.equal(paginationModule.getPastSwipeDirection(40, 48), null);
  assert.equal(paginationModule.getPastSwipeDirection(32, 4), "forward");
  assert.equal(paginationModule.getPastSwipeDirection(-32, 4), "backward");
  assert.equal(paginationModule.shouldCommitPastSwipe(32, 500), true);
  assert.equal(paginationModule.shouldCommitPastSwipe(18, 40), true);
  assert.equal(paginationModule.shouldCommitPastSwipe(31, 601), false);
  assert.equal(paginationModule.shouldCommitPastSwipe(17, 20), false);
  assert.equal(paginationModule.getPastWheelDirection(48, 8), "forward");
  assert.equal(paginationModule.getPastWheelDirection(-48, 8), "backward");
  assert.equal(paginationModule.getPastWheelDirection(8, 48), null);
});

test("past book uses connected pages and release-triggered light swipes", () => {
  const beginGestureSource = chaptersSource.match(/const beginGesture[\s\S]*?(?=\n {2}const moveGesture)/)?.[0] || "";
  const moveGestureSource = chaptersSource.match(/const moveGesture[\s\S]*?(?=\n {2}const endGesture)/)?.[0] || "";
  assert.match(styleSource, /\.past-spread \{[^}]*gap: 0/);
  assert.match(styleSource, /\.past-spread \{[^}]*touch-action: pan-y/);
  assert.match(styleSource, /\.past-spread \{[^}]*overscroll-behavior-x: contain/);
  assert.match(styleSource, /\.page-spine \{/);
  assert.match(styleSource, /\.turning-leaf \{[^}]*transform: rotateY\(var\(--turn-angle\)\)/);
  assert.match(chaptersSource, /const TURN_DURATION = 680/);
  assert.match(chaptersSource, /const SLIDE_DURATION = 420/);
  assert.match(chaptersSource, /const duration = singlePage \? SLIDE_DURATION : TURN_DURATION/);
  assert.match(chaptersSource, /singlePage && turn && \(/);
  assert.match(chaptersSource, /turn && !singlePage && \(/);
  assert.match(chaptersSource, /className=\{`single-page-slider slide-\$\{turn\.direction\}/);
  assert.match(styleSource, /\.past-spread\.is-single \{[^}]*overflow: hidden/);
  assert.match(styleSource, /\.single-page-slider\.slide-forward \.single-slide-target \{[^}]*translateX\(100%\)/);
  assert.match(styleSource, /\.single-page-slider\.slide-backward \.single-slide-target \{[^}]*translateX\(-100%\)/);
  assert.match(styleSource, /\.single-page-slider\.slide-forward\.is-settling \.single-slide-current \{[^}]*translateX\(-100%\)/);
  assert.match(styleSource, /\.single-page-slider\.slide-backward\.is-settling \.single-slide-current \{[^}]*translateX\(100%\)/);
  assert.ok(styleSource.indexOf(".past-spread.is-single") < styleSource.indexOf("@media (max-width: 760px)"));
  assert.doesNotMatch(styleSource, /\.past-spread\.is-single \.turning-leaf/);
  assert.match(paginationSource, /PAST_SWIPE_START_DISTANCE = 8/);
  assert.match(paginationSource, /PAST_SWIPE_DISTANCE = 32/);
  assert.match(paginationSource, /PAST_SWIPE_FAST_DISTANCE = 18/);
  assert.match(paginationSource, /PAST_SWIPE_VELOCITY = 0\.45/);
  assert.match(paginationSource, /PAST_SWIPE_MAX_DURATION = 600/);
  assert.doesNotMatch(beginGestureSource, /setPointerCapture/);
  assert.match(moveGestureSource, /setPointerCapture/);
  assert.doesNotMatch(moveGestureSource, /setTurn/);
  assert.match(chaptersSource, /onPointerDown=\{beginGesture\}/);
  assert.match(chaptersSource, /onClickCapture=/);
  assert.match(chaptersSource, /const TRACKPAD_THRESHOLD = 48/);
  assert.match(chaptersSource, /const TRACKPAD_COOLDOWN = 900/);
  assert.match(chaptersSource, /onWheel=\{handlePastWheel\}/);
  assert.match(chaptersSource, /轻扫书页翻页 · 方向键亦可/);
  assert.doesNotMatch(chaptersSource, /className="page-corner/);
  assert.doesNotMatch(styleSource, /\.page-corner/);
  assert.doesNotMatch(styleSource, /cursor: grab/);
  assert.doesNotMatch(styleSource, /cursor: grabbing/);
  assert.doesNotMatch(styleSource, /\.past-ticket \{[^}]*animation:/);
  assert.doesNotMatch(chaptersSource, /--delay/);
  assert.doesNotMatch(chaptersSource, />上一叠</);
  assert.doesNotMatch(chaptersSource, />下一叠</);
});

test("future corridor uses deterministic mountain perspective and safe near sizing", () => {
  const center = perspectiveModule.getFuturePerspective(0);
  const below = perspectiveModule.getFuturePerspective(1);
  const aboveNear = perspectiveModule.getFuturePerspective(-0.4);
  const aboveMiddle = perspectiveModule.getFuturePerspective(-1.2);
  const aboveFar = perspectiveModule.getFuturePerspective(-2.4);

  assert.equal(center.scale, 1.12);
  assert.equal(center.verticalOffsetRatio, 0);
  assert.equal(center.sideOffsetRatio, 0);
  assert.equal(center.opacity, 1);
  assert.ok(below.verticalOffsetRatio > 0);
  assert.ok(center.scale > aboveNear.scale && aboveNear.scale > aboveMiddle.scale && aboveMiddle.scale > aboveFar.scale);
  assert.ok(Math.abs(aboveFar.scale - 0.28) < 0.001);
  assert.ok(aboveNear.verticalOffsetRatio < 0 && aboveMiddle.verticalOffsetRatio < aboveNear.verticalOffsetRatio && aboveFar.verticalOffsetRatio < aboveMiddle.verticalOffsetRatio);
  assert.ok(Math.abs(aboveMiddle.verticalOffsetRatio - aboveNear.verticalOffsetRatio) > Math.abs(aboveFar.verticalOffsetRatio - aboveMiddle.verticalOffsetRatio));
  assert.ok(aboveMiddle.sideOffsetRatio > aboveFar.sideOffsetRatio);
  assert.equal(aboveNear.opacity, 1);
  assert.ok(aboveMiddle.opacity < aboveNear.opacity && aboveFar.opacity < 0.001);
  assert.ok(aboveMiddle.blur > aboveNear.blur && aboveFar.blur <= 1.8);

  for (const dimensions of [[560, 320, 560, 450], [220, 440, 358, 354], [500, 500, 300, 420]]) {
    const [width, height, maxWidth, maxHeight] = dimensions;
    const fit = perspectiveModule.getFutureTicketFitScale(width, height, maxWidth, maxHeight);
    assert.ok(width * fit * perspectiveModule.FUTURE_NEAR_SCALE <= maxWidth + 0.001);
    assert.ok(height * fit * perspectiveModule.FUTURE_NEAR_SCALE <= maxHeight + 0.001);
  }
  assert.match(chaptersSource, /getFuturePerspective\(corridorDistance\)/);
  assert.match(chaptersSource, /pointerEvents: ticketOpacity < 0\.18/);
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
