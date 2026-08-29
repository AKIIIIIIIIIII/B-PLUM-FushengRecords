export type StoredTicket = {
  ticketNumber: string;
  kind: "past" | "universe";
  title: string;
  date: string;
  place: string;
  note: string;
  createdAt: string;
  sortKey: string;
  image?: Blob;
  rawJson?: Blob;
  fictionalSample?: boolean;
};

export type HiddenCollectedTicket = {
  ticketNumber: string;
  collectionRevision: string;
};

export type TicketVisibilitySettings = {
  samplesVisible: boolean;
  hiddenSampleTicketNumbers: string[];
  hiddenCollectedTickets: HiddenCollectedTicket[];
};

export type ManifestVisibilityTicket = {
  ticketNumber: string;
  fictionalSample?: boolean;
  collectionRevision?: string;
};

const DATABASE_NAME = "fushenglu-local-album";
const STORE_NAME = "tickets";
const SETTINGS_STORE_NAME = "settings";
const DEFAULT_TICKETS_HIDDEN_KEY = "defaultTicketsHidden";
const HIDDEN_DEFAULT_TICKET_NUMBERS_KEY = "hiddenDefaultTicketNumbers";
const SAMPLES_VISIBLE_KEY = "samplesVisible";
const HIDDEN_SAMPLE_TICKET_NUMBERS_KEY = "hiddenSampleTicketNumbers";
const HIDDEN_COLLECTED_TICKETS_KEY = "hiddenCollectedTickets";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 4);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "ticketNumber" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredTickets(): Promise<StoredTicket[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredTicket[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveStoredTickets(tickets: StoredTicket[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    tickets.forEach((ticket) => store.put(ticket));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function deleteStoredTicket(ticketNumber: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(ticketNumber);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export function resolveHiddenDefaultTicketNumbers(value: unknown, currentTicketNumbers: string[]): string[] {
  if (value === true) return [...new Set(currentTicketNumbers.filter(Boolean))];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((ticketNumber): ticketNumber is string => typeof ticketNumber === "string" && ticketNumber.length > 0))];
}

function normalizeHiddenCollectedTickets(value: unknown): HiddenCollectedTicket[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, HiddenCollectedTicket>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const ticketNumber = "ticketNumber" in item ? item.ticketNumber : undefined;
    const collectionRevision = "collectionRevision" in item ? item.collectionRevision : undefined;
    if (typeof ticketNumber === "string" && ticketNumber && typeof collectionRevision === "string") {
      unique.set(`${ticketNumber}\u0000${collectionRevision}`, { ticketNumber, collectionRevision });
    }
  }
  return [...unique.values()];
}

export function collectedTicketRevision(ticket: ManifestVisibilityTicket): string {
  return ticket.collectionRevision || "";
}

export function isCollectedTicketHidden(ticket: ManifestVisibilityTicket, hidden: HiddenCollectedTicket[]): boolean {
  const revision = collectedTicketRevision(ticket);
  return hidden.some((item) => item.ticketNumber === ticket.ticketNumber && item.collectionRevision === revision);
}

export function migrateLegacyTicketVisibility(value: unknown, manifestTickets: ManifestVisibilityTicket[]): TicketVisibilitySettings {
  const legacyNumbers = resolveHiddenDefaultTicketNumbers(value, manifestTickets.map((ticket) => ticket.ticketNumber));
  const legacySet = new Set(legacyNumbers);
  const sampleTickets = manifestTickets.filter((ticket) => ticket.fictionalSample === true);
  const hiddenSampleTicketNumbers = sampleTickets.filter((ticket) => legacySet.has(ticket.ticketNumber)).map((ticket) => ticket.ticketNumber);
  const allSamplesHidden = sampleTickets.length > 0 && hiddenSampleTicketNumbers.length === sampleTickets.length;
  return {
    samplesVisible: !allSamplesHidden,
    hiddenSampleTicketNumbers: allSamplesHidden ? [] : hiddenSampleTicketNumbers,
    hiddenCollectedTickets: manifestTickets
      .filter((ticket) => ticket.fictionalSample !== true && legacySet.has(ticket.ticketNumber))
      .map((ticket) => ({ ticketNumber: ticket.ticketNumber, collectionRevision: collectedTicketRevision(ticket) })),
  };
}

export async function saveTicketVisibilitySettings(settings: TicketVisibilitySettings): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    store.put({ key: SAMPLES_VISIBLE_KEY, value: settings.samplesVisible });
    store.put({ key: HIDDEN_SAMPLE_TICKET_NUMBERS_KEY, value: resolveHiddenDefaultTicketNumbers(settings.hiddenSampleTicketNumbers, []) });
    store.put({ key: HIDDEN_COLLECTED_TICKETS_KEY, value: normalizeHiddenCollectedTickets(settings.hiddenCollectedTickets) });
    store.delete(DEFAULT_TICKETS_HIDDEN_KEY);
    store.delete(HIDDEN_DEFAULT_TICKET_NUMBERS_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function readTicketVisibilitySettings(manifestTickets: ManifestVisibilityTicket[]): Promise<TicketVisibilitySettings> {
  const database = await openDatabase();
  const records = await new Promise<Record<string, { value?: unknown } | undefined>>((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
    const store = transaction.objectStore(SETTINGS_STORE_NAME);
    const keys = [SAMPLES_VISIBLE_KEY, HIDDEN_SAMPLE_TICKET_NUMBERS_KEY, HIDDEN_COLLECTED_TICKETS_KEY, HIDDEN_DEFAULT_TICKET_NUMBERS_KEY, DEFAULT_TICKETS_HIDDEN_KEY];
    const result: Record<string, { value?: unknown } | undefined> = {};
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => { result[key] = request.result; };
      request.onerror = () => reject(request.error);
    }
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => { database.close(); resolve(result); };
  });
  const hasCurrentSettings = records[SAMPLES_VISIBLE_KEY] || records[HIDDEN_SAMPLE_TICKET_NUMBERS_KEY] || records[HIDDEN_COLLECTED_TICKETS_KEY];
  if (hasCurrentSettings) {
    return {
      samplesVisible: records[SAMPLES_VISIBLE_KEY]?.value !== false,
      hiddenSampleTicketNumbers: resolveHiddenDefaultTicketNumbers(records[HIDDEN_SAMPLE_TICKET_NUMBERS_KEY]?.value, []),
      hiddenCollectedTickets: normalizeHiddenCollectedTickets(records[HIDDEN_COLLECTED_TICKETS_KEY]?.value),
    };
  }

  const settings = migrateLegacyTicketVisibility(
    records[HIDDEN_DEFAULT_TICKET_NUMBERS_KEY]?.value ?? records[DEFAULT_TICKETS_HIDDEN_KEY]?.value,
    manifestTickets,
  );
  await saveTicketVisibilitySettings(settings);
  return settings;
}

export async function clearUserTickets(settings: TicketVisibilitySettings): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SETTINGS_STORE_NAME], "readwrite");
    const ticketStore = transaction.objectStore(STORE_NAME);
    const cursorRequest = ticketStore.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const ticket = cursor.value as StoredTicket;
      if (ticket.fictionalSample !== true) cursor.delete();
      cursor.continue();
    };
    const settingStore = transaction.objectStore(SETTINGS_STORE_NAME);
    settingStore.put({ key: SAMPLES_VISIBLE_KEY, value: settings.samplesVisible });
    settingStore.put({ key: HIDDEN_SAMPLE_TICKET_NUMBERS_KEY, value: resolveHiddenDefaultTicketNumbers(settings.hiddenSampleTicketNumbers, []) });
    settingStore.put({ key: HIDDEN_COLLECTED_TICKETS_KEY, value: normalizeHiddenCollectedTickets(settings.hiddenCollectedTickets) });
    settingStore.delete(DEFAULT_TICKETS_HIDDEN_KEY);
    settingStore.delete(HIDDEN_DEFAULT_TICKET_NUMBERS_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

type TicketJson = {
  schemaVersion?: number;
  ticketNumber?: string;
  kind?: "past" | "universe";
  title?: string;
  place?: string;
  note?: string;
  createdAt?: string;
  time?: { mode?: string; display?: string; raw?: string };
  design?: { shapeStyle?: TicketShape };
  fictionalSample?: boolean;
};

type TicketShape = "intermission-stub" | "film-edge" | "chapter-pass";
type RejectedTicket = { file: string; reason: string };

const TICKET_SHAPES = new Set<TicketShape>(["intermission-stub", "film-edge", "chapter-pass"]);

export function shapeFromDimensions(width: number, height: number): TicketShape | null {
  if (!(width > 0 && height > 0)) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 3) <= 0.16) return "intermission-stub";
  if (Math.abs(ratio - 2.5) <= 0.16) return "film-edge";
  if (Math.abs(ratio - 0.8) <= 0.08) return "chapter-pass";
  return null;
}

