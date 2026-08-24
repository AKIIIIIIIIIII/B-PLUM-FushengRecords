"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { strToU8, zipSync } from "fflate";
import { clearAllTickets, parseTicketFiles, readDefaultTicketsHidden, readStoredTickets, reconstructStoredTicketJson, restoreDefaultTickets, saveStoredTickets, type StoredTicket } from "./ticket-store";

type Chapter = "past" | "future";
type Ticket = {
  id: number | string;
  ticketNumber?: string;
  title: string;
  date: string;
  place: string;
  note: string;
  sortKey: string;
  createdAt: string;
  kind: "往昔纪念票" | "宇宙订单票";
  imageUrl?: string;
  dataUrl?: string;
  imported?: boolean;
};

type AlbumManifest = {
  title: string;
  subtitle: string;
  edition: string;
  contact?: {
    label: string;
    detail: string;
    url: string;
    actionLabel?: string;
    supportUrl?: string;
    qrImageUrl?: string;
    qrLabel?: string;
  };
  tickets: Array<Omit<Ticket, "id" | "kind"> & { ticketNumber: string; kind: "past" | "universe" }>;
};

const defaultManifest: AlbumManifest = {
  title: "浮生录",
  subtitle: "人生票根藏本",
  edition: "私藏本",
  tickets: [],
};

function reconstructManifestTicketJson(ticket: AlbumManifest["tickets"][number]): string {
  const mode = ticket.kind === "universe"
    ? (ticket.date === "宇宙时区" ? "cosmic" : "custom")
    : "unknown";
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

function AmbientWorld({ open, chapter, progress }: { open: boolean; chapter: Chapter; progress: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080806, 0.028);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 240);
    camera.position.set(0, 3.8, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0x9f7440, 0x020506, 1.35);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xffc45e, 2.6);
    moon.position.set(-6, 10, 5);
    scene.add(moon);

    const pavilion = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x040708, roughness: 0.9, metalness: 0.04 });
    const blueInk = new THREE.MeshStandardMaterial({ color: 0x071a29, roughness: 0.94, metalness: 0.02 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb07a27, emissive: 0x4e2507, emissiveIntensity: 0.35, roughness: 0.48, metalness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.35, 4.6), dark);
    pavilion.add(base);
    [-3.7, 3.7].forEach((x) => {
      [-1.6, 1.6].forEach((z) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.8, 10), dark);
        pillar.position.set(x, 2, z);
        pavilion.add(pillar);
      });
    });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.35, 4), dark);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.58;
    roof.position.y = 4.55;
    pavilion.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), gold);
    finial.position.y = 5.35;
    pavilion.add(finial);
    pavilion.position.set(0, -1.9, -9);
    scene.add(pavilion);

    const cliffs = new THREE.Group();
    [
      [-7.8, 0.5, -6, 2.8, 8.8, 2.5],
      [-10.2, -0.2, -18, 4.2, 11.5, 3.7],
      [8.6, 0.8, -10, 3.6, 9.6, 2.8],
      [11.4, -0.4, -24, 5.2, 13, 4.2],
    ].forEach(([x, y, z, sx, sy, sz], index) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), index % 2 ? dark : blueInk);
      rock.position.set(x, y, z);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(index * 0.11, index * 0.31, index * -0.07);
      cliffs.add(rock);
    });
    scene.add(cliffs);

    const distantPeaks = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(3.2 + (i % 3), 7 + (i % 2) * 2, 5), dark);
      peak.position.set(-18 + i * 6, -2.2, -39 - (i % 3) * 7);
      peak.rotation.y = i * 0.42;
      distantPeaks.add(peak);
    }
    scene.add(distantPeaks);

    const cloudGeometry = new THREE.BufferGeometry();
    const cloudCount = 680;
    const cloudPositions = new Float32Array(cloudCount * 3);
    for (let i = 0; i < cloudCount; i += 1) {
      cloudPositions[i * 3] = (Math.random() - 0.5) * 42;
      cloudPositions[i * 3 + 1] = -2.4 + Math.random() * 2.1;
      cloudPositions[i * 3 + 2] = -Math.random() * 130 + 16;
    }
    cloudGeometry.setAttribute("position", new THREE.BufferAttribute(cloudPositions, 3));
    const cloudMaterial = new THREE.PointsMaterial({ color: 0xb3a287, size: 0.44, transparent: true, opacity: 0.19, depthWrite: false });
    const clouds = new THREE.Points(cloudGeometry, cloudMaterial);
    scene.add(clouds);

    const lights = new THREE.Group();
    for (let i = 0; i < 48; i += 1) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 4) * 0.012, 8, 8), gold);
      orb.position.set((Math.random() - 0.5) * 8, -0.2 + Math.random() * 5, -8 - i * 4.2);
      lights.add(orb);
    }
    scene.add(lights);

    let animation = 0;
    const startedAt = performance.now();
    const render = () => {
      const t = (performance.now() - startedAt) / 1000;
      clouds.rotation.y = Math.sin(t * 0.055) * 0.035;
      clouds.position.x = Math.sin(t * 0.09) * 0.45;
      pavilion.position.y = -1.9 + Math.sin(t * 0.35) * 0.045;
      lights.children.forEach((light, index) => {
        const m = light as THREE.Mesh;
        const s = 0.75 + Math.sin(t * 1.1 + index) * 0.25;
        m.scale.setScalar(s);
      });
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      dark.dispose();
      blueInk.dispose();
      gold.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const canvas = mountRef.current?.querySelector("canvas");
    if (!canvas) return;
    canvas.style.transform = chapter === "future" && open
      ? `scale(${1.02 + progress * 0.18}) translateY(${progress * 2}%)`
      : `scale(${open ? 1.05 : 1}) translateY(0)`;
  }, [open, chapter, progress]);

  return <div className="ambient-world" ref={mountRef} aria-hidden="true" />;
}

