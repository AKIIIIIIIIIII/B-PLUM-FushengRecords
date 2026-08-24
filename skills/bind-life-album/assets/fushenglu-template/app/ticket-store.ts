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
};

const DATABASE_NAME = "fushenglu-local-album";
const STORE_NAME = "tickets";
const SETTINGS_STORE_NAME = "settings";
const DEFAULT_TICKETS_HIDDEN_KEY = "defaultTicketsHidden";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 3);
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

export async function readDefaultTicketsHidden(): Promise<boolean> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, "readonly");
    const request = transaction.objectStore(SETTINGS_STORE_NAME).get(DEFAULT_TICKETS_HIDDEN_KEY);
    request.onsuccess = () => resolve(request.result?.value === true);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function clearAllTickets(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SETTINGS_STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.objectStore(SETTINGS_STORE_NAME).put({ key: DEFAULT_TICKETS_HIDDEN_KEY, value: true });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function restoreDefaultTickets(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");
    transaction.objectStore(SETTINGS_STORE_NAME).put({ key: DEFAULT_TICKETS_HIDDEN_KEY, value: false });
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
};

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

export async function parseTicketFiles(files: File[]): Promise<{ tickets: StoredTicket[]; skipped: number }> {
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));
  const imageFiles = files.filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
  const tickets: StoredTicket[] = [];
  const pairedImages = new Set<string>();
  let skipped = files.length - jsonFiles.length - imageFiles.length;

  for (const file of jsonFiles) {
    try {
      const rawText = await file.text();
      const data = JSON.parse(rawText) as TicketJson;
      if (data.schemaVersion !== 1 || !data.ticketNumber || !data.kind || !data.title) {
        skipped += 1;
        continue;
      }
      const image = chooseImage(data.ticketNumber, imageFiles);
      if (image) pairedImages.add(image.name);
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
      });
    } catch {
      skipped += 1;
    }
  }

  for (const image of imageFiles) {
    if (pairedImages.has(image.name)) continue;
    const ticketNumber = ticketStem(image.name);
    if (tickets.some((ticket) => ticket.ticketNumber === ticketNumber)) continue;
    const type = /^LT-U-/i.test(ticketNumber) ? "universe" : /^LT-P-/i.test(ticketNumber) ? "past" : null;
    if (!type) {
      skipped += 1;
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
    });
  }

  return { tickets, skipped };
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
  if (ticket.note) data.note = ticket.note;
  return JSON.stringify(data, null, 2) + "\n";
}