export function shapeAllowedForKind(kind: "past" | "universe", shape: TicketShape): boolean {
  return kind === "universe" || shape !== "chapter-pass";
}

async function readPngShape(file: File): Promise<TicketShape | null> {
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return shapeFromDimensions(view.getUint32(16), view.getUint32(20));
}

function ticketSortKey(data: TicketJson) {
  if (data.kind !== "past") return data.createdAt || "9999-12-31T23:59:59Z";
  const display = data.time?.display || data.time?.raw || "";
  const year = display.match(/\d{4}/)?.[0] || "9999";
  const month = display.match(/\d{4}[.\-/年](\d{1,2})/)?.[1]?.padStart(2, "0");
  const day = display.match(/\d{4}[.\-/年]\d{1,2}[.\-/月](\d{1,2})/)?.[1]?.padStart(2, "0");
  const seasonMonth = display.includes("春") ? "03" : display.includes("夏") ? "06" : display.includes("秋") ? "09" : display.includes("冬") ? "12" : "12";
  return `${year}-${month || seasonMonth}-${day || "31"}-${data.createdAt || ""}`;
}

function stem(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function ticketStem(name: string) {
  return stem(name).replace(/-(main|preview)$/i, "");
}

function chooseImage(ticketNumber: string, images: File[]) {
  const candidates = images.filter((file) => ticketStem(file.name) === ticketNumber);
  return candidates.sort((a, b) => {
    const score = (file: File) => stem(file.name) === ticketNumber ? 0 : /-preview$/i.test(stem(file.name)) ? 1 : 2;
    return score(a) - score(b);
  })[0];
}

export async function parseTicketFiles(files: File[]): Promise<{ tickets: StoredTicket[]; skipped: number; rejected: RejectedTicket[] }> {
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));
  const imageFiles = files.filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
  const tickets: StoredTicket[] = [];
  const pairedImages = new Set<string>();
  const matchedImages = new Set<string>();
  const rejected: RejectedTicket[] = [];
  let skipped = files.length - jsonFiles.length - imageFiles.length;

  for (const file of jsonFiles) {
    try {
      const rawText = await file.text();
      const data = JSON.parse(rawText) as TicketJson;
      if (data.schemaVersion !== 1 || !data.ticketNumber || (data.kind !== "past" && data.kind !== "universe") || !data.title) {
        skipped += 1;
        rejected.push({ file: file.name, reason: "JSON 结构无效" });
        continue;
      }
      const image = chooseImage(data.ticketNumber, imageFiles);
      if (!image) {
        skipped += 1;
        rejected.push({ file: file.name, reason: "缺少同名 PNG" });
        continue;
      }
      matchedImages.add(image.name);
      const declaredShape = data.design?.shapeStyle;
      if (declaredShape !== undefined && !TICKET_SHAPES.has(declaredShape)) {
        skipped += 1;
        rejected.push({ file: file.name, reason: "JSON 中的票型未知" });
        continue;
      }
      const imageShape = await readPngShape(image);
      if (!imageShape) {
        skipped += 1;
        rejected.push({ file: image.name, reason: "PNG 尺寸不属于标准票型" });
        continue;
      }
      if (declaredShape && declaredShape !== imageShape) {
        skipped += 1;
        rejected.push({ file: file.name, reason: "JSON 票型与 PNG 尺寸不一致" });
        continue;
      }
      const shape = declaredShape || imageShape;
      if (!shapeAllowedForKind(data.kind, shape)) {
        skipped += 1;
        rejected.push({ file: file.name, reason: "过去篇仅接受幕间长票或胶片齿票" });
        continue;
      }
      pairedImages.add(image.name);
      tickets.push({
        ticketNumber: data.ticketNumber,
        kind: data.kind,
        title: data.title,
        date: data.time?.display || data.time?.raw || "日期未题",
        place: data.place || "地点未题",
        note: data.note || "",
        createdAt: data.createdAt || new Date().toISOString(),
        sortKey: ticketSortKey(data),
        image,
        rawJson: new Blob([rawText], { type: "application/json" }),
        fictionalSample: data.fictionalSample === true,
      });
    } catch {
      skipped += 1;
      rejected.push({ file: file.name, reason: "JSON 无法读取" });
    }
  }

  for (const image of imageFiles) {
    if (pairedImages.has(image.name) || matchedImages.has(image.name)) continue;
    const ticketNumber = ticketStem(image.name);
    if (tickets.some((ticket) => ticket.ticketNumber === ticketNumber)) continue;
    const type = /^LT-U-/i.test(ticketNumber) ? "universe" : /^LT-P-/i.test(ticketNumber) ? "past" : null;
    if (!type) {
      skipped += 1;
      rejected.push({ file: image.name, reason: "无法从票号判断过去或未来" });
      continue;
    }
    const shape = await readPngShape(image);
    if (!shape) {
      skipped += 1;
      rejected.push({ file: image.name, reason: "PNG 尺寸不属于标准票型" });
      continue;
    }
    if (!shapeAllowedForKind(type, shape)) {
      skipped += 1;
      rejected.push({ file: image.name, reason: "过去篇仅接受幕间长票或胶片齿票" });
      continue;
    }
    tickets.push({
      ticketNumber,
      kind: type,
      title: "未题票根",
      date: type === "universe" ? "宇宙时区" : "日期未题",
      place: "地点未题",
      note: "",
      createdAt: new Date().toISOString(),
      sortKey: new Date().toISOString(),
      image,
      fictionalSample: false,
    });
  }

  return { tickets, skipped, rejected };
}

export function reconstructStoredTicketJson(ticket: StoredTicket): string {
  const timeMode = ticket.kind === "universe"
    ? (ticket.date === "宇宙时区" ? "cosmic" : "custom")
    : "unknown";
  const data: Record<string, unknown> = {
    schemaVersion: 1,
    ticketNumber: ticket.ticketNumber,
    kind: ticket.kind,
    status: ticket.kind === "past" ? "ended" : "ordered",
    title: ticket.title,
    scene: ticket.title,
    time: { mode: timeMode, raw: ticket.date, display: ticket.date },
    place: ticket.place,
    createdAt: ticket.createdAt,
    export: { reconstructed: true },
  };
  if (ticket.fictionalSample === true) data.fictionalSample = true;
  if (ticket.note) data.note = ticket.note;
  return JSON.stringify(data, null, 2) + "\n";
}
