"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type WheelEvent } from "react";
import { strToU8, zipSync } from "fflate";
import { clearAllTickets, parseTicketFiles, readHiddenDefaultTicketNumbers, readStoredTickets, reconstructStoredTicketJson, restoreDefaultTickets, saveStoredTickets, type StoredTicket } from "./ticket-store";
import { defaultManifest, type AlbumManifest, type Chapter, type Ticket } from "./album-types";
import { getPastPageCount, normalizePastPage, remapPastPage } from "./past-pagination";
import { AmbientWorld } from "./components/ambient-world";
import { AlbumCover, BrandMark, ChapterBookmarks, ContactNote } from "./components/album-shell";
import { CollectionToolbar, DropCurtain, TicketFocus } from "./components/album-controls";
import { FutureChapter, PastChapter } from "./components/chapters";
import { createViewportLayout } from "./viewport-layout";

function reconstructManifestTicketJson(ticket: AlbumManifest["tickets"][number]): string {
  const mode = ticket.kind === "universe" ? (ticket.date === "宇宙时区" ? "cosmic" : "custom") : "unknown";
  const data: Record<string, unknown> = {
    schemaVersion: 1,
    ticketNumber: ticket.ticketNumber,
    kind: ticket.kind,
    status: ticket.kind === "past" ? "ended" : "ordered",
    title: ticket.title,
    scene: ticket.title,
    time: { mode, raw: ticket.date, display: ticket.date },
    place: ticket.place,
    createdAt: ticket.createdAt,
    export: { reconstructed: true },
  };
  if (ticket.note) data.note = ticket.note;
  return JSON.stringify(data, null, 2) + "\n";
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`无法读取 ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [chapter, setChapter] = useState<Chapter>("past");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [progress, setProgress] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [viewportLayout, setViewportLayout] = useState(() => createViewportLayout(1280, 800));
  const [ticketRatios, setTicketRatios] = useState<Record<string, number>>({});
  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [seedTickets, setSeedTickets] = useState<Ticket[]>([]);
  const [manifest, setManifest] = useState<AlbumManifest>(defaultManifest);
  const [hiddenDefaultTicketNumbers, setHiddenDefaultTicketNumbers] = useState<string[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const touchStart = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const pastLayoutRef = useRef({ rows: viewportLayout.pastRows, singlePage: viewportLayout.isMobile });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const showImportMessage = useCallback((message: string) => {
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    setImportMessage(message);
    messageTimerRef.current = window.setTimeout(() => {
      setImportMessage("");
      messageTimerRef.current = null;
    }, 4200);
  }, []);

  const hydrateTickets = useCallback((records: StoredTicket[]) => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const urls: string[] = [];
    const hydrated = [...records]
      .sort((a, b) => (a.sortKey || a.createdAt).localeCompare(b.sortKey || b.createdAt))
      .map<Ticket>((record) => {
        const imageUrl = record.image ? URL.createObjectURL(record.image) : undefined;
        if (imageUrl) urls.push(imageUrl);
        return {
          id: record.ticketNumber,
          ticketNumber: record.ticketNumber,
          title: record.title,
          date: record.date,
          place: record.place,
          note: record.note,
          sortKey: record.sortKey || record.createdAt,
          createdAt: record.createdAt,
          kind: record.kind === "past" ? "往昔纪念票" : "宇宙订单票",
          imageUrl,
          imported: true,
        };
      });
    objectUrlsRef.current = urls;
    setLocalTickets(hydrated);
  }, []);

  const reloadLocalTickets = useCallback(async () => hydrateTickets(await readStoredTickets()), [hydrateTickets]);

  useEffect(() => {
    fetch("/album-manifest.json")
      .then((response) => response.ok ? response.json() as Promise<AlbumManifest> : Promise.reject())
      .catch(() => defaultManifest)
      .then(async (data) => {
        setManifest(data);
        setSeedTickets((data.tickets || []).map((ticket) => ({ ...ticket, id: ticket.ticketNumber, kind: ticket.kind === "past" ? "往昔纪念票" : "宇宙订单票", imported: true })));
        try {
          const [records, hiddenNumbers] = await Promise.all([
            readStoredTickets(),
            readHiddenDefaultTicketNumbers((data.tickets || []).map((ticket) => ticket.ticketNumber)),
          ]);
          hydrateTickets(records);
          setHiddenDefaultTicketNumbers(hiddenNumbers);
        } catch {
          setHiddenDefaultTicketNumbers([]);
          showImportMessage("本地藏本暂时无法读取");
        }
      });
    return () => objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, [hydrateTickets, showImportMessage]);

  const importFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const result = await parseTicketFiles(files);
    if (!result.tickets.length) {
      showImportMessage(result.rejected[0]?.reason || "没有识别到可收藏的票根，请同时选择同名的票根图片与票据册");
      return;
    }
    await saveStoredTickets(result.tickets);
    await reloadLocalTickets();
    const savedText = result.tickets.length === 1 ? "一张票根已收入藏本" : `${result.tickets.length}张票根已收入藏本`;
    showImportMessage(result.skipped ? `${savedText}；${result.rejected[0]?.reason || `另有${result.skipped}个文件未识别`}` : savedText);
  }, [reloadLocalTickets, showImportMessage]);

  const exportAllTickets = useCallback(async () => {
    type ExportRecord = { ticketNumber: string; kind: "past" | "universe"; image?: Uint8Array; json: Uint8Array; imageStatus: "original" | "missing"; jsonStatus: "original" | "reconstructed" };
    const records = new Map<string, ExportRecord>();
    for (const ticket of manifest.tickets || []) {
      if (hiddenDefaultTicketNumbers?.includes(ticket.ticketNumber)) continue;
      let image: Uint8Array | undefined;
      let imageStatus: ExportRecord["imageStatus"] = "missing";
      try { image = await fetchBytes(ticket.imageUrl || `/tickets/${ticket.ticketNumber}.png`); imageStatus = "original"; } catch { /* Missing images remain explicit in the export manifest. */ }
      let json: Uint8Array;
      let jsonStatus: ExportRecord["jsonStatus"] = "reconstructed";
      try {
        if (!ticket.dataUrl) throw new Error("missing dataUrl");
        json = await fetchBytes(ticket.dataUrl);
        jsonStatus = "original";
      } catch { json = strToU8(reconstructManifestTicketJson(ticket)); }
      records.set(ticket.ticketNumber, { ticketNumber: ticket.ticketNumber, kind: ticket.kind, image, json, imageStatus, jsonStatus });
    }
    for (const ticket of await readStoredTickets()) {
      const previous = records.get(ticket.ticketNumber);
      const image = ticket.image ? new Uint8Array(await ticket.image.arrayBuffer()) : previous?.image;
      const rawJson = ticket.rawJson ? new Uint8Array(await ticket.rawJson.arrayBuffer()) : strToU8(reconstructStoredTicketJson(ticket));
      records.set(ticket.ticketNumber, { ticketNumber: ticket.ticketNumber, kind: ticket.kind, image, json: rawJson, imageStatus: image ? "original" : "missing", jsonStatus: ticket.rawJson ? "original" : "reconstructed" });
    }
    if (!records.size) { showImportMessage("这本册子里还没有可以导出的票根"); return; }
    const files: Record<string, Uint8Array> = {};
    const exported = [...records.values()].map((record) => {
      const folder = record.kind === "past" ? "past" : "future";
      if (record.image) files[`${folder}/${record.ticketNumber}.png`] = record.image;
      files[`${folder}/${record.ticketNumber}.json`] = record.json;
      return { ticketNumber: record.ticketNumber, kind: record.kind, image: record.imageStatus, json: record.jsonStatus };
    });
    files["export-manifest.json"] = strToU8(JSON.stringify({ schemaVersion: 1, albumTitle: manifest.title, exportedAt: new Date().toISOString(), tickets: exported }, null, 2) + "\n");
    const archive = zipSync(files, { level: 6 });
    const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    const blob = new Blob([archiveBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${manifest.title || "浮生录"}-票根-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    const rebuilt = exported.filter((ticket) => ticket.json === "reconstructed").length;
    const missing = exported.filter((ticket) => ticket.image === "missing").length;
    showImportMessage(`已导出${exported.length}张票根${rebuilt ? `，其中${rebuilt}份 JSON 为重建` : ""}${missing ? `，${missing}张缺少图片` : ""}`);
  }, [hiddenDefaultTicketNumbers, manifest, showImportMessage]);

  const allTickets = useMemo(() => {
    const byNumber = new Map<string | number, Ticket>();
    const hiddenNumbers = new Set(hiddenDefaultTicketNumbers || []);
    if (hiddenDefaultTicketNumbers !== null) seedTickets.filter((ticket) => !hiddenNumbers.has(String(ticket.ticketNumber || ticket.id))).forEach((ticket) => byNumber.set(ticket.ticketNumber || ticket.id, ticket));
    localTickets.forEach((ticket) => byNumber.set(ticket.ticketNumber || ticket.id, ticket));
    return [...byNumber.values()];
  }, [hiddenDefaultTicketNumbers, localTickets, seedTickets]);
  const pastCollection = allTickets.filter((ticket) => ticket.kind === "往昔纪念票").sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const futureCollection = allTickets.filter((ticket) => ticket.kind === "宇宙订单票").sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const updateViewport = () => {
      const nextLayout = createViewportLayout(window.innerWidth, window.innerHeight);
      const nextRows = nextLayout.pastRows;
      const nextSinglePage = nextLayout.isMobile;
      const previousLayout = pastLayoutRef.current;
      if (previousLayout.rows !== nextRows || previousLayout.singlePage !== nextSinglePage) {
        setPastPage((current) => remapPastPage(current, previousLayout.rows, nextRows, nextSinglePage));
        pastLayoutRef.current = { rows: nextRows, singlePage: nextSinglePage };
      }
      setViewportLayout(nextLayout);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const handleTicketImageLoad = useCallback((ticketId: string, width: number, height: number) => {
    if (!width || !height) return;
    const ratio = width / height;
    setTicketRatios((current) => current[ticketId] === ratio ? current : { ...current, [ticketId]: ratio });
  }, []);

  const futureTicketBaseShortSide = viewportLayout.isMobile ? Math.min(210, viewportLayout.designWidth * 0.55, viewportLayout.designHeight * 0.28) : Math.min(260, viewportLayout.designWidth * 0.28, viewportLayout.designHeight * 0.32);
  const futureTicketMaxWidth = viewportLayout.isMobile ? viewportLayout.designWidth * 0.92 : Math.min(560, viewportLayout.designWidth * 0.56);
  const futureTicketMaxHeight = viewportLayout.isMobile ? viewportLayout.designHeight * 0.42 : viewportLayout.designHeight * 0.5;
  const pastRows = viewportLayout.pastRows;
  const pastSinglePage = viewportLayout.isMobile;
  const pastPageCount = getPastPageCount(pastCollection.length, pastRows);
  const currentPastPage = normalizePastPage(pastPage, pastPageCount, pastSinglePage);

  const futureDepths = useMemo(() => futureCollection.map((_, index) => (index + 0.5) / Math.max(1, futureCollection.length)), [futureCollection]);
  const snapToNearestTicket = useCallback(() => {
    setProgress((current) => {
      if (!futureDepths.length) return current;
      if (current < futureDepths[0] * 0.28) return 0;
      return futureDepths.reduce((closest, depth) => Math.abs(depth - current) < Math.abs(closest - current) ? depth : closest);
    });
  }, [futureDepths]);
  const advance = useCallback((delta: number) => setProgress((value) => Math.min(1, Math.max(0, value + delta))), []);
  const onWheel = useCallback((event: WheelEvent) => {
    if (chapter !== "future" || selected) return;
    advance(event.deltaY * 0.00022);
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(snapToNearestTicket, 420);
  }, [advance, chapter, selected, snapToNearestTicket]);

  useEffect(() => () => {
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (!isOpen && (event.key === "Enter" || event.key === " ")) setIsOpen(true);
      if (chapter === "future" && !selected && event.key === "ArrowDown") advance(0.04);
      if (chapter === "future" && !selected && event.key === "ArrowUp") advance(-0.04);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, chapter, isOpen, selected]);

  const handleChapterChange = (nextChapter: Chapter) => {
    if (nextChapter === "future") setProgress(0);
    setChapter(nextChapter);
    setSelected(null);
  };
  const clearCollection = () => {
    if (!window.confirm("确认清空当前浏览器中的全部票根吗？网站自带票根可稍后恢复。")) return;
    const defaultTicketNumbers = (manifest.tickets || []).map((ticket) => ticket.ticketNumber);
    clearAllTickets(defaultTicketNumbers).then(() => {
      hydrateTickets([]); setHiddenDefaultTicketNumbers(defaultTicketNumbers); setSelected(null); setPastPage(0); setProgress(0); showImportMessage("全部票根已从此浏览器清空");
    }).catch(() => showImportMessage("票根暂时无法清空，请再试一次"));
  };
  const restoreCollection = () => {
    restoreDefaultTickets().then(() => {
      setHiddenDefaultTicketNumbers([]); setPastPage(0); setProgress(0); showImportMessage("默认票根已恢复");
    }).catch(() => showImportMessage("默认票根暂时无法恢复，请再试一次"));
  };

  return (
    <main
      className={`experience relative isolate h-dvh w-screen overflow-hidden ${isOpen ? "is-open" : "is-closed"} chapter-${chapter}`}
      style={{ "--ui-scale": viewportLayout.uiScale, "--book-width": `${viewportLayout.bookWidth}px`, "--book-height": `${viewportLayout.bookHeight}px`, "--touch-target": `${44 / viewportLayout.uiScale}px`, "--readable-small": `${10 / viewportLayout.uiScale}px` } as CSSProperties}
      onWheel={onWheel}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }}
      onTouchMove={(event) => {
        if (chapter !== "future" || selected || touchStart.current === null) return;
        const y = event.touches[0]?.clientY ?? touchStart.current;
        advance((touchStart.current - y) * 0.00075);
        touchStart.current = y;
      }}
      onTouchEnd={() => { touchStart.current = null; if (chapter === "future" && !selected) snapToNearestTicket(); }}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); importFiles(Array.from(event.dataTransfer.files)).catch(() => showImportMessage("票根没有成功放入，请再试一次")); }}
    >
      <AmbientWorld open={isOpen} chapter={chapter} progress={progress} />
      <div className="mist mist-one" /><div className="mist mist-two" />
      <DropCurtain visible={isDragging} />
      <input ref={fileInputRef} className="fixed h-px w-px opacity-0 pointer-events-none" type="file" accept=".png,.json,image/png,application/json" multiple onChange={(event) => {
        importFiles(Array.from(event.target.files || [])).catch(() => showImportMessage("票根没有成功放入，请再试一次"));
        event.currentTarget.value = "";
      }} />

      <div className="ui-stage absolute left-1/2 top-1/2" style={{ width: viewportLayout.designWidth, height: viewportLayout.designHeight, transform: `translate(-50%, -50%) scale(${viewportLayout.uiScale})` }}>
        <BrandMark manifest={manifest} />
        {isOpen && <CollectionToolbar fileInputRef={fileInputRef} canExport={allTickets.length > 0} canClear={allTickets.length > 0} canRestore={(hiddenDefaultTicketNumbers?.length || 0) > 0} onExport={() => exportAllTickets().catch(() => showImportMessage("票根暂时无法导出，请再试一次"))} onClear={clearCollection} onRestore={restoreCollection} />}
        {importMessage && <div className="import-message" role="status">{importMessage}</div>}

        {!isOpen ? <AlbumCover manifest={manifest} onOpen={() => setIsOpen(true)} /> : (
          <section className="album absolute inset-0 [perspective:1800px]" aria-label="浮生录内页">
            <ChapterBookmarks chapter={chapter} onChange={handleChapterChange} />
            {chapter === "past"
              ? <PastChapter key={`${pastRows}-${pastSinglePage}-${pastPageCount}`} tickets={pastCollection} rows={pastRows} page={currentPastPage} pageCount={pastPageCount} singlePage={pastSinglePage} interactionLocked={selected !== null} fileInputRef={fileInputRef} onPageChange={setPastPage} onSelect={setSelected} />
              : <FutureChapter tickets={futureCollection} depths={futureDepths} progress={progress} ratios={ticketRatios} baseShortSide={futureTicketBaseShortSide} maxWidth={futureTicketMaxWidth} maxHeight={futureTicketMaxHeight} stageWidth={viewportLayout.designWidth} stageHeight={viewportLayout.designHeight} fileInputRef={fileInputRef} onImageLoad={handleTicketImageLoad} onSelect={setSelected} />}
          </section>
        )}

        {!isOpen && manifest.contact && <ContactNote contact={manifest.contact} />}
        <footer className="absolute right-[38px] bottom-7 z-[8] text-[max(11px,var(--readable-small))] leading-[1.2] tracking-[.24em] text-[rgba(214,178,105,.48)] max-[760px]:right-[17px] max-[760px]:bottom-[18px]">{manifest.edition}</footer>
      </div>
      {selected && <TicketFocus ticket={selected} onClose={() => setSelected(null)} scale={Math.max(viewportLayout.uiScale, viewportLayout.isMobile ? 0.78 : 0.65)} />}
    </main>
  );
}
