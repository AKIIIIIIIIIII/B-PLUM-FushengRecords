export type Chapter = "past" | "future";

export type Ticket = {
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
  fictionalSample?: boolean;
  collectionRevision?: string;
  source?: "manifest" | "browser";
};

export type AlbumContact = {
  label: string;
  detail: string;
  url: string;
  actionLabel?: string;
  supportUrl?: string;
  qrImageUrl?: string;
  qrLabel?: string;
};

export type AlbumManifest = {
  title: string;
  subtitle: string;
  edition: string;
  contact?: AlbumContact;
  tickets: Array<Omit<Ticket, "id" | "kind" | "source"> & { ticketNumber: string; kind: "past" | "universe" }>;
};

export const defaultManifest: AlbumManifest = {
  title: "浮生录",
  subtitle: "人生票根藏本",
  edition: "私藏本",
  tickets: [],
};