function TicketFace({ ticket, compact = false, onImageLoad }: { ticket: Ticket; compact?: boolean; onImageLoad?: (ticketId: string, width: number, height: number) => void }) {
  if (ticket.imageUrl) {
    return (
      <div className={`ticket-face imported-ticket ${compact ? "compact" : ""}`}>
        <img src={ticket.imageUrl} alt={`${ticket.title}票根`} onLoad={(event) => {
          const image = event.currentTarget;
          onImageLoad?.(String(ticket.id), image.naturalWidth, image.naturalHeight);
        }} />
      </div>
    );
  }
  return (
    <div className={`ticket-face ${ticket.kind === "宇宙订单票" ? "ticket-future" : ""} ${compact ? "compact" : ""}`}>
      <div className="ticket-kicker">{ticket.kind}</div>
      <div className="ticket-title">{ticket.title}</div>
      <div className="ticket-rule" />
      <div className="ticket-date">{ticket.date}</div>
      {!compact && <div className="ticket-place">{ticket.place}</div>}
      <div className="ticket-seal">录</div>
    </div>
  );
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [chapter, setChapter] = useState<Chapter>("past");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [progress, setProgress] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [pastRows, setPastRows] = useState(3);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  const [ticketRatios, setTicketRatios] = useState<Record<string, number>>({});
  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [seedTickets, setSeedTickets] = useState<Ticket[]>([]);
  const [manifest, setManifest] = useState<AlbumManifest>(defaultManifest);
  const [defaultTicketsHidden, setDefaultTicketsHidden] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const touchStart = useRef<number | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
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
    const hydrated = [...records].sort((a, b) => (a.sortKey || a.createdAt).localeCompare(b.sortKey || b.createdAt)).map<Ticket>((record) => {
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

  const reloadLocalTickets = useCallback(async () => {
    hydrateTickets(await readStoredTickets());
  }, [hydrateTickets]);

  useEffect(() => {
    fetch("/album-manifest.json")
      .then((response) => response.ok ? response.json() as Promise<AlbumManifest> : Promise.reject())
      .then((data) => {
        setManifest(data);
        setSeedTickets((data.tickets || []).map((ticket) => ({
          ...ticket,
          id: ticket.ticketNumber,
          kind: ticket.kind === "past" ? "往昔纪念票" : "宇宙订单票",
          imported: true,
        })));
      })
      .catch(() => setManifest(defaultManifest));
    Promise.all([readStoredTickets(), readDefaultTicketsHidden()])
      .then(([records, hidden]) => {
        hydrateTickets(records);
        setDefaultTicketsHidden(hidden);
      })
      .catch(() => {
        setDefaultTicketsHidden(false);
        showImportMessage("本地藏本暂时无法读取");
      });
    return () => objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, [hydrateTickets, showImportMessage]);

  const importFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const result = await parseTicketFiles(files);
    if (!result.tickets.length) {
      const reason = result.rejected[0]?.reason;
      showImportMessage(reason || "没有识别到可收藏的票根，请同时选择同名的票根图片与票据册");
      return;
    }
    await saveStoredTickets(result.tickets);
    await reloadLocalTickets();
    const savedText = result.tickets.length === 1 ? "一张票根已收入藏本" : `${result.tickets.length}张票根已收入藏本`;
    const firstReason = result.rejected[0]?.reason;
    showImportMessage(result.skipped ? `${savedText}；${firstReason || `另有${result.skipped}个文件未识别`}` : savedText);
  }, [reloadLocalTickets, showImportMessage]);

  const exportAllTickets = useCallback(async () => {
    type ExportRecord = {
      ticketNumber: string;
      kind: "past" | "universe";
      image?: Uint8Array;
      json: Uint8Array;
      imageStatus: "original" | "missing";
      jsonStatus: "original" | "reconstructed";
    };
    const records = new Map<string, ExportRecord>();

    for (const ticket of manifest.tickets || []) {
      let image: Uint8Array | undefined;
      let imageStatus: ExportRecord["imageStatus"] = "missing";
      try {
        image = await fetchBytes(ticket.imageUrl || `/tickets/${ticket.ticketNumber}.png`);
        imageStatus = "original";
      } catch {}

      let json: Uint8Array;
      let jsonStatus: ExportRecord["jsonStatus"] = "reconstructed";
      try {
        if (!ticket.dataUrl) throw new Error("missing dataUrl");
        json = await fetchBytes(ticket.dataUrl);
        jsonStatus = "original";
      } catch {
        json = strToU8(reconstructManifestTicketJson(ticket));
      }
      records.set(ticket.ticketNumber, { ticketNumber: ticket.ticketNumber, kind: ticket.kind, image, json, imageStatus, jsonStatus });
    }

    for (const ticket of await readStoredTickets()) {
      const previous = records.get(ticket.ticketNumber);
      const image = ticket.image ? new Uint8Array(await ticket.image.arrayBuffer()) : previous?.image;
      const rawJson = ticket.rawJson ? new Uint8Array(await ticket.rawJson.arrayBuffer()) : strToU8(reconstructStoredTicketJson(ticket));
      records.set(ticket.ticketNumber, {
        ticketNumber: ticket.ticketNumber,
        kind: ticket.kind,
        image,
        json: rawJson,
        imageStatus: image ? "original" : "missing",
        jsonStatus: ticket.rawJson ? "original" : "reconstructed",
      });
    }

    if (!records.size) {
      showImportMessage("这本册子里还没有可以导出的票根");
      return;
    }

    const files: Record<string, Uint8Array> = {};
    const exported = [...records.values()].map((record) => {
      const folder = record.kind === "past" ? "past" : "future";
      if (record.image) files[`${folder}/${record.ticketNumber}.png`] = record.image;
      files[`${folder}/${record.ticketNumber}.json`] = record.json;
      return {
        ticketNumber: record.ticketNumber,
        kind: record.kind,
        image: record.imageStatus,
        json: record.jsonStatus,
      };
    });
    files["export-manifest.json"] = strToU8(JSON.stringify({
      schemaVersion: 1,
      albumTitle: manifest.title,
      exportedAt: new Date().toISOString(),
      tickets: exported,
    }, null, 2) + "\n");

    const blob = new Blob([zipSync(files, { level: 6 })], { type: "application/zip" });
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
  }, [manifest, showImportMessage]);

  const allTickets = useMemo(() => {
    const byNumber = new Map<string | number, Ticket>();
    if (defaultTicketsHidden === false) seedTickets.forEach((ticket) => byNumber.set(ticket.ticketNumber || ticket.id, ticket));
    localTickets.forEach((ticket) => byNumber.set(ticket.ticketNumber || ticket.id, ticket));
    return [...byNumber.values()];
  }, [defaultTicketsHidden, localTickets, seedTickets]);
  const pastCollection = allTickets
    .filter((ticket) => ticket.kind === "往昔纪念票")
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const futureCollection = allTickets
    .filter((ticket) => ticket.kind === "宇宙订单票")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const updatePastRows = () => {
      setPastRows(window.innerWidth <= 760 || window.innerHeight <= 700 ? 2 : 3);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updatePastRows();
    window.addEventListener("resize", updatePastRows);
    return () => window.removeEventListener("resize", updatePastRows);
  }, []);

  const handleTicketImageLoad = useCallback((ticketId: string, width: number, height: number) => {
    if (!width || !height) return;
    const ratio = width / height;
    setTicketRatios((current) => current[ticketId] === ratio ? current : { ...current, [ticketId]: ratio });
  }, []);

  const futureTicketBaseShortSide = viewport.width <= 760
    ? Math.min(210, viewport.width * 0.55, viewport.height * 0.28)
    : Math.min(260, viewport.width * 0.28, viewport.height * 0.32);
  const futureTicketMaxWidth = viewport.width <= 760 ? viewport.width * 0.92 : Math.min(560, viewport.width * 0.56);
  const futureTicketMaxHeight = viewport.width <= 760 ? viewport.height * 0.42 : viewport.height * 0.5;

  const ticketsPerSpread = pastRows * 2;
  const pastPageCount = Math.max(1, Math.ceil(pastCollection.length / ticketsPerSpread));
  const visiblePastTickets = pastCollection.slice(pastPage * ticketsPerSpread, pastPage * ticketsPerSpread + ticketsPerSpread);

  useEffect(() => {
    if (pastPage >= pastPageCount) setPastPage(Math.max(0, pastPageCount - 1));
  }, [pastPage, pastPageCount]);

  const futureDepths = useMemo(
    () => futureCollection.map((_, index) => (index + 0.5) / Math.max(1, futureCollection.length)),
    [futureCollection],
  );

  const snapToNearestTicket = useCallback(() => {
    setProgress((current) => {
      if (!futureDepths.length) return current;
      if (current < futureDepths[0] * 0.28) return 0;
      return futureDepths.reduce((closest, depth) => Math.abs(depth - current) < Math.abs(closest - current) ? depth : closest);
    });
  }, [futureDepths]);

  const advance = useCallback((delta: number) => {
    setProgress((value) => Math.min(1, Math.max(0, value + delta)));
  }, []);

  const onWheel = useCallback((event: React.WheelEvent) => {
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

  return (
    <main
      className={`experience ${isOpen ? "is-open" : "is-closed"} chapter-${chapter}`}
      onWheel={onWheel}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }}
      onTouchMove={(event) => {
        if (chapter !== "future" || selected || touchStart.current === null) return;
        const y = event.touches[0]?.clientY ?? touchStart.current;
        advance((touchStart.current - y) * 0.00075);
        touchStart.current = y;
      }}
      onTouchEnd={() => {
        touchStart.current = null;
        if (chapter === "future" && !selected) snapToNearestTicket();
      }}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        importFiles(Array.from(event.dataTransfer.files)).catch(() => showImportMessage("票根没有成功放入，请再试一次"));
      }}
    >
      <AmbientWorld open={isOpen} chapter={chapter} progress={progress} />
      <div className="mist mist-one" />
      <div className="mist mist-two" />

      <header className="brand-mark">
        <span>{manifest.subtitle}</span>
        <i />
        <b>{manifest.title}</b>
      </header>

      <div className={`drop-curtain ${isDragging ? "visible" : ""}`} aria-hidden={!isDragging}>
        <span className="drop-seal">入</span>
        <strong>放入浮生录</strong>
        <p>票根图片与同名票据册会自动配对</p>
      </div>

      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".png,.json,image/png,application/json"
        multiple
        onChange={(event) => {
          importFiles(Array.from(event.target.files || [])).catch(() => showImportMessage("票根没有成功放入，请再试一次"));
          event.currentTarget.value = "";
        }}
      />

      {isOpen && (
        <div className="collection-tools">
          <button onClick={() => fileInputRef.current?.click()}>置入票根</button>
          {(manifest.tickets.length > 0 || localTickets.length > 0) && (
            <button className="export-collection" onClick={() => exportAllTickets().catch(() => showImportMessage("票根暂时无法导出，请再试一次"))}>导出票根</button>
          )}
          {allTickets.length > 0 && (
            <button
              className="clear-collection"
              onClick={() => {
                if (!window.confirm("确认清空当前浏览器中的全部票根吗？网站自带票根可稍后恢复。")) return;
                clearAllTickets()
                  .then(() => {
                    hydrateTickets([]);
                    setDefaultTicketsHidden(true);
                    setSelected(null);
                    setPastPage(0);
                    setProgress(0);
                    showImportMessage("全部票根已从此浏览器清空");
                  })
                  .catch(() => showImportMessage("票根暂时无法清空，请再试一次"));
              }}
            >清空票根</button>
          )}
          {defaultTicketsHidden === true && (
            <button
              className="restore-collection"
              onClick={() => {
                restoreDefaultTickets()
                  .then(() => {
                    setDefaultTicketsHidden(false);
                    setPastPage(0);
                    setProgress(0);
                    showImportMessage("默认票根已恢复");
                  })
                  .catch(() => showImportMessage("默认票根暂时无法恢复，请再试一次"));
              }}
            >恢复默认票根</button>
          )}
          <small>仅保存在此浏览器</small>
        </div>
      )}

      {importMessage && <div className="import-message" role="status">{importMessage}</div>}

      {!isOpen ? (
        <section className="opening" aria-label="浮生录封面">
          <button className="closed-book" onClick={() => setIsOpen(true)} aria-label="打开浮生录">
            <span className="book-edge" />
            <span className="cover-frame" />
            <span className="cover-cloud cloud-a" />
            <span className="cover-cloud cloud-b" />
            <span className="cover-title">{manifest.title}</span>
            <span className="cover-subtitle">{manifest.subtitle}</span>
            <span className="cover-seal">藏</span>
          </button>
          <button className="open-prompt" onClick={() => setIsOpen(true)}>
            <span>轻触开卷</span><i>↗</i>
          </button>
        </section>
      ) : (
        <section className="album" aria-label="浮生录内页">
          <nav className="bookmarks" aria-label="时间书签">
            <button className={chapter === "past" ? "active" : ""} onClick={() => { setChapter("past"); setSelected(null); }}>
              <small>旧章</small><span>过去</span>
            </button>
            <button className={chapter === "future" ? "active" : ""} onClick={() => { setProgress(0); setChapter("future"); setSelected(null); }}>
              <small>未至</small><span>未来</span>
            </button>
          </nav>

          {chapter === "past" ? (
            <div className="past-chapter">
              <div className="past-spread" style={{ "--past-rows": pastRows } as React.CSSProperties}>
                <div className="page page-left">
                  <div className="spread-heading">
                    <p className="chapter-no">卷一 · 往昔</p>
                    <h1>循岁月而行</h1>
                  </div>
                  <div className="page-ticket-list" data-count={Math.min(visiblePastTickets.length, pastRows)}>
                    {visiblePastTickets.slice(0, pastRows).map((ticket, index) => (
                      <button key={ticket.id} className={`past-ticket ${ticket.imageUrl ? "has-image" : ""}`} onClick={() => setSelected(ticket)} style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
                        <TicketFace ticket={ticket} compact />
                      </button>
                    ))}
                  </div>
                  <div className="folio">{pastPage * 2 + 1}</div>
                </div>
                <div className="page page-right">
                  <div className="page-ticket-list page-ticket-list-right" data-count={Math.max(0, visiblePastTickets.length - pastRows)}>
                    {visiblePastTickets.slice(pastRows, pastRows * 2).map((ticket, index) => (
                      <button key={ticket.id} className={`past-ticket ${ticket.imageUrl ? "has-image" : ""}`} onClick={() => setSelected(ticket)} style={{ "--delay": `${(index + pastRows) * 90}ms` } as React.CSSProperties}>
                        <TicketFace ticket={ticket} compact />
                      </button>
                    ))}
                    {!pastCollection.length && <div className="empty-collection">这一卷还是空白<br /><button onClick={() => fileInputRef.current?.click()}>置入第一张往昔纪念票</button></div>}
                  </div>
                  <div className="folio">{pastPage * 2 + 2}</div>
                </div>
              </div>
              {pastPageCount > 1 && (
                <div className="page-turner" aria-label="往昔书页">
                  <button disabled={pastPage === 0} onClick={() => setPastPage((page) => Math.max(0, page - 1))}>上一叠</button>
                  <span>第 {pastPage + 1} 叠 · 共 {pastPageCount} 叠</span>
                  <button disabled={pastPage === pastPageCount - 1} onClick={() => setPastPage((page) => Math.min(pastPageCount - 1, page + 1))}>下一叠</button>
                </div>
              )}
              <span className="page-swipe-hint">左右滑动翻页</span>
            </div>
          ) : (
            <div className="future-corridor">
              <div className="corridor-heading" style={{ opacity: Math.max(0, 1 - progress * 2.2) }}>
                <p className="chapter-no">卷二 · 未至</p>
                <h1>向云深处</h1>
                <p>滚动前行，让尚未抵达的一页慢慢显形。</p>
              </div>
              <div className="path-line" />
              {futureCollection.map((ticket, index) => {
                const distance = futureDepths[index] - progress;
                const corridorDistance = distance * Math.max(2.4, futureCollection.length);
                const depth = Math.abs(corridorDistance);
                const visible = Math.max(0.6, 1 - depth * 0.24);
                const revealEnd = Math.max(0.02, Math.min(0.1, (futureDepths[0] ?? 0.1) * 0.7));
                const revealRaw = Math.min(1, Math.max(0, (progress - 0.01) / (revealEnd - 0.01)));
                const corridorReveal = revealRaw * revealRaw * (3 - 2 * revealRaw);
                const scale = Math.max(0.52, 0.96 - depth * 0.14);
                const side = (index % 2 === 0 ? -1 : 1) * Math.min(22, depth * 17);
                const ratio = ticketRatios[String(ticket.id)] ?? 1.75;
                const elongation = Math.max(ratio, 1 / ratio);
                const isSlender = elongation >= 2;
                const targetLongSide = isSlender ? futureTicketBaseShortSide * 2 : futureTicketBaseShortSide * elongation;
                const targetShortSide = isSlender ? targetLongSide / elongation : futureTicketBaseShortSide;
                const targetWidth = ratio >= 1 ? targetLongSide : targetShortSide;
                const targetHeight = ratio >= 1 ? targetShortSide : targetLongSide;
                const fitScale = Math.min(1, futureTicketMaxWidth / targetWidth, futureTicketMaxHeight / targetHeight);
                return (
                  <button
                    key={ticket.id}
                    className={`corridor-ticket ticket-${index + 1}`}
                    style={{
                      width: `${targetWidth * fitScale}px`,
                      height: `${targetHeight * fitScale}px`,
                      opacity: visible * corridorReveal,
                      pointerEvents: corridorReveal < 0.08 ? "none" : "auto",
                      transform: `translate3d(calc(-50% + ${side}vw), calc(-50% + ${corridorDistance * 54}vh), 0) scale(${scale})`,
                      filter: `blur(${Math.min(1, Math.max(0, depth - 1.4) * 0.55)}px)`,
                    }}
                    onClick={() => setSelected(ticket)}
                  >
                    <TicketFace ticket={ticket} onImageLoad={handleTicketImageLoad} />
                  </button>
                );
              })}
              {!futureCollection.length && (
                <div className="empty-future">
                  <span>长廊尽头尚无来信</span>
                  <button onClick={() => fileInputRef.current?.click()}>置入第一张宇宙订单票</button>
                </div>
              )}
              <div className="progress-rail" aria-label={`未来长廊进度 ${Math.round(progress * 100)}%`}>
                <span style={{ height: `${10 + progress * 90}%` }} />
                <em>{Math.round(progress * 100).toString().padStart(2, "0")}</em>
              </div>
              <div className="scroll-hint" style={{ opacity: progress > 0.08 ? 0.35 : 1 }}>
                <span>滚动 · 向前</span><i>↓</i>
              </div>
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="ticket-focus" role="dialog" aria-modal="true" aria-label={`${selected.title}详情`} onClick={() => setSelected(null)}>
          <button className="focus-close" onClick={() => setSelected(null)} aria-label="收回票根">收回此页　×</button>
          <div className="floating-ticket" onClick={(event) => event.stopPropagation()}>
            <TicketFace ticket={selected} />
            <div className="ticket-memory">
              <p>{selected.note}</p>
              <span>{selected.place}</span>
            </div>
          </div>
        </div>
      )}

      {!isOpen && manifest.contact && (
        <aside className="contact-note" aria-label={manifest.contact.label}>
          <strong>{manifest.contact.label}</strong>
          {manifest.contact.qrImageUrl && manifest.contact.supportUrl && (
            <a className="contact-qr" href={manifest.contact.supportUrl} target="_blank" rel="noreferrer" aria-label={manifest.contact.qrLabel || "请造册人喝杯茶"}>
              <img src={manifest.contact.qrImageUrl} alt="付茶钱二维码" />
              <span>{manifest.contact.qrLabel || "请造册人喝杯茶"}</span>
            </a>
          )}
          {manifest.contact.detail && <p>{manifest.contact.detail}</p>}
          {manifest.contact.url && (
            <a className="contact-action" href={manifest.contact.url} target="_blank" rel="noreferrer">
              {manifest.contact.actionLabel || "拜访造册人"}
            </a>
          )}
        </aside>
      )}
      <footer className="edition">{manifest.edition}</footer>
    </main>
  );
}
